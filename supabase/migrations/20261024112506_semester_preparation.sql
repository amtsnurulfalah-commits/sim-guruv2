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
