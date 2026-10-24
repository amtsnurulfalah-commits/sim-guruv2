-- Professional stage 3: one finance engine; reviewed corrections never edit final slips.
SET LOCAL ROLE sim_guru_owner;
DO $precondition$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='app.finance_read(text,jsonb)'::regprocedure) IS DISTINCT FROM 'fae08eb8f0b11deb5065054d47b9f6cb'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='app.finance_command(text,text,jsonb)'::regprocedure) IS DISTINCT FROM 'db630139ac4d988eaf0095a4105a30d8' THEN
 RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
 END IF;
END $precondition$;
ALTER TABLE finance.correction_requests
 ADD COLUMN evidence text NOT NULL DEFAULT '',
 ADD COLUMN request_key uuid,
 ADD COLUMN status text NOT NULL DEFAULT 'submitted' CHECK(status IN('submitted','reviewing','approved','rejected')),
 ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 ADD COLUMN reviewer_id uuid REFERENCES app.app_users(id),
 ADD COLUMN decision_reason text,
 ADD COLUMN decided_at timestamptz,
 ADD COLUMN correction_id uuid UNIQUE REFERENCES finance.corrections(id);
CREATE UNIQUE INDEX correction_request_retry ON finance.correction_requests(requested_by,request_key) WHERE request_key IS NOT NULL;
CREATE INDEX correction_request_period ON finance.correction_requests(statement_id,created_at DESC,id);
-- Existing requests retain identity/reason. Empty legacy evidence is visible and must be supplemented in approval preview.
CREATE TABLE finance.correction_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES finance.correction_requests(id),
 actor_id uuid NOT NULL REFERENCES app.app_users(id),
 action text NOT NULL CHECK(action IN('submitted','claim','approved','rejected')),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX correction_review_history ON finance.correction_reviews(request_id,created_at,id);
ALTER TABLE finance.correction_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance.correction_reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON finance.correction_reviews TO sim_guru_owner USING(true) WITH CHECK(true);
REVOKE ALL ON finance.correction_reviews FROM PUBLIC,sim_guru_auth,sim_guru_business,sim_guru_worker;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON finance.correction_reviews FOR EACH ROW EXECUTE FUNCTION finance.immutable_final();

ALTER FUNCTION app.finance_read(text,jsonb) RENAME TO finance_read_stage2;
REVOKE ALL ON FUNCTION app.finance_read_stage2(text,jsonb) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
ALTER FUNCTION app.finance_command(text,text,jsonb) RENAME TO finance_command_stage2;
REVOKE ALL ON FUNCTION app.finance_command_stage2(text,text,jsonb) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;

-- Administrative completeness uses materialized source records. It never creates JTM or blocks finalization.
CREATE FUNCTION finance.readiness_items(p_month date)
RETURNS TABLE(user_id uuid,kind text,date date,source_id uuid,title text,href text)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT a.effective_user_id,
 CASE WHEN NOT EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL) THEN 'confirmation' WHEN o.kind='KBM' THEN 'journal' ELSE 'bap' END,
 o.date,o.id,concat_ws(' · ',o.kind,o.snapshot->>'className',o.snapshot->>'subjectName',to_char(o.time_start,'HH24:MI')),
 CASE WHEN NOT EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL) THEN CASE WHEN o.kind='KBM' THEN '/kegiatan?date=' WHEN o.kind IN('PIKET','UPACARA') THEN '/piket?date=' ELSE '/ujian?date=' END WHEN o.kind='EXAM_SUPERVISOR' THEN '/ujian/bap?date=' ELSE '/jurnal?date=' END||o.date
 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id
 WHERE o.date>=p_month AND o.date<(p_month+interval '1 month')::date AND o.date<=finance.today()
 AND o.removed_at IS NULL AND o.kind IN('KBM','PIKET','UPACARA','EXAM_SUPERVISOR','EXAM_COMMITTEE')
 AND CASE WHEN o.kind IN('KBM','PIKET','UPACARA') THEN coalesce((app.day_context_internal(o.date)->>'kbmEnabled')::boolean,false) ELSE coalesce((app.day_context_internal(o.date)->>'examEnabled')::boolean,false) END
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=p_month AND g.finalized_at IS NOT NULL)
 AND (NOT EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL) OR (o.kind='KBM' AND NOT EXISTS(SELECT 1 FROM app.teaching_journals j WHERE j.occurrence_id=o.id AND j.deleted_at IS NULL))
 OR (o.kind='EXAM_SUPERVISOR' AND NOT EXISTS(SELECT 1 FROM app.exam_baps b WHERE b.occurrence_id=o.id AND b.state IN('active','locked'))))
 UNION ALL
 SELECT a.user_id,'event',a.date,a.id,'Jurnal acara · '||e.name,'/acara/jurnal?date='||a.date
 FROM app.event_attendance a JOIN app.event_definitions e ON e.id=a.event_id
 WHERE a.date>=p_month AND a.date<(p_month+interval '1 month')::date AND a.date<=finance.today()
 AND a.cancelled_at IS NULL AND e.active AND NOT EXISTS(SELECT 1 FROM app.event_journals j WHERE j.attendance_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=p_month AND g.finalized_at IS NOT NULL)
 UNION ALL
 SELECT a.user_id,'attendance',a.date,a.id,'Kehadiran belum memiliki waktu pulang','/kehadiran-saya?date='||a.date
 FROM app.daily_attendance a WHERE a.date>=p_month AND a.date<(p_month+interval '1 month')::date AND a.date<finance.today()
 AND a.actual_time_in IS NOT NULL AND a.actual_time_out IS NULL
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=p_month AND g.finalized_at IS NOT NULL)
$$;
CREATE FUNCTION app.finance_read(p_session text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; m date; bundle jsonb; recipients jsonb; result jsonb; sz int:=20; pg int; own boolean;
BEGIN
 actor:=app.activity_guard(p_session,false);own:=NOT app.actor_is_admin();
 IF p_data->>'kind'='readiness' THEN
 m:=finance.month_start(p_data->>'period');
 bundle:=app.finance_read_stage2(p_session,jsonb_build_object('kind',CASE WHEN own THEN 'estimate' ELSE 'recap' END,'period',p_data->>'period','mode','realized'));
 WITH administrative AS MATERIALIZED (SELECT * FROM finance.readiness_items(m))
 SELECT coalesce(jsonb_agg(jsonb_build_object('userId',s->'recipient'->>'id','name',s->'recipient'->>'name','total',s->>'total',
 'issues',coalesce((SELECT jsonb_agg(DISTINCT i) FROM jsonb_array_elements_text(bundle->'issues') i WHERE
 i='NEGATIVE_PAYABLE:'||(s->'recipient'->>'id') OR (i='RATE_MISSING' AND coalesce((s->>'rateMissing')::boolean,false)) OR (i='HOLIDAY_PENDING' AND jsonb_array_length(s->'pendingHolidays')>0)),'[]'),
 'administrative',coalesce((SELECT jsonb_agg((to_jsonb(x)-'user_id')||jsonb_build_object('href',CASE WHEN NOT own AND x.kind='attendance' THEN '/admin/kehadiran-harian?date='||x.date ELSE x.href END) ORDER BY x.date,x.source_id) FROM administrative x WHERE x.user_id=(s->'recipient'->>'id')::uuid),'[]')) ORDER BY s->'recipient'->>'name',s->'recipient'->>'id'),'[]') INTO recipients FROM jsonb_array_elements(bundle->'statements') s;
 RETURN jsonb_build_object('period',p_data->>'period','mode',bundle->>'mode','issues',bundle->'issues','recipients',recipients,'scope',CASE WHEN own THEN 'own' ELSE 'period' END,
 'note','Kelengkapan hanya mencakup sumber kegiatan yang sudah terbentuk. Administrasi belum lengkap bukan otomatis blocker finalisasi; kesiapan global hanya dinilai admin.');
 ELSIF p_data->>'kind'='requests' THEN
 m:=finance.month_start(p_data->>'period');pg:=coalesce((p_data->>'page')::int,1);
 IF pg NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 WITH f AS(SELECT r.id,r.statement_id,s.trx_id,u.full_name recipient,r.requested_by,r.reason,r.evidence,r.status,r.version::text,r.reviewer_id,r.decision_reason,r.decided_at,r.correction_id,r.created_at,
 (NOT own AND actor<>r.requested_by AND actor<>s.user_id AND(r.reviewer_id IS NULL OR r.reviewer_id=actor) AND r.status IN('submitted','reviewing')) can_review,
 (SELECT full_name FROM app.app_users WHERE id=r.reviewer_id) reviewer,
 coalesce((SELECT jsonb_agg(jsonb_build_object('action',h.action,'reason',h.reason,'actor',(SELECT full_name FROM app.app_users WHERE id=h.actor_id),'at',h.created_at) ORDER BY h.created_at,h.id) FROM finance.correction_reviews h WHERE h.request_id=r.id),'[]') history
 FROM finance.correction_requests r JOIN finance.honor_statements s ON s.id=r.statement_id JOIN finance.honor_periods p ON p.id=s.period_id JOIN app.app_users u ON u.id=s.user_id
 WHERE p.period_start=m AND(NOT own OR s.user_id=actor) AND(p_data->>'statementId' IS NULL OR s.id=(p_data->>'statementId')::uuid)),paged AS(SELECT * FROM f ORDER BY created_at DESC,id LIMIT sz OFFSET(pg-1)*sz)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(paged) ORDER BY created_at DESC,id) FROM paged),'[]'),'total',(SELECT count(*) FROM f),'page',pg,'pageSize',sz) INTO result;
 RETURN result;
 END IF;
 RETURN app.finance_read_stage2(p_session,p_data);
END $$;

CREATE FUNCTION app.finance_command(p_session text,p_operation text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; req finance.correction_requests%ROWTYPE; slip finance.honor_statements%ROWTYPE; prev ops.finance_previews%ROWTYPE; rid uuid; res jsonb; d jsonb; action text; reason text:=btrim(p_data->>'reason'); evidence text:=btrim(p_data->>'evidence');
BEGIN
 actor:=app.activity_guard(p_session,true);
 IF p_operation='request' THEN
 SELECT * INTO slip FROM finance.honor_statements WHERE id=(p_data->>'statementId')::uuid AND(user_id=actor OR app.actor_is_admin());
 IF slip.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 IF coalesce(length(reason),0) NOT BETWEEN 5 AND 500 OR coalesce(length(evidence),0) NOT BETWEEN 5 AND 1000 OR p_data->>'requestKey' IS NULL THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO req FROM finance.correction_requests WHERE requested_by=actor AND request_key=(p_data->>'requestKey')::uuid;
 IF req.id IS NOT NULL THEN
 IF req.statement_id<>slip.id OR req.reason<>reason OR req.evidence<>evidence THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('id',req.id);
 END IF;
 IF EXISTS(SELECT 1 FROM finance.correction_requests WHERE statement_id=slip.id AND status IN('submitted','reviewing')) THEN RAISE EXCEPTION 'CORRECTION_PENDING' USING ERRCODE='40001';END IF;
 INSERT INTO finance.correction_requests(statement_id,requested_by,reason,evidence,request_key) VALUES(slip.id,actor,reason,evidence,(p_data->>'requestKey')::uuid) RETURNING id INTO rid;
 INSERT INTO finance.correction_reviews(request_id,actor_id,action,reason) VALUES(rid,actor,'submitted',reason);
 PERFORM app.activity_audit('correction-request',rid,reason,null,jsonb_build_object('statementId',slip.id));RETURN jsonb_build_object('id',rid);
 END IF;
 IF p_operation='review' OR(p_operation='preview' AND p_data->>'operation'='correction') OR p_operation='commit' THEN
 PERFORM auth_private.require_admin();d:=p_data;
 IF p_operation='commit' THEN
 SELECT * INTO prev FROM ops.finance_previews WHERE id=(p_data->>'previewId')::uuid FOR UPDATE;
 IF prev.id IS NULL OR prev.actor_id<>actor THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;
 IF prev.consumed_at IS NOT NULL THEN RETURN prev.result;END IF;
 d:=prev.request;
 END IF;
 IF p_operation='review' OR d->>'operation'='correction' THEN
 SELECT * INTO req FROM finance.correction_requests WHERE id=(d->>'requestId')::uuid FOR UPDATE;
 IF req.id IS NULL THEN RAISE EXCEPTION 'CORRECTION_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO slip FROM finance.honor_statements WHERE id=req.statement_id;
 IF actor=req.requested_by OR actor=slip.user_id THEN RAISE EXCEPTION 'SELF_OPERATION_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF req.version::text IS DISTINCT FROM (CASE WHEN p_operation='review' THEN d->>'version' ELSE d->>'requestVersion' END) THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 IF p_operation='review' THEN
 action:=d->>'decision';
 IF coalesce(length(reason),0) NOT BETWEEN 5 AND 500 OR action NOT IN('claim','reject') THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 IF action='claim' THEN
 IF req.status<>'submitted' OR req.reviewer_id IS NOT NULL THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 UPDATE finance.correction_requests SET status='reviewing',reviewer_id=actor,version=version+1 WHERE id=req.id;
 ELSE
 IF req.status<>'reviewing' OR req.reviewer_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'CORRECTION_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 UPDATE finance.correction_requests SET status='rejected',decision_reason=btrim(p_data->>'reason'),decided_at=clock_timestamp(),version=version+1 WHERE id=req.id;
 END IF;
 INSERT INTO finance.correction_reviews(request_id,actor_id,action,reason) VALUES(req.id,actor,CASE WHEN action='reject' THEN 'rejected' ELSE action END,reason);
 PERFORM app.activity_audit('correction-'||action,req.id,reason,null,null);RETURN jsonb_build_object('id',req.id);
 END IF;
 IF req.status<>'reviewing' OR req.reviewer_id IS DISTINCT FROM actor OR req.statement_id IS DISTINCT FROM (d->>'statementId')::uuid THEN RAISE EXCEPTION 'CORRECTION_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;
 IF p_operation='commit' THEN
 res:=app.finance_command_stage2(p_session,p_operation,p_data);
 UPDATE finance.correction_requests SET status='approved',decision_reason=d->>'reason',decided_at=clock_timestamp(),correction_id=(res->>'id')::uuid,version=version+1 WHERE id=req.id;
 INSERT INTO finance.correction_reviews(request_id,actor_id,action,reason) VALUES(req.id,actor,'approved',d->>'reason');
 PERFORM app.activity_audit('correction-approved',req.id,d->>'reason',null,jsonb_build_object('correctionId',res->>'id','targetPeriod',d->>'targetPeriod'));
 RETURN res;
 END IF;
 END IF;
 END IF;
 RETURN app.finance_command_stage2(p_session,p_operation,p_data);
END $$;
REVOKE ALL ON FUNCTION finance.readiness_items(date) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
REVOKE ALL ON FUNCTION app.finance_read(text,jsonb),app.finance_command(text,text,jsonb) FROM PUBLIC,sim_guru_auth,sim_guru_worker;
GRANT EXECUTE ON FUNCTION app.finance_read(text,jsonb),app.finance_command(text,text,jsonb) TO sim_guru_business;
RESET ROLE;
