-- Additive journal content. No backfill, credit recalculation or historical rewrite.
SET LOCAL ROLE sim_guru_owner;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='app.journal_save(text,text,jsonb)'::regprocedure) <> '2005857719dd38dd88137b90ca2cfc54'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='app.journal_dto(uuid)'::regprocedure) <> '449d7f99cc95161ebde87ed4eb08b3ed' THEN
 RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH'; END IF;
END $$;
ALTER TABLE app.teaching_journals
 ADD COLUMN learning_objectives text NOT NULL DEFAULT '' CHECK(length(learning_objectives)<=2000),
 ADD COLUMN obstacles text NOT NULL DEFAULT '' CHECK(length(obstacles)<=2000),
 ADD COLUMN follow_up text NOT NULL DEFAULT '' CHECK(length(follow_up)<=2000),
 ADD COLUMN reflection text NOT NULL DEFAULT '' CHECK(length(reflection)<=2000);

CREATE OR REPLACE FUNCTION app.journal_dto(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('id',j.id,'occurrenceId',j.occurrence_id,'userId',j.user_id,'teacherName',u.full_name,'date',o.date,'className',o.snapshot->>'className','subjectName',o.snapshot->>'subjectName','schoolName',coalesce((SELECT name FROM app.school_profiles LIMIT 1),''),'periodLabel',coalesce(o.snapshot->>'periodLabel',''),'timeStart',to_char(o.time_start,'HH24:MI'),'timeEnd',to_char(o.time_end,'HH24:MI'),'learningObjectives',j.learning_objectives,'obstacles',j.obstacles,'followUp',j.follow_up,'reflection',j.reflection,'material',j.material,'present',j.present,'absent',j.absent,'notes',j.notes,'inputType',j.input_type,'weight',j.weight::text,'creditedJtm',j.credited_jtm::text,'version',j.version::text,'submittedAt',j.submitted_at,'deletedAt',j.deleted_at,'recapAvailable',EXISTS(SELECT 1 FROM app.student_attendance WHERE class_id=o.class_id AND date=o.date AND academic_period_id=o.academic_period_id)) FROM app.teaching_journals j JOIN app.activity_occurrences o ON o.id=j.occurrence_id JOIN app.app_users u ON u.id=j.user_id WHERE j.id=p_id $$;

-- Preserve the canonical transaction, version, confirmation, recap and finance guards.
-- Missing fields from older clients preserve existing values on edit.
CREATE OR REPLACE FUNCTION app.journal_save(p_session text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;o app.activity_occurrences%ROWTYPE;x app.activity_assignments%ROWTYPE;j app.teaching_journals%ROWTYPE;r app.student_attendance%ROWTYPE;v_id uuid;code text;old jsonb;credit numeric;w numeric;h int:=(p_data->>'present')::int;b int:=(p_data->>'absent')::int;BEGIN
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
 credit:=CASE WHEN w=1 THEN app.jtm_basis(o.id) ELSE round(app.jtm_basis(o.id)*w,1) END;
 IF p_action='create' THEN
 INSERT INTO app.teaching_journals(occurrence_id,assignment_id,user_id,material,present,absent,notes,learning_objectives,obstacles,follow_up,reflection,input_type,weight,credited_jtm) VALUES(o.id,x.id,a,p_data->>'material',h,b,p_data->>'notes',coalesce(p_data->>'learningObjectives',''),coalesce(p_data->>'obstacles',''),coalesce(p_data->>'followUp',''),coalesce(p_data->>'reflection',''),CASE WHEN w=1 THEN 'SAME_DAY' ELSE 'H_MINUS_1' END,w,credit) RETURNING app.teaching_journals.id INTO v_id;
 ELSIF p_action='edit' THEN
 v_id:=j.id;PERFORM finance.journal_reverse(v_id);UPDATE app.teaching_journals SET material=p_data->>'material',present=h,absent=b,notes=p_data->>'notes',learning_objectives=coalesce(p_data->>'learningObjectives',j.learning_objectives),obstacles=coalesce(p_data->>'obstacles',j.obstacles),follow_up=coalesce(p_data->>'followUp',j.follow_up),reflection=coalesce(p_data->>'reflection',j.reflection),version=version+1 WHERE app.teaching_journals.id=v_id;
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO finance.jtm_ledger(source_kind,journal_id,occurrence_id,user_id,date,jtm,revision) SELECT 'KBM',j2.id,o.id,j2.user_id,o.date,j2.credited_jtm,j2.version FROM app.teaching_journals j2 WHERE j2.id=v_id;
 PERFORM app.activity_audit('journal',v_id,p_data->>'reason',old,app.journal_dto(v_id));RETURN app.journal_dto(v_id);END $$;
RESET ROLE;
