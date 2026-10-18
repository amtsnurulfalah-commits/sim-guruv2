SET LOCAL ROLE sim_guru_owner;

CREATE FUNCTION auth_private.valid_argon2id_hash(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ SELECT value ~ '^\$argon2id\$v=19\$m=[0-9]{1,7},t=[0-9]{1,3},p=[0-9]{1,2}\$[A-Za-z0-9+/]{22,}={0,2}\$[A-Za-z0-9+/]{43,}={0,2}$'
 AND COALESCE((substring(value FROM 'm=([0-9]{1,7}),'))::integer >= 19456,false)
 AND COALESCE((substring(value FROM ',t=([0-9]{1,3}),'))::integer >= 2,false)
 AND COALESCE((substring(value FROM ',p=([0-9]{1,2})\$'))::integer >= 1,false) $$;

CREATE TABLE app.app_users (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 legacy_id text UNIQUE,
 username text NOT NULL CHECK(username = btrim(username) AND username ~ '^[A-Za-z0-9._-]{3,64}$'),
 full_name text NOT NULL CHECK(length(btrim(full_name)) BETWEEN 1 AND 200),
 nip text,
 role text NOT NULL CHECK(role IN ('admin','guru')),
 status text NOT NULL DEFAULT 'pending_activation' CHECK(status IN ('pending_activation','active','disabled','archived')),
 auth_version bigint NOT NULL DEFAULT 1 CHECK(auth_version > 0),
 must_change_password boolean NOT NULL DEFAULT true,
 contact_email text,
 email_verified_at timestamptz,
 phone text,
 photo_path text,
 address text,
 employment_status text,
 rank text,
 km_distance numeric(5,2) NOT NULL DEFAULT 0 CHECK(km_distance=0 OR km_distance BETWEEN 0.01 AND 999.99),
 additional_role text CHECK(additional_role='KEPALA_SEKOLAH'),
 version bigint NOT NULL DEFAULT 1 CHECK(version > 0),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK(email_verified_at IS NULL OR contact_email IS NOT NULL)
);
CREATE UNIQUE INDEX users_username_ci ON app.app_users(lower(username));
CREATE UNIQUE INDEX users_verified_email_ci ON app.app_users(lower(contact_email)) WHERE email_verified_at IS NOT NULL;

CREATE TABLE auth_private.user_credentials (
 user_id uuid PRIMARY KEY REFERENCES app.app_users(id) ON DELETE RESTRICT,
 password_hash text NOT NULL CHECK(auth_private.valid_argon2id_hash(password_hash)),
 credential_version bigint NOT NULL DEFAULT 1 CHECK(credential_version > 0),
 password_changed_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 temporary_expires_at timestamptz
);
CREATE TABLE auth_private.security_questions (
 user_id uuid PRIMARY KEY REFERENCES app.app_users(id) ON DELETE RESTRICT,
 question text NOT NULL CHECK(length(btrim(question)) BETWEEN 1 AND 300),
 answer_hash text NOT NULL CHECK(auth_private.valid_argon2id_hash(answer_hash)),
 normalization_version smallint NOT NULL DEFAULT 1 CHECK(normalization_version>0),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE auth_private.app_sessions (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid NOT NULL REFERENCES app.app_users(id) ON DELETE RESTRICT,
 auth_version_at_issue bigint NOT NULL CHECK(auth_version_at_issue>0),
 scope text NOT NULL CHECK(scope IN ('onboarding','business')),
 issued_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 idle_expires_at timestamptz NOT NULL,
 last_activity_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 revoked_at timestamptz,
 CHECK(expires_at > issued_at AND expires_at <= issued_at + interval '24 hours'),
 CHECK(idle_expires_at <= expires_at AND idle_expires_at > issued_at)
);
CREATE INDEX sessions_user_active ON auth_private.app_sessions(user_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE auth_private.verification_challenges (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app.app_users(id) ON DELETE RESTRICT,
 purpose text NOT NULL CHECK(purpose IN ('activation','email_verify','reset_otp','reset_token','admin_handover')),
 target_email text,
 secret_digest text NOT NULL CHECK(secret_digest ~ '^[a-f0-9]{64}$'),
 key_version smallint NOT NULL DEFAULT 1 CHECK(key_version>0),
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts>=0),
 max_attempts smallint NOT NULL DEFAULT 5 CHECK(max_attempts BETWEEN 1 AND 10),
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 superseded_at timestamptz,
 CHECK(expires_at>created_at),
 CHECK(attempts<=max_attempts)
);
CREATE INDEX challenges_user_purpose ON auth_private.verification_challenges(user_id,purpose,expires_at);
CREATE TABLE auth_private.auth_rate_limits (
 scope text NOT NULL,
 key_hash text NOT NULL CHECK(key_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz NOT NULL,
 count integer NOT NULL DEFAULT 0 CHECK(count>=0),
 blocked_until timestamptz,
 PRIMARY KEY(scope,key_hash,window_start)
);
CREATE TABLE auth_private.password_reset_requests (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES app.app_users(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','completed','expired')),
 method text NOT NULL CHECK(method IN ('email','admin')),
 verified_by uuid REFERENCES app.app_users(id),
 verified_at timestamptz,
 evidence_reference text,
 reason text,
 created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 CHECK(status<>'approved' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE app.system_settings (
 key text PRIMARY KEY CHECK(key ~ '^[a-z][a-z0-9_.]{0,79}$'),
 typed_value jsonb NOT NULL,
 schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version>0),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by uuid REFERENCES app.app_users(id),
 updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);
CREATE TABLE ops.audit_logs (
 id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
 request_id uuid,
 actor_id uuid REFERENCES app.app_users(id),
 action text NOT NULL,
 entity_id uuid,
 occurred_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
 reason text,
 redacted_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
 policy_version text NOT NULL DEFAULT 'sim-guru-policy-v1'
);
CREATE INDEX audit_entity_time ON ops.audit_logs(entity_id,occurred_at);

-- FORCE berlaku pada owner; policy internal eksplisit mencegah recursive RLS pada helper definer.
DO $rls$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['app.app_users','app.system_settings','auth_private.user_credentials','auth_private.security_questions','auth_private.app_sessions','auth_private.verification_challenges','auth_private.auth_rate_limits','auth_private.password_reset_requests','ops.audit_logs'] LOOP
   EXECUTE 'ALTER TABLE ' || table_name || ' ENABLE ROW LEVEL SECURITY';
   EXECUTE 'ALTER TABLE ' || table_name || ' FORCE ROW LEVEL SECURITY';
   EXECUTE 'CREATE POLICY owner_internal ON ' || table_name || ' TO sim_guru_owner USING (true) WITH CHECK (true)';
   EXECUTE 'REVOKE ALL ON ' || table_name || ' FROM PUBLIC';
 END LOOP;
END $rls$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth_private FROM PUBLIC;
RESET ROLE;
