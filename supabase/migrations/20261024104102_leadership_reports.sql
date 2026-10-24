-- Stage 5: explicit report scopes. No materialization, ledger or final snapshot mutation.
SET LOCAL ROLE sim_guru_owner;
CREATE TABLE app.report_readers(
 user_id uuid PRIMARY KEY REFERENCES app.app_users(id), academic boolean NOT NULL DEFAULT false,
 finance boolean NOT NULL DEFAULT false,version bigint NOT NULL DEFAULT 1,
 updated_by uuid NOT NULL REFERENCES app.app_users(id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(version>0)
);
ALTER TABLE app.report_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.report_readers FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON app.report_readers TO sim_guru_owner USING(true) WITH CHECK(true);
REVOKE ALL ON app.report_readers FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
CREATE FUNCTION app.report_access(p_session text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;u uuid;v bigint;BEGIN
 actor:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();
 IF jsonb_typeof(d)<>'object' OR coalesce(d->>'userId','')!~'^[a-f0-9-]{36}$' OR jsonb_typeof(d->'academic') IS DISTINCT FROM 'boolean' OR jsonb_typeof(d->'finance') IS DISTINCT FROM 'boolean' OR coalesce(d->>'version','')!~'^[0-9]{1,15}$' OR length(btrim(coalesce(d->>'reason',''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REPORT_INVALID' USING ERRCODE='22023';END IF;
 u:=(d->>'userId')::uuid;v:=(d->>'version')::bigint;
 IF NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=u AND role='guru' AND status='active') THEN RAISE EXCEPTION 'REPORT_INVALID' USING ERRCODE='22023';END IF;
 IF coalesce((SELECT version FROM app.report_readers WHERE user_id=u),0)<>v THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 INSERT INTO app.report_readers(user_id,academic,finance,updated_by) VALUES(u,(d->>'academic')::boolean,(d->>'finance')::boolean,actor)
 ON CONFLICT(user_id) DO UPDATE SET academic=excluded.academic,finance=excluded.finance,version=app.report_readers.version+1,updated_by=actor,updated_at=clock_timestamp();
 PERFORM app.activity_audit('report-access',u,btrim(d->>'reason'),NULL,jsonb_build_object('academic',d->'academic','finance',d->'finance'));
 RETURN jsonb_build_object('ok',true);
END $$;
-- Internal canonical rowset. Callers must authorize first; never grant directly to business.
CREATE FUNCTION app.report_academic_rows(m date,teacher uuid) RETURNS TABLE(id uuid,category text,date date,user_id uuid,name text,class_name text,subject text,confirmed boolean,documented boolean,time_in text,time_out text)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT o.id,o.kind,o.date,u.id,u.full_name,c.name,s.name,
 EXISTS(SELECT 1 FROM app.activity_confirmations f WHERE f.assignment_id=a.id AND f.revoked_at IS NULL),
 CASE WHEN o.kind='KBM' THEN EXISTS(SELECT 1 FROM app.teaching_journals j WHERE j.occurrence_id=o.id AND j.assignment_id=a.id AND j.user_id=a.effective_user_id AND j.deleted_at IS NULL)
 ELSE EXISTS(SELECT 1 FROM app.exam_baps b WHERE b.occurrence_id=o.id AND b.assignment_id=a.id AND b.user_id=a.effective_user_id AND b.state='active') END,NULL::text,NULL::text
 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id JOIN app.app_users u ON u.id=a.effective_user_id LEFT JOIN app.classes c ON c.id=o.class_id LEFT JOIN app.subjects s ON s.id=o.subject_id
 WHERE o.date>=m AND o.date<(m+interval '1 month')::date AND o.date<=app.activity_today() AND o.removed_at IS NULL AND o.kind IN('KBM','EXAM_SUPERVISOR') AND(teacher IS NULL OR u.id=teacher)
 AND coalesce((app.day_context_internal(o.date)->>CASE WHEN o.kind='KBM' THEN 'kbmEnabled' ELSE 'examEnabled' END)::boolean,false)
 UNION ALL
 SELECT d.id,'ATTENDANCE',d.date,u.id,u.full_name,NULL,NULL,d.actual_time_in IS NOT NULL,d.actual_time_out IS NOT NULL,d.actual_time_in::text,d.actual_time_out::text
 FROM app.daily_attendance d JOIN app.app_users u ON u.id=d.user_id WHERE d.date>=m AND d.date<(m+interval '1 month')::date AND d.date<=app.activity_today() AND(teacher IS NULL OR u.id=teacher)
$$;
CREATE FUNCTION app.reports_read(p_session text,d jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;adm boolean;ac boolean;fi boolean;k text:=d->>'kind';m date;teacher uuid;pg int;sz int;res jsonb;rows jsonb;summary jsonb;issues jsonb:='[]';mode text:=coalesce(d->>'mode','realized');is_final boolean;v_total int;BEGIN
 actor:=app.activity_guard(p_session,false);adm:=app.actor_is_admin();
 SELECT adm OR coalesce(r.academic,false),adm OR coalesce(r.finance,false) INTO ac,fi FROM(SELECT 1) dummy LEFT JOIN app.report_readers r ON r.user_id=actor;
 IF k='capabilities' THEN RETURN jsonb_build_object('admin',adm,'academic',ac,'finance',fi);END IF;
 IF k='access' THEN
 PERFORM auth_private.require_admin();
 RETURN jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',u.full_name,'academic',coalesce(r.academic,false),'finance',coalesce(r.finance,false),'version',coalesce(r.version,0)::text) ORDER BY u.full_name,u.id) FROM app.app_users u LEFT JOIN app.report_readers r ON r.user_id=u.id WHERE u.role='guru' AND u.status='active'),'[]'));
 END IF;
 IF k NOT IN('academic','finance') OR k IS NULL THEN RAISE EXCEPTION 'REPORT_INVALID' USING ERRCODE='22023';END IF;
 IF (k='academic' AND NOT ac) OR(k='finance' AND NOT fi) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF coalesce(d->>'period','')!~'^(20[0-9]{2})-(0[1-9]|1[0-2])$' OR mode NOT IN('realized','projection') OR coalesce(d->>'page','1')!~'^[1-9][0-9]{0,5}$' OR coalesce(d->>'pageSize','25')!~'^[1-9][0-9]{0,3}$' THEN RAISE EXCEPTION 'REPORT_INVALID' USING ERRCODE='22023';END IF;
 m:=((d->>'period')||'-01')::date;teacher:=nullif(d->>'teacher','')::uuid;pg:=coalesce((d->>'page')::int,1);sz:=coalesce((d->>'pageSize')::int,25);
 IF sz NOT IN(25,100,1000) THEN RAISE EXCEPTION 'REPORT_INVALID' USING ERRCODE='22023';END IF;
 IF k='academic' THEN
 WITH source AS MATERIALIZED(SELECT * FROM app.report_academic_rows(m,teacher))
 SELECT count(*)::int,jsonb_build_object('kbm',count(*) FILTER(WHERE category='KBM'),'confirmed',count(*) FILTER(WHERE category='KBM' AND confirmed),'journals',count(*) FILTER(WHERE category='KBM' AND documented),'exams',count(*) FILTER(WHERE category='EXAM_SUPERVISOR'),'baps',count(*) FILTER(WHERE category='EXAM_SUPERVISOR' AND documented),'attendance',count(*) FILTER(WHERE category='ATTENDANCE'),'present',count(*) FILTER(WHERE category='ATTENDANCE' AND confirmed),'complete',count(*) FILTER(WHERE category='ATTENDANCE' AND documented)),coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.date,r.category,r.name,r.id) FROM(SELECT * FROM source ORDER BY date,category,name,id LIMIT sz OFFSET(pg-1)*sz)r),'[]') INTO v_total,summary,rows FROM source;
 mode:='recorded';
 ELSE
 is_final:=EXISTS(SELECT 1 FROM finance.honor_periods WHERE period_start=m AND state='final');
 IF is_final THEN
 SELECT coalesce(jsonb_agg(s.snapshot ORDER BY s.user_id),'[]') INTO res FROM finance.honor_statements s JOIN finance.honor_periods p ON p.id=s.period_id WHERE p.period_start=m;mode:='final';
 ELSE res:=finance.bundle(m,mode);issues:=res->'issues';res:=res->'statements';END IF;
 WITH source AS MATERIALIZED(SELECT (x->'recipient'->>'id')::uuid id,x->'recipient'->>'name' name,x->>'cutoff' cutoff,x->>'totalJtm' jtm,x->>'teachingSettled' teaching,x->>'allowances' allowances,x->>'transportSettled' transport,x->>'corrections' corrections,x->>'total' total FROM jsonb_array_elements(res)x WHERE teacher IS NULL OR (x->'recipient'->>'id')::uuid=teacher)
 SELECT count(*)::int,jsonb_build_object('beneficiaries',count(*),'jtm',coalesce(sum(jtm::numeric),0)::text,'total',coalesce(sum(total::numeric),0)::text),coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.name,r.id) FROM(SELECT * FROM source ORDER BY name,id LIMIT sz OFFSET(pg-1)*sz)r),'[]') INTO v_total,summary,rows FROM source;
 -- Only issue categories, never arbitrary user identifiers or source notes.
 SELECT coalesce(jsonb_agg(DISTINCT split_part(x#>>'{}',':',1)),'[]') INTO issues FROM jsonb_array_elements(issues)x;
 END IF;
 RETURN jsonb_build_object('kind',k,'period',d->>'period','teacher',teacher,'mode',mode,'cutoff',least(app.activity_today(),(m+interval '1 month - 1 day')::date),'updatedAt',statement_timestamp(),'summary',summary,'issues',issues,'items',rows,'total',v_total,'page',pg,'pageSize',sz,'teachers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',full_name) ORDER BY full_name,id) FROM app.app_users),'[]'));
END $$;
REVOKE ALL ON FUNCTION app.report_access(text,jsonb),app.report_academic_rows(date,uuid),app.reports_read(text,jsonb) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
GRANT EXECUTE ON FUNCTION app.report_access(text,jsonb),app.reports_read(text,jsonb) TO sim_guru_business;
RESET ROLE;
