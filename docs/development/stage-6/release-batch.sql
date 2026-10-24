SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_catalog.pg_advisory_xact_lock(734190,0);
SELECT pg_catalog.pg_advisory_xact_lock(734190,1);
DO $release$ BEGIN
 IF (SELECT count(*) FROM sim_guru_migration.schema_migrations)<>31 OR EXISTS(
 SELECT 1 FROM (VALUES ('202610190001_roles_and_schemas.sql','5a02689b6c7ba930cb9bb9dd6589e662a4475968dbe0885c6812db9961485351'),('202610190002_identity_tables.sql','2285393b5bedbf355acd5120c61e2e53f856d0e9e307887b6aaf345edea28739'),('202610190003_auth_routines_and_policies.sql','513de24ee5b78f7f87fbcee7517321aa9bcd2ee39c1621794953250cc3178ca0'),('202610190004_account_activation.sql','45ea676a9417289fc89a2381b778ee26eb2c1dbdc0a0ae242ee61b56c6a32d70'),('202610190005_auth_http.sql','8322174234adf449b623cd0efd83dcaf8d3efafa1a53327b34c309b96f4d84b2'),('20261019055727_account_lifecycle.sql','7f8a8147db173ec6111c0c0daf0bec3a43b272451d74fc18dd681d05dfa5f4eb'),('20261019102819_user_management.sql','70fb7ff6d46d2d757fc8b2d12f283c7d8ced08bbd28d7e26d4f3b8730bf014c9'),('20261019111051_academic_masters.sql','03d2a4ee505d4a8f5cb2e34f68f9b55718bdc9274e37919dd65893c47c8be45f'),('20261019113611_calendar_day_context.sql','0aca461ee9fb1ddca1a2e303417a2f6501b4c840a37ed421b6c047dc747c9e6f'),('20261019115903_teaching_schedules.sql','5d723716ecd404b3bef48c04533e6106c9fbc0289a98649225b5a1b272cc993a'),('20261019160412_security_otp_dispatch.sql','d2fe41ec2a79f68d82d9d6c074506a874c37e2ec9c17d52d5270c0168d2e5c9f'),('20261019170744_attendance_journals_stage3.sql','0cbb0d170e69cf58b8e7da26690e2ec04c7d4c935a2c7486ac8439433f034f80'),('20261019174518_duties_substitution_jtm.sql','fa072cf82e68b1ff3b520b0babd386589f0baeef8245e5040ca07718c3478dda'),('20261020014753_exams_bap_stage5.sql','3cbea9d2e6cfd20ecb84a66ce45894de303022fc3237bdbd83127bfccc38481c'),('20261020015111_events_journals_stage5.sql','76e7fb6f741d861a6bb114157be65864b6010f607b9033c586463c20f6c1cbc3'),('20261020022247_exam_api_attendance_stage5.sql','bdfd4d3cdd4145e675c0eaf1bac6809b5c8ad9e3a658957c2f3620f7af7eb538'),('20261020045419_exam_attendance_guards_stage5.sql','8f52e9ae8b9b2e8e1d8ce290262f3d3fc7d8ddfb829dfbffc88aaf59c3290dd9'),('20261020055614_finance_holiday_transport_stage6.sql','aea2d5528c77d9feaf732cfb0b8baa5b7070d223c8c5ec8e4368c1db8d60e4cb'),('20261020063050_exact_transport_settlement_stage6.sql','abedbd9149fbfe00e1bc0e33d6e1323da247597d4907b4822b9eee665b7942c8'),('20261020065725_operations_stage7.sql','ba07522f2a54bd36100f0e744307d26566ed8e9f04e1d5e3c1d985b43f0881e7'),('20261020092915_operations_finance_workers_stage7.sql','699325a268988064ad1cf3f1ddd10b4d69c1d25a8b524c127e9bd8b18443dc7e'),('20261020100138_reminder_context_stage7.sql','5f9ba4a2f925181a2d77cea042e78b3ff922e9f7c4a3642c839fbf1279590696'),('20261020103452_migration_readiness_stage8.sql','72641265ad4916245085c0744f5087f7a6ca92e524d8add1698212cb627d82c6'),('20261020182241_pg_net_private_registration.sql','cddbbf85b5c798c5ab421757be3a79463a6e78c97b069cf6f1930ce43786c1df'),('20261021135112_support_reports.sql','4309bc2b6a4cf740a7cbd3ba42c7114c04d790a2b4840dabe8a382c957587530'),('20261021161000_duty_final_guard_record_shape.sql','277ffde113bbe668df562bc5cdc7bdb50bec8d48dbff14d7aad217b0d1fb24db'),('20261023094531_kbm_confirmation_operator_guard.sql','1bef1ac096c78e373caa4d4435c220fabed099f18aa3c456521e8a03a4d1caaa'),('20261024000945_task_center_and_notification_preferences.sql','67538e3fadd12d81620ce59e8ed853f7d19b4926bd23fb6713e8b049cd864608'),('20261024054743_honor_readiness_and_correction_review.sql','56ca7c9fe9e4ebd7e5afd134bbd90ceb1e1c8c314fecca280d1201ba1545f51a'),('20261024062231_support_case_lifecycle_and_monitoring.sql','e139ca081aa4a81b9a6e1dfa573402a9e7fed6c3281af13f96dc6088ec1eaadd'),('20261024104102_leadership_reports.sql','e5386a3082dfb3281d9449fc44e5954e12494b7d7844b833d8274258e884a6ef')) v(name,checksum) FULL JOIN sim_guru_migration.schema_migrations m USING(name) WHERE v.checksum IS DISTINCT FROM m.checksum) THEN RAISE EXCEPTION 'MIGRATION_LEDGER_MISMATCH';END IF;
END $release$;
-- Stage 6. Allowlist: classes and optional KBM configuration. No transactional copy.
SET LOCAL ROLE sim_guru_owner;
CREATE TABLE ops.semester_preparations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES app.app_users(id),
 request jsonb NOT NULL,basis_hash text NOT NULL,plan jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',
 consumed_at timestamptz,result jsonb,CHECK((consumed_at IS NULL)=(result IS NULL))
);
CREATE INDEX semester_preparations_history ON ops.semester_preparations(consumed_at DESC,id) WHERE consumed_at IS NOT NULL;
CREATE INDEX semester_preparations_actor ON ops.semester_preparations(actor_id,created_at DESC);
ALTER TABLE ops.semester_preparations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.semester_preparations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON ops.semester_preparations TO sim_guru_owner USING(true) WITH CHECK(true);
REVOKE ALL ON ops.semester_preparations FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
-- Only configuration columns enter the fingerprint, never credentials or business evidence.
CREATE FUNCTION app.semester_basis(src uuid,dst uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object(
 'source',(SELECT to_jsonb(p) FROM app.academic_periods p WHERE id=src),
 'target',(SELECT to_jsonb(p) FROM app.academic_periods p WHERE id=dst),
 'school',(SELECT to_jsonb(s) FROM app.school_profiles s),
 'years',(SELECT coalesce(jsonb_agg(to_jsonb(y) ORDER BY id),'[]') FROM app.academic_years y WHERE id IN(SELECT academic_year_id FROM app.academic_periods WHERE id IN(src,dst))),
 'classes',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY id),'[]') FROM app.classes c WHERE academic_period_id IN(src,dst)),
 'schedules',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM app.teaching_schedules s WHERE academic_period_id IN(src,dst)),
 'users',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name,'role',role,'status',status,'version',version) ORDER BY id),'[]') FROM app.app_users WHERE id IN(SELECT user_id FROM app.teaching_schedules WHERE academic_period_id=src)),
 'subjects',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY id),'[]') FROM app.subjects s WHERE id IN(SELECT subject_id FROM app.teaching_schedules WHERE academic_period_id=src)),
 'targetOccupied',EXISTS(SELECT 1 FROM app.classes WHERE academic_period_id=dst) OR EXISTS(SELECT 1 FROM app.teaching_schedules WHERE academic_period_id=dst) OR EXISTS(SELECT 1 FROM app.duty_schedules WHERE academic_period_id=dst) OR EXISTS(SELECT 1 FROM app.exam_periods WHERE academic_period_id=dst) OR EXISTS(SELECT 1 FROM app.activity_occurrences WHERE academic_period_id=dst))
$$;
CREATE FUNCTION app.semester_plan(d jsonb,b jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE src app.academic_periods%ROWTYPE;dst app.academic_periods%ROWTYPE;c jsonb;s jsonb;classes jsonb:='[]';schedules jsonb:='[]';issues jsonb:='[]';mapping jsonb:='{}';nid uuid;entry jsonb;BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR d-ARRAY['sourceId','targetId','configuration','reason']<>'{}'::jsonb OR NOT d?&ARRAY['sourceId','targetId','configuration','reason'] OR coalesce(d->>'configuration','') NOT IN('classes','classes_and_schedules') OR length(btrim(coalesce(d->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'SEMESTER_INVALID' USING ERRCODE='22023';END IF;
 src:=jsonb_populate_record(null::app.academic_periods,b->'source');dst:=jsonb_populate_record(null::app.academic_periods,b->'target');
 IF src.id IS NULL OR dst.id IS NULL OR src.id=dst.id OR src.archived_at IS NOT NULL OR dst.archived_at IS NOT NULL OR src.date_end>=dst.date_start OR dst.date_start<=app.activity_today() OR dst.date_end-dst.date_start>365 OR dst.is_active THEN issues:=issues||'"PERIOD_INVALID"'::jsonb;END IF;
 IF(b->>'targetOccupied')::boolean THEN issues:=issues||'"TARGET_NOT_EMPTY"'::jsonb;END IF;
 IF b->'school' IS NULL OR b->'school'='null'::jsonb OR b->'school'->>'archived_at' IS NOT NULL THEN issues:=issues||'"SCHOOL_INVALID"'::jsonb;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b->'years') y WHERE y->>'archived_at' IS NOT NULL) THEN issues:=issues||'"PERIOD_INVALID"'::jsonb;END IF;
 FOR c IN SELECT value FROM jsonb_array_elements(b->'classes') WHERE(value->>'academic_period_id')::uuid=src.id AND value->>'archived_at' IS NULL ORDER BY value->>'id' LOOP
 nid:=gen_random_uuid();mapping:=mapping||jsonb_build_object(c->>'id',nid);
 entry:=jsonb_build_object('sourceId',c->>'id','id',nid,'name',c->>'name','level',c->>'level','grade',c->'grade','parallel',c->>'parallel','expectedStudents',0);
 classes:=classes||jsonb_build_array(entry);
 IF c->>'level' IS DISTINCT FROM b->'school'->>'level' OR ((b->'school'->>'use_parallel')::boolean AND(coalesce(c->>'parallel','')='' OR ascii(c->>'parallel')-64>(b->'school'->>'parallel_max')::int)) OR (NOT(b->'school'->>'use_parallel')::boolean AND c->>'parallel'<>'') THEN issues:=issues||'"CLASS_POLICY_CHANGED"'::jsonb;END IF;
 END LOOP;
 IF jsonb_array_length(classes)=0 THEN issues:=issues||'"NO_CLASSES"'::jsonb;END IF;
 IF d->>'configuration'='classes_and_schedules' THEN
 FOR s IN SELECT value FROM jsonb_array_elements(b->'schedules') WHERE(value->>'academic_period_id')::uuid=src.id AND value->>'state'='active' AND(value->>'valid_from')::date<=src.date_end AND(value->>'valid_to')::date>=src.date_end ORDER BY value->>'id' LOOP
 IF NOT (mapping ? (s->>'class_id')) THEN issues:=issues||'"CLASS_MISSING"'::jsonb;END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'users') u WHERE u->>'id'=s->>'user_id' AND u->>'role'='guru' AND u->>'status'='active') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'subjects') u WHERE u->>'id'=s->>'subject_id' AND u->>'archived_at' IS NULL) THEN issues:=issues||'"INACTIVE_DEPENDENCY"'::jsonb;END IF;
 IF (s->>'minutes_per_jtm')::int IS DISTINCT FROM(b->'school'->>'minutes_per_jtm')::int THEN issues:=issues||'"JP_POLICY_CHANGED"'::jsonb;END IF;
 IF NOT app.schedule_weekday_exists(dst.date_start,dst.date_end,(s->>'day_index')::int) THEN issues:=issues||'"WEEKDAY_MISSING"'::jsonb;END IF;
 schedules:=schedules||jsonb_build_array(jsonb_build_object('sourceId',s->>'id','id',gen_random_uuid(),'classId',mapping->>(s->>'class_id'),'className',(SELECT x->>'name' FROM jsonb_array_elements(classes)x WHERE x->>'sourceId'=s->>'class_id'),'teacher',(SELECT u->>'name' FROM jsonb_array_elements(b->'users')u WHERE u->>'id'=s->>'user_id'),'subject',(SELECT u->>'name' FROM jsonb_array_elements(b->'subjects')u WHERE u->>'id'=s->>'subject_id'),'userId',s->>'user_id','subjectId',s->>'subject_id','dayIndex',(s->>'day_index')::int,'timeStart',s->>'time_start','timeEnd',s->>'time_end','scheduledJtm',s->>'scheduled_jtm','restMinutes',(s->>'rest_minutes')::int,'validFrom',dst.date_start,'validTo',dst.date_end));
 END LOOP;
 IF jsonb_array_length(schedules)=0 THEN issues:=issues||'"NO_SCHEDULES"'::jsonb;END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(schedules)a JOIN jsonb_array_elements(schedules)z ON a->>'id'<z->>'id' AND a->>'dayIndex'=z->>'dayIndex' AND(a->>'userId'=z->>'userId' OR a->>'classId'=z->>'classId') AND(a->>'timeStart')::time<(z->>'timeEnd')::time AND(z->>'timeStart')::time<(a->>'timeEnd')::time) THEN issues:=issues||'"SCHEDULE_COLLISION"'::jsonb;END IF;
 END IF;
 IF jsonb_array_length(classes)>500 OR jsonb_array_length(schedules)>2000 THEN issues:=issues||'"PLAN_TOO_LARGE"'::jsonb;END IF;
 SELECT coalesce(jsonb_agg(DISTINCT x),'[]') INTO issues FROM jsonb_array_elements(issues)x;
 RETURN jsonb_build_object('classes',classes,'schedules',schedules,'issues',issues,'sourceDate',src.date_end,'validFrom',dst.date_start,'validTo',dst.date_end,'sourceId',src.id,'targetId',dst.id,'configuration',d->>'configuration');
END $$;
CREATE FUNCTION app.semester_read(p_session text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;r ops.semester_preparations%ROWTYPE;BEGIN
 actor:=app.master_guard(p_session,false);
 IF d?'previewId' THEN
 SELECT * INTO r FROM ops.semester_preparations WHERE id=(d->>'previewId')::uuid AND actor_id=actor;
 IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 RETURN jsonb_build_object('previewId',r.id,'plan',r.plan,'expiresAt',r.expires_at,'result',r.result);
 END IF;
 RETURN jsonb_build_object('periods',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',y.label||' · Semester '||p.semester,'start',p.date_start,'end',p.date_end,'active',p.is_active) ORDER BY p.date_start DESC,p.id) FROM app.academic_periods p JOIN app.academic_years y ON y.id=p.academic_year_id WHERE p.archived_at IS NULL AND y.archived_at IS NULL),'[]'),
 'history',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.at DESC,h.id) FROM(SELECT prep.id,prep.consumed_at at,prep.result-ARRAY['classMapping','scheduleMapping'] result,prep.request->>'reason' reason,u.full_name actor FROM ops.semester_preparations prep JOIN app.app_users u ON u.id=prep.actor_id WHERE prep.consumed_at IS NOT NULL ORDER BY prep.consumed_at DESC,prep.id LIMIT 20)h),'[]'));
END $$;
CREATE FUNCTION app.semester_preview(p_session text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;b jsonb;p jsonb;rid uuid;BEGIN
 actor:=app.master_guard(p_session,true);b:=app.semester_basis((d->>'sourceId')::uuid,(d->>'targetId')::uuid);IF b->'source'='null'::jsonb OR b->'target'='null'::jsonb THEN RAISE EXCEPTION 'SEMESTER_INVALID' USING ERRCODE='22023';END IF;p:=app.semester_plan(d,b);
 -- Bound unconsumed previews without deleting committed audit receipts.
 DELETE FROM ops.semester_preparations WHERE actor_id=actor AND consumed_at IS NULL AND expires_at<clock_timestamp();
 IF(SELECT count(*) FROM ops.semester_preparations WHERE actor_id=actor AND consumed_at IS NULL)>20 THEN RAISE EXCEPTION 'SEMESTER_PREVIEW_LIMIT' USING ERRCODE='22023';END IF;
 INSERT INTO ops.semester_preparations(actor_id,request,basis_hash,plan)VALUES(actor,d,md5(b::text),p)RETURNING id INTO rid;
 RETURN jsonb_build_object('previewId',rid,'plan',p,'expiresAt',(SELECT expires_at FROM ops.semester_preparations WHERE id=rid),'result',null);
END $$;
CREATE FUNCTION app.semester_commit(p_session text,p_preview uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;r ops.semester_preparations%ROWTYPE;b jsonb;x jsonb;c jsonb;res jsonb;BEGIN
 actor:=app.master_guard(p_session,true);SELECT * INTO r FROM ops.semester_preparations WHERE id=p_preview AND actor_id=actor FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF r.result IS NOT NULL THEN RETURN r.result;END IF;
 b:=app.semester_basis((r.request->>'sourceId')::uuid,(r.request->>'targetId')::uuid);
 IF r.expires_at<clock_timestamp() OR md5(b::text)<>r.basis_hash OR jsonb_array_length(r.plan->'issues')>0 OR(r.plan->>'validFrom')::date<=app.activity_today() THEN RAISE EXCEPTION 'SEMESTER_PREVIEW_STALE' USING ERRCODE='40001';END IF;
 PERFORM set_config('app.master_reason',r.request->>'reason',true);
 FOR x IN SELECT value FROM jsonb_array_elements(r.plan->'classes') LOOP
 INSERT INTO app.classes(id,academic_period_id,name,level,grade,parallel,expected_students)VALUES((x->>'id')::uuid,(r.request->>'targetId')::uuid,x->>'name',x->>'level',(x->>'grade')::smallint,x->>'parallel',0);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(r.plan->'schedules') LOOP
 c:=app.schedule_candidate(jsonb_build_object('academicPeriodId',r.request->>'targetId','userId',x->>'userId','subjectId',x->>'subjectId','classId',x->>'classId','dayIndex',x->'dayIndex','timeStart',to_char((x->>'timeStart')::time,'HH24:MI'),'scheduledJtm',x->>'scheduledJtm','restMinutes',x->'restMinutes','validFrom',x->>'validFrom','validTo',x->>'validTo'));
 IF(c->>'time_end')::time IS DISTINCT FROM(x->>'timeEnd')::time THEN RAISE EXCEPTION 'SEMESTER_PREVIEW_STALE' USING ERRCODE='40001';END IF;
 INSERT INTO app.teaching_schedules(id,academic_period_id,user_id,subject_id,class_id,day_index,time_start,time_end,scheduled_jtm,rest_minutes,minutes_per_jtm,valid_from,valid_to,snapshot)
 SELECT (x->>'id')::uuid,q.academic_period_id,q.user_id,q.subject_id,q.class_id,q.day_index,q.time_start,q.time_end,q.scheduled_jtm,q.rest_minutes,q.minutes_per_jtm,q.valid_from,q.valid_to,q.snapshot FROM jsonb_populate_record(null::app.teaching_schedules,c)q;
 END LOOP;
 res:=jsonb_build_object('previewId',r.id,'sourceId',r.request->>'sourceId','targetId',r.request->>'targetId','classes',jsonb_array_length(r.plan->'classes'),'schedules',jsonb_array_length(r.plan->'schedules'),'committedAt',clock_timestamp(),'classMapping',r.plan->'classes','scheduleMapping',r.plan->'schedules');
 UPDATE ops.semester_preparations SET consumed_at=clock_timestamp(),result=res WHERE id=r.id;
 PERFORM app.activity_audit('semester-preparation',r.id,r.request->>'reason',null,res);
 UPDATE app.calendar_state SET revision=revision+1 WHERE singleton;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION app.semester_basis(uuid,uuid),app.semester_plan(jsonb,jsonb),app.semester_read(text,jsonb),app.semester_preview(text,jsonb),app.semester_commit(text,uuid) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
GRANT EXECUTE ON FUNCTION app.semester_read(text,jsonb),app.semester_preview(text,jsonb),app.semester_commit(text,uuid) TO sim_guru_business;
RESET ROLE;

RESET ROLE;
INSERT INTO sim_guru_migration.schema_migrations(name,checksum)VALUES('20261024112506_semester_preparation.sql','eec3a6a030f4c6a3018dc1ab0a280d08e039c0ce319b76d182a06376310e6674');
