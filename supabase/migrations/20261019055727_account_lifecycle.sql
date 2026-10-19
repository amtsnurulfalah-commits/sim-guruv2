SET LOCAL ROLE sim_guru_owner;
-- Private definer routines implement local application identity. No Supabase Auth JWT is used.
ALTER TABLE ops.notification_outbox DROP CONSTRAINT notification_outbox_template_check;
ALTER TABLE ops.notification_outbox ADD CONSTRAINT notification_outbox_template_check CHECK(template IN ('account_activation','email_verify','reset_otp','password_changed'));
ALTER TABLE auth_private.outbox_secrets DROP CONSTRAINT outbox_secrets_ciphertext_check;
ALTER TABLE auth_private.outbox_secrets ADD CONSTRAINT outbox_secrets_ciphertext_check CHECK(octet_length(ciphertext) IN (6,43));
CREATE INDEX reset_requests_pending ON auth_private.password_reset_requests(user_id,created_at) WHERE status='pending';

CREATE FUNCTION auth_private.lifecycle_self(p_digest text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; s auth_private.app_sessions%ROWTYPE; BEGIN
 SELECT user_id INTO u FROM auth_private.app_sessions WHERE token_hash=p_digest;
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM app.app_users WHERE id=u FOR UPDATE;
 SELECT * INTO s FROM auth_private.app_sessions WHERE token_hash=p_digest FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM app.app_users a JOIN auth_private.user_credentials c ON c.user_id=a.id WHERE a.id=u AND a.status='active' AND a.auth_version=s.auth_version_at_issue AND (c.temporary_expires_at IS NULL OR c.temporary_expires_at>clock_timestamp()))
 OR s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp() OR s.idle_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE='42501'; END IF;
 PERFORM set_config('app.actor_id',u::text,true),set_config('app.session_id',s.id::text,true),set_config('app.session_token_hash',p_digest,true),set_config('app.request_id',gen_random_uuid()::text,true);
 RETURN u;
END $$;
CREATE FUNCTION auth_private.lifecycle_context(p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; result jsonb; BEGIN
 u:=auth_private.lifecycle_self(p_digest);
 SELECT jsonb_build_object('userId',a.id,'passwordHash',c.password_hash,'credentialVersion',c.credential_version::text,'answerHash',q.answer_hash,'profile',jsonb_build_object(
 'id',a.id,'username',a.username,'fullName',a.full_name,'nip',coalesce(a.nip,''),'phone',coalesce(a.phone,''),'address',coalesce(a.address,''),'photoUrl',coalesce(a.photo_path,''),'email',coalesce(a.contact_email,''),'emailVerified',a.email_verified_at IS NOT NULL,'question',coalesce(q.question,''),'version',a.version::text))
 INTO result FROM app.app_users a JOIN auth_private.user_credentials c ON c.user_id=a.id LEFT JOIN auth_private.security_questions q ON q.user_id=a.id WHERE a.id=u;
 RETURN result;
END $$;
-- Revoke and erase secret payloads in the same transaction as a sensitive account change.
CREATE FUNCTION auth_private.invalidate_account_security(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 UPDATE auth_private.app_sessions SET revoked_at=clock_timestamp() WHERE user_id=p_user AND revoked_at IS NULL;
 UPDATE auth_private.verification_challenges SET superseded_at=clock_timestamp() WHERE user_id=p_user AND consumed_at IS NULL AND superseded_at IS NULL;
 UPDATE ops.notification_outbox SET state='cancelled' WHERE recipient_id=p_user AND template<>'password_changed' AND state IN ('pending','retry_wait','sending','unknown');
 DELETE FROM auth_private.outbox_secrets WHERE outbox_id IN (SELECT id FROM ops.notification_outbox WHERE recipient_id=p_user);
END $$;
CREATE FUNCTION auth_private.password_notice(p_user uuid,p_app_url text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 INSERT INTO ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload)
 SELECT gen_random_uuid(),'password_changed:'||u.id||':'||u.auth_version,u.id,u.contact_email,'password_changed',jsonb_build_object('fullName',u.full_name,'username',u.username,'appUrl',p_app_url,'expiresAt',clock_timestamp()+interval '24 hours') FROM app.app_users u WHERE u.id=p_user AND u.email_verified_at IS NOT NULL $$;
CREATE FUNCTION auth_private.lifecycle_mutate(p_digest text,p_action text,p_data jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; BEGIN
 u:=auth_private.lifecycle_self(p_digest);
 IF p_action='profile' THEN
  UPDATE app.app_users SET username=p_data->>'username',full_name=p_data->>'fullName',nip=nullif(p_data->>'nip',''),phone=nullif(p_data->>'phone',''),address=nullif(p_data->>'address',''),photo_path=nullif(p_data->>'photoUrl',''),version=version+1,updated_at=clock_timestamp() WHERE id=u AND version=(p_data->>'version')::bigint;
  IF NOT FOUND THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 ELSIF p_action='question' THEN
  INSERT INTO auth_private.security_questions(user_id,question,answer_hash) VALUES(u,p_data->>'question',p_data->>'answerHash') ON CONFLICT(user_id) DO UPDATE SET question=excluded.question,answer_hash=excluded.answer_hash,normalization_version=1,updated_at=clock_timestamp();
 ELSIF p_action='password' THEN
  PERFORM auth_private.set_password_after_verification(u,p_data->>'newHash',(p_data->>'credentialVersion')::bigint,p_data->>'oldHash');
  PERFORM auth_private.invalidate_account_security(u);
  PERFORM auth_private.password_notice(u,p_data->>'appUrl');
 ELSE RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(u,'account.'||p_action||'_updated',u);
END $$;
CREATE FUNCTION auth_private.complete_onboarding(p_digest text,p_new_digest text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; c auth_private.user_credentials%ROWTYPE; v bigint; BEGIN
 u:=auth_private.lifecycle_self(p_digest);
 IF NOT auth_private.onboarding_ready(u) THEN RAISE EXCEPTION 'ONBOARDING_REQUIRED' USING ERRCODE='42501'; END IF;
 IF auth_private.maintenance_enabled() AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=u AND role='admin') THEN RAISE EXCEPTION 'MAINTENANCE' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM auth_private.user_credentials WHERE user_id=u;
 SELECT auth_version INTO v FROM app.app_users WHERE id=u;
 PERFORM auth_private.revoke_session(p_digest);
 PERFORM auth_private.issue_session(u,c.password_hash,c.credential_version,v,p_new_digest,'business');
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(u,'account.onboarding_completed',u);
END $$;
CREATE FUNCTION auth_private.consume_lifecycle_rate(p_scope text,p_key text,p_max integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n integer; start_at timestamptz:=date_bin(interval '15 minutes',clock_timestamp(),'2000-01-01'::timestamptz); BEGIN
 IF p_scope NOT IN ('lifecycle_ip','lifecycle_account') OR p_key !~ '^[a-f0-9]{64}$' OR p_max NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'INVALID_RATE_KEY'; END IF;
 INSERT INTO auth_private.auth_rate_limits(scope,key_hash,window_start,count) VALUES(p_scope,p_key,start_at,1) ON CONFLICT(scope,key_hash,window_start) DO UPDATE SET count=least(auth_private.auth_rate_limits.count+1,31) RETURNING count INTO n;
 RETURN CASE WHEN n>p_max THEN greatest(1,ceil(extract(epoch FROM start_at+interval '15 minutes'-clock_timestamp()))::integer) ELSE 0 END;
END $$;
CREATE FUNCTION auth_private.queue_security_otp(p_session text,p_username text,p_purpose text,p_email text,p_id uuid,p_digest text,p_outbox uuid,p_cipher text,p_nonce text,p_tag text,p_app_url text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target app.app_users%ROWTYPE; u uuid; expiry timestamptz:=clock_timestamp()+interval '10 minutes'; BEGIN
 IF p_purpose='email_verify' THEN
  u:=auth_private.lifecycle_self(p_session);
  SELECT * INTO target FROM app.app_users WHERE id=u FOR UPDATE;
 ELSIF p_purpose='reset_otp' THEN
  SELECT * INTO target FROM app.app_users WHERE lower(username)=lower(p_username) AND status='active' AND email_verified_at IS NOT NULL FOR UPDATE;
  IF target.id IS NULL THEN RETURN false; END IF;
  IF target.contact_email IS DISTINCT FROM p_email THEN RETURN false; END IF;
 ELSE RAISE EXCEPTION 'INVALID_PURPOSE'; END IF;
 IF p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'INVALID_EMAIL'; END IF;
 IF EXISTS(SELECT 1 FROM auth_private.verification_challenges WHERE user_id=target.id AND purpose=p_purpose AND created_at>clock_timestamp()-interval '60 seconds') THEN RETURN false; END IF;
 UPDATE auth_private.verification_challenges SET superseded_at=clock_timestamp() WHERE user_id=target.id AND purpose IN (p_purpose,CASE WHEN p_purpose='reset_otp' THEN 'reset_token' ELSE p_purpose END) AND consumed_at IS NULL AND superseded_at IS NULL;
 UPDATE ops.notification_outbox SET state='cancelled' WHERE recipient_id=target.id AND template=p_purpose AND state IN ('pending','retry_wait','sending','unknown');
 DELETE FROM auth_private.outbox_secrets WHERE outbox_id IN(SELECT id FROM ops.notification_outbox WHERE recipient_id=target.id AND template=p_purpose AND state='cancelled');
 INSERT INTO auth_private.verification_challenges(id,user_id,purpose,target_email,secret_digest,expires_at) VALUES(p_id,target.id,p_purpose,lower(p_email),p_digest,expiry);
 INSERT INTO ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload) VALUES(p_outbox,p_purpose||':'||p_id,target.id,lower(p_email),p_purpose,jsonb_build_object('fullName',target.full_name,'username',target.username,'appUrl',p_app_url,'expiresAt',expiry));
 INSERT INTO auth_private.outbox_secrets(outbox_id,challenge_id,ciphertext,nonce,auth_tag,encryption_key_version,expires_at) VALUES(p_outbox,p_id,decode(p_cipher,'hex'),decode(p_nonce,'hex'),decode(p_tag,'hex'),1,expiry);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(u,'account.'||p_purpose||'_queued',target.id);
 RETURN true;
END $$;
CREATE FUNCTION auth_private.otp_binding(p_id uuid,p_purpose text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('userId',c.user_id,'email',c.target_email) FROM auth_private.verification_challenges c WHERE c.id=p_id AND c.purpose=p_purpose $$;
CREATE FUNCTION auth_private.verify_security_otp(p_session text,p_id uuid,p_purpose text,p_digest text,p_reset_id uuid,p_reset_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c auth_private.verification_challenges%ROWTYPE; u uuid; target app.app_users%ROWTYPE; BEGIN
 SELECT user_id INTO u FROM auth_private.verification_challenges WHERE id=p_id;
 IF u IS NULL THEN RETURN false; END IF;
 SELECT * INTO target FROM app.app_users WHERE id=u FOR UPDATE;
 IF p_purpose='email_verify' AND auth_private.lifecycle_self(p_session)<>u THEN RETURN false; END IF;
 SELECT * INTO c FROM auth_private.verification_challenges WHERE id=p_id FOR UPDATE;
 IF p_purpose NOT IN ('email_verify','reset_otp') OR target.status<>'active' OR c.purpose<>p_purpose OR c.expires_at<=clock_timestamp() OR c.consumed_at IS NOT NULL OR c.superseded_at IS NOT NULL OR c.attempts>=c.max_attempts THEN RETURN false; END IF;
 IF p_purpose='reset_otp' AND (target.email_verified_at IS NULL OR target.contact_email IS DISTINCT FROM c.target_email) THEN RETURN false; END IF;
 IF c.secret_digest IS DISTINCT FROM p_digest THEN UPDATE auth_private.verification_challenges SET attempts=attempts+1 WHERE id=c.id; RETURN false; END IF;
 IF p_purpose='email_verify' THEN
  IF EXISTS(SELECT 1 FROM app.app_users WHERE lower(contact_email)=lower(c.target_email) AND email_verified_at IS NOT NULL AND id<>u) THEN RETURN false; END IF;
  UPDATE app.app_users SET contact_email=c.target_email,email_verified_at=clock_timestamp(),auth_version=auth_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=u;
  PERFORM auth_private.invalidate_account_security(u);
 ELSE
  UPDATE auth_private.verification_challenges SET superseded_at=clock_timestamp() WHERE user_id=u AND purpose='reset_token' AND consumed_at IS NULL AND superseded_at IS NULL;
  INSERT INTO auth_private.verification_challenges(id,user_id,purpose,target_email,secret_digest,expires_at) VALUES(p_reset_id,u,'reset_token',c.target_email,p_reset_digest,clock_timestamp()+interval '5 minutes');
 END IF;
 UPDATE auth_private.verification_challenges SET consumed_at=clock_timestamp() WHERE id=c.id;
 DELETE FROM auth_private.outbox_secrets WHERE challenge_id=c.id;
 UPDATE ops.notification_outbox SET state='cancelled' WHERE id IN(SELECT o.id FROM ops.notification_outbox o WHERE o.dedupe_key=p_purpose||':'||c.id) AND state IN ('pending','retry_wait','sending','unknown');
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(u,'account.'||p_purpose||'_verified',u);
 RETURN true;
END $$;
CREATE FUNCTION auth_private.reset_context(p_id uuid,p_digest text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; c auth_private.verification_challenges%ROWTYPE; result jsonb; BEGIN
 SELECT user_id INTO u FROM auth_private.verification_challenges WHERE id=p_id;
 IF u IS NULL THEN RETURN NULL; END IF;
 PERFORM 1 FROM app.app_users WHERE id=u FOR UPDATE;
 SELECT * INTO c FROM auth_private.verification_challenges WHERE id=p_id FOR UPDATE;
 IF c.purpose<>'reset_token' OR c.secret_digest IS DISTINCT FROM p_digest OR c.expires_at<=clock_timestamp() OR c.consumed_at IS NOT NULL OR c.superseded_at IS NOT NULL THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('userId',a.id,'username',a.username,'fullName',a.full_name,'passwordHash',r.password_hash) INTO result FROM app.app_users a JOIN auth_private.user_credentials r ON r.user_id=a.id WHERE a.id=u AND a.status='active' AND a.email_verified_at IS NOT NULL AND a.contact_email=c.target_email;
 RETURN result;
END $$;
CREATE FUNCTION auth_private.finish_password_reset(p_id uuid,p_digest text,p_hash text,p_app_url text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ctx jsonb; u uuid; BEGIN
 ctx:=auth_private.reset_context(p_id,p_digest); IF ctx IS NULL THEN RETURN false; END IF; u:=(ctx->>'userId')::uuid;
 UPDATE auth_private.user_credentials SET password_hash=p_hash,credential_version=credential_version+1,password_changed_at=clock_timestamp(),temporary_expires_at=NULL WHERE user_id=u;
 UPDATE app.app_users SET must_change_password=false,auth_version=auth_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=u;
 PERFORM auth_private.invalidate_account_security(u);
 UPDATE auth_private.verification_challenges SET consumed_at=clock_timestamp() WHERE id=p_id;
 UPDATE auth_private.password_reset_requests SET status='completed' WHERE user_id=u AND status IN ('pending','approved');
 PERFORM auth_private.password_notice(u,p_app_url);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(u,'account.password_reset',u);
 RETURN true;
END $$;
CREATE FUNCTION auth_private.recovery_question_context(p_username text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('userId',u.id,'answerHash',q.answer_hash,'email',CASE WHEN u.email_verified_at IS NOT NULL THEN u.contact_email ELSE NULL END) FROM app.app_users u LEFT JOIN auth_private.security_questions q ON q.user_id=u.id WHERE lower(u.username)=lower(p_username) AND u.status='active' $$;
CREATE FUNCTION auth_private.request_admin_recovery(p_username text,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE u uuid; BEGIN
 SELECT id INTO u FROM app.app_users WHERE lower(username)=lower(p_username) AND status='active' FOR UPDATE;
 IF u IS NULL OR EXISTS(SELECT 1 FROM auth_private.password_reset_requests WHERE user_id=u AND status='pending' AND created_at>clock_timestamp()-interval '24 hours') THEN RETURN; END IF;
 INSERT INTO auth_private.password_reset_requests(user_id,method,reason) VALUES(u,'admin',left(p_reason,500));
 INSERT INTO ops.audit_logs(action,entity_id) VALUES('account.admin_recovery_requested',u);
END $$;
CREATE FUNCTION auth_private.admin_recovery_context(p_session text,p_request uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; result jsonb; BEGIN
 a:=auth_private.lifecycle_self(p_session); PERFORM auth_private.require_admin();
 IF p_request IS NULL THEN
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'username',u.username,'fullName',u.full_name,'createdAt',r.created_at,'reason',r.reason) ORDER BY r.created_at),'[]'::jsonb) INTO result FROM (SELECT * FROM auth_private.password_reset_requests WHERE status='pending' ORDER BY created_at LIMIT 100) r JOIN app.app_users u ON u.id=r.user_id;
 ELSE
 SELECT jsonb_build_object('userId',u.id,'username',u.username,'fullName',u.full_name) INTO result FROM auth_private.password_reset_requests r JOIN app.app_users u ON u.id=r.user_id WHERE r.id=p_request AND r.status='pending' AND r.created_at>clock_timestamp()-interval '7 days' AND u.status='active' AND u.id<>a;
 END IF; RETURN result;
END $$;
CREATE FUNCTION auth_private.approve_admin_recovery(p_session text,p_request uuid,p_hash text,p_method text,p_evidence text,p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; u uuid; r auth_private.password_reset_requests%ROWTYPE; BEGIN
 a:=auth_private.lifecycle_self(p_session); PERFORM auth_private.require_admin();
 SELECT user_id INTO u FROM auth_private.password_reset_requests WHERE id=p_request;
 IF u IS NULL OR u=a THEN RETURN false; END IF;
 PERFORM 1 FROM app.app_users WHERE id=u AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO r FROM auth_private.password_reset_requests WHERE id=p_request FOR UPDATE;
 IF r.status<>'pending' OR r.created_at<=clock_timestamp()-interval '7 days' OR p_method NOT IN ('tatap_muka','dokumen_dan_panggilan') OR length(btrim(p_evidence)) NOT BETWEEN 5 AND 300 OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RETURN false; END IF;
 UPDATE auth_private.password_reset_requests SET status='approved',verified_by=a,verified_at=clock_timestamp(),evidence_reference=p_method||':'||p_evidence,reason=p_reason WHERE id=p_request;
 PERFORM auth_private.invalidate_account_security(u);
 UPDATE auth_private.user_credentials SET password_hash=p_hash,credential_version=credential_version+1,temporary_expires_at=clock_timestamp()+interval '24 hours',password_changed_at=clock_timestamp() WHERE user_id=u;
 UPDATE app.app_users SET must_change_password=true,contact_email=NULL,email_verified_at=NULL,auth_version=auth_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=u;
 DELETE FROM auth_private.security_questions WHERE user_id=u;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,'account.admin_recovery_approved',u,p_reason,jsonb_build_object('requestId',p_request,'method',p_method));
 RETURN true;
END $$;

-- Worker receives only leased security messages. It has no credential lookup or table grants.
GRANT USAGE ON SCHEMA auth_private TO sim_guru_worker;
CREATE FUNCTION auth_private.claim_security_outbox() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE o ops.notification_outbox%ROWTYPE; payload jsonb; lease uuid:=gen_random_uuid(); BEGIN
 UPDATE ops.notification_outbox SET state='unknown' WHERE state='sending' AND lease_until<clock_timestamp();
 UPDATE ops.notification_outbox SET state='cancelled' WHERE state IN ('pending','retry_wait','unknown') AND (public_payload->>'expiresAt')::timestamptz<=clock_timestamp();
 DELETE FROM auth_private.outbox_secrets s WHERE s.expires_at<=clock_timestamp() OR EXISTS(SELECT 1 FROM ops.notification_outbox x WHERE x.id=s.outbox_id AND x.state IN ('sent','failed','cancelled'));
 SELECT * INTO o FROM ops.notification_outbox WHERE state IN ('pending','retry_wait') AND attempts<5 AND next_attempt_at<=clock_timestamp() AND template IN ('account_activation','email_verify','reset_otp','password_changed') ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF o.id IS NULL THEN RETURN NULL; END IF;
 UPDATE ops.notification_outbox SET state='sending',attempts=attempts+1,lease_token=lease,lease_until=clock_timestamp()+interval '2 minutes' WHERE id=o.id;
 SELECT jsonb_build_object('challengeId',s.challenge_id,'ciphertextHex',encode(s.ciphertext,'hex'),'nonceHex',encode(s.nonce,'hex'),'tagHex',encode(s.auth_tag,'hex'),'keyVersion',s.encryption_key_version) INTO payload FROM auth_private.outbox_secrets s WHERE s.outbox_id=o.id;
 RETURN jsonb_build_object('id',o.id,'lease',lease,'userId',o.recipient_id,'email',o.recipient_email,'template',o.template,'public',o.public_payload,'secret',payload);
END $$;
CREATE FUNCTION auth_private.finish_security_outbox(p_id uuid,p_lease uuid,p_result text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE o ops.notification_outbox%ROWTYPE; BEGIN
 SELECT * INTO o FROM ops.notification_outbox WHERE id=p_id FOR UPDATE;
 IF o.state<>'sending' OR o.lease_token IS DISTINCT FROM p_lease OR o.lease_until<=clock_timestamp() OR p_result NOT IN ('sent','retry_wait','failed','unknown') THEN RETURN false; END IF;
 UPDATE ops.notification_outbox SET state=CASE WHEN p_result='retry_wait' AND attempts>=5 THEN 'failed' ELSE p_result END,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,60*(2^o.attempts)::integer)),lease_token=NULL,lease_until=NULL WHERE id=o.id;
 IF p_result IN ('sent','failed') OR (p_result='retry_wait' AND o.attempts>=5) THEN DELETE FROM auth_private.outbox_secrets WHERE outbox_id=o.id; END IF;
 RETURN true;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.lifecycle_context(text),auth_private.lifecycle_mutate(text,text,jsonb),auth_private.complete_onboarding(text,text),auth_private.consume_lifecycle_rate(text,text,integer),auth_private.queue_security_otp(text,text,text,text,uuid,text,uuid,text,text,text,text),auth_private.otp_binding(uuid,text),auth_private.verify_security_otp(text,uuid,text,text,uuid,text),auth_private.reset_context(uuid,text),auth_private.finish_password_reset(uuid,text,text,text),auth_private.recovery_question_context(text),auth_private.request_admin_recovery(text,text),auth_private.admin_recovery_context(text,uuid),auth_private.approve_admin_recovery(text,uuid,text,text,text,text) TO sim_guru_auth;
GRANT EXECUTE ON FUNCTION auth_private.claim_security_outbox(),auth_private.finish_security_outbox(uuid,uuid,text) TO sim_guru_worker;
RESET ROLE;
