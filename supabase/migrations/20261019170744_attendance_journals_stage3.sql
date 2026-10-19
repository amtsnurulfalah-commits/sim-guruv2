-- Tahap 3.1–3.6. Internal session proof only; no Supabase Auth/JWT.
SET LOCAL ROLE sim_guru_owner;
CREATE TABLE app.activity_occurrences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind='KBM'),
 schedule_id uuid NOT NULL REFERENCES app.teaching_schedules(id),date date NOT NULL,
 academic_period_id uuid NOT NULL REFERENCES app.academic_periods(id),class_id uuid NOT NULL REFERENCES app.classes(id),
 subject_id uuid NOT NULL REFERENCES app.subjects(id),time_start time NOT NULL,time_end time NOT NULL,
 scheduled_jtm numeric(12,4) NOT NULL CHECK(scheduled_jtm>0),expected_students int NOT NULL CHECK(expected_students>=0),
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(schedule_id,date),CHECK(time_end>time_start));
CREATE TABLE app.activity_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),occurrence_id uuid NOT NULL UNIQUE REFERENCES app.activity_occurrences(id),
 original_user_id uuid NOT NULL REFERENCES app.app_users(id),effective_user_id uuid NOT NULL REFERENCES app.app_users(id),version bigint NOT NULL DEFAULT 1 CHECK(version>0));
CREATE INDEX assignments_effective ON app.activity_assignments(effective_user_id);
CREATE TABLE app.attendance_claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id uuid NOT NULL UNIQUE REFERENCES app.activity_assignments(id),user_id uuid NOT NULL REFERENCES app.app_users(id),claimed_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.activity_confirmations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),assignment_id uuid NOT NULL REFERENCES app.activity_assignments(id),confirmed_by uuid NOT NULL REFERENCES app.app_users(id),confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),revoked_by uuid REFERENCES app.app_users(id),revoked_at timestamptz,reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500));
CREATE UNIQUE INDEX one_active_confirmation ON app.activity_confirmations(assignment_id) WHERE revoked_at IS NULL;
CREATE TABLE app.daily_attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.app_users(id),date date NOT NULL,sched_time_in time,sched_time_out time,actual_time_in time,actual_time_out time,time_in_recorded_by uuid REFERENCES app.app_users(id),time_in_source text CHECK(time_in_source IN('admin','self')),extra_attendee boolean NOT NULL DEFAULT false,extra_reason text,version bigint NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(user_id,date),CHECK((sched_time_in IS NULL AND sched_time_out IS NULL) OR (sched_time_in IS NOT NULL AND sched_time_out> sched_time_in)),CHECK(actual_time_out IS NULL OR (actual_time_in IS NOT NULL AND actual_time_out>=actual_time_in)),CHECK(NOT extra_attendee OR length(btrim(extra_reason)) BETWEEN 5 AND 500));
CREATE INDEX daily_date ON app.daily_attendance(date,user_id);
CREATE TABLE app.attendance_schedule_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),day_index int NOT NULL CHECK(day_index BETWEEN 0 AND 6),sched_type text NOT NULL CHECK(sched_type IN('KBM','UJIAN')),time_in time NOT NULL,time_out time NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(day_index,sched_type),CHECK(time_out>time_in));
CREATE TABLE ops.attendance_previews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES app.app_users(id),date date NOT NULL,template_id uuid NOT NULL REFERENCES app.attendance_schedule_templates(id),fingerprint text NOT NULL,expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',consumed_at timestamptz);
CREATE TABLE app.attendance_template_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),preview_id uuid NOT NULL UNIQUE REFERENCES ops.attendance_previews(id),date date NOT NULL,template_id uuid NOT NULL REFERENCES app.attendance_schedule_templates(id),template_version bigint NOT NULL,participant_hash text NOT NULL,applied_by uuid NOT NULL REFERENCES app.app_users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE app.attendance_leaves(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attendance_id uuid NOT NULL REFERENCES app.daily_attendance(id),leave_time time NOT NULL,return_time time NOT NULL,reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),created_by uuid NOT NULL REFERENCES app.app_users(id),deleted_at timestamptz,CHECK(return_time>leave_time));
CREATE INDEX leaves_attendance ON app.attendance_leaves(attendance_id) WHERE deleted_at IS NULL;
CREATE TABLE app.student_attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),class_id uuid NOT NULL REFERENCES app.classes(id),date date NOT NULL,academic_period_id uuid NOT NULL REFERENCES app.academic_periods(id),hadir int NOT NULL CHECK(hadir>=0),sakit int NOT NULL CHECK(sakit>=0),izin int NOT NULL CHECK(izin>=0),alpa int NOT NULL CHECK(alpa>=0),submitted_by uuid NOT NULL REFERENCES app.app_users(id),submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),version bigint NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(class_id,date,academic_period_id),CHECK(hadir+sakit+izin+alpa BETWEEN 1 AND 1000));
CREATE INDEX students_date ON app.student_attendance(date,class_id);
CREATE TABLE app.teaching_journals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),occurrence_id uuid NOT NULL REFERENCES app.activity_occurrences(id),assignment_id uuid NOT NULL REFERENCES app.activity_assignments(id),user_id uuid NOT NULL REFERENCES app.app_users(id),material text NOT NULL CHECK(length(btrim(material)) BETWEEN 1 AND 2000),present int NOT NULL CHECK(present>=0),absent int NOT NULL CHECK(absent>=0),notes text NOT NULL CHECK(length(notes)<=2000),input_type text NOT NULL CHECK(input_type IN('SAME_DAY','H_MINUS_1')),weight numeric(2,1) NOT NULL CHECK(weight IN(1,0.8)),credited_jtm numeric(12,4) NOT NULL CHECK(credited_jtm>=0),submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),version bigint NOT NULL DEFAULT 1 CHECK(version>0),deleted_at timestamptz);
CREATE UNIQUE INDEX one_active_journal ON app.teaching_journals(occurrence_id) WHERE deleted_at IS NULL;
CREATE INDEX journal_owner ON app.teaching_journals(user_id,submitted_at,id);
CREATE TABLE app.journal_blocks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),subject_id uuid NOT NULL REFERENCES app.subjects(id),date_start date NOT NULL,date_end date NOT NULL,message text NOT NULL CHECK(length(btrim(message)) BETWEEN 5 AND 500),active boolean NOT NULL DEFAULT true,version bigint NOT NULL DEFAULT 1,CHECK(date_end>=date_start));
CREATE TABLE finance.period_guards(period_start date PRIMARY KEY CHECK(extract(day FROM period_start)=1),finalized_at timestamptz);
CREATE TABLE finance.jtm_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_kind text NOT NULL CHECK(source_kind IN('KBM','REVERSAL')),journal_id uuid NOT NULL REFERENCES app.teaching_journals(id),occurrence_id uuid NOT NULL REFERENCES app.activity_occurrences(id),user_id uuid NOT NULL REFERENCES app.app_users(id),date date NOT NULL,jtm numeric(12,4) NOT NULL,revision bigint NOT NULL,reverses_id uuid UNIQUE REFERENCES finance.jtm_ledger(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(journal_id,revision,source_kind),CHECK((source_kind='KBM' AND jtm>=0 AND reverses_id IS NULL) OR(source_kind='REVERSAL' AND jtm<=0 AND reverses_id IS NOT NULL)));
CREATE INDEX ledger_user_date ON finance.jtm_ledger(user_id,date);
CREATE TABLE ops.activity_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity_kind text NOT NULL,entity_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES app.app_users(id),reason text NOT NULL,old_data jsonb,new_data jsonb,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['app.activity_occurrences','app.activity_assignments','app.attendance_claims','app.activity_confirmations','app.daily_attendance','app.attendance_schedule_templates','ops.attendance_previews','app.attendance_template_applications','app.attendance_leaves','app.student_attendance','app.teaching_journals','app.journal_blocks','finance.period_guards','finance.jtm_ledger','ops.activity_revisions'] LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker',t);END LOOP;END $$;
-- Later exam/finance modules must replace these adapters before enabling mutations.
CREATE OR REPLACE FUNCTION app.schedule_dependencies() RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ BEGIN
 IF to_regclass('app.exam_periods') IS NOT NULL OR to_regclass('finance.honor_periods') IS NOT NULL THEN RAISE EXCEPTION 'CONTEXT_DEPENDENCY_UNAVAILABLE' USING ERRCODE='55000';END IF;END $$;
CREATE OR REPLACE FUNCTION app.calendar_dependencies(p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ BEGIN PERFORM app.schedule_dependencies();RETURN jsonb_build_object('assignmentIntegration','attendance_ready','activeExamPeriods','[]'::jsonb,'activeExamPeriodIds','[]'::jsonb);END $$;
CREATE FUNCTION app.activity_today() RETURNS date LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date $$;
CREATE FUNCTION app.activity_guard(p_session text,p_write boolean) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE a uuid;BEGIN
 IF p_write THEN PERFORM pg_advisory_xact_lock(734190,1);END IF;a:=auth_private.lifecycle_self(p_session);IF auth_private.resolve_actor(true) IS NULL THEN RAISE EXCEPTION 'ONBOARDING_REQUIRED' USING ERRCODE='42501';END IF;RETURN a;END $$;
CREATE FUNCTION finance.guard_open(p_date date) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE m date:=date_trunc('month',p_date)::date;f timestamptz;BEGIN
 INSERT INTO finance.period_guards(period_start) VALUES(m) ON CONFLICT DO NOTHING;SELECT finalized_at INTO f FROM finance.period_guards WHERE period_start=m FOR UPDATE;IF f IS NOT NULL THEN RAISE EXCEPTION 'FINAL_PERIOD' USING ERRCODE='42501';END IF;END $$;
CREATE FUNCTION app.activity_audit(p_kind text,p_id uuid,p_reason text,p_old jsonb,p_new jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.activity_revisions(entity_kind,entity_id,actor_id,reason,old_data,new_data) VALUES(p_kind,p_id,auth_private.resolve_actor(true),p_reason,p_old,p_new);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(auth_private.resolve_actor(true),'activity.'||p_kind,p_id,p_reason,'{}');END $$;
CREATE FUNCTION app.ensure_occurrences(p_date date) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE context jsonb;BEGIN
 IF p_date>app.activity_today() OR p_date<app.activity_today()-1 THEN RETURN;END IF;
 context:=app.day_context_internal(p_date);IF NOT coalesce((context->>'kbmEnabled')::boolean,false) THEN RETURN;END IF;
 INSERT INTO app.activity_occurrences(kind,schedule_id,date,academic_period_id,class_id,subject_id,time_start,time_end,scheduled_jtm,expected_students,snapshot)
 SELECT 'KBM',s.id,p_date,s.academic_period_id,s.class_id,s.subject_id,s.time_start,s.time_end,s.scheduled_jtm,c.expected_students,s.snapshot||jsonb_build_object('scheduleVersion',s.version::text,'classVersion',c.version::text,'dayContext',context)
 FROM app.teaching_schedules s JOIN app.classes c ON c.id=s.class_id JOIN app.app_users u ON u.id=s.user_id
 WHERE s.state<>'archived' AND p_date BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM p_date) AND s.academic_period_id=(context->>'academicPeriodId')::uuid AND c.archived_at IS NULL AND u.status='active' AND u.role='guru' ON CONFLICT DO NOTHING;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id) SELECT o.id,s.user_id,s.user_id FROM app.activity_occurrences o JOIN app.teaching_schedules s ON s.id=o.schedule_id WHERE o.date=p_date ON CONFLICT DO NOTHING;END $$;
CREATE FUNCTION app.activity_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF TG_TABLE_NAME='teaching_schedules' THEN
 IF EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.schedule_id=NEW.id AND (NEW.state='archived' OR o.date NOT BETWEEN NEW.valid_from AND NEW.valid_to OR (NEW.user_id,NEW.subject_id,NEW.class_id,NEW.day_index,NEW.time_start,NEW.time_end,NEW.scheduled_jtm) IS DISTINCT FROM (OLD.user_id,OLD.subject_id,OLD.class_id,OLD.day_index,OLD.time_start,OLD.time_end,OLD.scheduled_jtm))) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;
 ELSE
 IF EXISTS(SELECT 1 FROM app.activity_occurrences WHERE date=NEW.date) OR EXISTS(SELECT 1 FROM app.daily_attendance WHERE date=NEW.date) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;END IF;RETURN NEW;END $$;
CREATE TRIGGER occurrence_schedule_guard BEFORE UPDATE ON app.teaching_schedules FOR EACH ROW EXECUTE FUNCTION app.activity_snapshot_guard();
CREATE TRIGGER occurrence_calendar_guard BEFORE INSERT OR UPDATE ON app.academic_calendar FOR EACH ROW EXECUTE FUNCTION app.activity_snapshot_guard();
CREATE TRIGGER occurrence_context_guard BEFORE INSERT OR UPDATE ON app.day_context_overrides FOR EACH ROW EXECUTE FUNCTION app.activity_snapshot_guard();
CREATE FUNCTION app.occurrence_dto(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',o.id,'assignmentId',a.id,'date',o.date,'kind',o.kind,'userId',a.effective_user_id,'originalUserId',a.original_user_id,'version',a.version::text,'classId',o.class_id,'subjectId',o.subject_id,'teacherName',o.snapshot->>'teacherName','className',o.snapshot->>'className','subjectName',o.snapshot->>'subjectName','timeStart',to_char(o.time_start,'HH24:MI'),'timeEnd',to_char(o.time_end,'HH24:MI'),'scheduledJtm',o.scheduled_jtm::text,'expectedStudents',o.expected_students,'claimed',EXISTS(SELECT 1 FROM app.attendance_claims WHERE assignment_id=a.id),'confirmed',EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=a.id AND revoked_at IS NULL),'journalId',(SELECT id FROM app.teaching_journals WHERE occurrence_id=o.id AND deleted_at IS NULL)) FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.id=p_id $$;
CREATE FUNCTION app.occurrences_list(p_session text,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;BEGIN
 a:=app.activity_guard(p_session,true);PERFORM app.ensure_occurrences(p_date);RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(app.occurrence_dto(o.id) ORDER BY o.time_start,o.id) FROM app.activity_occurrences o JOIN app.activity_assignments x ON x.occurrence_id=o.id WHERE o.date=p_date AND(app.actor_is_admin() OR x.effective_user_id=a)),'[]'),'date',p_date);END $$;
CREATE FUNCTION app.occurrence_command(p_session text,p_id uuid,p_action text,p_version bigint,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;o app.activity_occurrences%ROWTYPE;x app.activity_assignments%ROWTYPE;old jsonb;BEGIN
 a:=app.activity_guard(p_session,true);SELECT * INTO o FROM app.activity_occurrences WHERE id=p_id;SELECT * INTO x FROM app.activity_assignments WHERE occurrence_id=p_id FOR UPDATE;
 IF o.id IS NULL OR(NOT app.actor_is_admin() AND x.effective_user_id<>a) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF o.date<>app.activity_today() THEN RAISE EXCEPTION 'TODAY_ONLY' USING ERRCODE='42501';END IF;PERFORM finance.guard_open(o.date);
 IF x.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;old:=app.occurrence_dto(p_id);
 IF p_action='claim' AND x.effective_user_id=a THEN INSERT INTO app.attendance_claims(assignment_id,user_id) VALUES(x.id,a) ON CONFLICT DO NOTHING;
 ELSIF p_action IN('confirm','revoke') AND app.actor_is_admin() AND x.effective_user_id<>a THEN
 IF p_action='confirm' THEN INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason) VALUES(x.id,a,p_reason) ON CONFLICT DO NOTHING;
 ELSE IF EXISTS(SELECT 1 FROM app.teaching_journals WHERE occurrence_id=p_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;UPDATE app.activity_confirmations SET revoked_at=clock_timestamp(),revoked_by=a WHERE assignment_id=x.id AND revoked_at IS NULL;END IF;
 ELSE RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 UPDATE app.activity_assignments SET version=version+1 WHERE id=x.id;PERFORM app.activity_audit('confirmation',p_id,p_reason,old,app.occurrence_dto(p_id));RETURN app.occurrence_dto(p_id);END $$;
CREATE FUNCTION app.attendance_dto(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',d.id,'userId',d.user_id,'teacherName',u.full_name,'date',d.date,'scheduledIn',to_char(d.sched_time_in,'HH24:MI'),'scheduledOut',to_char(d.sched_time_out,'HH24:MI'),'actualIn',to_char(d.actual_time_in,'HH24:MI'),'actualOut',to_char(d.actual_time_out,'HH24:MI'),'source',d.time_in_source,'extra',d.extra_attendee,'extraReason',d.extra_reason,'version',d.version::text,'scheduledMinutes',coalesce(extract(epoch FROM(d.sched_time_out-d.sched_time_in))/60,0),'effectiveMinutes',v.effective,'ratio',CASE WHEN coalesce(extract(epoch FROM(d.sched_time_out-d.sched_time_in)),0)>0 THEN least(1,v.effective/(extract(epoch FROM(d.sched_time_out-d.sched_time_in))/60)) WHEN d.extra_attendee AND v.effective>0 THEN 1 ELSE 0 END,'leaves',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'leaveTime',to_char(l.leave_time,'HH24:MI'),'returnTime',to_char(l.return_time,'HH24:MI'),'reason',l.reason) ORDER BY l.leave_time,l.id) FROM app.attendance_leaves l WHERE l.attendance_id=d.id AND l.deleted_at IS NULL),'[]'))
 FROM app.daily_attendance d JOIN app.app_users u ON u.id=d.user_id CROSS JOIN LATERAL(SELECT greatest(0,coalesce(extract(epoch FROM(d.actual_time_out-d.actual_time_in))/60,0)-coalesce((SELECT sum(greatest(0,extract(epoch FROM(least(l.return_time,d.actual_time_out)-greatest(l.leave_time,d.actual_time_in)))/60)) FROM app.attendance_leaves l WHERE l.attendance_id=d.id AND l.deleted_at IS NULL AND d.actual_time_out IS NOT NULL),0)) AS effective) v WHERE d.id=p_id $$;
CREATE FUNCTION app.attendance_participants(p_date date,p_type text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE c jsonb;BEGIN
 c:=app.day_context_internal(p_date);IF p_type<>'KBM' OR NOT coalesce((c->>'kbmEnabled')::boolean,false) THEN RETURN '[]';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name) ORDER BY u.id) FROM app.app_users u WHERE u.role='guru' AND u.status='active' AND EXISTS(SELECT 1 FROM app.teaching_schedules s WHERE s.user_id=u.id AND s.state<>'archived' AND p_date BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM p_date) AND s.academic_period_id=(c->>'academicPeriodId')::uuid)),'[]');END $$;
CREATE FUNCTION app.attendance_fingerprint(p_date date,p_template uuid) RETURNS text LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT md5(jsonb_build_array(app.day_context_internal(p_date),app.attendance_participants(p_date,t.sched_type),to_jsonb(t),(SELECT jsonb_agg(jsonb_build_array(id,version) ORDER BY id) FROM app.daily_attendance WHERE date=p_date))::text) FROM app.attendance_schedule_templates t WHERE t.id=p_template $$;
CREATE FUNCTION app.attendance_template(p_session text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;t app.attendance_schedule_templates%ROWTYPE;v ops.attendance_previews%ROWTYPE;v_id uuid;d date;old jsonb;person jsonb;n int:=0;BEGIN
 a:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();
 IF p_action IN('save','delete') THEN
 SELECT * INTO t FROM app.attendance_schedule_templates WHERE day_index=(p_data->>'dayIndex')::int AND sched_type=p_data->>'type' FOR UPDATE;
 IF coalesce(t.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;old:=to_jsonb(t);
 IF p_action='delete' THEN DELETE FROM app.attendance_schedule_templates WHERE id=t.id;v_id:=t.id;
 ELSE INSERT INTO app.attendance_schedule_templates(day_index,sched_type,time_in,time_out) VALUES((p_data->>'dayIndex')::int,p_data->>'type',(p_data->>'timeIn')::time,(p_data->>'timeOut')::time) ON CONFLICT(day_index,sched_type) DO UPDATE SET time_in=excluded.time_in,time_out=excluded.time_out,version=app.attendance_schedule_templates.version+1 RETURNING app.attendance_schedule_templates.id INTO v_id;END IF;
 PERFORM app.activity_audit('template',v_id,p_data->>'reason',old,p_data-'reason');RETURN jsonb_build_object('id',v_id);
 ELSIF p_action='preview' THEN
 d:=(p_data->>'date')::date;SELECT * INTO t FROM app.attendance_schedule_templates WHERE id=(p_data->>'templateId')::uuid;
 IF d<app.activity_today() OR d>app.activity_today()+365 OR t.id IS NULL OR extract(dow FROM d)<>t.day_index OR t.sched_type<>'KBM' OR jsonb_array_length(app.attendance_participants(d,t.sched_type))=0 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.attendance_previews(actor_id,date,template_id,fingerprint) VALUES(a,d,t.id,app.attendance_fingerprint(d,t.id)) RETURNING * INTO v;
 RETURN jsonb_build_object('previewId',v.id,'expiresAt',v.expires_at,'date',d,'participants',app.attendance_participants(d,t.sched_type),'timeIn',to_char(t.time_in,'HH24:MI'),'timeOut',to_char(t.time_out,'HH24:MI'),'preservesActual',true);
 ELSIF p_action='apply' THEN
 SELECT * INTO v FROM ops.attendance_previews WHERE ops.attendance_previews.id=(p_data->>'previewId')::uuid FOR UPDATE;
 IF v.id IS NULL OR v.actor_id<>a OR v.consumed_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.fingerprint IS DISTINCT FROM app.attendance_fingerprint(v.date,v.template_id) THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;PERFORM finance.guard_open(v.date);SELECT * INTO t FROM app.attendance_schedule_templates WHERE app.attendance_schedule_templates.id=v.template_id;
 FOR person IN SELECT value FROM jsonb_array_elements(app.attendance_participants(v.date,t.sched_type)) LOOP
 INSERT INTO app.daily_attendance(user_id,date,sched_time_in,sched_time_out) VALUES((person->>'id')::uuid,v.date,t.time_in,t.time_out) ON CONFLICT(user_id,date) DO UPDATE SET sched_time_in=excluded.sched_time_in,sched_time_out=excluded.sched_time_out,version=app.daily_attendance.version+1 WHERE app.daily_attendance.actual_time_in IS NULL AND app.daily_attendance.actual_time_out IS NULL;n:=n+1;END LOOP;
 INSERT INTO app.attendance_template_applications(preview_id,date,template_id,template_version,participant_hash,applied_by) VALUES(v.id,v.date,t.id,t.version,v.fingerprint,a);UPDATE ops.attendance_previews SET consumed_at=clock_timestamp() WHERE ops.attendance_previews.id=v.id;
 PERFORM app.activity_audit('apply-template',v.id,p_data->>'reason',null,jsonb_build_object('date',v.date,'count',n));RETURN jsonb_build_object('applied',true,'count',n);
 END IF;RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END $$;
CREATE FUNCTION app.attendance_command(p_session text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;d app.daily_attendance%ROWTYPE;target uuid;day date;old jsonb;v_id uuid;begin_time time;end_time time;now_time time:=(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time;BEGIN
 a:=app.activity_guard(p_session,true);
 IF p_action='manual' THEN
 PERFORM auth_private.require_admin();target:=(p_data->>'userId')::uuid;day:=(p_data->>'date')::date;
 IF day>app.activity_today() OR NOT EXISTS(SELECT 1 FROM app.app_users WHERE app.app_users.id=target AND role='guru' AND status='active') THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 PERFORM app.ensure_occurrences(day);SELECT * INTO d FROM app.daily_attendance WHERE user_id=target AND date=day FOR UPDATE;
 IF coalesce(d.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;old:=CASE WHEN d.id IS NULL THEN null ELSE app.attendance_dto(d.id) END;
 IF NOT coalesce((p_data->>'extra')::boolean,false) AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o JOIN app.activity_assignments x ON x.occurrence_id=o.id WHERE o.date=day AND x.effective_user_id=target) AND d.id IS NULL THEN RAISE EXCEPTION 'ASSIGNMENT_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM finance.guard_open(day);
 INSERT INTO app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out,time_in_recorded_by,time_in_source,extra_attendee,extra_reason)
 VALUES(target,day,(p_data->>'scheduledIn')::time,(p_data->>'scheduledOut')::time,(p_data->>'actualIn')::time,(p_data->>'actualOut')::time,CASE WHEN p_data->>'actualIn' IS NOT NULL THEN a END,CASE WHEN p_data->>'actualIn' IS NOT NULL THEN 'admin' END,(p_data->>'extra')::boolean,CASE WHEN(p_data->>'extra')::boolean THEN p_data->>'reason' END)
 ON CONFLICT(user_id,date) DO UPDATE SET sched_time_in=excluded.sched_time_in,sched_time_out=excluded.sched_time_out,actual_time_in=excluded.actual_time_in,actual_time_out=excluded.actual_time_out,time_in_recorded_by=excluded.time_in_recorded_by,time_in_source=excluded.time_in_source,extra_attendee=excluded.extra_attendee,extra_reason=excluded.extra_reason,version=app.daily_attendance.version+1 RETURNING app.daily_attendance.id INTO v_id;
 ELSE
 SELECT * INTO d FROM app.daily_attendance WHERE app.daily_attendance.id=(p_data->>'attendanceId')::uuid FOR UPDATE;
 IF d.id IS NULL OR(NOT app.actor_is_admin() AND d.user_id<>a) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF d.date<>app.activity_today() THEN RAISE EXCEPTION 'TODAY_ONLY' USING ERRCODE='42501';END IF;PERFORM finance.guard_open(d.date);
 IF d.version IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;v_id:=d.id;old:=app.attendance_dto(d.id);
 IF p_action='in' THEN
 IF d.sched_time_in IS NULL OR now_time<d.sched_time_in OR d.actual_time_in IS NOT NULL THEN RAISE EXCEPTION 'ATTENDANCE_TIME_INVALID' USING ERRCODE='22023';END IF;
 UPDATE app.daily_attendance SET actual_time_in=date_trunc('minute',clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time,time_in_source=CASE WHEN app.actor_is_admin() THEN 'admin' ELSE 'self' END,time_in_recorded_by=a,version=version+1 WHERE app.daily_attendance.id=d.id;
 ELSIF p_action='out' THEN
 IF d.actual_time_in IS NULL OR d.sched_time_out IS NULL OR d.actual_time_out IS NOT NULL OR d.actual_time_in>d.sched_time_out OR (NOT app.actor_is_admin() AND now_time<d.sched_time_out+interval '5 minutes') THEN RAISE EXCEPTION 'ATTENDANCE_TIME_INVALID' USING ERRCODE='22023';END IF;
 UPDATE app.daily_attendance SET actual_time_out=least(date_trunc('minute',clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time,d.sched_time_out),version=version+1 WHERE app.daily_attendance.id=d.id;
 ELSIF p_action='leave' THEN
 begin_time:=(p_data->>'leaveTime')::time;end_time:=(p_data->>'returnTime')::time;
 IF d.actual_time_in IS NULL OR begin_time IS NULL OR end_time IS NULL OR end_time<=begin_time OR EXISTS(SELECT 1 FROM app.attendance_leaves WHERE attendance_id=d.id AND deleted_at IS NULL AND leave_time<end_time AND return_time>begin_time) THEN RAISE EXCEPTION 'LEAVE_OVERLAP' USING ERRCODE='22023';END IF;
 INSERT INTO app.attendance_leaves(attendance_id,leave_time,return_time,reason,created_by) VALUES(d.id,begin_time,end_time,p_data->>'reason',a);UPDATE app.daily_attendance SET version=version+1 WHERE app.daily_attendance.id=d.id;
 ELSIF p_action='delete-leave' THEN
 UPDATE app.attendance_leaves SET deleted_at=clock_timestamp() WHERE app.attendance_leaves.id=(p_data->>'leaveId')::uuid AND attendance_id=d.id AND deleted_at IS NULL;IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;UPDATE app.daily_attendance SET version=version+1 WHERE app.daily_attendance.id=d.id;
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 END IF;
 PERFORM app.activity_audit('attendance',v_id,p_data->>'reason',old,app.attendance_dto(v_id));RETURN app.attendance_dto(v_id);END $$;
CREATE FUNCTION app.students_required(p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE c jsonb;BEGIN c:=app.day_context_internal(p_date);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'expectedStudents',x.expected_students,'complete',EXISTS(SELECT 1 FROM app.student_attendance a WHERE a.class_id=x.id AND a.date=p_date AND a.academic_period_id=x.academic_period_id)) ORDER BY x.name,x.id) FROM app.classes x WHERE x.archived_at IS NULL AND x.academic_period_id=(c->>'academicPeriodId')::uuid AND coalesce((c->>'kbmEnabled')::boolean,false) AND EXISTS(SELECT 1 FROM app.teaching_schedules s WHERE s.class_id=x.id AND s.state<>'archived' AND p_date BETWEEN s.valid_from AND s.valid_to)),'[]');END $$;
CREATE FUNCTION app.students_save(p_session text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;c app.classes%ROWTYPE;r app.student_attendance%ROWTYPE;d date:=(p_data->>'date')::date;v_id uuid;old jsonb;h int:=(p_data->>'hadir')::int;s int:=(p_data->>'sakit')::int;i int:=(p_data->>'izin')::int;l int:=(p_data->>'alpa')::int;BEGIN
 a:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();IF d<>app.activity_today() THEN RAISE EXCEPTION 'TODAY_ONLY' USING ERRCODE='42501';END IF;PERFORM finance.guard_open(d);
 SELECT * INTO c FROM app.classes WHERE app.classes.id=(p_data->>'classId')::uuid AND archived_at IS NULL;
 IF c.id IS NULL OR c.academic_period_id::text IS DISTINCT FROM app.day_context_internal(d)->>'academicPeriodId' OR least(h,s,i,l)<0 OR h+s+i+l NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 IF c.expected_students>0 AND h+s+i+l<>c.expected_students THEN RAISE EXCEPTION 'STUDENT_COUNT_MISMATCH' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM app.teaching_journals j JOIN app.activity_occurrences o ON o.id=j.occurrence_id WHERE o.date=d AND o.class_id=c.id AND j.deleted_at IS NULL AND(j.present<>h OR j.absent<>s+i+l)) THEN RAISE EXCEPTION 'STUDENT_ATTENDANCE_MISMATCH' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM app.student_attendance WHERE class_id=c.id AND date=d AND academic_period_id=c.academic_period_id FOR UPDATE;old:=to_jsonb(r);
 IF coalesce(r.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 INSERT INTO app.student_attendance(class_id,date,academic_period_id,hadir,sakit,izin,alpa,submitted_by) VALUES(c.id,d,c.academic_period_id,h,s,i,l,a) ON CONFLICT(class_id,date,academic_period_id) DO UPDATE SET hadir=excluded.hadir,sakit=excluded.sakit,izin=excluded.izin,alpa=excluded.alpa,submitted_by=a,submitted_at=clock_timestamp(),version=app.student_attendance.version+1 RETURNING app.student_attendance.id INTO v_id;
 PERFORM app.activity_audit('students',v_id,p_data->>'reason',old,p_data-'reason');RETURN jsonb_build_object('id',v_id);END $$;
CREATE FUNCTION app.journal_eligibility(p_occurrence uuid,p_actor uuid) RETURNS text LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE o app.activity_occurrences%ROWTYPE;x app.activity_assignments%ROWTYPE;BEGIN
 SELECT * INTO o FROM app.activity_occurrences WHERE id=p_occurrence;SELECT * INTO x FROM app.activity_assignments WHERE occurrence_id=p_occurrence;
 IF o.id IS NULL OR x.effective_user_id<>p_actor THEN RETURN 'NOT_FOUND';END IF;
 IF o.date>app.activity_today() THEN RETURN 'FUTURE_DATE';END IF;IF o.date<app.activity_today()-1 THEN RETURN 'DATE_EXPIRED';END IF;
 IF o.date=app.activity_today()-1 AND NOT coalesce((SELECT typed_value='true'::jsonb FROM app.system_settings WHERE key='allow_h_minus_1_journal'),false) THEN RETURN 'H1_DISABLED';END IF;
 IF NOT EXISTS(SELECT 1 FROM app.activity_confirmations WHERE assignment_id=x.id AND revoked_at IS NULL) THEN RETURN CASE WHEN o.date=app.activity_today()-1 THEN 'H1_NOT_CONFIRMED' ELSE 'NO_ACTIVE_CONFIRMATION' END;END IF;
 IF EXISTS(SELECT 1 FROM app.journal_blocks WHERE active AND subject_id=o.subject_id AND o.date BETWEEN date_start AND date_end) THEN RETURN 'JOURNAL_BLOCKED';END IF;
 IF EXISTS(SELECT 1 FROM finance.period_guards WHERE period_start=date_trunc('month',o.date)::date AND finalized_at IS NOT NULL) THEN RETURN 'FINAL_PERIOD';END IF;
 RETURN null;END $$;
CREATE FUNCTION app.journal_dto(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('id',j.id,'occurrenceId',j.occurrence_id,'userId',j.user_id,'teacherName',u.full_name,'date',o.date,'className',o.snapshot->>'className','subjectName',o.snapshot->>'subjectName','material',j.material,'present',j.present,'absent',j.absent,'notes',j.notes,'inputType',j.input_type,'weight',j.weight::text,'creditedJtm',j.credited_jtm::text,'version',j.version::text,'submittedAt',j.submitted_at,'deletedAt',j.deleted_at,'recapAvailable',EXISTS(SELECT 1 FROM app.student_attendance WHERE class_id=o.class_id AND date=o.date AND academic_period_id=o.academic_period_id)) FROM app.teaching_journals j JOIN app.activity_occurrences o ON o.id=j.occurrence_id JOIN app.app_users u ON u.id=j.user_id WHERE j.id=p_id $$;
CREATE FUNCTION finance.journal_reverse(p_id uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 INSERT INTO finance.jtm_ledger(source_kind,journal_id,occurrence_id,user_id,date,jtm,revision,reverses_id)
 SELECT 'REVERSAL',p.journal_id,p.occurrence_id,p.user_id,p.date,-p.jtm,p.revision,p.id FROM finance.jtm_ledger p WHERE p.journal_id=p_id AND p.source_kind='KBM' AND NOT EXISTS(SELECT 1 FROM finance.jtm_ledger r WHERE r.reverses_id=p.id) ON CONFLICT DO NOTHING;END $$;
CREATE FUNCTION app.journal_save(p_session text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;o app.activity_occurrences%ROWTYPE;x app.activity_assignments%ROWTYPE;j app.teaching_journals%ROWTYPE;r app.student_attendance%ROWTYPE;v_id uuid;code text;old jsonb;credit numeric;w numeric;h int:=(p_data->>'present')::int;b int:=(p_data->>'absent')::int;BEGIN
 a:=app.activity_guard(p_session,true);
 IF p_action='create' THEN
 SELECT * INTO o FROM app.activity_occurrences WHERE app.activity_occurrences.id=(p_data->>'occurrenceId')::uuid;SELECT * INTO x FROM app.activity_assignments WHERE occurrence_id=o.id FOR UPDATE;
 code:=app.journal_eligibility(o.id,a);IF code IS NOT NULL THEN RAISE EXCEPTION '%',code USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM app.teaching_journals WHERE occurrence_id=o.id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'DUPLICATE_JOURNAL' USING ERRCODE='23505';END IF;
 w:=CASE WHEN o.date=app.activity_today() THEN 1 ELSE 0.8 END;
 ELSE
 SELECT * INTO j FROM app.teaching_journals WHERE app.teaching_journals.id=(p_data->>'journalId')::uuid AND deleted_at IS NULL FOR UPDATE;
 IF j.id IS NULL OR(NOT app.actor_is_admin() AND j.user_id<>a) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF j.version IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 SELECT * INTO o FROM app.activity_occurrences WHERE app.activity_occurrences.id=j.occurrence_id;SELECT * INTO x FROM app.activity_assignments WHERE occurrence_id=o.id FOR UPDATE;w:=j.weight;old:=app.journal_dto(j.id);
 END IF;
 PERFORM finance.guard_open(o.date);
 IF p_action='delete' THEN PERFORM finance.journal_reverse(j.id);UPDATE app.teaching_journals SET deleted_at=clock_timestamp(),version=version+1 WHERE app.teaching_journals.id=j.id;PERFORM app.activity_audit('journal',j.id,p_data->>'reason',old,app.journal_dto(j.id));RETURN jsonb_build_object('deleted',true,'id',j.id);END IF;
 IF EXISTS(SELECT 1 FROM app.journal_blocks WHERE active AND subject_id=o.subject_id AND o.date BETWEEN date_start AND date_end) THEN RAISE EXCEPTION 'JOURNAL_BLOCKED' USING ERRCODE='42501';END IF;
 IF h IS NULL OR b IS NULL OR h<0 OR b<0 OR h+b>1000 OR(o.expected_students>0 AND h+b<>o.expected_students) THEN RAISE EXCEPTION 'STUDENT_COUNT_MISMATCH' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM app.student_attendance WHERE class_id=o.class_id AND date=o.date AND academic_period_id=o.academic_period_id;
 IF r.id IS NOT NULL AND(h<>r.hadir OR b<>r.sakit+r.izin+r.alpa) THEN RAISE EXCEPTION 'STUDENT_ATTENDANCE_MISMATCH' USING ERRCODE='22023';END IF;
 credit:=CASE WHEN w=1 THEN o.scheduled_jtm ELSE round(o.scheduled_jtm*w,1) END;
 IF p_action='create' THEN
 INSERT INTO app.teaching_journals(occurrence_id,assignment_id,user_id,material,present,absent,notes,input_type,weight,credited_jtm) VALUES(o.id,x.id,a,p_data->>'material',h,b,p_data->>'notes',CASE WHEN w=1 THEN 'SAME_DAY' ELSE 'H_MINUS_1' END,w,credit) RETURNING app.teaching_journals.id INTO v_id;
 ELSIF p_action='edit' THEN
 v_id:=j.id;PERFORM finance.journal_reverse(v_id);UPDATE app.teaching_journals SET material=p_data->>'material',present=h,absent=b,notes=p_data->>'notes',version=version+1 WHERE app.teaching_journals.id=v_id;
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO finance.jtm_ledger(source_kind,journal_id,occurrence_id,user_id,date,jtm,revision) SELECT 'KBM',j2.id,o.id,j2.user_id,o.date,j2.credited_jtm,j2.version FROM app.teaching_journals j2 WHERE j2.id=v_id;
 PERFORM app.activity_audit('journal',v_id,p_data->>'reason',old,app.journal_dto(v_id));RETURN app.journal_dto(v_id);END $$;
CREATE FUNCTION app.activity_settings(p_session text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;r app.journal_blocks%ROWTYPE;v_id uuid;old jsonb;BEGIN
 a:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();
 IF p_action='h1' THEN
 IF jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO app.system_settings(key,typed_value,updated_by) VALUES('allow_h_minus_1_journal',p_data->'enabled',a) ON CONFLICT(key) DO UPDATE SET typed_value=excluded.typed_value,updated_by=a,version=app.system_settings.version+1,updated_at=clock_timestamp();v_id:=a;
 ELSE
 IF p_data->>'id' IS NOT NULL THEN SELECT * INTO r FROM app.journal_blocks WHERE app.journal_blocks.id=(p_data->>'id')::uuid FOR UPDATE;IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;END IF;
 IF coalesce(r.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;old:=to_jsonb(r);
 IF r.id IS NULL THEN INSERT INTO app.journal_blocks(subject_id,date_start,date_end,message,active) VALUES((p_data->>'subjectId')::uuid,(p_data->>'dateStart')::date,(p_data->>'dateEnd')::date,p_data->>'message',(p_data->>'active')::boolean) RETURNING app.journal_blocks.id INTO v_id;
 ELSE UPDATE app.journal_blocks SET active=(p_data->>'active')::boolean,message=p_data->>'message',version=version+1 WHERE app.journal_blocks.id=r.id;v_id:=r.id;END IF;
 END IF;PERFORM app.activity_audit('settings',v_id,p_data->>'reason',old,p_data-'reason');RETURN jsonb_build_object('saved',true);END $$;
CREATE FUNCTION app.activity_read(p_session text,p_kind text,p_filter jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;d date:=(p_filter->>'date')::date;f date:=(p_filter->>'from')::date;e date:=(p_filter->>'to')::date;page int:=(p_filter->>'page')::int;size int:=(p_filter->>'pageSize')::int;items jsonb;total int;required jsonb;BEGIN
 a:=app.activity_guard(p_session,false);
 IF p_kind='options' THEN
 RETURN jsonb_build_object('teachers',CASE WHEN app.actor_is_admin() THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id) FROM app.app_users WHERE role='guru' AND status='active'),'[]') ELSE '[]'::jsonb END,'classes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'periodId',academic_period_id,'expectedStudents',expected_students) ORDER BY name,id) FROM app.classes WHERE archived_at IS NULL),'[]'),'subjects',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY name,id) FROM app.subjects WHERE archived_at IS NULL),'[]'),'h1Enabled',coalesce((SELECT typed_value='true'::jsonb FROM app.system_settings WHERE key='allow_h_minus_1_journal'),false));
 ELSIF p_kind='templates' THEN PERFORM auth_private.require_admin();RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('version',version::text) ORDER BY day_index,sched_type,id) FROM app.attendance_schedule_templates t),'[]'));
 ELSIF p_kind='blocks' THEN PERFORM auth_private.require_admin();RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('version',version::text) ORDER BY date_start,id) FROM app.journal_blocks b),'[]'));
 ELSIF p_kind='eligible' THEN
 PERFORM pg_advisory_xact_lock(734190,1);PERFORM app.ensure_occurrences(d);
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(app.occurrence_dto(o.id)||jsonb_build_object('eligibilityError',app.journal_eligibility(o.id,a)) ORDER BY o.time_start,o.id) FROM app.activity_occurrences o JOIN app.activity_assignments x ON x.occurrence_id=o.id WHERE o.date=d AND x.effective_user_id=a),'[]'));
 ELSIF p_kind='students-progress' THEN
 PERFORM auth_private.require_admin();required:=app.students_required(d);RETURN jsonb_build_object('required',required,'requiredCount',jsonb_array_length(required),'completedCount',(SELECT count(*) FROM jsonb_array_elements(required) x WHERE(x->>'complete')::boolean),'complete',NOT EXISTS(SELECT 1 FROM jsonb_array_elements(required) x WHERE NOT(x->>'complete')::boolean));
 END IF;
 IF f IS NULL OR e IS NULL OR e-f NOT BETWEEN 0 AND 365 OR page IS NULL OR page<1 OR size IS NULL OR size NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 IF p_kind='attendance' THEN
 SELECT count(*) INTO total FROM app.daily_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId');
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'date' DESC,v->>'id'),'[]') INTO items FROM(SELECT app.attendance_dto(x.id) v FROM app.daily_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') ORDER BY x.date DESC,x.id LIMIT size OFFSET(page-1)*size) q;
 ELSIF p_kind='students' THEN
 SELECT count(*) INTO total FROM app.student_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.submitted_by=a);
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'date' DESC,v->>'id'),'[]') INTO items FROM(SELECT to_jsonb(x)||jsonb_build_object('version',x.version::text,'className',c.name,'submittedByName',u.full_name) v FROM app.student_attendance x JOIN app.classes c ON c.id=x.class_id JOIN app.app_users u ON u.id=x.submitted_by WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.submitted_by=a) ORDER BY x.date DESC,x.id LIMIT size OFFSET(page-1)*size) q;
 ELSIF p_kind='journals' THEN
 SELECT count(*) INTO total FROM app.teaching_journals x JOIN app.activity_occurrences o ON o.id=x.occurrence_id WHERE o.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') AND x.deleted_at IS NULL AND(coalesce(p_filter->>'q','')='' OR position(lower(p_filter->>'q') in lower(x.material||' '||x.notes))>0);
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'date' DESC,v->>'id'),'[]') INTO items FROM(SELECT app.journal_dto(x.id) v FROM app.teaching_journals x JOIN app.activity_occurrences o ON o.id=x.occurrence_id WHERE o.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') AND x.deleted_at IS NULL AND(coalesce(p_filter->>'q','')='' OR position(lower(p_filter->>'q') in lower(x.material||' '||x.notes))>0) ORDER BY o.date DESC,x.id LIMIT size OFFSET(page-1)*size) q;
 ELSIF p_kind='ledger' THEN
 SELECT count(*) INTO total FROM finance.jtm_ledger x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a);
 SELECT coalesce(jsonb_agg(v ORDER BY v->>'created_at',v->>'id'),'[]') INTO items FROM(SELECT to_jsonb(x)||jsonb_build_object('jtm',x.jtm::text,'revision',x.revision::text) v FROM finance.jtm_ledger x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a) ORDER BY x.created_at,x.id LIMIT size OFFSET(page-1)*size) q;
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 RETURN jsonb_build_object('items',items,'total',total,'page',page,'pageSize',size);END $$;
CREATE FUNCTION app.activity_parent_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF TG_TABLE_NAME='classes' THEN
 IF NEW.expected_students IS DISTINCT FROM OLD.expected_students AND(EXISTS(SELECT 1 FROM app.activity_occurrences WHERE class_id=NEW.id AND date>=app.activity_today()-1) OR EXISTS(SELECT 1 FROM app.student_attendance WHERE class_id=NEW.id AND date>=app.activity_today()-1)) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;
 ELSIF (NEW.is_active,NEW.archived_at,NEW.date_start,NEW.date_end) IS DISTINCT FROM(OLD.is_active,OLD.archived_at,OLD.date_start,OLD.date_end) AND EXISTS(SELECT 1 FROM app.activity_occurrences WHERE academic_period_id=NEW.id AND date=app.activity_today()) THEN RAISE EXCEPTION 'ACTIVITY_REFERENCED' USING ERRCODE='23503';END IF;RETURN NEW;END $$;
CREATE TRIGGER attendance_class_guard BEFORE UPDATE ON app.classes FOR EACH ROW EXECUTE FUNCTION app.activity_parent_guard();
CREATE TRIGGER attendance_period_guard BEFORE UPDATE ON app.academic_periods FOR EACH ROW EXECUTE FUNCTION app.activity_parent_guard();
CREATE FUNCTION finance.ledger_integrity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE j app.teaching_journals%ROWTYPE;o app.activity_occurrences%ROWTYPE;p finance.jtm_ledger%ROWTYPE;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'LEDGER_IMMUTABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO j FROM app.teaching_journals WHERE id=NEW.journal_id;SELECT * INTO o FROM app.activity_occurrences WHERE id=j.occurrence_id;
 IF j.id IS NULL OR NEW.occurrence_id<>j.occurrence_id OR NEW.user_id<>j.user_id OR NEW.date<>o.date THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 IF NEW.source_kind='KBM' THEN IF NEW.jtm<>j.credited_jtm OR NEW.revision<>j.version OR j.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 ELSE SELECT * INTO p FROM finance.jtm_ledger WHERE id=NEW.reverses_id;IF p.id IS NULL OR p.source_kind<>'KBM' OR p.journal_id<>NEW.journal_id OR NEW.jtm<>-p.jtm OR p.revision<>NEW.revision THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;END IF;RETURN NEW;END $$;
CREATE TRIGGER ledger_integrity BEFORE INSERT OR UPDATE OR DELETE ON finance.jtm_ledger FOR EACH ROW EXECUTE FUNCTION finance.ledger_integrity();
ALTER TABLE app.activity_assignments ADD CONSTRAINT assignment_occurrence_key UNIQUE(id,occurrence_id);
ALTER TABLE app.teaching_journals ADD CONSTRAINT journal_assignment_occurrence FOREIGN KEY(assignment_id,occurrence_id) REFERENCES app.activity_assignments(id,occurrence_id);
CREATE INDEX occurrences_date ON app.activity_occurrences(date,academic_period_id,class_id);
CREATE INDEX occurrences_class ON app.activity_occurrences(class_id,date);
CREATE INDEX occurrences_subject ON app.activity_occurrences(subject_id,date);
CREATE INDEX journal_blocks_subject ON app.journal_blocks(subject_id,date_start,date_end) WHERE active;
REVOKE ALL ON FUNCTION app.activity_parent_guard(),finance.ledger_integrity() FROM PUBLIC;

-- Revoke helper execution as well as DML. Only these verified-session entry points are public to business LOGIN.
DO $$ DECLARE r record;BEGIN FOR r IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('app','finance') AND p.proname IN('activity_today','activity_guard','guard_open','activity_audit','ensure_occurrences','activity_snapshot_guard','occurrence_dto','occurrences_list','occurrence_command','attendance_dto','attendance_participants','attendance_fingerprint','attendance_template','attendance_command','students_required','students_save','journal_eligibility','journal_dto','journal_reverse','journal_save','activity_settings','activity_read') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',r.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION app.occurrences_list(text,date),app.occurrence_command(text,uuid,text,bigint,text),app.attendance_template(text,text,jsonb),app.attendance_command(text,text,jsonb),app.students_save(text,jsonb),app.journal_save(text,text,jsonb),app.activity_settings(text,text,jsonb),app.activity_read(text,text,jsonb) TO sim_guru_business;
CREATE OR REPLACE FUNCTION app.schedule_today(p_session text,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;context jsonb;result jsonb;BEGIN
 actor:=auth_private.lifecycle_self(p_session);IF auth_private.resolve_actor(true) IS NULL THEN RAISE EXCEPTION 'ONBOARDING_REQUIRED' USING ERRCODE='42501';END IF;context:=app.day_context_internal(p_date);PERFORM app.schedule_dependencies();
 SELECT jsonb_build_object('items',CASE WHEN(context->>'kbmEnabled')::boolean THEN coalesce(jsonb_agg(app.schedule_dto(id) ORDER BY time_start,id),'[]'::jsonb) ELSE '[]'::jsonb END,'scheduledCount',count(*),'dayContext',context,'confirmationAvailable',true,'journalAvailable',true,'substitutionsAvailable',false) INTO result FROM app.teaching_schedules WHERE user_id=actor AND state<>'archived' AND p_date BETWEEN valid_from AND valid_to AND day_index=extract(dow FROM p_date)::int AND academic_period_id::text=context->>'academicPeriodId';RETURN result;END $$;
CREATE OR REPLACE FUNCTION app.calendar_preview(p_session text,p_kind text,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;days jsonb;v ops.calendar_previews%ROWTYPE;rev bigint;BEGIN
 a:=app.master_guard(p_session,true);days:=app.calendar_changes(p_kind,p_request,false);SELECT revision INTO rev FROM app.calendar_state WHERE singleton;
 INSERT INTO ops.calendar_previews(actor_id,kind,request,state_revision) VALUES(a,p_kind,p_request,rev) RETURNING * INTO v;
 RETURN jsonb_build_object('previewId',v.id,'expiresAt',v.expires_at,'kind',p_kind,'action',p_request->>'action','count',jsonb_array_length(days),'days',days,'assignmentIntegration','attendance_ready','policyVersion','calendar-v1');END $$;
CREATE FUNCTION auth_private.consume_activity_rate(p_scope text,p_key text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n int;limit_count int;start_at timestamptz:=date_bin(interval '15 minutes',clock_timestamp(),'2000-01-01'::timestamptz);BEGIN
 limit_count:=CASE p_scope WHEN 'activity_ip' THEN 1000 WHEN 'activity_account' THEN 300 WHEN 'activity_export' THEN 30 END;
 IF limit_count IS NULL OR p_key !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'INVALID_RATE_KEY';END IF;
 INSERT INTO auth_private.auth_rate_limits(scope,key_hash,window_start,count) VALUES(p_scope,p_key,start_at,1) ON CONFLICT(scope,key_hash,window_start) DO UPDATE SET count=least(auth_private.auth_rate_limits.count+1,1001) RETURNING count INTO n;
 RETURN CASE WHEN n>limit_count THEN greatest(1,ceil(extract(epoch FROM start_at+interval '15 minutes'-clock_timestamp()))::integer) ELSE 0 END;END $$;
REVOKE ALL ON FUNCTION auth_private.consume_activity_rate(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.consume_activity_rate(text,text) TO sim_guru_auth;
RESET ROLE;
