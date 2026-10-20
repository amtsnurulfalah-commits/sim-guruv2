-- Staging is private. Import application is operator-only, never a business RPC.
SET LOCAL ROLE sim_guru_owner;
CREATE TABLE ops.migration_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text NOT NULL,source_checksum text NOT NULL CHECK(source_checksum~'^[a-f0-9]{64}$'),exported_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN('blocked','validated','imported','reconciled')),summary jsonb NOT NULL,metadata jsonb NOT NULL,created_by uuid NOT NULL REFERENCES app.app_users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),version bigint NOT NULL DEFAULT 1,plan_hash text,imported_at timestamptz,
 UNIQUE(source,source_checksum));
CREATE TABLE ops.migration_staging_rows(batch_id uuid NOT NULL REFERENCES ops.migration_batches(id),source_table text NOT NULL,row_number int NOT NULL CHECK(row_number>=2),legacy_id text,raw_payload jsonb NOT NULL,normalized_payload jsonb NOT NULL,PRIMARY KEY(batch_id,source_table,row_number));
CREATE TABLE ops.migration_issues(batch_id uuid NOT NULL REFERENCES ops.migration_batches(id),sequence int NOT NULL,code text NOT NULL,source_table text NOT NULL,row_number int,field text,severity text NOT NULL CHECK(severity IN('error','review')),resolution text,resolved_by uuid REFERENCES app.app_users(id),resolved_at timestamptz,PRIMARY KEY(batch_id,sequence));
CREATE TABLE ops.migration_id_map(source text NOT NULL,source_table text NOT NULL,legacy_id text NOT NULL,target_table text NOT NULL,target_key jsonb NOT NULL,payload_hash text NOT NULL CHECK(payload_hash~'^[a-f0-9]{64}$'),batch_id uuid NOT NULL REFERENCES ops.migration_batches(id),PRIMARY KEY(source,source_table,legacy_id,target_table));
CREATE INDEX migration_map_batch ON ops.migration_id_map(batch_id);
CREATE TABLE ops.migration_gates(batch_id uuid NOT NULL REFERENCES ops.migration_batches(id),gate text NOT NULL CHECK(gate IN('source_backup','restore_drill','reconciliation','parallel_run','uat_admin','uat_guru','legacy_freeze','delta_reconciliation','rollback_plan','cutover_approval')),passed boolean NOT NULL,evidence text NOT NULL CHECK(length(btrim(evidence)) BETWEEN 10 AND 1000),actor_id uuid NOT NULL REFERENCES app.app_users(id),version bigint NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(batch_id,gate));
CREATE INDEX migration_batches_actor ON ops.migration_batches(created_by);
CREATE INDEX migration_issues_actor ON ops.migration_issues(resolved_by);
CREATE INDEX migration_gates_actor ON ops.migration_gates(actor_id);
DO $$DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['migration_batches','migration_staging_rows','migration_issues','migration_id_map','migration_gates'] LOOP EXECUTE format('ALTER TABLE ops.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE ops.%I FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY owner_internal ON ops.%I TO sim_guru_owner USING(true) WITH CHECK(true)',t);END LOOP;END$$;
CREATE FUNCTION app.migration_read(p_session text,p_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE actor uuid;BEGIN
 actor:=app.activity_guard(p_session,false);PERFORM auth_private.require_admin();
 IF p_id IS NULL THEN RETURN jsonb_build_object('batches',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('version',b.version::text,'gates',coalesce((SELECT jsonb_agg(to_jsonb(g)-ARRAY['actor_id','batch_id']||jsonb_build_object('version',g.version::text) ORDER BY g.gate) FROM ops.migration_gates g WHERE g.batch_id=b.id),'[]'::jsonb))) FROM (SELECT id,source,source_checksum,state,summary,version,created_at FROM ops.migration_batches ORDER BY created_at DESC LIMIT 50)b),'[]'::jsonb));END IF;
 IF NOT EXISTS(SELECT 1 FROM ops.migration_batches WHERE id=p_id) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 RETURN jsonb_build_object('issues',coalesce((SELECT jsonb_agg(to_jsonb(i)-ARRAY['resolved_by','batch_id'] ORDER BY sequence) FROM ops.migration_issues i WHERE batch_id=p_id),'[]'::jsonb),'counts',(SELECT jsonb_object_agg(source_table,n) FROM(SELECT source_table,count(*) n FROM ops.migration_staging_rows WHERE batch_id=p_id GROUP BY source_table)x),'mappedRows',(SELECT count(*) FROM ops.migration_id_map WHERE batch_id=p_id));END$$;
CREATE FUNCTION app.migration_stage(p_session text,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE actor uuid;bid uuid;n int;BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();
 IF length(p::text)>6000000 OR p->>'sourceChecksum'!~'^[a-f0-9]{64}$' OR jsonb_array_length(p->'rows')>10000 THEN RAISE EXCEPTION 'INVALID_MIGRATION' USING ERRCODE='22023';END IF;
 SELECT id INTO bid FROM ops.migration_batches WHERE source=p->>'source' AND source_checksum=p->>'sourceChecksum';IF bid IS NOT NULL THEN RETURN jsonb_build_object('id',bid,'replayed',true);END IF;
 INSERT INTO ops.migration_batches(source,source_checksum,exported_at,state,summary,metadata,created_by) VALUES(p->>'source',p->>'sourceChecksum',(p->>'exportedAt')::timestamptz,CASE WHEN (p->'summary'->>'errors')::int=0 AND (p->'summary'->>'review')::int=0 THEN 'validated' ELSE 'blocked' END,p->'summary',p->'metadata',actor) RETURNING id INTO bid;
 INSERT INTO ops.migration_staging_rows(batch_id,source_table,row_number,legacy_id,raw_payload,normalized_payload) SELECT bid,x->>'sheet',(x->>'row')::int,x->>'legacyId',x->'raw',x->'normalized' FROM jsonb_array_elements(p->'rows') x;
 INSERT INTO ops.migration_issues(batch_id,sequence,code,source_table,row_number,field,severity) SELECT bid,ordinality::int,x->>'code',x->>'sheet',(x->>'row')::int,x->>'field',x->>'severity' FROM jsonb_array_elements(p->'issues') WITH ORDINALITY v(x,ordinality);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(actor,'migration.stage',bid,'Unggah ekspor ke staging privat',p->'summary');RETURN jsonb_build_object('id',bid,'replayed',false);END$$;
CREATE FUNCTION app.migration_command(p_session text,k text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$DECLARE actor uuid;b ops.migration_batches%ROWTYPE;v bigint;BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();SELECT * INTO b FROM ops.migration_batches WHERE id=(d->>'batchId')::uuid FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF b.version<>(d->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF length(btrim(coalesce(d->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'INVALID_REASON' USING ERRCODE='22023';END IF;
 IF length(btrim(coalesce(d->>'evidence',''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'INVALID_EVIDENCE' USING ERRCODE='22023';END IF;
 IF k='resolve' THEN
 UPDATE ops.migration_issues SET resolution=d->>'evidence',resolved_by=actor,resolved_at=clock_timestamp() WHERE batch_id=b.id AND sequence=(d->>'sequence')::int AND severity='review' AND resolution IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'REVIEW_NOT_ALLOWED' USING ERRCODE='42501';END IF;
 UPDATE ops.migration_gates SET passed=false,version=version+1,updated_at=clock_timestamp() WHERE batch_id=b.id;
 UPDATE ops.migration_batches SET state=CASE WHEN EXISTS(SELECT 1 FROM ops.migration_issues WHERE batch_id=b.id AND resolution IS NULL) THEN 'blocked' ELSE 'validated' END,version=version+1 WHERE id=b.id RETURNING version INTO v;
 ELSIF k='gate' THEN
 IF length(btrim(coalesce(d->>'evidence',''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'INVALID_EVIDENCE' USING ERRCODE='22023';END IF;
 IF (d->>'passed')::boolean AND (b.state='blocked' OR EXISTS(SELECT 1 FROM ops.migration_issues WHERE batch_id=b.id AND resolution IS NULL)) THEN RAISE EXCEPTION 'MIGRATION_BLOCKED' USING ERRCODE='42501';END IF;
 IF d->>'gate' IN('reconciliation','delta_reconciliation','cutover_approval') AND (d->>'passed')::boolean AND b.state NOT IN('imported','reconciled') THEN RAISE EXCEPTION 'MIGRATION_NOT_IMPORTED' USING ERRCODE='42501';END IF;
 IF d->>'gate'='cutover_approval' AND (d->>'passed')::boolean AND (SELECT count(*) FROM ops.migration_gates WHERE batch_id=b.id AND passed AND gate<>'cutover_approval')<>9 THEN RAISE EXCEPTION 'CUTOVER_GATES_INCOMPLETE' USING ERRCODE='42501';END IF;
 INSERT INTO ops.migration_gates(batch_id,gate,passed,evidence,actor_id) VALUES(b.id,d->>'gate',(d->>'passed')::boolean,d->>'evidence',actor) ON CONFLICT(batch_id,gate) DO UPDATE SET passed=excluded.passed,evidence=excluded.evidence,actor_id=excluded.actor_id,version=ops.migration_gates.version+1,updated_at=clock_timestamp();
 IF d->>'gate'<>'cutover_approval' THEN UPDATE ops.migration_gates SET passed=false,version=version+1,updated_at=clock_timestamp() WHERE batch_id=b.id AND gate='cutover_approval';END IF;
 UPDATE ops.migration_batches SET version=version+1 WHERE id=b.id RETURNING version INTO v;
 ELSE RAISE EXCEPTION 'INVALID_OPERATION' USING ERRCODE='22023';END IF;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(actor,'migration.'||k,b.id,d->>'reason',jsonb_build_object('gate',d->>'gate','passed',d->'passed','version',v));RETURN jsonb_build_object('version',v::text);END$$;
REVOKE ALL ON FUNCTION app.migration_read(text,uuid),app.migration_stage(text,jsonb),app.migration_command(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.migration_read(text,uuid),app.migration_stage(text,jsonb),app.migration_command(text,text,jsonb) TO sim_guru_business;
RESET ROLE;
