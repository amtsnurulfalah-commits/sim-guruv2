SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_catalog.pg_advisory_xact_lock(734190,0);
SELECT pg_catalog.pg_advisory_xact_lock(734190,1);
DO $release$ BEGIN
 IF (SELECT count(*) FROM sim_guru_migration.schema_migrations)<>30 OR EXISTS(
 SELECT 1 FROM (VALUES ('202610190001_roles_and_schemas.sql','5a02689b6c7ba930cb9bb9dd6589e662a4475968dbe0885c6812db9961485351'),('202610190002_identity_tables.sql','2285393b5bedbf355acd5120c61e2e53f856d0e9e307887b6aaf345edea28739'),('202610190003_auth_routines_and_policies.sql','513de24ee5b78f7f87fbcee7517321aa9bcd2ee39c1621794953250cc3178ca0'),('202610190004_account_activation.sql','45ea676a9417289fc89a2381b778ee26eb2c1dbdc0a0ae242ee61b56c6a32d70'),('202610190005_auth_http.sql','8322174234adf449b623cd0efd83dcaf8d3efafa1a53327b34c309b96f4d84b2'),('20261019055727_account_lifecycle.sql','7f8a8147db173ec6111c0c0daf0bec3a43b272451d74fc18dd681d05dfa5f4eb'),('20261019102819_user_management.sql','70fb7ff6d46d2d757fc8b2d12f283c7d8ced08bbd28d7e26d4f3b8730bf014c9'),('20261019111051_academic_masters.sql','03d2a4ee505d4a8f5cb2e34f68f9b55718bdc9274e37919dd65893c47c8be45f'),('20261019113611_calendar_day_context.sql','0aca461ee9fb1ddca1a2e303417a2f6501b4c840a37ed421b6c047dc747c9e6f'),('20261019115903_teaching_schedules.sql','5d723716ecd404b3bef48c04533e6106c9fbc0289a98649225b5a1b272cc993a'),('20261019160412_security_otp_dispatch.sql','d2fe41ec2a79f68d82d9d6c074506a874c37e2ec9c17d52d5270c0168d2e5c9f'),('20261019170744_attendance_journals_stage3.sql','0cbb0d170e69cf58b8e7da26690e2ec04c7d4c935a2c7486ac8439433f034f80'),('20261019174518_duties_substitution_jtm.sql','fa072cf82e68b1ff3b520b0babd386589f0baeef8245e5040ca07718c3478dda'),('20261020014753_exams_bap_stage5.sql','3cbea9d2e6cfd20ecb84a66ce45894de303022fc3237bdbd83127bfccc38481c'),('20261020015111_events_journals_stage5.sql','76e7fb6f741d861a6bb114157be65864b6010f607b9033c586463c20f6c1cbc3'),('20261020022247_exam_api_attendance_stage5.sql','bdfd4d3cdd4145e675c0eaf1bac6809b5c8ad9e3a658957c2f3620f7af7eb538'),('20261020045419_exam_attendance_guards_stage5.sql','8f52e9ae8b9b2e8e1d8ce290262f3d3fc7d8ddfb829dfbffc88aaf59c3290dd9'),('20261020055614_finance_holiday_transport_stage6.sql','aea2d5528c77d9feaf732cfb0b8baa5b7070d223c8c5ec8e4368c1db8d60e4cb'),('20261020063050_exact_transport_settlement_stage6.sql','abedbd9149fbfe00e1bc0e33d6e1323da247597d4907b4822b9eee665b7942c8'),('20261020065725_operations_stage7.sql','ba07522f2a54bd36100f0e744307d26566ed8e9f04e1d5e3c1d985b43f0881e7'),('20261020092915_operations_finance_workers_stage7.sql','699325a268988064ad1cf3f1ddd10b4d69c1d25a8b524c127e9bd8b18443dc7e'),('20261020100138_reminder_context_stage7.sql','5f9ba4a2f925181a2d77cea042e78b3ff922e9f7c4a3642c839fbf1279590696'),('20261020103452_migration_readiness_stage8.sql','72641265ad4916245085c0744f5087f7a6ca92e524d8add1698212cb627d82c6'),('20261020182241_pg_net_private_registration.sql','cddbbf85b5c798c5ab421757be3a79463a6e78c97b069cf6f1930ce43786c1df'),('20261021135112_support_reports.sql','4309bc2b6a4cf740a7cbd3ba42c7114c04d790a2b4840dabe8a382c957587530'),('20261021161000_duty_final_guard_record_shape.sql','277ffde113bbe668df562bc5cdc7bdb50bec8d48dbff14d7aad217b0d1fb24db'),('20261023094531_kbm_confirmation_operator_guard.sql','1bef1ac096c78e373caa4d4435c220fabed099f18aa3c456521e8a03a4d1caaa'),('20261024000945_task_center_and_notification_preferences.sql','67538e3fadd12d81620ce59e8ed853f7d19b4926bd23fb6713e8b049cd864608'),('20261024054743_honor_readiness_and_correction_review.sql','56ca7c9fe9e4ebd7e5afd134bbd90ceb1e1c8c314fecca280d1201ba1545f51a'),('20261024062231_support_case_lifecycle_and_monitoring.sql','e139ca081aa4a81b9a6e1dfa573402a9e7fed6c3281af13f96dc6088ec1eaadd')) v(name,checksum) FULL JOIN sim_guru_migration.schema_migrations m USING(name) WHERE v.checksum IS DISTINCT FROM m.checksum) THEN RAISE EXCEPTION 'MIGRATION_LEDGER_MISMATCH';END IF;
END $release$;
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

RESET ROLE;
INSERT INTO sim_guru_migration.schema_migrations(name,checksum)VALUES('20261024104102_leadership_reports.sql','e5386a3082dfb3281d9449fc44e5954e12494b7d7844b833d8274258e884a6ef');
