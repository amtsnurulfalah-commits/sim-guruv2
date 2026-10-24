-- Professional stage 4. Admin-only cases; automatic telemetry is aggregate metadata only.
SET LOCAL ROLE sim_guru_owner;
DO $precondition$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='ops.record_support_event(uuid,timestamp with time zone,text,text,integer)'::regprocedure) IS DISTINCT FROM 'd6058de179e9c321aabe2ad412357bc6' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
END $precondition$;
CREATE TABLE ops.support_cases(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, summary text NOT NULL,
 reporter_id uuid REFERENCES app.app_users(id), reporter_verified boolean NOT NULL DEFAULT false,
 owner_id uuid REFERENCES app.app_users(id), status text NOT NULL DEFAULT 'new' CHECK(status IN('new','reviewed','processing','waiting','resolved')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0), created_by uuid NOT NULL REFERENCES app.app_users(id),
 module text NOT NULL, code text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), closed_at timestamptz, resolution text, verification text,
 CHECK((status='resolved')=(closed_at IS NOT NULL)),CHECK(NOT reporter_verified OR reporter_id IS NOT NULL)
);
CREATE INDEX support_cases_queue ON ops.support_cases(status,updated_at DESC,id);
CREATE INDEX support_cases_retention ON ops.support_cases(closed_at) WHERE status='resolved';
CREATE TABLE ops.support_case_references(
 request_id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES ops.support_cases(id) ON DELETE CASCADE,
 occurred_at timestamptz NOT NULL,module text NOT NULL,code text NOT NULL,status integer NOT NULL
);
CREATE INDEX support_case_refs ON ops.support_case_references(case_id,occurred_at,request_id);
CREATE TABLE ops.support_case_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES ops.support_cases(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES app.app_users(id),operation_key uuid NOT NULL,payload_hash text NOT NULL,result jsonb NOT NULL,
 action text NOT NULL,note text NOT NULL,changes jsonb NOT NULL DEFAULT '{}',from_status text,to_status text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(actor_id,operation_key)
);
CREATE INDEX support_history_case ON ops.support_case_history(case_id,created_at,id);
CREATE TRIGGER immutable_before_update BEFORE UPDATE ON ops.support_case_history FOR EACH ROW EXECUTE FUNCTION finance.immutable_final();
CREATE TABLE ops.request_metrics(
 bucket timestamptz NOT NULL,module text NOT NULL,status_class int NOT NULL CHECK(status_class BETWEEN 2 AND 5),
 samples bigint NOT NULL,total_ms bigint NOT NULL,max_ms int NOT NULL,PRIMARY KEY(bucket,module,status_class)
);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['ops.support_cases','ops.support_case_references','ops.support_case_history','ops.request_metrics'] LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker',t);
END LOOP;END $$;
CREATE FUNCTION ops.support_text_valid(v text,n int) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(length(btrim(v)) BETWEEN 5 AND n AND v !~* '(password|kata sandi|otp|token|secret|api_key)[[:space:]]*[:=]|Bearer[[:space:]]+[a-z0-9._-]+|postgres(ql)?://|-----BEGIN .*PRIVATE KEY|https?://[^/[:space:]]*@',false)
$$;
CREATE FUNCTION ops.support_purge() RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE events int;cases int;metrics int;BEGIN
 IF NOT pg_try_advisory_xact_lock(734190,4) THEN RETURN jsonb_build_object('events',0,'cases',0,'metrics',0);END IF;
 DELETE FROM ops.support_events WHERE request_id IN(SELECT request_id FROM ops.support_events WHERE occurred_at<clock_timestamp()-interval '30 days' ORDER BY occurred_at LIMIT 5000);GET DIAGNOSTICS events=ROW_COUNT;
 DELETE FROM ops.support_cases WHERE id IN(SELECT id FROM ops.support_cases WHERE status='resolved' AND closed_at<clock_timestamp()-interval '365 days' ORDER BY closed_at LIMIT 100);GET DIAGNOSTICS cases=ROW_COUNT;
 DELETE FROM ops.request_metrics WHERE(bucket,module,status_class) IN(SELECT bucket,module,status_class FROM ops.request_metrics WHERE bucket<clock_timestamp()-interval '30 days' ORDER BY bucket LIMIT 5000);GET DIAGNOSTICS metrics=ROW_COUNT;
 DELETE FROM ops.support_case_history WHERE case_id IS NULL AND created_at<clock_timestamp()-interval '365 days';
 RETURN jsonb_build_object('events',events,'cases',cases,'metrics',metrics);
END $$;
CREATE OR REPLACE FUNCTION ops.record_support_event(p_id uuid,p_time timestamptz,p_module text,p_code text,p_status integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO ops.support_events VALUES(p_id,p_time,p_module,p_code,p_status) ON CONFLICT(request_id) DO NOTHING;
 PERFORM ops.support_purge();END $$;
CREATE FUNCTION ops.record_request_metric(p_module text,p_status int,p_duration int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE n bigint;BEGIN
 IF p_module !~ '^[a-z-]{1,40}$' OR p_status NOT BETWEEN 200 AND 599 OR p_duration NOT BETWEEN 0 AND 600000 OR p_module IS NULL OR p_status IS NULL OR p_duration IS NULL THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.request_metrics(bucket,module,status_class,samples,total_ms,max_ms) VALUES(date_trunc('minute',clock_timestamp()),p_module,p_status/100,1,p_duration,p_duration)
 ON CONFLICT(bucket,module,status_class) DO UPDATE SET samples=ops.request_metrics.samples+1,total_ms=ops.request_metrics.total_ms+p_duration,max_ms=greatest(ops.request_metrics.max_ms,p_duration) RETURNING samples INTO n;
 IF n=1 THEN PERFORM ops.support_purge();END IF;END $$;

CREATE FUNCTION app.support_case_command(p_session text,d jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;op text:=d->>'operation'; c ops.support_cases%ROWTYPE;e ops.support_events%ROWTYPE; prior ops.support_case_history%ROWTYPE;
 rid uuid;res jsonb;hash text:=finance.digest(d::text);note text:=btrim(d->>'reason');target text:=d->>'status';owner uuid:=(d->>'ownerId')::uuid;
BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();
 IF d->>'operationKey' IS NULL OR NOT ops.support_text_valid(note,2000) THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO prior FROM ops.support_case_history WHERE actor_id=actor AND operation_key=(d->>'operationKey')::uuid;
 IF prior.id IS NOT NULL THEN IF prior.payload_hash<>hash THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;RETURN prior.result;END IF;
 IF op='purge' THEN
 res:=ops.support_purge();INSERT INTO ops.support_case_history(actor_id,operation_key,payload_hash,result,action,note) VALUES(actor,(d->>'operationKey')::uuid,hash,res,op,note);
 PERFORM app.activity_audit('support-purge',actor,'Pembersihan retensi kendala',null,res);RETURN res;
 ELSIF op='create' THEN
 SELECT * INTO e FROM ops.support_events WHERE request_id=(d->>'reference')::uuid AND occurred_at>=clock_timestamp()-interval '30 days';
 IF e.request_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF NOT ops.support_text_valid(d->>'title',160) OR NOT ops.support_text_valid(d->>'summary',1000) OR (d->>'reporterVerified')::boolean IS NULL THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 IF d->>'reporterId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=(d->>'reporterId')::uuid) THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 IF (d->>'reporterVerified')::boolean AND d->>'reporterId' IS NULL THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 SELECT case_id INTO rid FROM ops.support_case_references WHERE request_id=e.request_id;
 IF rid IS NULL THEN
 INSERT INTO ops.support_cases(title,summary,reporter_id,reporter_verified,created_by,module,code) VALUES(btrim(d->>'title'),btrim(d->>'summary'),(d->>'reporterId')::uuid,(d->>'reporterVerified')::boolean,actor,e.module,e.code) RETURNING id INTO rid;
 INSERT INTO ops.support_case_references SELECT e.request_id,rid,e.occurred_at,e.module,e.code,e.status;
 END IF;
 SELECT * INTO c FROM ops.support_cases WHERE id=rid;
 ELSE
 SELECT * INTO c FROM ops.support_cases WHERE id=(d->>'id')::uuid AND (closed_at IS NULL OR closed_at>=clock_timestamp()-interval '365 days') FOR UPDATE;
 IF c.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF c.version::text IS DISTINCT FROM d->>'version' THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;rid:=c.id;
 IF op='update' THEN
 IF target IS NULL OR target NOT IN('new','reviewed','processing','waiting','resolved') OR NOT(target=c.status AND c.status<>'resolved' OR c.status='new' AND target='reviewed' OR c.status='reviewed' AND target IN('processing','waiting') OR c.status='processing' AND target IN('waiting','resolved') OR c.status='waiting' AND target IN('processing','resolved') OR c.status='resolved' AND target='new') THEN RAISE EXCEPTION 'SUPPORT_TRANSITION_INVALID' USING ERRCODE='22023';END IF;
 IF owner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=owner AND status='active' AND role='admin') OR target<>'new' AND owner IS NULL THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 IF target='resolved' AND(NOT ops.support_text_valid(d->>'resolution',1000) OR NOT ops.support_text_valid(d->>'verification',1000)) THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 UPDATE ops.support_cases SET status=target,owner_id=owner,version=version+1,updated_at=clock_timestamp(),closed_at=CASE WHEN target='resolved' THEN clock_timestamp() END,resolution=CASE WHEN target='resolved' THEN d->>'resolution' ELSE resolution END,verification=CASE WHEN target='resolved' THEN d->>'verification' ELSE verification END WHERE id=rid;
 ELSIF op='context' THEN
 IF c.status='resolved' THEN RAISE EXCEPTION 'SUPPORT_TRANSITION_INVALID' USING ERRCODE='22023';END IF;
 IF (d->>'reporterVerified')::boolean IS NULL OR ((d->>'reporterVerified')::boolean AND d->>'reporterId' IS NULL) OR (d->>'reporterId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=(d->>'reporterId')::uuid)) THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 UPDATE ops.support_cases SET reporter_id=(d->>'reporterId')::uuid,reporter_verified=(d->>'reporterVerified')::boolean,version=version+1,updated_at=clock_timestamp() WHERE id=rid;
 ELSIF op='link' THEN
 SELECT * INTO e FROM ops.support_events WHERE request_id=(d->>'reference')::uuid AND occurred_at>=clock_timestamp()-interval '30 days';
 IF e.request_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF e.module<>c.module OR e.code<>c.code OR c.status='resolved' THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM ops.support_case_references WHERE request_id=e.request_id AND case_id<>rid) THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 INSERT INTO ops.support_case_references SELECT e.request_id,rid,e.occurred_at,e.module,e.code,e.status ON CONFLICT(request_id) DO NOTHING;
 UPDATE ops.support_cases SET version=version+1,updated_at=clock_timestamp() WHERE id=rid;
 ELSIF op='note' THEN
 IF c.status='resolved' THEN RAISE EXCEPTION 'SUPPORT_TRANSITION_INVALID' USING ERRCODE='22023';END IF;
 UPDATE ops.support_cases SET version=version+1,updated_at=clock_timestamp() WHERE id=rid;
 ELSE RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 END IF;
 SELECT jsonb_build_object('id',id,'version',version::text) INTO res FROM ops.support_cases WHERE id=rid;
 INSERT INTO ops.support_case_history(case_id,actor_id,operation_key,payload_hash,result,action,note,from_status,to_status,changes)
 SELECT rid,actor,(d->>'operationKey')::uuid,hash,res,op,note,c.status,n.status,jsonb_build_object(
 'before',CASE WHEN op='create' THEN null ELSE jsonb_build_object('owner',(SELECT full_name FROM app.app_users WHERE id=c.owner_id),'reporter',(SELECT full_name FROM app.app_users WHERE id=c.reporter_id),'verified',c.reporter_verified,'resolution',c.resolution,'verification',c.verification) END,
 'after',jsonb_build_object('owner',(SELECT full_name FROM app.app_users WHERE id=n.owner_id),'reporter',(SELECT full_name FROM app.app_users WHERE id=n.reporter_id),'verified',n.reporter_verified,'resolution',n.resolution,'verification',n.verification)) FROM ops.support_cases n WHERE n.id=rid;
 PERFORM app.activity_audit('support-'||op,rid,'Perubahan penanganan kendala',null,jsonb_build_object('version',res->>'version'));RETURN res;
END $$;

CREATE FUNCTION app.support_cases_read(p_session text,d jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;res jsonb;pg int:=coalesce((d->>'page')::int,1);v_case ops.support_cases%ROWTYPE;
BEGIN
 actor:=app.activity_guard(p_session,false);PERFORM auth_private.require_admin();
 IF d->>'kind'='detail' THEN
 SELECT * INTO v_case FROM ops.support_cases WHERE id=(d->>'id')::uuid AND(closed_at IS NULL OR closed_at>=clock_timestamp()-interval '365 days');
 IF v_case.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 RETURN (to_jsonb(v_case)-'version')||jsonb_build_object('version',v_case.version::text,'reporter',(SELECT full_name FROM app.app_users WHERE id=v_case.reporter_id),'owner',(SELECT full_name FROM app.app_users WHERE id=v_case.owner_id),
 'references',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY occurred_at,request_id) FROM ops.support_case_references r WHERE case_id=v_case.id),'[]'),
 'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'actor',u.full_name,'action',h.action,'note',h.note,'changes',h.changes,'from',h.from_status,'to',h.to_status,'at',h.created_at) ORDER BY h.created_at,h.id) FROM ops.support_case_history h JOIN app.app_users u ON u.id=h.actor_id WHERE h.case_id=v_case.id),'[]'));
 ELSIF d->>'kind'='list' THEN
 IF pg NOT BETWEEN 1 AND 100000 OR length(coalesce(d->>'q',''))>100 OR coalesce(d->>'status','') NOT IN('','new','reviewed','processing','waiting','resolved') THEN RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
 WITH f AS(SELECT c.id,c.title,c.status,c.version::text,c.module,c.code,c.updated_at,(SELECT full_name FROM app.app_users WHERE id=c.owner_id) owner,(SELECT count(*) FROM ops.support_case_references WHERE case_id=c.id) reference_count FROM ops.support_cases c
 WHERE(c.closed_at IS NULL OR c.closed_at>=clock_timestamp()-interval '365 days') AND(coalesce(d->>'status','')='' OR c.status=d->>'status') AND(coalesce(d->>'q','')='' OR position(lower(d->>'q') in lower(c.title||' '||c.code||' '||c.module))>0 OR EXISTS(SELECT 1 FROM ops.support_case_references r WHERE r.case_id=c.id AND r.request_id::text=lower(d->>'q')))),paged AS(SELECT * FROM f ORDER BY updated_at DESC,id LIMIT 20 OFFSET(pg-1)*20)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY updated_at DESC,id) FROM paged),'[]'),'total',(SELECT count(*) FROM f),'page',pg,'pageSize',20,'owners',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id) FROM app.app_users WHERE role='admin' AND status='active'),'[]'),'reporters',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id) FROM app.app_users WHERE status='active'),'[]')) INTO res;RETURN res;
 ELSE RAISE EXCEPTION 'SUPPORT_INVALID' USING ERRCODE='22023';END IF;
END $$;

CREATE FUNCTION app.support_monitor_read(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;heartbeat timestamptz;enabled boolean;failed_jobs int;failed_messages int;queued int;age_seconds int;samples bigint;average numeric;slow bigint;res jsonb;alerts jsonb:='[]';BEGIN
 actor:=app.activity_guard(p_session,false);PERFORM auth_private.require_admin();
 SELECT max(used_at) INTO heartbeat FROM ops.worker_tickets;
 SELECT coalesce((typed_value->>'jobsEnabled')::boolean,false) OR coalesce((typed_value->>'mailEnabled')::boolean,false) OR coalesce((typed_value->>'securityMailEnabled')::boolean,false) INTO enabled FROM app.system_settings WHERE key='operations.config';
 SELECT count(*) INTO failed_jobs FROM ops.job_runs WHERE state='failed';
 SELECT (SELECT count(*) FROM ops.domain_outbox WHERE state IN('failed','unknown'))+(SELECT count(*) FROM ops.notification_outbox WHERE state IN('failed','unknown')) INTO failed_messages;
 SELECT count(*),coalesce(extract(epoch FROM clock_timestamp()-min(created_at))::int,0) INTO queued,age_seconds FROM(SELECT created_at FROM ops.domain_outbox WHERE state IN('pending','retry_wait') AND next_attempt_at<=clock_timestamp() UNION ALL SELECT created_at FROM ops.notification_outbox WHERE state IN('pending','retry_wait') AND next_attempt_at<=clock_timestamp()) q;
 SELECT coalesce(sum(rm.samples),0),coalesce(round(sum(rm.total_ms)::numeric/nullif(sum(rm.samples),0),1),0),coalesce(max(rm.max_ms),0) INTO samples,average,slow FROM ops.request_metrics rm WHERE bucket>=clock_timestamp()-interval '1 hour';
 IF failed_jobs>0 THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','FAILED_JOBS','message','Job gagal: periksa alasan dan status sumber sebelum retry.','href','/admin/operasional'));END IF;
 IF failed_messages>0 THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','FAILED_MESSAGES','message','Pengiriman gagal/hasil tidak pasti: rekonsiliasi sebelum retry; jangan otomatis mengirim ulang status unknown.','href','/admin/operasional'));END IF;
 IF queued>0 AND age_seconds>=900 THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','QUEUE_DELAY','message','Antrean siap kirim berusia ≥15 menit. Periksa dispatch dan worker; pengaturan nonaktif dapat menjelaskan antrean tertahan.','href','/admin/operasional'));END IF;
 IF enabled AND(heartbeat IS NULL OR heartbeat<clock_timestamp()-interval '15 minutes') THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','WORKER_STALE','message','Worker belum terlihat dalam 15 menit. Periksa scheduler/tiket dan endpoint; heartbeat bukan bukti sukses setiap job.','href','/admin/operasional'));END IF;
 IF samples>=10 AND average>=2000 THEN alerts:=alerts||jsonb_build_array(jsonb_build_object('code','SLOW_API','message','Rata-rata respons API modul ≥2 detik, minimal 10 sampel/jam. Telusuri modul, waktu dan deployment.','href','/admin/laporan-kendala'));END IF;
 SELECT jsonb_build_object('generatedAt',clock_timestamp(),'lastWorkerAt',heartbeat,'workerEnabled',coalesce(enabled,false),'failedJobs',failed_jobs,'failedMessages',failed_messages,'readyQueue',queued,'oldestQueueSeconds',age_seconds,'samples',samples,'averageMs',average,'maxMs',slow,'alerts',alerts,
 'groups',coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.count DESC,g.module,g.code) FROM(SELECT module,code,count(DISTINCT request_id)::int count FROM(SELECT request_id,module,code FROM ops.support_events WHERE occurred_at>=clock_timestamp()-interval '30 days' UNION SELECT request_id,module,code FROM ops.support_case_references WHERE occurred_at>=clock_timestamp()-interval '30 days') x GROUP BY module,code ORDER BY count DESC,module,code LIMIT 20)g),'[]'),
 'modules',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.module) FROM(SELECT module,sum(rm.samples)::int samples,round(sum(rm.total_ms)::numeric/nullif(sum(rm.samples),0),1) average_ms,max(rm.max_ms) max_ms FROM ops.request_metrics rm WHERE bucket>=clock_timestamp()-interval '1 hour' GROUP BY module)m),'[]')) INTO res;RETURN res;
END $$;
REVOKE ALL ON FUNCTION ops.support_text_valid(text,int),ops.support_purge(),ops.record_request_metric(text,int,int),app.support_case_command(text,jsonb),app.support_cases_read(text,jsonb),app.support_monitor_read(text) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
GRANT EXECUTE ON FUNCTION ops.record_request_metric(text,int,int) TO sim_guru_auth;
GRANT EXECUTE ON FUNCTION app.support_case_command(text,jsonb),app.support_cases_read(text,jsonb),app.support_monitor_read(text) TO sim_guru_business;
RESET ROLE;
