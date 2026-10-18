SET LOCAL ROLE sim_guru_owner;

CREATE FUNCTION auth_private.onboarding_ready(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT EXISTS(SELECT 1 FROM app.app_users u JOIN auth_private.user_credentials c ON c.user_id=u.id
 WHERE u.id=p_user_id AND u.status='active' AND NOT u.must_change_password AND u.email_verified_at IS NOT NULL
 AND c.temporary_expires_at IS NULL AND EXISTS(SELECT 1 FROM auth_private.security_questions q WHERE q.user_id=u.id)) $$;

-- Token hash context adalah data sensitif server; UUID actor/session saja tidak cukup.
CREATE FUNCTION auth_private.resolve_actor(require_business boolean) RETURNS uuid
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
 AND (NOT require_business OR (s.scope='business' AND auth_private.onboarding_ready(u.id)));
 RETURN result_id;
END $$;
CREATE FUNCTION app.actor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT auth_private.resolve_actor(true) $$;
CREATE FUNCTION app.actor_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT EXISTS(SELECT 1 FROM app.app_users WHERE id=auth_private.resolve_actor(true) AND role='admin') $$;
CREATE FUNCTION auth_private.require_admin() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE actor uuid; BEGIN actor:=auth_private.resolve_actor(true);
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=actor AND role='admin') THEN
  RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF; RETURN actor; END $$;

CREATE FUNCTION auth_private.lookup_credentials(p_username text)
RETURNS TABLE(user_id uuid,username text,password_hash text,auth_version bigint,credential_version bigint,status text,must_change_password boolean,temporary_expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT u.id,u.username,c.password_hash,u.auth_version,c.credential_version,u.status,u.must_change_password,c.temporary_expires_at
 FROM app.app_users u JOIN auth_private.user_credentials c ON c.user_id=u.id WHERE lower(u.username)=lower(btrim(p_username)) $$;

-- Auth service yang terisolasi wajib memverifikasi password di Node sebelum memanggil routine ini.
-- Fingerprint/version hanya CAS anti-race; bukan pengganti verifikasi password/rate limit pada 1.4.
CREATE FUNCTION auth_private.issue_session(p_user_id uuid,p_expected_hash text,p_credential_version bigint,p_auth_version bigint,p_token_hash text,p_scope text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE u app.app_users%ROWTYPE; c auth_private.user_credentials%ROWTYPE; session_ref uuid; now_at timestamptz:=pg_catalog.clock_timestamp(); BEGIN
 SELECT * INTO u FROM app.app_users WHERE id=p_user_id FOR UPDATE;
 SELECT * INTO c FROM auth_private.user_credentials WHERE user_id=p_user_id FOR UPDATE;
 IF u.id IS NULL OR c.user_id IS NULL OR u.status<>'active' OR c.password_hash IS DISTINCT FROM p_expected_hash
 OR c.credential_version IS DISTINCT FROM p_credential_version OR u.auth_version IS DISTINCT FROM p_auth_version
 OR (c.temporary_expires_at IS NOT NULL AND c.temporary_expires_at<=now_at) THEN RAISE EXCEPTION 'INVALID_CREDENTIALS' USING ERRCODE='42501'; END IF;
 IF p_scope NOT IN ('onboarding','business') OR p_scope IS NULL OR (p_scope='business' AND NOT auth_private.onboarding_ready(u.id)) THEN
 RAISE EXCEPTION 'ONBOARDING_REQUIRED' USING ERRCODE='42501'; END IF;
 INSERT INTO auth_private.app_sessions(token_hash,user_id,auth_version_at_issue,scope,issued_at,expires_at,idle_expires_at,last_activity_at)
 VALUES(p_token_hash,u.id,u.auth_version,p_scope,now_at,now_at+interval '24 hours',now_at+interval '2 hours',now_at) RETURNING id INTO session_ref;
 RETURN session_ref;
END $$;

CREATE FUNCTION auth_private.read_session(p_token_hash text)
RETURNS TABLE(session_id uuid,user_id uuid,role text,scope text,auth_version bigint,expires_at timestamptz,idle_expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT s.id,u.id,u.role,s.scope,u.auth_version,s.expires_at,s.idle_expires_at
 FROM auth_private.app_sessions s JOIN app.app_users u ON u.id=s.user_id
 WHERE s.token_hash=p_token_hash AND u.status='active' AND s.revoked_at IS NULL AND s.auth_version_at_issue=u.auth_version
 AND s.expires_at>pg_catalog.statement_timestamp() AND s.idle_expires_at>pg_catalog.statement_timestamp()
 AND (s.scope='onboarding' OR auth_private.onboarding_ready(u.id)) $$;
CREATE FUNCTION auth_private.touch_session(p_token_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE touched uuid; BEGIN
 UPDATE auth_private.app_sessions s SET last_activity_at=pg_catalog.clock_timestamp(),idle_expires_at=least(s.expires_at,pg_catalog.clock_timestamp()+interval '2 hours')
 WHERE s.token_hash=p_token_hash AND s.revoked_at IS NULL AND s.expires_at>pg_catalog.clock_timestamp() AND s.idle_expires_at>pg_catalog.clock_timestamp()
 AND EXISTS(SELECT 1 FROM app.app_users u WHERE u.id=s.user_id AND u.status='active' AND u.auth_version=s.auth_version_at_issue)
 RETURNING s.id INTO touched;
 RETURN touched IS NOT NULL; END $$;
CREATE FUNCTION auth_private.revoke_session(p_token_hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog
AS $$ UPDATE auth_private.app_sessions SET revoked_at=pg_catalog.clock_timestamp() WHERE token_hash=p_token_hash AND revoked_at IS NULL $$;

CREATE FUNCTION auth_private.create_account(p_username text,p_full_name text,p_role text,p_temporary_hash text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE actor uuid; new_id uuid; BEGIN
 actor:=auth_private.require_admin();
 INSERT INTO app.app_users(username,full_name,role,status,must_change_password)
 VALUES(btrim(p_username),p_full_name,p_role,CASE WHEN p_temporary_hash IS NULL THEN 'pending_activation' ELSE 'active' END,true) RETURNING id INTO new_id;
 IF p_temporary_hash IS NOT NULL THEN
 INSERT INTO auth_private.user_credentials(user_id,password_hash,temporary_expires_at) VALUES(new_id,p_temporary_hash,pg_catalog.clock_timestamp()+interval '24 hours');
 END IF;
 INSERT INTO ops.audit_logs(request_id,actor_id,action,entity_id,redacted_changes)
 VALUES(nullif(pg_catalog.current_setting('app.request_id',true),'')::uuid,actor,'account.created',new_id,pg_catalog.jsonb_build_object('role',p_role));
 RETURN new_id;
END $$;

CREATE FUNCTION auth_private.set_password_after_verification(p_target_id uuid,p_new_hash text,p_expected_credential_version bigint,p_expected_old_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE actor uuid; c auth_private.user_credentials%ROWTYPE; is_admin boolean; BEGIN
 actor:=auth_private.resolve_actor(false);
 is_admin:=app.actor_is_admin();
 IF actor IS NULL OR (actor<>p_target_id AND NOT is_admin) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM app.app_users WHERE id=p_target_id FOR UPDATE;
 SELECT * INTO c FROM auth_private.user_credentials WHERE user_id=p_target_id FOR UPDATE;
 IF c.user_id IS NULL OR c.credential_version IS DISTINCT FROM p_expected_credential_version OR c.password_hash IS DISTINCT FROM p_expected_old_hash THEN
 RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF c.password_hash=p_new_hash THEN RAISE EXCEPTION 'PASSWORD_REUSE' USING ERRCODE='22023'; END IF;
 UPDATE auth_private.user_credentials SET password_hash=p_new_hash,credential_version=credential_version+1,password_changed_at=pg_catalog.clock_timestamp(),temporary_expires_at=CASE WHEN actor<>p_target_id THEN pg_catalog.clock_timestamp()+interval '24 hours' ELSE NULL END WHERE user_id=p_target_id;
 UPDATE app.app_users SET auth_version=auth_version+1,version=version+1,must_change_password=(actor<>p_target_id),updated_at=pg_catalog.clock_timestamp() WHERE id=p_target_id;
 UPDATE auth_private.app_sessions SET revoked_at=pg_catalog.clock_timestamp() WHERE user_id=p_target_id AND revoked_at IS NULL;
 UPDATE auth_private.verification_challenges SET superseded_at=pg_catalog.clock_timestamp() WHERE user_id=p_target_id AND consumed_at IS NULL AND superseded_at IS NULL;
 INSERT INTO ops.audit_logs(request_id,actor_id,action,entity_id) VALUES(nullif(pg_catalog.current_setting('app.request_id',true),'')::uuid,actor,'account.password_changed',p_target_id);
END $$;

CREATE FUNCTION auth_private.set_account_status(p_target_id uuid,p_status text,p_expected_version bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE actor uuid; target app.app_users%ROWTYPE; BEGIN
 actor:=auth_private.require_admin();
 PERFORM pg_catalog.pg_advisory_xact_lock(734190,1);
 SELECT * INTO target FROM app.app_users WHERE id=p_target_id FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF target.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('active','disabled','archived') OR target.status='pending_activation' OR target.status='archived' THEN
 RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE='22023'; END IF;
 IF target.role='admin' AND target.status='active' AND p_status<>'active'
 AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE role='admin' AND status='active' AND id<>target.id) THEN
 RAISE EXCEPTION 'LAST_ACTIVE_ADMIN' USING ERRCODE='42501'; END IF;
 UPDATE app.app_users SET status=p_status,auth_version=auth_version+1,version=version+1,updated_at=pg_catalog.clock_timestamp() WHERE id=p_target_id;
 UPDATE auth_private.app_sessions SET revoked_at=pg_catalog.clock_timestamp() WHERE user_id=p_target_id AND revoked_at IS NULL;
 UPDATE auth_private.verification_challenges SET superseded_at=pg_catalog.clock_timestamp() WHERE user_id=p_target_id AND consumed_at IS NULL AND superseded_at IS NULL;
 INSERT INTO ops.audit_logs(request_id,actor_id,action,entity_id,redacted_changes) VALUES(nullif(pg_catalog.current_setting('app.request_id',true),'')::uuid,actor,'account.status_changed',p_target_id,pg_catalog.jsonb_build_object('status',p_status));
END $$;

-- Routine bootstrap hanya group NOLOGIN terpisah; bukan permission sim_guru_auth.
CREATE FUNCTION auth_private.bootstrap_admin(p_username text,p_full_name text,p_temporary_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE target uuid; BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(734190,1);
 SELECT id INTO target FROM app.app_users WHERE lower(username)=lower(btrim(p_username)) AND role='admin';
 IF target IS NOT NULL THEN RETURN target; END IF;
 IF EXISTS(SELECT 1 FROM app.app_users WHERE role='admin') THEN RAISE EXCEPTION 'BOOTSTRAP_ALREADY_INITIALIZED' USING ERRCODE='42501'; END IF;
 INSERT INTO app.app_users(username,full_name,role,status,must_change_password) VALUES(btrim(p_username),p_full_name,'admin','active',true) RETURNING id INTO target;
 INSERT INTO auth_private.user_credentials(user_id,password_hash,temporary_expires_at) VALUES(target,p_temporary_hash,pg_catalog.clock_timestamp()+interval '24 hours');
 INSERT INTO ops.audit_logs(action,entity_id) VALUES('account.bootstrap_created',target);
 RETURN target;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app,auth_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.actor_id(),app.actor_is_admin() TO sim_guru_business;
GRANT EXECUTE ON FUNCTION auth_private.lookup_credentials(text),auth_private.issue_session(uuid,text,bigint,bigint,text,text),auth_private.read_session(text),auth_private.touch_session(text),auth_private.revoke_session(text),auth_private.create_account(text,text,text,text),auth_private.set_password_after_verification(uuid,text,bigint,text),auth_private.set_account_status(uuid,text,bigint) TO sim_guru_auth;
GRANT EXECUTE ON FUNCTION auth_private.bootstrap_admin(text,text,text) TO sim_guru_bootstrap;

GRANT SELECT(id,username,full_name,nip,role,status,auth_version,must_change_password,contact_email,email_verified_at,phone,photo_path,address,employment_status,rank,km_distance,additional_role,version,created_at,updated_at) ON app.app_users TO sim_guru_business;
CREATE POLICY profile_read ON app.app_users FOR SELECT TO sim_guru_business USING(id=app.actor_id() OR app.actor_is_admin());
GRANT SELECT ON app.system_settings TO sim_guru_business;
CREATE POLICY settings_admin_read ON app.system_settings FOR SELECT TO sim_guru_business USING(app.actor_is_admin());
GRANT SELECT ON ops.audit_logs TO sim_guru_business;
CREATE POLICY audit_admin_read ON ops.audit_logs FOR SELECT TO sim_guru_business USING(app.actor_is_admin());
-- Tidak memberi table CRUD kepada auth atau business; penulisan lewat routine khusus.
RESET ROLE;
