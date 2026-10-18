-- Tidak membuat LOGIN atau password database. Provision login terpisah dari migrasi.
DO $roles$
DECLARE role_name text; other_role text; record_role record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['sim_guru_owner','sim_guru_business','sim_guru_auth','sim_guru_bootstrap','sim_guru_worker'] LOOP
    SELECT * INTO record_role FROM pg_catalog.pg_roles WHERE rolname = role_name;
    IF NOT FOUND THEN
      EXECUTE pg_catalog.format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT', role_name);
    ELSIF record_role.rolcanlogin OR record_role.rolsuper OR record_role.rolcreatedb OR record_role.rolcreaterole OR record_role.rolreplication OR record_role.rolbypassrls THEN
      RAISE EXCEPTION 'ROLE_COLLISION_UNSAFE: %', role_name;
    END IF;
  END LOOP;
  -- Hanya administrator migrasi menjadi member owner. Runtime tidak boleh mewarisi owner/auth/bootstrap.
  EXECUTE pg_catalog.format('GRANT sim_guru_owner TO %I', current_user);
  FOREACH role_name IN ARRAY ARRAY['sim_guru_business','sim_guru_auth','sim_guru_worker','sim_guru_bootstrap'] LOOP
    IF pg_catalog.pg_has_role(role_name, 'sim_guru_owner', 'MEMBER') THEN
      RAISE EXCEPTION 'ROLE_MEMBERSHIP_UNSAFE: %', role_name;
    END IF;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['sim_guru_business','sim_guru_auth','sim_guru_worker','sim_guru_bootstrap'] LOOP
    FOREACH other_role IN ARRAY ARRAY['sim_guru_business','sim_guru_auth','sim_guru_worker','sim_guru_bootstrap'] LOOP
      IF role_name <> other_role AND pg_catalog.pg_has_role(role_name,other_role,'MEMBER') THEN
        RAISE EXCEPTION 'ROLE_MEMBERSHIP_UNSAFE: % -> %',role_name,other_role;
      END IF;
    END LOOP;
  END LOOP;
END $roles$;

DO $schemas$
DECLARE schema_name text; existing_owner text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['app','auth_private','finance','ops'] LOOP
    SELECT pg_catalog.pg_get_userbyid(nspowner) INTO existing_owner FROM pg_catalog.pg_namespace WHERE nspname=schema_name;
    IF FOUND AND existing_owner <> 'sim_guru_owner' THEN
      RAISE EXCEPTION 'SCHEMA_COLLISION: %', schema_name;
    END IF;
    IF NOT FOUND THEN EXECUTE pg_catalog.format('CREATE SCHEMA %I AUTHORIZATION sim_guru_owner',schema_name); END IF;
  END LOOP;
END $schemas$;

SET LOCAL ROLE sim_guru_owner;
REVOKE ALL ON SCHEMA app, auth_private, finance, ops FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app,auth_private,finance,ops REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA app,auth_private,finance,ops REVOKE ALL ON SEQUENCES FROM PUBLIC;
-- PUBLIC EXECUTE bawaan function bersifat global; REVOKE per-schema saja tidak mencabutnya.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Supabase roles mungkin belum ada pada PostgreSQL lokal.
DO $api_roles$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=api_role) THEN
      EXECUTE pg_catalog.format('REVOKE ALL ON SCHEMA app,auth_private,finance,ops FROM %I',api_role);
    END IF;
  END LOOP;
END $api_roles$;
GRANT USAGE ON SCHEMA app,ops,finance TO sim_guru_business;
GRANT USAGE ON SCHEMA auth_private TO sim_guru_auth,sim_guru_bootstrap;
RESET ROLE;
