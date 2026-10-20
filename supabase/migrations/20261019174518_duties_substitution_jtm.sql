-- Tahap 4.1–4.4. Canonical occurrences/assignments and one append-only ledger.
SET LOCAL ROLE sim_guru_owner;
CREATE TABLE app.duty_schedules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN('PIKET','UPACARA')),user_id uuid NOT NULL REFERENCES app.app_users(id),academic_period_id uuid NOT NULL REFERENCES app.academic_periods(id),day_index int NOT NULL CHECK(day_index BETWEEN 0 AND 6),date date,valid_from date NOT NULL,valid_to date NOT NULL,time_start time NOT NULL,time_end time NOT NULL,active boolean NOT NULL DEFAULT true,version bigint NOT NULL DEFAULT 1 CHECK(version>0),CHECK(time_end>time_start),CHECK(valid_to-valid_from BETWEEN 0 AND 365),CHECK((kind='PIKET' AND date IS NULL) OR(kind='UPACARA' AND date IS NOT NULL AND day_index=1 AND extract(dow FROM date)=1 AND valid_from=date AND valid_to=date)));
CREATE UNIQUE INDEX ceremony_date_unique ON app.duty_schedules(date) WHERE kind='UPACARA' AND active;
CREATE INDEX duties_user_window ON app.duty_schedules(user_id,day_index,valid_from,valid_to) WHERE active;
ALTER TABLE app.activity_occurrences ALTER COLUMN schedule_id DROP NOT NULL,ALTER COLUMN class_id DROP NOT NULL,ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE app.activity_occurrences DROP CONSTRAINT activity_occurrences_kind_check;
ALTER TABLE app.activity_occurrences ADD COLUMN duty_schedule_id uuid REFERENCES app.duty_schedules(id),ADD CONSTRAINT occurrence_kind CHECK(kind IN('KBM','PIKET','UPACARA')),ADD CONSTRAINT occurrence_source CHECK((kind='KBM' AND schedule_id IS NOT NULL AND duty_schedule_id IS NULL AND class_id IS NOT NULL AND subject_id IS NOT NULL) OR(kind IN('PIKET','UPACARA') AND schedule_id IS NULL AND duty_schedule_id IS NOT NULL AND class_id IS NULL AND subject_id IS NULL));
CREATE UNIQUE INDEX duty_occurrence_date ON app.activity_occurrences(duty_schedule_id,date) WHERE duty_schedule_id IS NOT NULL;
ALTER TABLE app.activity_assignments ADD COLUMN effective_name text;
UPDATE app.activity_assignments a SET effective_name=o.snapshot->>'teacherName' FROM app.activity_occurrences o WHERE o.id=a.occurrence_id;
CREATE FUNCTION app.assignment_name() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN IF NEW.effective_name IS NULL THEN SELECT full_name INTO NEW.effective_name FROM app.app_users WHERE id=NEW.effective_user_id;END IF;RETURN NEW;END $$;
CREATE TRIGGER assignment_name BEFORE INSERT ON app.activity_assignments FOR EACH ROW EXECUTE FUNCTION app.assignment_name();
CREATE TABLE app.substitutions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),occurrence_id uuid NOT NULL REFERENCES app.activity_occurrences(id),assignment_id uuid NOT NULL REFERENCES app.activity_assignments(id),original_user_id uuid NOT NULL REFERENCES app.app_users(id),substitute_user_id uuid NOT NULL REFERENCES app.app_users(id),assigned_by uuid NOT NULL REFERENCES app.app_users(id),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),cancelled_at timestamptz,replaced_by_id uuid REFERENCES app.substitutions(id),CHECK(original_user_id<>substitute_user_id));
CREATE UNIQUE INDEX one_substitution ON app.substitutions(occurrence_id) WHERE cancelled_at IS NULL;
CREATE INDEX substitute_user ON app.substitutions(substitute_user_id,occurrence_id) WHERE cancelled_at IS NULL;
CREATE TABLE finance.jtm_adjustments(occurrence_id uuid PRIMARY KEY REFERENCES app.activity_occurrences(id),adjusted_jtm numeric(12,4) NOT NULL CHECK(adjusted_jtm>=0 AND adjusted_jtm=trunc(adjusted_jtm)),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),updated_by uuid NOT NULL REFERENCES app.app_users(id));
CREATE TABLE finance.jtm_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),occurrence_id uuid NOT NULL REFERENCES app.activity_occurrences(id),user_id uuid NOT NULL REFERENCES app.app_users(id),allocated_jtm numeric(12,4) NOT NULL CHECK(allocated_jtm>0),allocated_by uuid NOT NULL REFERENCES app.app_users(id),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 500),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),cancelled_at timestamptz);
CREATE UNIQUE INDEX allocation_receiver ON finance.jtm_allocations(occurrence_id,user_id) WHERE cancelled_at IS NULL;
CREATE INDEX allocations_user ON finance.jtm_allocations(user_id,occurrence_id) WHERE cancelled_at IS NULL;
CREATE TABLE ops.duty_previews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES app.app_users(id),request jsonb NOT NULL,fingerprint text NOT NULL,expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',consumed_at timestamptz);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['app.duty_schedules','app.substitutions','finance.jtm_adjustments','finance.jtm_allocations','ops.duty_previews'] LOOP EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker',t);END LOOP;END $$;
ALTER TABLE finance.jtm_ledger ALTER COLUMN journal_id DROP NOT NULL;
ALTER TABLE finance.jtm_ledger DROP CONSTRAINT jtm_ledger_source_kind_check,DROP CONSTRAINT jtm_ledger_check;
ALTER TABLE finance.jtm_ledger ADD COLUMN assignment_id uuid REFERENCES app.activity_assignments(id),ADD COLUMN allocation_id uuid REFERENCES finance.jtm_allocations(id),ADD CONSTRAINT ledger_source_kind CHECK(source_kind IN('KBM','PIKET','UPACARA','PARTIAL_SUB_KBM','PARTIAL_SUB_PIKET','REVERSAL')),ADD CONSTRAINT ledger_sign CHECK((source_kind<>'REVERSAL' AND jtm>=0 AND reverses_id IS NULL) OR(source_kind='REVERSAL' AND jtm<=0 AND reverses_id IS NOT NULL));
CREATE UNIQUE INDEX ledger_assignment_revision ON finance.jtm_ledger(assignment_id,revision,source_kind) WHERE source_kind IN('PIKET','UPACARA');
CREATE UNIQUE INDEX ledger_allocation_revision ON finance.jtm_ledger(allocation_id,revision,source_kind) WHERE source_kind IN('PARTIAL_SUB_KBM','PARTIAL_SUB_PIKET');
CREATE FUNCTION app.jtm_basis(p_occurrence uuid) RETURNS numeric LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT coalesce((SELECT adjusted_jtm FROM finance.jtm_adjustments WHERE occurrence_id=o.id),o.scheduled_jtm) FROM app.activity_occurrences o WHERE id=p_occurrence $$;
CREATE FUNCTION app.is_piket(p_user uuid,p_date date) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 FROM app.daily_attendance WHERE user_id=p_user AND date=p_date AND actual_time_in IS NOT NULL) AND(EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id JOIN app.activity_confirmations c ON c.assignment_id=a.id AND c.revoked_at IS NULL WHERE o.kind='PIKET' AND o.date=p_date AND a.effective_user_id=p_user) OR EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences o ON o.id=r.occurrence_id JOIN app.activity_assignments a ON a.occurrence_id=o.id JOIN app.activity_confirmations c ON c.assignment_id=a.id AND c.revoked_at IS NULL WHERE o.kind='PIKET' AND o.date=p_date AND r.user_id=p_user AND r.cancelled_at IS NULL AND r.allocated_jtm>0)) $$;
CREATE FUNCTION app.is_duty_target(p_user uuid,p_date date) RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.kind='PIKET' AND o.date=p_date AND a.effective_user_id=p_user) OR EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences o ON o.id=r.occurrence_id WHERE o.kind='PIKET' AND o.date=p_date AND r.user_id=p_user AND r.cancelled_at IS NULL) $$;
ALTER FUNCTION app.ensure_occurrences(date) RENAME TO ensure_teaching_occurrences;
CREATE FUNCTION app.ensure_occurrences(p_date date) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE context jsonb;BEGIN
 PERFORM app.ensure_teaching_occurrences(p_date);IF p_date NOT BETWEEN app.activity_today()-1 AND app.activity_today() THEN RETURN;END IF;context:=app.day_context_internal(p_date);IF NOT coalesce((context->>'kbmEnabled')::boolean,false) THEN RETURN;END IF;
 INSERT INTO app.activity_occurrences(kind,duty_schedule_id,date,academic_period_id,time_start,time_end,scheduled_jtm,expected_students,snapshot)
 SELECT d.kind,d.id,p_date,d.academic_period_id,d.time_start,d.time_end,CASE d.kind WHEN 'PIKET' THEN 4 ELSE 5 END,0,jsonb_build_object('teacherName',u.full_name,'dutyVersion',d.version::text,'dayContext',context,'exclusive',d.kind='UPACARA') FROM app.duty_schedules d JOIN app.app_users u ON u.id=d.user_id WHERE d.active AND u.status='active' AND u.role='guru' AND p_date BETWEEN d.valid_from AND d.valid_to AND d.day_index=extract(dow FROM p_date) AND d.academic_period_id=(context->>'academicPeriodId')::uuid ON CONFLICT DO NOTHING;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id) SELECT o.id,d.user_id,d.user_id FROM app.activity_occurrences o JOIN app.duty_schedules d ON d.id=o.duty_schedule_id WHERE o.date=p_date ON CONFLICT DO NOTHING;END $$;
CREATE OR REPLACE FUNCTION app.occurrence_dto(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('id',o.id,'assignmentId',a.id,'date',o.date,'kind',o.kind,'userId',a.effective_user_id,'originalUserId',a.original_user_id,'version',a.version::text,'classId',o.class_id,'subjectId',o.subject_id,'teacherName',a.effective_name,'originalTeacherName',o.snapshot->>'teacherName','className',o.snapshot->>'className','subjectName',o.snapshot->>'subjectName','timeStart',to_char(o.time_start,'HH24:MI'),'timeEnd',to_char(o.time_end,'HH24:MI'),'scheduledJtm',o.scheduled_jtm::text,'adjustedJtm',app.jtm_basis(o.id)::numeric(12,4)::text,'expectedStudents',o.expected_students,'claimed',EXISTS(SELECT 1 FROM app.attendance_claims WHERE assignment_id=a.id),'confirmed',EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL),'journalId',(SELECT id FROM app.teaching_journals WHERE occurrence_id=o.id AND deleted_at IS NULL),'substitutionId',(SELECT id FROM app.substitutions WHERE occurrence_id=o.id AND cancelled_at IS NULL),'allocations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'userId',r.user_id,'teacherName',u.full_name,'jtm',r.allocated_jtm::text,'reason',r.reason) ORDER BY r.id) FROM finance.jtm_allocations r JOIN app.app_users u ON u.id=r.user_id WHERE r.occurrence_id=o.id AND r.cancelled_at IS NULL),'[]'),'remainingJtm',(o.scheduled_jtm-app.jtm_basis(o.id)-coalesce((SELECT sum(allocated_jtm) FROM finance.jtm_allocations WHERE occurrence_id=o.id AND cancelled_at IS NULL),0))::numeric(12,4)::text,'adjustmentReason',(SELECT reason FROM finance.jtm_adjustments WHERE occurrence_id=o.id)) FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.id=p_id $$;
CREATE FUNCTION app.duty_candidate(p_user uuid,p_occurrence uuid) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE o app.activity_occurrences%ROWTYPE;BEGIN
 SELECT * INTO o FROM app.activity_occurrences WHERE id=p_occurrence;
 IF NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=p_user AND role='guru' AND status='active') THEN RAISE EXCEPTION 'SUBSTITUTE_INVALID' USING ERRCODE='22023';END IF;
 IF o.kind='PIKET' THEN IF EXISTS(SELECT 1 FROM app.activity_occurrences q JOIN app.activity_assignments a ON a.occurrence_id=q.id WHERE q.id<>o.id AND q.date=o.date AND q.kind='PIKET' AND a.effective_user_id=p_user) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;RETURN;END IF;
 IF EXISTS(SELECT 1 FROM app.teaching_schedules s WHERE s.user_id=p_user AND s.state<>'archived' AND o.date BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM o.date) AND s.time_start<o.time_end AND s.time_end>o.time_start AND s.id IS DISTINCT FROM o.schedule_id AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences q JOIN app.activity_assignments a ON a.occurrence_id=q.id WHERE q.schedule_id=s.id AND q.date=o.date AND a.effective_user_id<>s.user_id)) OR
 EXISTS(SELECT 1 FROM app.activity_occurrences q JOIN app.activity_assignments a ON a.occurrence_id=q.id WHERE q.id<>o.id AND q.date=o.date AND q.kind IN('KBM','UPACARA') AND a.effective_user_id=p_user AND q.time_start<o.time_end AND q.time_end>o.time_start) OR
 EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences q ON q.id=r.occurrence_id WHERE r.user_id=p_user AND r.cancelled_at IS NULL AND q.id<>o.id AND q.kind='KBM' AND q.date=o.date AND q.time_start<o.time_end AND q.time_end>o.time_start) OR
 EXISTS(SELECT 1 FROM app.duty_schedules d WHERE d.kind='UPACARA' AND d.active AND d.user_id=p_user AND d.date=o.date AND d.id IS DISTINCT FROM o.duty_schedule_id AND d.time_start<o.time_end AND d.time_end>o.time_start AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences q JOIN app.activity_assignments a ON a.occurrence_id=q.id WHERE q.duty_schedule_id=d.id AND a.effective_user_id<>d.user_id)) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;END $$;
CREATE FUNCTION app.duty_permission(p_actor uuid,p_occurrence uuid,p_operation text) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE o app.activity_occurrences%ROWTYPE;a app.activity_assignments%ROWTYPE;BEGIN
 SELECT * INTO o FROM app.activity_occurrences WHERE id=p_occurrence;SELECT * INTO a FROM app.activity_assignments WHERE occurrence_id=o.id;
 IF o.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;IF o.date<>app.activity_today() THEN RAISE EXCEPTION 'TODAY_ONLY' USING ERRCODE='42501';END IF;
 IF p_operation IN('confirm','revoke') THEN
 IF o.kind='PIKET' THEN IF NOT app.actor_is_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 ELSIF o.kind='UPACARA' THEN IF NOT app.actor_is_admin() AND a.effective_user_id<>p_actor THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 ELSIF NOT app.actor_is_admin() AND(NOT app.is_piket(p_actor,o.date) OR a.effective_user_id=p_actor) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 ELSE
 IF NOT app.actor_is_admin() AND NOT app.is_piket(p_actor,o.date) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF a.effective_user_id=p_actor OR a.original_user_id=p_actor THEN RAISE EXCEPTION 'SELF_OPERATION_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_operation IN('adjust','allocate','remove-allocation','reset') AND o.kind NOT IN('KBM','PIKET') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;END IF;END $$;
CREATE FUNCTION finance.reverse_occurrence(p_occurrence uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO finance.jtm_ledger(source_kind,journal_id,occurrence_id,user_id,date,jtm,revision,reverses_id,assignment_id,allocation_id)
 SELECT 'REVERSAL',p.journal_id,p.occurrence_id,p.user_id,p.date,-p.jtm,p.revision,p.id,p.assignment_id,p.allocation_id FROM finance.jtm_ledger p WHERE p.occurrence_id=p_occurrence AND p.source_kind<>'REVERSAL' AND NOT EXISTS(SELECT 1 FROM finance.jtm_ledger r WHERE r.reverses_id=p.id) ON CONFLICT DO NOTHING;END $$;
CREATE OR REPLACE FUNCTION finance.ledger_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE j app.teaching_journals%ROWTYPE;o app.activity_occurrences%ROWTYPE;p finance.jtm_ledger%ROWTYPE;a app.activity_assignments%ROWTYPE;r finance.jtm_allocations%ROWTYPE;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LEDGER_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.source_kind='REVERSAL' THEN SELECT * INTO p FROM finance.jtm_ledger WHERE id=NEW.reverses_id;IF p.id IS NULL OR p.source_kind='REVERSAL' OR(NEW.journal_id,NEW.occurrence_id,NEW.user_id,NEW.date,NEW.revision,NEW.assignment_id,NEW.allocation_id) IS DISTINCT FROM(p.journal_id,p.occurrence_id,p.user_id,p.date,p.revision,p.assignment_id,p.allocation_id) OR NEW.jtm<>-p.jtm THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;RETURN NEW;END IF;
 SELECT * INTO o FROM app.activity_occurrences WHERE id=NEW.occurrence_id;SELECT * INTO a FROM app.activity_assignments WHERE occurrence_id=o.id;
 IF o.id IS NULL OR NEW.date<>o.date THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 IF NEW.source_kind='KBM' THEN SELECT * INTO j FROM app.teaching_journals WHERE id=NEW.journal_id;IF j.id IS NULL OR j.occurrence_id<>o.id OR NEW.user_id<>j.user_id OR NEW.jtm<>j.credited_jtm OR NEW.revision<>j.version OR j.deleted_at IS NOT NULL OR NEW.assignment_id IS NOT NULL OR NEW.allocation_id IS NOT NULL THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 ELSIF NEW.source_kind IN('PIKET','UPACARA') THEN
 IF NEW.source_kind<>o.kind OR NEW.assignment_id IS DISTINCT FROM a.id OR NEW.user_id<>a.effective_user_id OR NEW.revision<>a.version OR NEW.journal_id IS NOT NULL OR NEW.allocation_id IS NOT NULL OR NEW.jtm<>app.jtm_basis(o.id) OR NOT EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 ELSE SELECT * INTO r FROM finance.jtm_allocations WHERE id=NEW.allocation_id;IF r.id IS NULL OR r.cancelled_at IS NOT NULL OR r.occurrence_id<>o.id OR NEW.user_id<>r.user_id OR NEW.jtm<>r.allocated_jtm OR NEW.journal_id IS NOT NULL OR NEW.assignment_id IS DISTINCT FROM a.id OR NEW.source_kind<>(CASE o.kind WHEN 'KBM' THEN 'PARTIAL_SUB_KBM' ELSE 'PARTIAL_SUB_PIKET' END) OR NEW.revision<>a.version THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;END IF;RETURN NEW;END $$;
CREATE FUNCTION finance.reconcile_occurrence(p_occurrence uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE o app.activity_occurrences%ROWTYPE;a app.activity_assignments%ROWTYPE;j app.teaching_journals%ROWTYPE;BEGIN
 SELECT * INTO o FROM app.activity_occurrences WHERE id=p_occurrence;SELECT * INTO a FROM app.activity_assignments WHERE occurrence_id=p_occurrence;
 PERFORM finance.reverse_occurrence(p_occurrence);
 IF EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL) THEN
 IF o.kind IN('PIKET','UPACARA') THEN INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,assignment_id) VALUES(o.kind,o.id,a.effective_user_id,o.date,app.jtm_basis(o.id),a.version,a.id);
 ELSE
 SELECT * INTO j FROM app.teaching_journals WHERE occurrence_id=o.id AND deleted_at IS NULL;
 IF j.id IS NOT NULL THEN UPDATE app.teaching_journals SET credited_jtm=CASE WHEN weight=1 THEN app.jtm_basis(o.id) ELSE round(app.jtm_basis(o.id)*weight,1) END,version=version+1 WHERE id=j.id RETURNING * INTO j;
 INSERT INTO finance.jtm_ledger(source_kind,journal_id,occurrence_id,user_id,date,jtm,revision) VALUES('KBM',j.id,o.id,j.user_id,o.date,j.credited_jtm,j.version);END IF;END IF;
 INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,assignment_id,allocation_id) SELECT CASE o.kind WHEN 'KBM' THEN 'PARTIAL_SUB_KBM' ELSE 'PARTIAL_SUB_PIKET' END,o.id,r.user_id,o.date,r.allocated_jtm,a.version,a.id,r.id FROM finance.jtm_allocations r WHERE r.occurrence_id=o.id AND r.cancelled_at IS NULL;
 END IF;END $$;
CREATE FUNCTION app.duty_cleanup(p_occurrence uuid,p_actor uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 PERFORM finance.reverse_occurrence(p_occurrence);UPDATE app.teaching_journals SET deleted_at=clock_timestamp(),version=version+1 WHERE occurrence_id=p_occurrence AND deleted_at IS NULL;
 UPDATE app.activity_confirmations SET revoked_at=clock_timestamp(),revoked_by=p_actor WHERE assignment_id=(SELECT id FROM app.activity_assignments WHERE occurrence_id=p_occurrence) AND revoked_at IS NULL;
 UPDATE finance.jtm_allocations SET cancelled_at=clock_timestamp() WHERE occurrence_id=p_occurrence AND cancelled_at IS NULL;DELETE FROM finance.jtm_adjustments WHERE occurrence_id=p_occurrence;
 DELETE FROM app.attendance_claims WHERE assignment_id=(SELECT id FROM app.activity_assignments WHERE occurrence_id=p_occurrence);END $$;
CREATE FUNCTION app.duty_fingerprint(p_occurrence uuid) RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT md5(jsonb_build_array(app.occurrence_dto(p_occurrence),(SELECT jsonb_agg(jsonb_build_array(id,version,deleted_at) ORDER BY id) FROM app.teaching_journals WHERE occurrence_id=p_occurrence),(SELECT jsonb_agg(id ORDER BY id) FROM finance.jtm_ledger WHERE occurrence_id=p_occurrence))::text) $$;
CREATE FUNCTION app.duty_preview(p_session text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;v_occ uuid:=(p_data->>'occurrenceId')::uuid;a app.activity_assignments%ROWTYPE;v ops.duty_previews%ROWTYPE;BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM app.duty_permission(actor,v_occ,p_data->>'operation');PERFORM finance.guard_open((SELECT date FROM app.activity_occurrences WHERE app.activity_occurrences.id=v_occ));
 SELECT * INTO a FROM app.activity_assignments WHERE occurrence_id=v_occ FOR UPDATE;IF a.version IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_data->>'operation' NOT IN('confirm','revoke','substitute','replace','cancel-substitute','adjust','allocate','remove-allocation','reset') OR length(btrim(coalesce(p_data->>'reason',''))) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'DUTY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.duty_previews(actor_id,request,fingerprint) VALUES(actor,p_data,app.duty_fingerprint(v_occ)) RETURNING * INTO v;
 RETURN jsonb_build_object('previewId',v.id,'expiresAt',v.expires_at,'operation',p_data->>'operation','current',app.occurrence_dto(v_occ),'request',p_data,'activeJournals',(SELECT count(*) FROM app.teaching_journals WHERE occurrence_id=v_occ AND deleted_at IS NULL),'activeNetJtm',coalesce((SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=v_occ),0)::numeric(12,4)::text,'authorizesMutation',false);END $$;
CREATE FUNCTION app.duty_commit(p_session text,p_preview uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;v ops.duty_previews%ROWTYPE;d jsonb;op text;o app.activity_occurrences%ROWTYPE;a app.activity_assignments%ROWTYPE;target uuid;r numeric;basis numeric;old jsonb;sid uuid;oldsub uuid;BEGIN
 actor:=app.activity_guard(p_session,true);SELECT * INTO v FROM ops.duty_previews WHERE id=p_preview FOR UPDATE;
 IF v.id IS NULL OR v.actor_id<>actor OR v.consumed_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.fingerprint IS DISTINCT FROM app.duty_fingerprint((v.request->>'occurrenceId')::uuid) THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;
 d:=v.request;op:=d->>'operation';SELECT * INTO o FROM app.activity_occurrences WHERE id=(d->>'occurrenceId')::uuid;SELECT * INTO a FROM app.activity_assignments WHERE occurrence_id=o.id FOR UPDATE;
 PERFORM app.duty_permission(actor,o.id,op);PERFORM finance.guard_open(o.date);IF a.version IS DISTINCT FROM(d->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;old:=app.occurrence_dto(o.id);
 IF op IN('substitute','replace','cancel-substitute') THEN
 SELECT id INTO oldsub FROM app.substitutions WHERE occurrence_id=o.id AND cancelled_at IS NULL;
 IF op='substitute' AND oldsub IS NOT NULL THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;
 IF op IN('replace','cancel-substitute') AND oldsub IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 target:=CASE WHEN op='cancel-substitute' THEN a.original_user_id ELSE(d->>'userId')::uuid END;
 IF op<>'cancel-substitute' AND(target IN(a.original_user_id,a.effective_user_id,actor) OR target IS NULL) THEN RAISE EXCEPTION 'SUBSTITUTE_INVALID' USING ERRCODE='22023';END IF;
 PERFORM app.duty_candidate(target,o.id); -- Validate before destructive cleanup; failure leaves prior assignment intact.
 PERFORM app.duty_cleanup(o.id,actor);
 UPDATE app.substitutions SET cancelled_at=clock_timestamp() WHERE id=oldsub;
 IF op<>'cancel-substitute' THEN INSERT INTO app.substitutions(occurrence_id,assignment_id,original_user_id,substitute_user_id,assigned_by,reason) VALUES(o.id,a.id,a.original_user_id,target,actor,d->>'reason') RETURNING id INTO sid;IF oldsub IS NOT NULL THEN UPDATE app.substitutions SET replaced_by_id=sid WHERE id=oldsub;END IF;END IF;
 UPDATE app.activity_assignments SET effective_user_id=target,effective_name=(SELECT full_name FROM app.app_users WHERE id=target),version=version+1 WHERE id=a.id;
 ELSIF op='revoke' THEN
 PERFORM app.duty_cleanup(o.id,actor);UPDATE app.activity_assignments SET version=version+1 WHERE id=a.id;
 ELSIF op='confirm' THEN
 IF NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=a.effective_user_id AND status='active' AND role='guru') THEN RAISE EXCEPTION 'SUBSTITUTE_INVALID' USING ERRCODE='22023';END IF;
 IF NOT EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL) THEN
 INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason) VALUES(a.id,actor,CASE WHEN length(btrim(d->>'reason'))<5 THEN 'Tugas: '||(d->>'reason') ELSE d->>'reason' END);UPDATE app.activity_assignments SET version=version+1 WHERE id=a.id;PERFORM finance.reconcile_occurrence(o.id);END IF;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL) THEN RAISE EXCEPTION 'NO_ACTIVE_CONFIRMATION' USING ERRCODE='42501';END IF;
 IF op='adjust' THEN
 IF coalesce(d->>'adjustedJtm','')!~'^(0|[1-9][0-9]{0,7})$' OR(d->>'adjustedJtm')::numeric>o.scheduled_jtm THEN RAISE EXCEPTION 'ADJUSTED_INVALID' USING ERRCODE='22023';END IF;
 basis:=(d->>'adjustedJtm')::numeric;IF basis+coalesce((SELECT sum(allocated_jtm) FROM finance.jtm_allocations WHERE occurrence_id=o.id AND cancelled_at IS NULL),0)>o.scheduled_jtm THEN RAISE EXCEPTION 'CONSERVATION_VIOLATION' USING ERRCODE='22023';END IF;
 INSERT INTO finance.jtm_adjustments(occurrence_id,adjusted_jtm,reason,updated_by) VALUES(o.id,basis,d->>'reason',actor) ON CONFLICT(occurrence_id) DO UPDATE SET adjusted_jtm=excluded.adjusted_jtm,reason=excluded.reason,updated_by=actor;
 ELSIF op='allocate' THEN
 target:=(d->>'userId')::uuid;IF target IS NULL OR target IN(a.original_user_id,a.effective_user_id,actor) OR coalesce(d->>'allocatedJtm','')!~'^(0|[1-9][0-9]{0,7})(\.[0-9]{1,4})?$' OR(d->>'allocatedJtm')::numeric<=0 THEN RAISE EXCEPTION 'ALLOCATION_INVALID' USING ERRCODE='22023';END IF;
 PERFORM app.duty_candidate(target,o.id);r:=(d->>'allocatedJtm')::numeric;
 IF app.jtm_basis(o.id)+coalesce((SELECT sum(allocated_jtm) FROM finance.jtm_allocations WHERE occurrence_id=o.id AND cancelled_at IS NULL),0)+r>o.scheduled_jtm THEN RAISE EXCEPTION 'CONSERVATION_VIOLATION' USING ERRCODE='22023';END IF;
 INSERT INTO finance.jtm_allocations(occurrence_id,user_id,allocated_jtm,allocated_by,reason) VALUES(o.id,target,r,actor,d->>'reason');
 ELSIF op='remove-allocation' THEN UPDATE finance.jtm_allocations SET cancelled_at=clock_timestamp() WHERE id=(d->>'allocationId')::uuid AND occurrence_id=o.id AND cancelled_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 ELSIF op='reset' THEN UPDATE finance.jtm_allocations SET cancelled_at=clock_timestamp() WHERE occurrence_id=o.id AND cancelled_at IS NULL;DELETE FROM finance.jtm_adjustments WHERE occurrence_id=o.id;
 ELSE RAISE EXCEPTION 'DUTY_INVALID' USING ERRCODE='22023';END IF;
 UPDATE app.activity_assignments SET version=version+1 WHERE id=a.id;PERFORM finance.reconcile_occurrence(o.id);
 END IF;
 UPDATE ops.duty_previews SET consumed_at=clock_timestamp() WHERE id=v.id;
 PERFORM app.activity_audit('duty-'||op,o.id,CASE WHEN length(btrim(d->>'reason'))<5 THEN 'Tugas: '||(d->>'reason') ELSE d->>'reason' END,old,app.occurrence_dto(o.id));RETURN app.occurrence_dto(o.id);END $$;
CREATE FUNCTION app.duty_schedule_save(p_session text,p_id uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;old app.duty_schedules%ROWTYPE;n app.duty_schedules%ROWTYPE;uid uuid:=(p_data->>'userId')::uuid;p app.academic_periods%ROWTYPE;d date;v_id uuid;BEGIN
 actor:=app.master_guard(p_session,true);PERFORM app.schedule_dependencies();
 IF p_id IS NOT NULL THEN SELECT * INTO old FROM app.duty_schedules WHERE id=p_id FOR UPDATE;IF old.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;END IF;
 IF coalesce(old.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF length(btrim(coalesce(p_data->>'reason',''))) NOT BETWEEN 5 AND 500 OR NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=uid AND role='guru' AND status='active') THEN RAISE EXCEPTION 'DUTY_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO p FROM app.academic_periods WHERE id=(p_data->>'academicPeriodId')::uuid AND archived_at IS NULL;
 n:=jsonb_populate_record(null::app.duty_schedules,jsonb_build_object('id',coalesce(p_id,gen_random_uuid()),'kind',p_data->>'kind','user_id',uid,'academic_period_id',p.id,'day_index',(p_data->>'dayIndex')::int,'date',p_data->>'date','valid_from',p_data->>'validFrom','valid_to',p_data->>'validTo','time_start',p_data->>'timeStart','time_end',p_data->>'timeEnd','active',(p_data->>'active')::boolean,'version',coalesce(old.version,0)+1));
 IF p.id IS NULL OR n.valid_from<p.date_start OR n.valid_to>p.date_end OR n.valid_to<n.valid_from OR n.valid_to-n.valid_from>365 OR n.time_end<=n.time_start OR NOT app.schedule_weekday_exists(n.valid_from,n.valid_to,n.day_index) OR(p_id IS NULL AND n.valid_from<app.activity_today()) OR (p_id IS NOT NULL AND (old.kind<>n.kind OR old.academic_period_id<>n.academic_period_id OR old.valid_to<app.activity_today())) THEN RAISE EXCEPTION 'DUTY_INVALID' USING ERRCODE='22023';END IF;
 IF n.active AND EXISTS(SELECT 1 FROM app.duty_schedules q WHERE q.id<>n.id AND q.active AND q.kind=n.kind AND q.user_id=uid AND q.day_index=n.day_index AND q.valid_from<=n.valid_to AND q.valid_to>=n.valid_from) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;
 IF EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.duty_schedule_id=p_id AND (NOT n.active OR o.date NOT BETWEEN n.valid_from AND n.valid_to OR(n.user_id,n.day_index,n.time_start,n.time_end) IS DISTINCT FROM(old.user_id,old.day_index,old.time_start,old.time_end))) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;
 IF n.kind='UPACARA' AND n.active AND(EXISTS(SELECT 1 FROM app.teaching_schedules s WHERE s.user_id=uid AND s.state<>'archived' AND n.date BETWEEN s.valid_from AND s.valid_to AND s.day_index=1 AND s.time_start<n.time_end AND s.time_end>n.time_start) OR EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE a.effective_user_id=uid AND o.kind IN('KBM','UPACARA') AND o.date=n.date AND o.duty_schedule_id IS DISTINCT FROM n.id AND o.time_start<n.time_end AND o.time_end>n.time_start)) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;
 IF p_id IS NULL THEN INSERT INTO app.duty_schedules SELECT n.* RETURNING id INTO v_id;ELSE UPDATE app.duty_schedules SET(kind,user_id,academic_period_id,day_index,date,valid_from,valid_to,time_start,time_end,active,version)=(n.kind,n.user_id,n.academic_period_id,n.day_index,n.date,n.valid_from,n.valid_to,n.time_start,n.time_end,n.active,n.version) WHERE id=p_id RETURNING id INTO v_id;END IF;
 PERFORM app.activity_audit('duty-schedule',v_id,p_data->>'reason',to_jsonb(old),to_jsonb(n));UPDATE app.calendar_state SET revision=revision+1 WHERE singleton;RETURN to_jsonb(n)||jsonb_build_object('version',n.version::text);END $$;

ALTER TABLE app.daily_attendance DROP CONSTRAINT daily_attendance_time_in_source_check;
ALTER TABLE app.daily_attendance ADD CONSTRAINT daily_attendance_time_in_source_check CHECK(time_in_source IN('admin','self','piket'));
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.occurrences_list(text,date)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'12f3a6ca3c9f509abe2ade70d47fb7d5' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$) OR app.is_piket(a,p_date$replacement$ from 346 for 0);
 body:=overlay(body placing $replacement$kind='KBM' AND o.$replacement$ from 311 for 0);
 IF md5(body)<>'1b6e8d0fbe0cdf0be32d255ba98cc294' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.occurrence_command(text,uuid,text,bigint,text)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'71c53bfc051bbd82d4a51c303ec3b73e' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$)$replacement$ from 1379 for 9);
 body:=overlay(body placing $replacement$,$replacement$ from 1365 for 13);
 body:=overlay(body placing $replacement$$replacement$ from 1332 for 30);
 body:=overlay(body placing $replacement$$replacement$ from 1326 for 5);
 body:=overlay(body placing $replacement$u$replacement$ from 1284 for 40);
 body:=overlay(body placing $replacement$lea$replacement$ from 1282 for 1);
 body:=overlay(body placing $replacement$du$replacement$ from 1272 for 6);
 body:=overlay(body placing $replacement$RFORM$replacement$ from 1267 for 0);
 body:=overlay(body placing $replacement$$replacement$ from 1263 for 3);
 body:=overlay(body placing $replacement$$replacement$ from 1261 for 1);
 body:=overlay(body placing $replacement$) OR app.is_piket(a,o.date)$replacement$ from 904 for 0);
 body:=overlay(body placing $replacement$o.kind='KBM' AND($replacement$ from 885 for 0);
 IF md5(body)<>'629bec2fd47faa06824a80e1e09ee3c5' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.attendance_command(text,text,jsonb)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'b5f9f678d19c092f3ab5941aad0067ed' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$' WHEN d.user_id<>a THEN 'piket$replacement$ from 3121 for 0);
 body:=overlay(body placing $replacement$';END IF;
 IF NOT app.actor_is_admin() AND app.is_duty_target(d.user_id,d.date) AND(d.user_id<>a OR NOT EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments x ON x.occurrence_id=o.id WHERE o.date=d.date AND o.kind='KBM' AND x.effective_user_id=a)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501$replacement$ from 2443 for 0);
 body:=overlay(body placing $replacement$ AND NOT app.is_piket(a,d.date)$replacement$ from 2388 for 0);
 body:=overlay(body placing $replacement$PERFORM app.ensure_occurrences(app.activity_today());
 $replacement$ from 2211 for 0);
 body:=overlay(body placing $replacement$NOT EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences o ON o.id=r.occurrence_id WHERE r.user_id=target AND r.cancelled_at IS NULL AND o.date=day) AND $replacement$ from 1126 for 0);
 IF md5(body)<>'738232ea50739ae278f8a901cbe5d103' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.students_save(text,jsonb)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'1d1048c7b5f8da20bbefbd110129e426' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$ AND NOT app.is_piket(a,d) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF$replacement$ from 327 for 0);
 body:=overlay(body placing $replacement$s$replacement$ from 307 for 12);
 body:=overlay(body placing $replacement$$replacement$ from 304 for 2);
 body:=overlay(body placing $replacement$or$replacement$ from 302 for 1);
 body:=overlay(body placing $replacement$pp.ac$replacement$ from 300 for 1);
 body:=overlay(body placing $replacement$T$replacement$ from 296 for 2);
 body:=overlay(body placing $replacement$ N$replacement$ from 295 for 0);
 body:=overlay(body placing $replacement$I$replacement$ from 291 for 3);
 IF md5(body)<>'a650dca5f6f53b5f9c646ed9f2a5f41b' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.journal_eligibility(uuid,uuid)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'f2bc5a5b8ce66e7865492888d614d3b2' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$ OR o.kind<>'KBM'$replacement$ from 251 for 0);
 IF md5(body)<>'be0f0ac957c52c89c1d8340856792c3e' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.journal_save(text,text,jsonb)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'81af11364682802b0f93ef92ecf96bbe' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$_basis(o.id)$replacement$ from 2613 for 0);
 body:=overlay(body placing $replacement$$replacement$ from 2600 for 10);
 body:=overlay(body placing $replacement$app$replacement$ from 2598 for 1);
 body:=overlay(body placing $replacement$_basis(o.id)$replacement$ from 2586 for 0);
 body:=overlay(body placing $replacement$$replacement$ from 2573 for 10);
 body:=overlay(body placing $replacement$app$replacement$ from 2571 for 1);
 IF md5(body)<>'2005857719dd38dd88137b90ca2cfc54' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.activity_read(text,text,jsonb)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'6e316a8e1f47a29a80bd7229f65fd04d' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$ OR app.is_piket(a,x.date)$replacement$ from 3056 for 0);
 body:=overlay(body placing $replacement$ OR app.is_piket(a,x.date)$replacement$ from 2757 for 0);
 body:=overlay(body placing $replacement$ AND NOT app.is_piket(a,d) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF$replacement$ from 2059 for 0);
 body:=overlay(body placing $replacement$s$replacement$ from 2039 for 12);
 body:=overlay(body placing $replacement$$replacement$ from 2036 for 2);
 body:=overlay(body placing $replacement$or$replacement$ from 2034 for 1);
 body:=overlay(body placing $replacement$pp.ac$replacement$ from 2032 for 1);
 body:=overlay(body placing $replacement$T$replacement$ from 2028 for 2);
 body:=overlay(body placing $replacement$ N$replacement$ from 2027 for 0);
 body:=overlay(body placing $replacement$I$replacement$ from 2023 for 3);
 body:=overlay(body placing $replacement$kind='KBM' AND o.$replacement$ from 1941 for 0);
 body:=overlay(body placing $replacement$) OR app.is_piket(a,app.activity_today()$replacement$ from 368 for 0);
 body:=overlay(body placing $replacement$canOperate',app.is_piket(a,app.activity_today()),'$replacement$ from 329 for 0);
 IF md5(body)<>'b9bc573e3bee4fd827e1d7427a6e8890' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
-- Patch the checksum-verified prior function without duplicating its unchanged body.
DO $patch$ DECLARE fn regprocedure:='app.attendance_participants(date,text)'::regprocedure; body text; BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
 IF md5(body)<>'1d2ab5b28671080c300adcc35fb515e9' THEN RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';END IF;
 body:=overlay(body placing $replacement$ AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.schedule_id=s.id AND o.date=p_date AND a.effective_user_id<>s.user_id)) OR
 EXISTS(SELECT 1 FROM app.duty_schedules d WHERE d.user_id=u.id AND d.active AND p_date BETWEEN d.valid_from AND d.valid_to AND d.day_index=extract(dow FROM p_date) AND d.academic_period_id=(c->>'academicPeriodId')::uuid AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.duty_schedule_id=d.id AND o.date=p_date AND a.effective_user_id<>d.user_id)) OR
 EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.date=p_date AND a.effective_user_id=u.id) OR
 EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences o ON o.id=r.occurrence_id WHERE o.date=p_date AND r.user_id=u.id AND r.cancelled_at IS NULL)$replacement$ from 554 for 0);
 body:=overlay(body placing $replacement$(
$replacement$ from 319 for 0);
 IF md5(body)<>'cad84c24b7d5e1d9ba933ddf3e430ae3' THEN RAISE EXCEPTION 'PATCH_ROUTINE_MISMATCH';END IF;
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);END $patch$;
CREATE FUNCTION app.duty_read(p_session text,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;operator boolean;BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM app.ensure_occurrences(p_date);operator:=app.is_piket(actor,p_date);
 RETURN jsonb_build_object('date',p_date,'canOperate',operator,'admin',app.actor_is_admin(),'occurrences',coalesce((SELECT jsonb_agg(app.occurrence_dto(o.id) ORDER BY o.kind,o.time_start,o.id) FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.date=p_date AND(app.actor_is_admin() OR operator OR a.original_user_id=actor OR a.effective_user_id=actor OR EXISTS(SELECT 1 FROM finance.jtm_allocations r WHERE r.occurrence_id=o.id AND r.user_id=actor AND r.cancelled_at IS NULL))),'[]'),
 'schedules',coalesce((SELECT jsonb_agg(to_jsonb(d)||jsonb_build_object('version',d.version::text,'teacherName',u.full_name) ORDER BY d.kind,d.valid_from,d.day_index,d.id) FROM app.duty_schedules d JOIN app.app_users u ON u.id=d.user_id WHERE p_date BETWEEN d.valid_from AND d.valid_to AND(app.actor_is_admin() OR d.user_id=actor)),'[]'),
 'teachers',CASE WHEN app.actor_is_admin() OR operator THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id) FROM app.app_users WHERE role='guru' AND status='active'),'[]') ELSE '[]'::jsonb END,
 'periods',CASE WHEN app.actor_is_admin() THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',y.label||' · Semester '||p.semester,'dateStart',p.date_start,'dateEnd',p.date_end) ORDER BY p.date_start DESC,p.id) FROM app.academic_periods p JOIN app.academic_years y ON y.id=p.academic_year_id WHERE p.archived_at IS NULL AND y.archived_at IS NULL),'[]') ELSE '[]'::jsonb END);END $$;
CREATE FUNCTION app.stage4_schedule_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF NEW.state='archived' THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.kind IN('KBM','UPACARA') AND o.date BETWEEN NEW.valid_from AND NEW.valid_to AND extract(dow FROM o.date)=NEW.day_index AND a.effective_user_id=NEW.user_id AND o.time_start<NEW.time_end AND o.time_end>NEW.time_start AND o.schedule_id IS DISTINCT FROM NEW.id) OR
 EXISTS(SELECT 1 FROM finance.jtm_allocations r JOIN app.activity_occurrences o ON o.id=r.occurrence_id WHERE r.cancelled_at IS NULL AND r.user_id=NEW.user_id AND o.kind='KBM' AND o.date BETWEEN NEW.valid_from AND NEW.valid_to AND extract(dow FROM o.date)=NEW.day_index AND o.time_start<NEW.time_end AND o.time_end>NEW.time_start AND o.schedule_id IS DISTINCT FROM NEW.id) OR
 EXISTS(SELECT 1 FROM app.duty_schedules d WHERE d.active AND d.kind='UPACARA' AND d.user_id=NEW.user_id AND d.date BETWEEN NEW.valid_from AND NEW.valid_to AND NEW.day_index=1 AND d.time_start<NEW.time_end AND d.time_end>NEW.time_start) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;RETURN NEW;END $$;
CREATE TRIGGER stage4_schedule_guard BEFORE INSERT OR UPDATE ON app.teaching_schedules FOR EACH ROW EXECUTE FUNCTION app.stage4_schedule_guard();
CREATE FUNCTION finance.conservation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE v_occ uuid:=NEW.occurrence_id;s numeric;a numeric;r numeric;BEGIN
 SELECT scheduled_jtm INTO s FROM app.activity_occurrences WHERE app.activity_occurrences.id=v_occ;a:=app.jtm_basis(v_occ);SELECT coalesce(sum(allocated_jtm),0) INTO r FROM finance.jtm_allocations WHERE occurrence_id=v_occ AND cancelled_at IS NULL;
 IF a+r>s THEN RAISE EXCEPTION 'CONSERVATION_VIOLATION' USING ERRCODE='22023';END IF;RETURN NEW;END $$;
CREATE CONSTRAINT TRIGGER adjustment_conservation AFTER INSERT OR UPDATE ON finance.jtm_adjustments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.conservation_guard();
CREATE CONSTRAINT TRIGGER allocation_conservation AFTER INSERT OR UPDATE ON finance.jtm_allocations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.conservation_guard();
DO $$ DECLARE r record;BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('app','finance') AND p.proname IN('assignment_name','jtm_basis','is_piket','is_duty_target','ensure_occurrences','duty_candidate','duty_permission','reverse_occurrence','reconcile_occurrence','duty_cleanup','duty_fingerprint','duty_preview','duty_commit','duty_schedule_save','duty_read','stage4_schedule_guard','conservation_guard') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION app.duty_preview(text,jsonb),app.duty_commit(text,uuid),app.duty_schedule_save(text,uuid,jsonb),app.duty_read(text,date) TO sim_guru_business;
CREATE FUNCTION app.duty_parent_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM app.duty_schedules WHERE academic_period_id=NEW.id AND active AND(NEW.archived_at IS NOT NULL OR valid_from<NEW.date_start OR valid_to>NEW.date_end)) THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;RETURN NEW;END $$;
CREATE TRIGGER duties_period_guard BEFORE UPDATE ON app.academic_periods FOR EACH ROW EXECUTE FUNCTION app.duty_parent_guard();
REVOKE ALL ON FUNCTION app.duty_parent_guard() FROM PUBLIC;
RESET ROLE;
