SET LOCAL ROLE sim_guru_owner;
-- Reuse the canonical OTP queue. No new table grants, password writes or session revocations.
CREATE FUNCTION auth_private.users_queue_reset_email(
 p_session text,p_user uuid,p_version bigint,p_reason text,p_email text,
 p_id uuid,p_digest text,p_outbox uuid,p_cipher text,p_nonce text,p_tag text,p_app_url text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; target app.app_users%ROWTYPE; queued boolean;
BEGIN
 a:=auth_private.users_admin_guard(p_session,true);
 SELECT * INTO target FROM app.app_users WHERE id=p_user FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF target.status<>'active' OR target.email_verified_at IS NULL OR target.contact_email IS NULL
    OR NOT EXISTS(SELECT 1 FROM auth_private.user_credentials WHERE user_id=p_user) THEN
  RAISE EXCEPTION 'RESET_EMAIL_NOT_ALLOWED' USING ERRCODE='42501';
 END IF;
 IF target.contact_email IS DISTINCT FROM p_email THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 queued:=auth_private.queue_security_otp(null,target.username,'reset_otp',target.contact_email,p_id,p_digest,p_outbox,p_cipher,p_nonce,p_tag,p_app_url);
 IF NOT queued THEN RETURN null; END IF;
 UPDATE app.app_users SET version=version+1,updated_at=clock_timestamp() WHERE id=p_user;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason) VALUES(a,'users.password_reset_email_queued',p_user,p_reason);
 RETURN auth_private.users_dto(p_user);
END $$;
REVOKE ALL ON FUNCTION auth_private.users_queue_reset_email(text,uuid,bigint,text,text,uuid,text,uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.users_queue_reset_email(text,uuid,bigint,text,text,uuid,text,uuid,text,text,text,text) TO sim_guru_auth;
RESET ROLE;
