SET LOCAL ROLE sim_guru_owner;

CREATE FUNCTION auth_private.maintenance_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT coalesce((SELECT typed_value='true'::jsonb FROM app.system_settings WHERE key='maintenance.enabled'),false) $$;

-- Counter IP pada fixed bucket 15 menit; account failure memakai satu state bergulir.
CREATE FUNCTION auth_private.consume_login_source(p_key text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE n integer; start_at timestamptz:=date_bin(interval '15 minutes',clock_timestamp(),'2000-01-01'::timestamptz); BEGIN
 IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_RATE_KEY'; END IF;
 INSERT INTO auth_private.auth_rate_limits(scope,key_hash,window_start,count) VALUES('login_ip',p_key,start_at,1)
 ON CONFLICT(scope,key_hash,window_start) DO UPDATE SET count=least(auth_private.auth_rate_limits.count+1,31) RETURNING count INTO n;
 IF n>30 THEN RETURN greatest(1,ceil(extract(epoch FROM start_at+interval '15 minutes'-clock_timestamp()))::integer); END IF;
 RETURN 0;
END $$;

-- Lock ditahan transaksi auth selama verifikasi Argon2 agar paralel tidak melewati batas akun.
CREATE FUNCTION auth_private.finish_login_attempt(p_key text,p_success boolean,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE failures integer; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('sim-guru:login:'||p_key,0));
 IF p_success THEN DELETE FROM auth_private.auth_rate_limits WHERE scope='login_account' AND key_hash=p_key; RETURN; END IF;
 -- blocked_until juga menyimpan akhir window untuk kegagalan 1-4; hanya count>=5 memblokir.
 INSERT INTO auth_private.auth_rate_limits(scope,key_hash,window_start,count,blocked_until)
 VALUES('login_account',p_key,'epoch'::timestamptz,1,clock_timestamp()+interval '15 minutes')
 ON CONFLICT(scope,key_hash,window_start) DO UPDATE SET
 count=CASE WHEN auth_private.auth_rate_limits.blocked_until<=clock_timestamp() THEN 1 ELSE least(auth_private.auth_rate_limits.count+1,5) END,
 blocked_until=CASE WHEN auth_private.auth_rate_limits.blocked_until<=clock_timestamp() OR auth_private.auth_rate_limits.count>=4 THEN clock_timestamp()+interval '15 minutes' ELSE auth_private.auth_rate_limits.blocked_until END
 RETURNING count INTO failures;
 INSERT INTO ops.audit_logs(request_id,action,redacted_changes) VALUES(p_request,'auth.login_failed',jsonb_build_object('limited',failures>=5));
END $$;
-- Jangan menganggap window belum habis sebagai cooldown sebelum lima gagal.
CREATE FUNCTION auth_private.login_account_state(p_key text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE target auth_private.auth_rate_limits%ROWTYPE; BEGIN
 IF p_key IS NULL OR p_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_RATE_KEY'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sim-guru:login:'||p_key,0));
 SELECT * INTO target FROM auth_private.auth_rate_limits WHERE scope='login_account' AND key_hash=p_key AND window_start='epoch'::timestamptz FOR UPDATE;
 IF target.count>=5 AND target.blocked_until>clock_timestamp() THEN RETURN greatest(1,ceil(extract(epoch FROM target.blocked_until-clock_timestamp()))::integer); END IF;
 IF target.blocked_until<=clock_timestamp() THEN DELETE FROM auth_private.auth_rate_limits WHERE scope='login_account' AND key_hash=p_key; END IF;
 RETURN 0;
END $$;

CREATE FUNCTION auth_private.login_profile(p_user uuid)
RETURNS TABLE(full_name text,ready boolean,maintenance boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT u.full_name,auth_private.onboarding_ready(u.id),auth_private.maintenance_enabled() AND u.role<>'admin' FROM app.app_users u WHERE u.id=p_user $$;
CREATE FUNCTION auth_private.session_snapshot(p_digest text,p_touch boolean)
RETURNS TABLE(session_id uuid,user_id uuid,username text,full_name text,role text,scope text,expires_at timestamptz,idle_expires_at timestamptz,must_change_password boolean,email_verified boolean,security_question_ready boolean,maintenance boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ BEGIN
 IF p_touch AND NOT auth_private.touch_session(p_digest) THEN RETURN; END IF;
 RETURN QUERY SELECT s.session_id,s.user_id,u.username,u.full_name,s.role,s.scope,s.expires_at,s.idle_expires_at,u.must_change_password,u.email_verified_at IS NOT NULL,
 EXISTS(SELECT 1 FROM auth_private.security_questions q WHERE q.user_id=u.id),auth_private.maintenance_enabled()
 FROM auth_private.read_session(p_digest) s JOIN app.app_users u ON u.id=s.user_id;
END $$;
CREATE FUNCTION auth_private.logout_with_audit(p_digest text,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE target uuid; BEGIN
 UPDATE auth_private.app_sessions SET revoked_at=clock_timestamp() WHERE token_hash=p_digest AND revoked_at IS NULL RETURNING user_id INTO target;
 IF target IS NOT NULL THEN INSERT INTO ops.audit_logs(request_id,actor_id,action,entity_id) VALUES(p_request,target,'auth.logout',target); END IF;
END $$;
CREATE FUNCTION auth_private.audit_login_success(p_user uuid,p_request uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog
AS $$ INSERT INTO ops.audit_logs(request_id,actor_id,action,entity_id) VALUES(p_request,p_user,'auth.login_succeeded',p_user) $$;
GRANT EXECUTE ON FUNCTION auth_private.consume_login_source(text),auth_private.login_account_state(text),auth_private.finish_login_attempt(text,boolean,uuid),auth_private.login_profile(uuid),auth_private.session_snapshot(text,boolean),auth_private.logout_with_audit(text,uuid),auth_private.audit_login_success(uuid,uuid) TO sim_guru_auth;
CREATE OR REPLACE FUNCTION auth_private.resolve_actor(require_business boolean) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$
DECLARE actor uuid; session_ref uuid; token_digest text; trace uuid; result_id uuid;
BEGIN
 BEGIN
   actor := nullif(pg_catalog.current_setting('app.actor_id',true),'')::uuid;
   session_ref := nullif(pg_catalog.current_setting('app.session_id',true),'')::uuid;
   trace := nullif(pg_catalog.current_setting('app.request_id',true),'')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
 END;
 token_digest := pg_catalog.current_setting('app.session_token_hash',true);
 IF actor IS NULL OR session_ref IS NULL OR trace IS NULL OR token_digest IS NULL OR token_digest !~ '^[a-f0-9]{64}$' THEN RETURN NULL; END IF;
 SELECT u.id INTO result_id FROM app.app_users u JOIN auth_private.app_sessions s ON s.user_id=u.id
 WHERE u.id=actor AND s.id=session_ref AND s.token_hash=token_digest
 AND u.status='active' AND s.revoked_at IS NULL AND s.auth_version_at_issue=u.auth_version
 AND s.expires_at>pg_catalog.statement_timestamp() AND s.idle_expires_at>pg_catalog.statement_timestamp()
 AND (NOT require_business OR (s.scope='business' AND auth_private.onboarding_ready(u.id) AND (u.role='admin' OR NOT auth_private.maintenance_enabled())));
 RETURN result_id;
END $$;

RESET ROLE;
