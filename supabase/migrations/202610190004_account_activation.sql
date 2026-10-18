SET LOCAL ROLE sim_guru_owner;

CREATE OR REPLACE FUNCTION auth_private.valid_argon2id_hash(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog
AS $$ DECLARE parts text[]; item text; m integer; t integer; p integer; BEGIN
 IF value !~ '^\$argon2id\$v=19\$[^$]+\$[A-Za-z0-9+/]{22,86}={0,2}\$[A-Za-z0-9+/]{43,86}={0,2}$' THEN RETURN false; END IF;
 parts:=string_to_array(split_part(value,'$',4),',');
 IF cardinality(parts)<>3 THEN RETURN false; END IF;
 FOREACH item IN ARRAY parts LOOP
  IF item ~ '^m=[0-9]{1,7}$' AND m IS NULL THEN m:=substring(item FROM 3)::integer;
  ELSIF item ~ '^t=[0-9]{1,3}$' AND t IS NULL THEN t:=substring(item FROM 3)::integer;
  ELSIF item ~ '^p=[0-9]{1,2}$' AND p IS NULL THEN p:=substring(item FROM 3)::integer;
  ELSE RETURN false; END IF;
 END LOOP;
 RETURN coalesce(m BETWEEN 19456 AND 262144 AND t BETWEEN 2 AND 10 AND p BETWEEN 1 AND 8 AND m>=8*p,false);
END $$;


CREATE TABLE ops.notification_outbox (
 id uuid PRIMARY KEY,
 dedupe_key text NOT NULL UNIQUE,
 recipient_id uuid NOT NULL REFERENCES app.app_users(id),
 recipient_email text NOT NULL,
 template text NOT NULL CHECK(template='account_activation'),
 public_payload jsonb NOT NULL CHECK(jsonb_typeof(public_payload)='object' AND public_payload - ARRAY['fullName','username','appUrl','expiresAt']::text[]='{}'::jsonb),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','retry_wait','failed','unknown','cancelled')),
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 next_attempt_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE auth_private.outbox_secrets (
 outbox_id uuid PRIMARY KEY REFERENCES ops.notification_outbox(id) ON DELETE CASCADE,
 challenge_id uuid NOT NULL REFERENCES auth_private.verification_challenges(id),
 ciphertext bytea NOT NULL CHECK(octet_length(ciphertext)=43),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=12),
 auth_tag bytea NOT NULL CHECK(octet_length(auth_tag)=16),
 encryption_key_version smallint NOT NULL CHECK(encryption_key_version=1),
 expires_at timestamptz NOT NULL
);
CREATE INDEX outbox_ready ON ops.notification_outbox(state,next_attempt_at);
CREATE UNIQUE INDEX challenges_one_active_purpose ON auth_private.verification_challenges(user_id,purpose) WHERE consumed_at IS NULL AND superseded_at IS NULL;
ALTER TABLE ops.notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.notification_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE auth_private.outbox_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_private.outbox_secrets FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON ops.notification_outbox TO sim_guru_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_internal ON auth_private.outbox_secrets TO sim_guru_owner USING(true) WITH CHECK(true);

CREATE FUNCTION auth_private.queue_activation(p_user_id uuid,p_email text,p_challenge_id uuid,p_digest text,p_outbox_id uuid,p_cipher_hex text,p_nonce_hex text,p_tag_hex text,p_app_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE actor uuid; target app.app_users%ROWTYPE; expiry timestamptz:=pg_catalog.clock_timestamp()+interval '24 hours'; BEGIN
 actor:=auth_private.require_admin();
 SELECT * INTO target FROM app.app_users WHERE id=p_user_id FOR UPDATE;
 IF target.id IS NULL OR target.status<>'pending_activation' OR EXISTS(SELECT 1 FROM auth_private.user_credentials WHERE user_id=target.id) THEN RAISE EXCEPTION 'ACTIVATION_NOT_ALLOWED' USING ERRCODE='42501'; END IF;
 IF p_email IS NULL OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR p_app_url !~ '^https?://' THEN RAISE EXCEPTION 'INVALID_ACTIVATION_INPUT' USING ERRCODE='22023'; END IF;
 UPDATE auth_private.verification_challenges SET superseded_at=pg_catalog.clock_timestamp() WHERE user_id=target.id AND purpose='activation' AND consumed_at IS NULL AND superseded_at IS NULL;
 UPDATE ops.notification_outbox SET state='cancelled' WHERE recipient_id=target.id AND template='account_activation' AND state IN ('pending','retry_wait');
 DELETE FROM auth_private.outbox_secrets WHERE outbox_id IN (SELECT id FROM ops.notification_outbox WHERE recipient_id=target.id AND template='account_activation' AND state='cancelled');
 INSERT INTO auth_private.verification_challenges(id,user_id,purpose,target_email,secret_digest,expires_at) VALUES(p_challenge_id,target.id,'activation',lower(btrim(p_email)),p_digest,expiry);
 INSERT INTO ops.notification_outbox(id,dedupe_key,recipient_id,recipient_email,template,public_payload)
 VALUES(p_outbox_id,'activation:'||p_challenge_id::text,target.id,lower(btrim(p_email)),'account_activation',pg_catalog.jsonb_build_object('fullName',target.full_name,'username',target.username,'appUrl',p_app_url,'expiresAt',expiry));
 INSERT INTO auth_private.outbox_secrets(outbox_id,challenge_id,ciphertext,nonce,auth_tag,encryption_key_version,expires_at)
 VALUES(p_outbox_id,p_challenge_id,decode(p_cipher_hex,'hex'),decode(p_nonce_hex,'hex'),decode(p_tag_hex,'hex'),1,expiry);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(actor,'account.activation_queued',target.id);
END $$;

CREATE FUNCTION auth_private.activation_context(p_challenge_id uuid,p_digest text)
RETURNS TABLE(user_id uuid,username text,full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT u.id,u.username,u.full_name FROM auth_private.verification_challenges c JOIN app.app_users u ON u.id=c.user_id
WHERE c.id=p_challenge_id AND c.secret_digest=p_digest AND c.purpose='activation' AND c.consumed_at IS NULL AND c.superseded_at IS NULL AND c.expires_at>pg_catalog.statement_timestamp() AND u.status='pending_activation' $$;
CREATE FUNCTION auth_private.complete_activation(p_challenge_id uuid,p_digest text,p_password_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE user_ref uuid; target app.app_users%ROWTYPE; challenge auth_private.verification_challenges%ROWTYPE; BEGIN
 SELECT user_id INTO user_ref FROM auth_private.verification_challenges WHERE id=p_challenge_id;
 IF user_ref IS NULL THEN RAISE EXCEPTION 'INVALID_ACTIVATION' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM app.app_users WHERE id=user_ref FOR UPDATE;
 SELECT * INTO challenge FROM auth_private.verification_challenges WHERE id=p_challenge_id FOR UPDATE;
 IF target.status<>'pending_activation' OR challenge.purpose<>'activation' OR challenge.secret_digest IS DISTINCT FROM p_digest OR challenge.consumed_at IS NOT NULL OR challenge.superseded_at IS NOT NULL OR challenge.expires_at<=pg_catalog.clock_timestamp() THEN RAISE EXCEPTION 'INVALID_ACTIVATION' USING ERRCODE='42501'; END IF;
 INSERT INTO auth_private.user_credentials(user_id,password_hash) VALUES(target.id,p_password_hash);
 UPDATE app.app_users SET status='active',must_change_password=false,contact_email=challenge.target_email,email_verified_at=pg_catalog.clock_timestamp(),auth_version=auth_version+1,version=version+1,updated_at=pg_catalog.clock_timestamp() WHERE id=target.id;
 UPDATE auth_private.verification_challenges SET consumed_at=CASE WHEN id=p_challenge_id THEN pg_catalog.clock_timestamp() ELSE consumed_at END,superseded_at=CASE WHEN id<>p_challenge_id THEN pg_catalog.clock_timestamp() ELSE superseded_at END WHERE user_id=target.id AND consumed_at IS NULL AND superseded_at IS NULL;
 UPDATE auth_private.app_sessions SET revoked_at=pg_catalog.clock_timestamp() WHERE user_id=target.id AND revoked_at IS NULL;
 UPDATE ops.notification_outbox SET state='cancelled' WHERE recipient_id=target.id AND template='account_activation' AND state IN ('pending','retry_wait');
 DELETE FROM auth_private.outbox_secrets WHERE outbox_id IN(SELECT id FROM ops.notification_outbox WHERE recipient_id=target.id AND template='account_activation');
 INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(target.id,'account.activated',target.id);
 RETURN target.id;
END $$;

CREATE FUNCTION auth_private.rehash_credentials_after_verification(p_user_id uuid,p_expected_version bigint,p_expected_hash text,p_new_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE changed uuid; BEGIN
 PERFORM 1 FROM app.app_users WHERE id=p_user_id AND status='active' FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE auth_private.user_credentials SET password_hash=p_new_hash,credential_version=credential_version+1
 WHERE user_id=p_user_id AND credential_version=p_expected_version AND password_hash=p_expected_hash
 AND (temporary_expires_at IS NULL OR temporary_expires_at>pg_catalog.clock_timestamp()) RETURNING user_id INTO changed;
 IF changed IS NOT NULL THEN INSERT INTO ops.audit_logs(actor_id,action,entity_id) VALUES(p_user_id,'account.password_rehashed',p_user_id); END IF;
 RETURN changed IS NOT NULL;
END $$;

CREATE FUNCTION auth_private.bootstrap_target(p_username text)
RETURNS TABLE(user_id uuid,full_name text,role text,status text,has_credential boolean,temporary_expired boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
AS $$ SELECT u.id,u.full_name,u.role,u.status,c.user_id IS NOT NULL,(c.temporary_expires_at IS NOT NULL AND c.temporary_expires_at<=pg_catalog.statement_timestamp()) FROM app.app_users u LEFT JOIN auth_private.user_credentials c ON c.user_id=u.id WHERE lower(u.username)=lower(btrim(p_username)) $$;
CREATE OR REPLACE FUNCTION auth_private.bootstrap_admin(p_username text,p_full_name text,p_temporary_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $$ DECLARE target app.app_users%ROWTYPE; BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(734190,1);
 SELECT * INTO target FROM app.app_users WHERE lower(username)=lower(btrim(p_username));
 IF target.id IS NOT NULL THEN
   IF target.role<>'admin' OR target.full_name<>p_full_name OR target.status<>'active' OR NOT EXISTS(SELECT 1 FROM auth_private.user_credentials WHERE user_id=target.id AND (temporary_expires_at IS NULL OR temporary_expires_at>pg_catalog.clock_timestamp())) THEN RAISE EXCEPTION 'BOOTSTRAP_RECOVERY_REQUIRED' USING ERRCODE='42501'; END IF;
   RETURN target.id;
 END IF;
 IF EXISTS(SELECT 1 FROM app.app_users WHERE role='admin') THEN RAISE EXCEPTION 'BOOTSTRAP_ALREADY_INITIALIZED' USING ERRCODE='42501'; END IF;
 INSERT INTO app.app_users(username,full_name,role,status,must_change_password) VALUES(btrim(p_username),p_full_name,'admin','active',true) RETURNING * INTO target;
 INSERT INTO auth_private.user_credentials(user_id,password_hash,temporary_expires_at) VALUES(target.id,p_temporary_hash,pg_catalog.clock_timestamp()+interval '24 hours');
 INSERT INTO ops.audit_logs(action,entity_id) VALUES('account.bootstrap_created',target.id);
 RETURN target.id;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.queue_activation(uuid,text,uuid,text,uuid,text,text,text,text),auth_private.activation_context(uuid,text),auth_private.complete_activation(uuid,text,text),auth_private.rehash_credentials_after_verification(uuid,bigint,text,text) TO sim_guru_auth;
GRANT EXECUTE ON FUNCTION auth_private.bootstrap_target(text) TO sim_guru_bootstrap;
RESET ROLE;
