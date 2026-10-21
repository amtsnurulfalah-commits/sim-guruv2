-- Supabase pg_net is non-relocatable: recreate its registration outside public.
-- Precondition: pause sim-guru-worker and drain net.http_request_queue first.
-- No CASCADE, no catalog edits, no application data changes. Entire migration
-- must execute in one transaction so a failure restores the previous extension.
DO $migration$
DECLARE old_version text; saved_last bigint; saved_called boolean; saved_rows bigint;
BEGIN
  SELECT e.extversion INTO old_version FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace
  WHERE e.extname='pg_net' AND n.nspname='public';
  IF old_version IS NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM cron.job WHERE jobname='sim-guru-worker' AND active) THEN
    RAISE EXCEPTION 'PG_NET_PAUSE_SCHEDULER_REQUIRED';
  END IF;
  LOCK TABLE net.http_request_queue,net._http_response IN ACCESS EXCLUSIVE MODE;
  IF EXISTS(SELECT 1 FROM net.http_request_queue) THEN
    RAISE EXCEPTION 'PG_NET_DRAIN_REQUIRED';
  END IF;
  SELECT last_value,is_called INTO saved_last,saved_called FROM net.http_request_queue_id_seq;
  CREATE TEMP TABLE pg_net_response_backup ON COMMIT DROP AS SELECT * FROM net._http_response;
  SELECT count(*) INTO saved_rows FROM pg_net_response_backup;
  DROP EXTENSION pg_net RESTRICT;
  CREATE EXTENSION pg_net WITH SCHEMA extensions;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n
    ON n.oid=e.extnamespace WHERE e.extname='pg_net' AND e.extversion=old_version AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'PG_NET_REINSTALL_VERSION_OR_SCHEMA_MISMATCH';
  END IF;
  INSERT INTO net._http_response SELECT * FROM pg_net_response_backup;
  IF (SELECT count(*) FROM net._http_response)<>saved_rows THEN
    RAISE EXCEPTION 'PG_NET_RESPONSE_RESTORE_MISMATCH';
  END IF;
  PERFORM pg_catalog.setval('net.http_request_queue_id_seq',saved_last,saved_called);
  -- Keep the platform-owned net ACL unchanged. Supabase owns these objects;
  -- this migration fixes extension registration, not platform grants.
  -- Scheduler access is verified after installation before resuming cron.
  IF NOT has_schema_privilege('sim_guru_owner','net','USAGE')
     OR NOT has_table_privilege('sim_guru_owner','net.http_request_queue','INSERT')
     OR NOT has_sequence_privilege('sim_guru_owner','net.http_request_queue_id_seq','USAGE')
     OR NOT has_function_privilege('sim_guru_owner','net.http_get(text,jsonb,jsonb,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'PG_NET_SCHEDULER_ACCESS_MISSING';
  END IF;
END;
$migration$;
