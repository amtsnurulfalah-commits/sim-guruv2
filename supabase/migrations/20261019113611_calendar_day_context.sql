SET LOCAL ROLE sim_guru_owner;
CREATE TABLE app.academic_calendar(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),date date NOT NULL UNIQUE CHECK(isfinite(date)),description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 500),is_holiday boolean NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),deleted_at timestamptz);
CREATE TABLE app.day_context_overrides(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),date date NOT NULL UNIQUE CHECK(isfinite(date)),academic_period_id uuid NOT NULL REFERENCES app.academic_periods(id),kbm_enabled boolean NOT NULL,exam_enabled boolean NOT NULL,reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),version bigint NOT NULL DEFAULT 1 CHECK(version>0),deleted_at timestamptz);
CREATE INDEX context_overrides_period ON app.day_context_overrides(academic_period_id);
CREATE TABLE app.calendar_state(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),revision bigint NOT NULL CHECK(revision>0));
INSERT INTO app.calendar_state(singleton,revision) VALUES(true,1);
CREATE TABLE ops.calendar_previews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES app.app_users(id),kind text NOT NULL CHECK(kind IN('calendar','context')),request jsonb NOT NULL,state_revision bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '10 minutes',consumed_at timestamptz);
CREATE INDEX calendar_previews_actor ON ops.calendar_previews(actor_id);
CREATE INDEX calendar_previews_expiry ON ops.calendar_previews(expires_at);
DO $$ DECLARE t text;BEGIN FOREACH t IN ARRAY ARRAY['app.academic_calendar','app.day_context_overrides','app.calendar_state','ops.calendar_previews'] LOOP EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);END LOOP;END $$;
-- No fake conflict scan. A later scheduling/exam/finance migration MUST replace this adapter.
CREATE FUNCTION app.calendar_dependencies(p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ BEGIN
 IF to_regclass('app.teaching_schedules') IS NOT NULL OR to_regclass('app.activity_occurrences') IS NOT NULL OR to_regclass('app.exam_periods') IS NOT NULL OR to_regclass('finance.honor_periods') IS NOT NULL THEN RAISE EXCEPTION 'CONTEXT_DEPENDENCY_UNAVAILABLE' USING ERRCODE='55000';END IF;
 RETURN jsonb_build_object('assignmentIntegration','not_installed','activeExamPeriods','[]'::jsonb,'activeExamPeriodIds','[]'::jsonb);
END $$;
CREATE FUNCTION app.day_context_internal(p_date date,p_calendar jsonb DEFAULT null,p_override jsonb DEFAULT null) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$
DECLARE c jsonb;o jsonb;p jsonb;dep jsonb;holiday boolean;kbm boolean;exam boolean;rev bigint;idx int;why jsonb:='[]'::jsonb;BEGIN
 IF p_date IS NULL OR NOT isfinite(p_date) THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 IF p_calendar IS NULL THEN SELECT to_jsonb(x) INTO c FROM app.academic_calendar x WHERE date=p_date;ELSE c:=p_calendar;END IF;
 IF p_override IS NULL THEN SELECT to_jsonb(x) INTO o FROM app.day_context_overrides x WHERE date=p_date;ELSE o:=p_override;END IF;
 IF c->>'deleted_at' IS NOT NULL OR c='{}'::jsonb THEN c:=null;END IF;IF o->>'deleted_at' IS NOT NULL OR o='{}'::jsonb THEN o:=null;END IF;
 IF o->>'academic_period_id' IS NOT NULL THEN
  SELECT jsonb_build_object('id',a.id,'label',y.label,'semester',a.semester,'dateStart',a.date_start,'dateEnd',a.date_end) INTO p FROM app.academic_periods a JOIN app.academic_years y ON y.id=a.academic_year_id WHERE a.id=(o->>'academic_period_id')::uuid AND a.archived_at IS NULL AND y.archived_at IS NULL AND p_date BETWEEN a.date_start AND a.date_end;
 ELSE
  SELECT jsonb_build_object('id',a.id,'label',y.label,'semester',a.semester,'dateStart',a.date_start,'dateEnd',a.date_end) INTO p FROM app.academic_periods a JOIN app.academic_years y ON y.id=a.academic_year_id WHERE a.is_active AND a.archived_at IS NULL AND y.archived_at IS NULL AND p_date BETWEEN a.date_start AND a.date_end;
 END IF;
 dep:=app.calendar_dependencies(p_date);holiday:=coalesce((c->>'is_holiday')::boolean,false);idx:=extract(dow FROM p_date)::integer;
 kbm:=p IS NOT NULL AND NOT holiday AND coalesce((o->>'kbm_enabled')::boolean,idx<>0);
 exam:=p IS NOT NULL AND NOT holiday AND coalesce((o->>'exam_enabled')::boolean,jsonb_array_length(dep->'activeExamPeriods')>0);
 IF p IS NULL THEN why:=why||'"NO_ACADEMIC_PERIOD"'::jsonb;END IF;IF holiday THEN why:=why||'"HOLIDAY"'::jsonb;END IF;IF idx=0 AND o IS NULL THEN why:=why||'"SUNDAY_DEFAULT_OFF"'::jsonb;END IF;
 SELECT revision INTO rev FROM app.calendar_state WHERE singleton;
 RETURN jsonb_build_object('date',p_date,'dayIndex',idx,'isHoliday',holiday,'calendarEntry',CASE WHEN c IS NULL OR c='{}'::jsonb THEN null ELSE jsonb_build_object('id',c->>'id','date',p_date,'description',c->>'description','isHoliday',(c->>'is_holiday')::boolean,'version',c->>'version','deletedAt',c->>'deleted_at') END,
 'kbmEnabled',kbm,'examEnabled',exam,'activeExamPeriods',dep->'activeExamPeriods','activeExamPeriodIds',dep->'activeExamPeriodIds','activeAcademicPeriod',p,'academicPeriodId',p->>'id',
 'override',CASE WHEN o IS NULL OR o='{}'::jsonb THEN null ELSE jsonb_build_object('id',o->>'id','version',o->>'version','academicPeriodId',o->>'academic_period_id','kbmEnabled',(o->>'kbm_enabled')::boolean,'examEnabled',(o->>'exam_enabled')::boolean) END,
 'calendarVersion',coalesce((SELECT version::text FROM app.academic_calendar WHERE date=p_date),'0'),'overrideVersion',coalesce((SELECT version::text FROM app.day_context_overrides WHERE date=p_date),'0'),
 'contextVersion',md5(jsonb_build_array('calendar-v1',rev,p_date,c,o,p,dep)::text),'reasons',why,'policyVersion','calendar-v1','assignmentIntegration',dep->>'assignmentIntegration');
END $$;
CREATE FUNCTION app.get_day_context(p_session text,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM auth_private.lifecycle_self(p_session);IF auth_private.resolve_actor(true) IS NULL THEN RAISE EXCEPTION 'ONBOARDING_REQUIRED' USING ERRCODE='42501';END IF;RETURN app.day_context_internal(p_date);END $$;
CREATE FUNCTION app.calendar_revision_bump() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN UPDATE app.calendar_state SET revision=revision+1 WHERE singleton;RETURN null;END $$;
CREATE TRIGGER calendar_revision AFTER INSERT OR UPDATE ON app.academic_calendar FOR EACH STATEMENT EXECUTE FUNCTION app.calendar_revision_bump();
CREATE TRIGGER context_revision AFTER INSERT OR UPDATE ON app.day_context_overrides FOR EACH STATEMENT EXECUTE FUNCTION app.calendar_revision_bump();
CREATE TRIGGER academic_context_revision AFTER INSERT OR UPDATE ON app.academic_periods FOR EACH STATEMENT EXECUTE FUNCTION app.calendar_revision_bump();
CREATE FUNCTION app.calendar_parent_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM app.day_context_overrides WHERE academic_period_id=NEW.id AND deleted_at IS NULL AND (NEW.archived_at IS NOT NULL OR date<NEW.date_start OR date>NEW.date_end)) THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;RETURN NEW;END $$;
CREATE TRIGGER calendar_parent_guard BEFORE UPDATE ON app.academic_periods FOR EACH ROW EXECUTE FUNCTION app.calendar_parent_guard();
CREATE FUNCTION app.calendar_audit() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE a uuid;r text;BEGIN
 a:=auth_private.require_admin();r:=current_setting('app.master_reason',true);IF r IS NULL OR length(btrim(r)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.master_revisions(kind,entity_id,actor_id,reason,old_data,new_data) VALUES(TG_ARGV[0],NEW.id,a,r,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE null END,to_jsonb(NEW));
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,'calendar.'||TG_ARGV[0]||'.changed',NEW.id,r,jsonb_build_object('version',NEW.version,'deleted',NEW.deleted_at IS NOT NULL));RETURN NEW;END $$;
CREATE TRIGGER calendar_audit AFTER INSERT OR UPDATE ON app.academic_calendar FOR EACH ROW EXECUTE FUNCTION app.calendar_audit('calendar');
CREATE TRIGGER context_audit AFTER INSERT OR UPDATE ON app.day_context_overrides FOR EACH ROW EXECUTE FUNCTION app.calendar_audit('day-context');
CREATE FUNCTION app.calendar_list(p_session text,p_filter jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE start_date date:=(p_filter->>'dateStart')::date;end_date date:=(p_filter->>'dateEnd')::date;page int:=(p_filter->>'page')::int;size int:=(p_filter->>'pageSize')::int;result jsonb;BEGIN
 PERFORM app.master_guard(p_session,false);
 IF start_date IS NULL OR end_date IS NULL OR NOT isfinite(start_date) OR NOT isfinite(end_date) OR end_date-start_date NOT BETWEEN 0 AND 365 OR page IS NULL OR size IS NULL OR page NOT BETWEEN 1 AND 100000 OR size NOT BETWEEN 1 AND 100 OR coalesce(p_filter->>'holiday','') NOT IN('','true','false') OR length(coalesce(p_filter->>'q',''))>100 THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 WITH filtered AS(SELECT * FROM app.academic_calendar WHERE date BETWEEN start_date AND end_date AND deleted_at IS NULL AND(coalesce(p_filter->>'holiday','')='' OR is_holiday=(p_filter->>'holiday')::boolean) AND position(lower(coalesce(p_filter->>'q','')) in lower(description))>0),paged AS(SELECT * FROM filtered ORDER BY date,id LIMIT size OFFSET(page-1)*size)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'date',date,'description',description,'isHoliday',is_holiday,'version',version::text,'deletedAt',deleted_at) ORDER BY date,id) FROM paged),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',page,'pageSize',size) INTO result;RETURN result;END $$;
-- Shared dry-run logic is executed both before preview and again inside the commit transaction.
CREATE FUNCTION app.calendar_changes(p_kind text,p_request jsonb,p_apply boolean) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE start_date date;end_date date;d date;action text:=p_request->>'action';expected bigint;old jsonb;replacement jsonb;before_day jsonb;after_day jsonb;days jsonb:='[]'::jsonb;period app.academic_periods%ROWTYPE;allowed text[];today date:=(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date;BEGIN
 IF p_kind NOT IN('calendar','context') OR p_kind IS NULL OR action IS NULL OR p_request->>'reason' IS NULL OR length(btrim(p_request->>'reason')) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 allowed:=CASE action WHEN 'upsert' THEN ARRAY['action','date','version','description','isHoliday','reason'] WHEN 'delete' THEN ARRAY['action','date','version','reason'] WHEN 'range' THEN ARRAY['action','dateStart','dateEnd','description','isHoliday','reason'] WHEN 'override' THEN ARRAY['action','date','version','academicPeriodId','kbmEnabled','examEnabled','reason'] WHEN 'clear' THEN ARRAY['action','date','version','reason'] END;
 IF allowed IS NULL OR p_request-allowed<>'{}'::jsonb OR NOT p_request ?& allowed THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 start_date:=CASE WHEN action='range' THEN (p_request->>'dateStart')::date ELSE(p_request->>'date')::date END;end_date:=CASE WHEN action='range' THEN(p_request->>'dateEnd')::date ELSE start_date END;
 IF start_date IS NULL OR end_date IS NULL OR NOT isfinite(start_date) OR NOT isfinite(end_date) OR end_date-start_date NOT BETWEEN 0 AND 365 THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 IF start_date<today THEN RAISE EXCEPTION 'CALENDAR_PAST' USING ERRCODE='42501';END IF;
 PERFORM set_config('app.master_reason',p_request->>'reason',true);
 FOR d IN SELECT generate_series(start_date::timestamp,end_date::timestamp,interval '1 day')::date LOOP
  PERFORM app.calendar_dependencies(d);before_day:=app.day_context_internal(d);
  IF p_kind='calendar' THEN
   IF action NOT IN('upsert','delete','range') THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
   SELECT to_jsonb(x) INTO old FROM app.academic_calendar x WHERE date=d FOR UPDATE;
   expected:=CASE WHEN action='range' THEN 0 ELSE(p_request->>'version')::bigint END;
   IF coalesce((old->>'version')::bigint,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
   IF action='delete' AND(old IS NULL OR old->>'deleted_at' IS NOT NULL) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
   IF action<>'delete' AND(coalesce(length(btrim(p_request->>'description')),0) NOT BETWEEN 1 AND 500 OR jsonb_typeof(p_request->'isHoliday') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
   replacement:=CASE WHEN action='delete' THEN '{}'::jsonb ELSE jsonb_build_object('id',old->>'id','date',d,'description',p_request->>'description','is_holiday',(p_request->>'isHoliday')::boolean,'version',(expected+1)::text,'deleted_at',null) END;
   after_day:=app.day_context_internal(d,replacement,null);
   IF p_apply THEN
    IF old IS NULL THEN INSERT INTO app.academic_calendar(date,description,is_holiday) VALUES(d,p_request->>'description',(p_request->>'isHoliday')::boolean);
    ELSIF action='delete' THEN UPDATE app.academic_calendar SET deleted_at=clock_timestamp(),version=version+1 WHERE date=d;
    ELSE UPDATE app.academic_calendar SET description=p_request->>'description',is_holiday=(p_request->>'isHoliday')::boolean,deleted_at=null,version=version+1 WHERE date=d;END IF;
   END IF;
  ELSE
   IF action NOT IN('override','clear') THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
   SELECT to_jsonb(x) INTO old FROM app.day_context_overrides x WHERE date=d FOR UPDATE;expected:=(p_request->>'version')::bigint;
   IF coalesce((old->>'version')::bigint,0) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
   IF action='clear' AND(old IS NULL OR old->>'deleted_at' IS NOT NULL) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
   IF action='override' THEN
    SELECT * INTO period FROM app.academic_periods WHERE id=(p_request->>'academicPeriodId')::uuid AND archived_at IS NULL AND d BETWEEN date_start AND date_end;
    IF period.id IS NULL OR jsonb_typeof(p_request->'kbmEnabled') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_request->'examEnabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
    replacement:=jsonb_build_object('id',old->>'id','academic_period_id',period.id,'kbm_enabled',(p_request->>'kbmEnabled')::boolean,'exam_enabled',(p_request->>'examEnabled')::boolean,'version',(expected+1)::text,'deleted_at',null);
   ELSE replacement:='{}'::jsonb;END IF;
   after_day:=app.day_context_internal(d,null,replacement);
   IF p_apply THEN
    IF old IS NULL THEN INSERT INTO app.day_context_overrides(date,academic_period_id,kbm_enabled,exam_enabled,reason) VALUES(d,period.id,(p_request->>'kbmEnabled')::boolean,(p_request->>'examEnabled')::boolean,p_request->>'reason');
    ELSIF action='clear' THEN UPDATE app.day_context_overrides SET deleted_at=clock_timestamp(),version=version+1,reason=p_request->>'reason' WHERE date=d;
    ELSE UPDATE app.day_context_overrides SET academic_period_id=period.id,kbm_enabled=(p_request->>'kbmEnabled')::boolean,exam_enabled=(p_request->>'examEnabled')::boolean,reason=p_request->>'reason',deleted_at=null,version=version+1 WHERE date=d;END IF;
   END IF;
  END IF;
  days:=days||jsonb_build_array(jsonb_build_object('date',d,'before',before_day,'after',after_day));
 END LOOP;RETURN days;
END $$;
CREATE FUNCTION app.calendar_preview(p_session text,p_kind text,p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;days jsonb;v ops.calendar_previews%ROWTYPE;rev bigint;BEGIN
 a:=app.master_guard(p_session,true);days:=app.calendar_changes(p_kind,p_request,false);SELECT revision INTO rev FROM app.calendar_state WHERE singleton;
 INSERT INTO ops.calendar_previews(actor_id,kind,request,state_revision) VALUES(a,p_kind,p_request,rev) RETURNING * INTO v;
 RETURN jsonb_build_object('previewId',v.id,'expiresAt',v.expires_at,'kind',p_kind,'action',p_request->>'action','count',jsonb_array_length(days),'days',days,'assignmentIntegration','not_installed','policyVersion','calendar-v1');END $$;
CREATE FUNCTION app.calendar_commit(p_session text,p_preview uuid,p_kind text,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;v ops.calendar_previews%ROWTYPE;days jsonb;rev bigint;BEGIN
 a:=app.master_guard(p_session,true);IF (p_kind='context' AND p_action IS DISTINCT FROM 'context') OR (p_kind='calendar' AND p_action NOT IN('upsert','delete','range')) THEN RAISE EXCEPTION 'CALENDAR_PREVIEW_INVALID' USING ERRCODE='42501';END IF;SELECT * INTO v FROM ops.calendar_previews WHERE id=p_preview FOR UPDATE;
 IF v.id IS NULL OR v.actor_id<>a OR v.kind IS DISTINCT FROM p_kind OR (p_action<>'context' AND v.request->>'action' IS DISTINCT FROM p_action) OR p_action IS NULL OR v.consumed_at IS NOT NULL OR v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CALENDAR_PREVIEW_INVALID' USING ERRCODE='42501';END IF;
 SELECT revision INTO rev FROM app.calendar_state WHERE singleton;IF rev<>v.state_revision THEN RAISE EXCEPTION 'CALENDAR_PREVIEW_STALE' USING ERRCODE='40001';END IF;
 days:=app.calendar_changes(v.kind,v.request,true);UPDATE ops.calendar_previews SET consumed_at=clock_timestamp() WHERE id=v.id;
 RETURN jsonb_build_object('committed',true,'count',jsonb_array_length(days),'previewId',v.id,'policyVersion','calendar-v1');END $$;
CREATE FUNCTION app.calendar_history(p_session text,p_kind text,p_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE id uuid;BEGIN
 PERFORM app.master_guard(p_session,false);IF p_kind='calendar' THEN SELECT c.id INTO id FROM app.academic_calendar c WHERE date=p_date;ELSIF p_kind='day-context' THEN SELECT o.id INTO id FROM app.day_context_overrides o WHERE date=p_date;ELSE RAISE EXCEPTION 'CALENDAR_INVALID' USING ERRCODE='22023';END IF;
 RETURN app.master_history(p_session,p_kind,id);END $$;
REVOKE ALL ON FUNCTION app.calendar_audit(),app.calendar_history(text,text,date),app.calendar_dependencies(date),app.day_context_internal(date,jsonb,jsonb),app.get_day_context(text,date),app.calendar_revision_bump(),app.calendar_parent_guard(),app.calendar_list(text,jsonb),app.calendar_changes(text,jsonb,boolean),app.calendar_preview(text,text,jsonb),app.calendar_commit(text,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.calendar_history(text,text,date),app.get_day_context(text,date),app.calendar_list(text,jsonb),app.calendar_preview(text,text,jsonb),app.calendar_commit(text,uuid,text,text) TO sim_guru_business;
RESET ROLE;
