SET LOCAL ROLE sim_guru_owner;
-- No historical receipt timestamp is invented for older security messages.
ALTER TABLE ops.notification_outbox ADD COLUMN completed_at timestamptz;
DO $patch$
DECLARE fn regprocedure; b text; definition text;
BEGIN
 fn:='ops.scheduled_finance()'::regprocedure;
 SELECT prosrc,pg_get_functiondef(oid) INTO b,definition FROM pg_proc WHERE oid=fn;
 IF md5(b)<>'d4362b8de07ef4d4790f2ecb6c930f43' THEN RAISE EXCEPTION 'PRO3_SCHEDULER_PRIOR_MISMATCH'; END IF;
 b:=replace(b,'state=''completed'' OR attempts>=5','state IN(''completed'',''paused'') OR attempts>=5');
 EXECUTE split_part(definition,'$function$',1)||quote_literal(b);
 fn:='ops.domain_finish(uuid,uuid,text)'::regprocedure;
 SELECT prosrc,pg_get_functiondef(oid) INTO b,definition FROM pg_proc WHERE oid=fn;
 IF md5(b)<>'7aecf82d544fff210bf76626c06b958b' THEN RAISE EXCEPTION 'PRO3_DOMAIN_PRIOR_MISMATCH'; END IF;
 b:=replace(b,'WHEN p_result IN(''sent'',''failed'') THEN','WHEN p_result IN(''sent'',''failed'') OR (p_result=''retry_wait'' AND attempts>=5) THEN');
 EXECUTE split_part(definition,'$function$',1)||quote_literal(b);
 fn:='auth_private.finish_security_outbox(uuid,uuid,text)'::regprocedure;
 SELECT prosrc,pg_get_functiondef(oid) INTO b,definition FROM pg_proc WHERE oid=fn;
 IF md5(b)<>'2a5325e330e09f5e5fd47cb17b525a34' THEN RAISE EXCEPTION 'PRO3_SECURITY_PRIOR_MISMATCH'; END IF;
 b:=replace(b,'IF o.state<>','IF o.id IS NULL OR p_lease IS NULL OR p_result IS NULL OR o.state<>');
 b:=replace(b,'lease_token=NULL,lease_until=NULL WHERE id=o.id;', 'lease_token=NULL,lease_until=NULL,completed_at=CASE WHEN p_result IN (''sent'',''failed'') OR (p_result=''retry_wait'' AND o.attempts>=5) THEN clock_timestamp() ELSE NULL END WHERE id=o.id;');
 EXECUTE split_part(definition,'$function$',1)||quote_literal(b);
END $patch$;

-- Private read helper, reused only from the existing admin-authenticated monitor.
CREATE FUNCTION ops.reliability_snapshot() RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH messages AS (
  SELECT state,created_at,completed_at FROM ops.domain_outbox
  UNION ALL SELECT state,created_at,completed_at FROM ops.notification_outbox
 ), totals AS (
  SELECT count(*) FILTER(WHERE state='sent') accepted,
   count(*) FILTER(WHERE state='failed') failed,count(*) FILTER(WHERE state='unknown') uncertain
  FROM messages WHERE created_at>=statement_timestamp()-interval '24 hours'
 ) SELECT jsonb_build_object(
  'lastSuccessfulJobAt',(SELECT max(completed_at) FROM ops.job_runs WHERE kind='notifications' AND state='completed'),
  'lastAcceptedAt',(SELECT max(completed_at) FROM messages WHERE state='sent'),
  'accepted24h',accepted,'failed24h',failed,'uncertain24h',uncertain,
  'knownFailurePercent',round(100.0*failed/nullif(accepted+failed,0),1)) FROM totals
$$;
REVOKE ALL ON FUNCTION ops.reliability_snapshot() FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
DO $patch$
DECLARE fn regprocedure:='app.support_monitor_read(text)'::regprocedure;b text;definition text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO b,definition FROM pg_proc WHERE oid=fn;
 IF md5(b)<>'5a3e6c08b647d078c22897853889e108' THEN RAISE EXCEPTION 'PRO3_MONITOR_PRIOR_MISMATCH'; END IF;
 b:=replace(b,'DECLARE actor uuid;','DECLARE health jsonb;active_queued int;active_age int;mail_on boolean;security_on boolean;jobs_on boolean;maintenance_on boolean;actor uuid;');
 b:=replace(b,' SELECT count(*) INTO failed_jobs', $new$
 SELECT coalesce((typed_value->>'mailEnabled')::boolean,false),coalesce((typed_value->>'securityMailEnabled')::boolean,false),coalesce((typed_value->>'jobsEnabled')::boolean,false) INTO mail_on,security_on,jobs_on FROM app.system_settings WHERE key='operations.config';
 maintenance_on:=auth_private.maintenance_enabled();
 enabled:=security_on OR (NOT maintenance_on AND (mail_on OR jobs_on));
 health:=ops.reliability_snapshot();
 SELECT count(*),coalesce(extract(epoch FROM clock_timestamp()-min(created_at))::int,0) INTO active_queued,active_age FROM(
 SELECT created_at FROM ops.domain_outbox WHERE mail_on AND NOT maintenance_on AND state IN('pending','retry_wait') AND next_attempt_at<=clock_timestamp()
 UNION ALL SELECT created_at FROM ops.notification_outbox WHERE security_on AND state IN('pending','retry_wait') AND next_attempt_at<=clock_timestamp()) q;
 SELECT count(*) INTO failed_jobs$new$);
 b:=replace(b,'IF queued>0 AND age_seconds>=900 THEN','IF active_queued>0 AND active_age>=900 THEN');
 b:=replace(b,$prior$SELECT jsonb_build_object('generatedAt'$prior$,$new$IF jobs_on AND NOT maintenance_on AND heartbeat>=clock_timestamp()-interval '15 minutes' AND ((health->>'lastSuccessfulJobAt') IS NULL OR (health->>'lastSuccessfulJobAt')::timestamptz<clock_timestamp()-interval '15 minutes') THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','JOBS_STALE','message','Tiket worker dipakai tetapi job notifikasi belum berhasil dalam 15 menit. Periksa endpoint dan hasil job; jangan retry transaksi tanpa memeriksa sumber.','href','/admin/operasional')); END IF;
 SELECT jsonb_build_object('reliability',health||jsonb_build_object('activeReadyQueue',active_queued,'activeOldestQueueSeconds',active_age),'generatedAt'$new$);
 EXECUTE split_part(definition,'$function$',1)||quote_literal(b);
END $patch$;
RESET ROLE;
