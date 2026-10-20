SET LOCAL ROLE sim_guru_owner;
CREATE FUNCTION finance.finalize_core(m date,actor uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE res jsonb;pid uuid;sid uuid;s jsonb;l jsonb;checksum text;BEGIN
 PERFORM finance.guard_open(m);res:=finance.bundle(m,'realized');IF jsonb_array_length(res->'issues')>0 THEN RAISE EXCEPTION 'FINANCE_BLOCKED' USING ERRCODE='42501';END IF;
 INSERT INTO finance.honor_periods(period_start) VALUES(m) ON CONFLICT DO NOTHING;SELECT id INTO pid FROM finance.honor_periods WHERE period_start=m FOR UPDATE;
 FOR s IN SELECT value FROM jsonb_array_elements(res->'statements') LOOP
 sid:=gen_random_uuid();s:=s||jsonb_build_object('statementId',sid,'trxId','SG-'||to_char(m,'YYYYMM')||'-'||replace(sid::text,'-',''),'finalizedAt',transaction_timestamp(),'mode','final');checksum:=finance.digest(s::text);
 INSERT INTO finance.honor_statements(id,period_id,user_id,trx_id,snapshot,total_jtm,total_honor,checksum) VALUES(sid,pid,(s->'recipient'->>'id')::uuid,s->>'trxId',s,(s->>'totalJtm')::numeric,(s->>'total')::numeric,checksum);
 FOR l IN SELECT value FROM jsonb_array_elements(s->'lines') LOOP INSERT INTO finance.honor_statement_lines(statement_id,component,source_ref,ledger_id,snapshot) VALUES(sid,l->>'component',(l->>'sourceRef')::uuid,(l->>'ledgerId')::uuid,l);END LOOP;
 INSERT INTO finance.notification_outbox(dedupe_key,recipient_id,statement_id,kind) VALUES('honor-final:'||sid,(s->'recipient'->>'id')::uuid,sid,'honor_final');END LOOP;
 UPDATE finance.period_guards SET finalized_at=transaction_timestamp() WHERE period_start=m;UPDATE finance.honor_periods SET state='final',finalized_at=transaction_timestamp(),finalized_by=actor WHERE id=pid;res:=jsonb_build_object('period',to_char(m,'YYYY-MM'),'state','final','beneficiaries',res->'beneficiaries');RETURN res;END $$;
CREATE OR REPLACE FUNCTION app.finance_command(p_session text,p_operation text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;v ops.finance_previews%ROWTYPE;res jsonb;m date;sid uuid;s jsonb;l jsonb;pid uuid;checksum text;tok text;d jsonb;rid uuid;reason text;BEGIN
 actor:=app.activity_guard(p_session,true);reason:=p_data->>'reason';
 IF p_operation='request' THEN SELECT id INTO sid FROM finance.honor_statements WHERE id=(p_data->>'statementId')::uuid AND(user_id=actor OR app.actor_is_admin());IF sid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;IF length(btrim(coalesce(reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;INSERT INTO finance.correction_requests(statement_id,requested_by,reason) VALUES(sid,actor,reason) RETURNING id INTO rid;PERFORM app.activity_audit('correction-request',rid,reason,null,null);RETURN jsonb_build_object('id',rid);
 ELSIF p_operation='token' THEN SELECT id INTO sid FROM finance.honor_statements WHERE id=(p_data->>'statementId')::uuid AND(user_id=actor OR app.actor_is_admin());IF sid IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;tok:=replace(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'-','');INSERT INTO finance.document_tokens(token_hash,statement_id) VALUES(finance.digest(tok),sid);RETURN jsonb_build_object('token',tok);
 END IF;
 PERFORM auth_private.require_admin();
 IF p_operation='holiday' THEN IF p_data->>'operation' IS DISTINCT FROM 'generate' THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;RETURN finance.holiday_command(actor,p_data);
 ELSIF p_operation='block' THEN IF length(btrim(coalesce(reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 IF p_data->>'id' IS NULL THEN INSERT INTO finance.transport_blocks(user_id,date_start,date_end,reason) VALUES((p_data->>'userId')::uuid,(p_data->>'from')::date,(p_data->>'to')::date,reason) RETURNING id INTO rid;
 ELSE UPDATE finance.transport_blocks SET active=false,version=version+1 WHERE id=(p_data->>'id')::uuid AND version=(p_data->>'version')::bigint AND active RETURNING id INTO rid;IF rid IS NULL THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;END IF;PERFORM app.activity_audit('transport-block',rid,reason,null,p_data);RETURN jsonb_build_object('id',rid);
 ELSIF p_operation='preview' THEN IF p_data->>'operation'='finalize' THEN m:=finance.month_start(p_data->>'period');PERFORM finance.guard_open(m);res:=finance.bundle(m,'realized');ELSIF p_data->>'operation'='holiday-waive' THEN m:=date_trunc('month',(p_data->>'date')::date)::date;PERFORM finance.guard_open(m);res:=finance.waive_impact(p_data);ELSIF p_data->>'operation'='holiday-cancel' THEN m:=date_trunc('month',(p_data->>'date')::date)::date;PERFORM finance.guard_open(m);SELECT jsonb_build_object('runId',r.id,'state',r.state,'count',(SELECT count(*) FROM finance.holiday_effects WHERE run_id=r.id),'jtm',(SELECT coalesce(sum(l.jtm),0)::text FROM finance.holiday_effects e JOIN finance.jtm_ledger l ON l.id=e.ledger_id WHERE e.run_id=r.id)) INTO res FROM finance.holiday_runs r WHERE r.id=(p_data->>'runId')::uuid AND r.date=(p_data->>'date')::date;IF res IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF; ELSIF p_data->>'operation'='correction' THEN m:=finance.month_start(p_data->>'targetPeriod');PERFORM finance.guard_open(m);res:=finance.correction_basis(p_data);ELSE RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 IF length(btrim(coalesce(reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.finance_previews(actor_id,request,fingerprint,result) VALUES(actor,p_data,finance.digest(res::text),res) RETURNING * INTO v;RETURN jsonb_build_object('previewId',v.id,'result',res,'expiresAt',v.expires_at);
 ELSIF p_operation='commit' THEN
 SELECT * INTO v FROM ops.finance_previews WHERE id=(p_data->>'previewId')::uuid FOR UPDATE;IF v.id IS NULL OR v.actor_id<>actor OR v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;IF v.consumed_at IS NOT NULL THEN RETURN v.result;END IF;d:=v.request;reason:=d->>'reason';
 IF d->>'operation'='finalize' THEN m:=finance.month_start(d->>'period');PERFORM finance.guard_open(m);res:=finance.bundle(m,'realized');IF finance.digest(res::text)<>v.fingerprint THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;IF jsonb_array_length(res->'issues')>0 THEN RAISE EXCEPTION 'FINANCE_BLOCKED' USING ERRCODE='42501';END IF;
 res:=finance.finalize_core(m,actor);SELECT id INTO rid FROM finance.honor_periods WHERE period_start=m;
 ELSIF d->>'operation'='holiday-waive' THEN res:=finance.waive_impact(d);IF finance.digest(res::text) IS DISTINCT FROM v.fingerprint THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;res:=finance.holiday_command(actor,(d-'operation')||jsonb_build_object('operation','waive'));rid:=actor; ELSIF d->>'operation'='holiday-cancel' THEN SELECT jsonb_build_object('runId',r.id,'state',r.state,'count',(SELECT count(*) FROM finance.holiday_effects WHERE run_id=r.id),'jtm',(SELECT coalesce(sum(l.jtm),0)::text FROM finance.holiday_effects e JOIN finance.jtm_ledger l ON l.id=e.ledger_id WHERE e.run_id=r.id)) INTO res FROM finance.holiday_runs r WHERE r.id=(d->>'runId')::uuid AND r.date=(d->>'date')::date;IF finance.digest(res::text) IS DISTINCT FROM v.fingerprint THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;res:=finance.holiday_command(actor,(d-'operation')||jsonb_build_object('operation','cancel'));rid:=(d->>'runId')::uuid; ELSE m:=finance.month_start(d->>'targetPeriod');PERFORM finance.guard_open(m);res:=finance.correction_basis(d);IF finance.digest(res::text)<>v.fingerprint THEN RAISE EXCEPTION 'PREVIEW_STALE' USING ERRCODE='40001';END IF;
 INSERT INTO finance.corrections(statement_id,target_period,sequence,baseline_total,corrected_total,delta,reason,evidence,revision,approved_by) VALUES((res->>'sourceStatementId')::uuid,m,(res->>'sequence')::int,(res->>'baseline')::numeric,(res->>'correctedTotal')::numeric,(res->>'delta')::numeric,reason,d->>'evidence',res->'revision',actor) RETURNING id INTO rid;
 INSERT INTO finance.notification_outbox(dedupe_key,recipient_id,statement_id,kind) VALUES('honor-correction:'||rid,(res->>'recipientId')::uuid,(res->>'sourceStatementId')::uuid,'honor_correction');res:=res||jsonb_build_object('id',rid);END IF;
 UPDATE ops.finance_previews SET consumed_at=clock_timestamp(),result=res WHERE id=v.id;PERFORM app.activity_audit('honor-'||(d->>'operation'),rid,reason,null,res);RETURN res;
 ELSE RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;END $$;
ALTER TABLE finance.holiday_runs ALTER COLUMN actor_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION finance.holiday_command(p_actor uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE d date:=(p_data->>'date')::date;op text:=p_data->>'operation';c record;h finance.holiday_entitlements%ROWTYPE;r finance.holiday_runs%ROWTYPE;occ uuid;entry uuid;n int:=0;g int;v_reason text:=p_data->>'reason';BEGIN
 IF op NOT IN('generate','cancel','waive') OR d IS NULL OR d>finance.today() OR length(btrim(coalesce(v_reason,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;PERFORM finance.guard_open(d);
 IF op='generate' AND d=finance.today() AND(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time<time '16:00' THEN RAISE EXCEPTION 'HOLIDAY_NOT_DUE' USING ERRCODE='42501';END IF;
 IF op='cancel' THEN SELECT * INTO r FROM finance.holiday_runs WHERE id=(p_data->>'runId')::uuid AND date=d FOR UPDATE;IF r.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;IF r.state='cancelled' THEN RETURN jsonb_build_object('count',0,'runId',r.id,'state','cancelled');END IF;
 INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,reverses_id,holiday_entitlement_id) SELECT 'REVERSAL',l.occurrence_id,l.user_id,l.date,-l.jtm,l.revision,l.id,l.holiday_entitlement_id FROM finance.holiday_effects e JOIN finance.jtm_ledger l ON l.id=e.ledger_id WHERE e.run_id=r.id AND NOT EXISTS(SELECT 1 FROM finance.jtm_ledger q WHERE q.reverses_id=l.id);GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE finance.holiday_entitlements SET state='pending',version=version+1,reason=v_reason WHERE id IN(SELECT entitlement_id FROM finance.holiday_effects WHERE run_id=r.id);UPDATE finance.holiday_runs SET state='cancelled' WHERE id=r.id;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM app.academic_calendar WHERE date=d AND is_holiday AND deleted_at IS NULL) THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 SELECT coalesce(max(generation),0)+1 INTO g FROM finance.holiday_runs WHERE date=d;
 IF op='generate' AND NOT EXISTS(SELECT 1 FROM finance.holiday_candidates(date_trunc('month',d)::date) cand LEFT JOIN finance.holiday_entitlements ent ON ent.source_key=cand.source_key WHERE cand.date=d AND coalesce(ent.state,'pending') NOT IN('posted','waived')) THEN RETURN jsonb_build_object('count',0,'runId',(SELECT id FROM finance.holiday_runs WHERE date=d ORDER BY generation DESC LIMIT 1),'operation',op);END IF; IF op='generate' THEN INSERT INTO finance.holiday_runs(date,generation,state,actor_id,reason) VALUES(d,g,'completed',p_actor,v_reason) RETURNING * INTO r;END IF;
 FOR c IN SELECT * FROM finance.holiday_candidates(date_trunc('month',d)::date) WHERE date=d ORDER BY source_key LOOP
 SELECT * INTO h FROM finance.holiday_entitlements WHERE source_key=c.source_key;
 IF h.state IN('posted','waived') THEN CONTINUE;END IF;
 IF h.id IS NULL THEN
 INSERT INTO app.activity_occurrences(kind,schedule_id,duty_schedule_id,date,academic_period_id,class_id,subject_id,time_start,time_end,scheduled_jtm,expected_students,snapshot) VALUES(c.kind,c.schedule_id,c.duty_id,c.date,c.academic_period_id,c.class_id,c.subject_id,c.time_start,c.time_end,c.jtm,coalesce((SELECT expected_students FROM app.classes WHERE id=c.class_id),0),c.snapshot||jsonb_build_object('holiday',true,'material','Auto-generated: Libur Bonus')) ON CONFLICT DO NOTHING;
 SELECT id INTO occ FROM app.activity_occurrences WHERE date=d AND(schedule_id=c.schedule_id OR duty_schedule_id=c.duty_id);
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id,effective_name) SELECT occ,c.user_id,c.user_id,full_name FROM app.app_users WHERE id=c.user_id ON CONFLICT DO NOTHING;
 INSERT INTO finance.holiday_entitlements(source_key,occurrence_id,user_id,date,jtm,state,reason) VALUES(c.source_key,occ,c.user_id,d,c.jtm,'pending',v_reason) RETURNING * INTO h;
 END IF;
 IF op='waive' THEN UPDATE finance.holiday_entitlements SET state='waived',reason=v_reason,version=version+1 WHERE id=h.id;
 ELSE UPDATE finance.holiday_entitlements SET state='posted',generation=generation+1,version=version+1,reason=v_reason WHERE id=h.id RETURNING * INTO h;
 INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,holiday_entitlement_id) VALUES('HOLIDAY_BONUS',h.occurrence_id,h.user_id,h.date,h.jtm,h.generation,h.id) RETURNING id INTO entry;INSERT INTO finance.holiday_effects(run_id,entitlement_id,ledger_id) VALUES(r.id,h.id,entry);END IF;n:=n+1;END LOOP;
 END IF;IF p_actor IS NULL THEN INSERT INTO ops.audit_logs(action,entity_id,reason,redacted_changes) VALUES('job.holiday',r.id,v_reason,jsonb_build_object('count',n));ELSE PERFORM app.activity_audit('holiday',coalesce(r.id,p_actor),v_reason,null,jsonb_build_object('operation',op,'count',n));END IF;RETURN jsonb_build_object('count',n,'runId',r.id,'operation',op);END $$;

CREATE FUNCTION ops.activity_notification() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE u uuid;k text;v text; a uuid;BEGIN
 IF TG_TABLE_NAME='activity_assignments' THEN
  a:=NEW.id;u:=NEW.effective_user_id;k:='Penugasan kegiatan';v:=NEW.version::text;
  IF TG_OP='UPDATE' AND OLD.effective_user_id=NEW.effective_user_id THEN RETURN NEW;END IF;
  IF TG_OP='UPDATE' THEN INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,subject,body) VALUES('assignment-cancel:'||NEW.id||':'||v,OLD.effective_user_id,'Perubahan penugasan','Penugasan Anda telah dialihkan. Periksa rincian pada SIM GURU.') ON CONFLICT DO NOTHING;END IF;
 ELSIF TG_TABLE_NAME='activity_confirmations' THEN
  a:=NEW.assignment_id;SELECT effective_user_id INTO u FROM app.activity_assignments WHERE id=NEW.assignment_id;k:=CASE WHEN NEW.revoked_at IS NULL THEN 'Konfirmasi kegiatan' ELSE 'Pencabutan konfirmasi kegiatan' END;v:=CASE WHEN NEW.revoked_at IS NULL THEN 'confirm' ELSE 'revoke' END;
 ELSIF TG_TABLE_NAME IN('exam_supervisor_assignments','exam_committee_assignments') THEN u:=NEW.user_id;k:='Penugasan ujian';v:=NEW.version::text;
 ELSIF TG_TABLE_NAME='event_attendance' THEN u:=NEW.user_id;k:='Kehadiran acara';v:=NEW.version::text;
 ELSIF TG_TABLE_NAME='holiday_entitlements' THEN u:=NEW.user_id;k:='Bonus hari libur';v:=NEW.version::text;IF NEW.state<>'posted' THEN RETURN NEW;END IF;
 ELSE RETURN NEW;END IF;
 IF u IS NOT NULL THEN INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,assignment_id,subject,body) VALUES(TG_TABLE_NAME||':'||NEW.id||':'||v,u,a,k,k||' telah diperbarui. Buka SIM GURU untuk rincian dan status terbaru.') ON CONFLICT DO NOTHING;END IF;RETURN NEW;END $$;
CREATE TRIGGER domain_assignment AFTER INSERT OR UPDATE ON app.activity_assignments FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE TRIGGER domain_confirmation AFTER INSERT OR UPDATE OF revoked_at ON app.activity_confirmations FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE TRIGGER domain_exam_supervisor AFTER INSERT OR UPDATE ON app.exam_supervisor_assignments FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE TRIGGER domain_exam_committee AFTER INSERT OR UPDATE ON app.exam_committee_assignments FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE TRIGGER domain_event AFTER INSERT OR UPDATE ON app.event_attendance FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE TRIGGER domain_holiday AFTER UPDATE ON finance.holiday_entitlements FOR EACH ROW EXECUTE FUNCTION ops.activity_notification();
CREATE FUNCTION ops.reminders() RETURNS int LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE n int;BEGIN
 INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,subject,body)
 SELECT 'journal:'||a.id||':'||app.activity_today(),a.effective_user_id,'Jurnal belum lengkap','Periksa jurnal pembelajaran atau BAP kegiatan Anda pada SIM GURU.' FROM app.activity_assignments a JOIN app.activity_occurrences o ON o.id=a.occurrence_id WHERE o.date=app.activity_today() AND (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')>=o.date+o.time_end+interval '5 minutes' AND EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL) AND ((o.kind='KBM' AND NOT EXISTS(SELECT 1 FROM app.teaching_journals j WHERE j.occurrence_id=o.id AND j.deleted_at IS NULL)) OR (o.kind='EXAM_SUPERVISOR' AND NOT EXISTS(SELECT 1 FROM app.exam_baps b WHERE b.occurrence_id=o.id AND b.state='active'))) ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,subject,body)
 SELECT 'confirmation-reminder:'||o.id||':'||receiver.effective_user_id||':'||app.activity_today(),receiver.effective_user_id,'Konfirmasi kegiatan belum lengkap','Periksa kegiatan mengajar atau pengawas yang belum terkonfirmasi pada SIM GURU.' FROM app.activity_occurrences o JOIN app.activity_assignments target ON target.occurrence_id=o.id JOIN app.activity_occurrences duty ON duty.date=o.date AND ((o.kind='KBM' AND duty.kind='PIKET') OR (o.kind='EXAM_SUPERVISOR' AND duty.kind='EXAM_COMMITTEE')) JOIN app.activity_assignments receiver ON receiver.occurrence_id=duty.id WHERE o.date=app.activity_today() AND target.effective_user_id<>receiver.effective_user_id AND (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time>=o.time_end AND NOT EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=target.id AND c.revoked_at IS NULL) ON CONFLICT(dedupe_key) DO NOTHING;
 INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,subject,body) SELECT 'event-journal:'||a.id||':'||app.activity_today(),a.user_id,'Jurnal acara belum lengkap','Kehadiran acara Anda tercatat. Lengkapi jurnal acara pada SIM GURU.' FROM app.event_attendance a JOIN app.event_definitions e ON e.id=a.event_id WHERE a.date=app.activity_today() AND a.cancelled_at IS NULL AND (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time>=e.time_end AND NOT EXISTS(SELECT 1 FROM app.event_journals j WHERE j.attendance_id=a.id AND j.cancelled_at IS NULL) ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN n;END $$;
CREATE FUNCTION ops.cleanup() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE n int;BEGIN
 IF (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time NOT BETWEEN '03:00'::time AND '03:59:59'::time THEN RETURN '{}'::jsonb;END IF;
 DELETE FROM auth_private.app_sessions WHERE id IN(SELECT id FROM auth_private.app_sessions WHERE expires_at<clock_timestamp()-interval '7 days' LIMIT 500);
 -- Only encrypted expired secrets are removed; audit and immutable finance are retained.
 DELETE FROM auth_private.outbox_secrets WHERE outbox_id IN(SELECT outbox_id FROM auth_private.outbox_secrets WHERE expires_at<clock_timestamp() LIMIT 500);GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('expiredSecretsRemoved',n);END $$;
CREATE FUNCTION ops.scheduled_finance() RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE d date:=app.activity_today();m date;h record;k text;res jsonb;r jsonb:='[]'::jsonb;BEGIN
 IF true THEN
 FOR h IN SELECT c.date FROM app.academic_calendar c WHERE c.date BETWEEN d-31 AND d AND (c.date<d OR (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time>='16:00') AND c.is_holiday AND c.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',c.date)::date AND g.finalized_at IS NOT NULL) ORDER BY c.date LOOP
 k:='holiday:'||h.date;
 IF NOT EXISTS(SELECT 1 FROM ops.job_runs WHERE business_key=k AND (state='completed' OR attempts>=5 OR next_attempt_at>clock_timestamp())) THEN
 BEGIN
 res:=finance.holiday_command(null,jsonb_build_object('operation','generate','date',h.date,'reason','Pekerjaan bonus libur terjadwal'));
 INSERT INTO ops.job_runs(business_key,kind,state,attempts,result,completed_at) VALUES(k,'holiday','completed',1,res,clock_timestamp()) ON CONFLICT(business_key) DO UPDATE SET state='completed',attempts=ops.job_runs.attempts+1,result=excluded.result,completed_at=excluded.completed_at;
 EXCEPTION WHEN OTHERS THEN INSERT INTO ops.job_runs(business_key,kind,state,attempts,result) VALUES(k,'holiday','failed',1,jsonb_build_object('code',SQLSTATE)) ON CONFLICT(business_key) DO UPDATE SET state='failed',attempts=ops.job_runs.attempts+1,next_attempt_at=clock_timestamp()+interval '1 hour',result=excluded.result;END;
 END IF;END LOOP;END IF;
 IF (extract(day FROM d)>2 OR (extract(day FROM d)=2 AND (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time>='10:00')) THEN m:=(date_trunc('month',d)-interval '1 month')::date;k:='honor:'||m;
 IF NOT EXISTS(SELECT 1 FROM ops.job_runs WHERE business_key=k AND (state='completed' OR attempts>=5 OR next_attempt_at>clock_timestamp())) THEN BEGIN
 IF EXISTS(SELECT 1 FROM finance.honor_periods WHERE period_start=m AND state='final') THEN res:=jsonb_build_object('alreadyFinal',true);ELSE res:=finance.finalize_core(m,null);INSERT INTO ops.audit_logs(action,reason,redacted_changes) VALUES('job.honor','Finalisasi honorarium terjadwal',res);END IF;
 INSERT INTO ops.job_runs(business_key,kind,state,attempts,result,completed_at) VALUES(k,'honor','completed',1,res,clock_timestamp()) ON CONFLICT(business_key) DO UPDATE SET state='completed',attempts=ops.job_runs.attempts+1,result=excluded.result,completed_at=excluded.completed_at;
 EXCEPTION WHEN OTHERS THEN INSERT INTO ops.job_runs(business_key,kind,state,attempts,result) VALUES(k,'honor','failed',1,jsonb_build_object('code',SQLSTATE)) ON CONFLICT(business_key) DO UPDATE SET state='failed',attempts=ops.job_runs.attempts+1,next_attempt_at=clock_timestamp()+interval '1 hour',result=excluded.result;END;END IF;END IF;
 RETURN r;END $$;
CREATE FUNCTION app.dashboard_summary(p_session text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;d date:=app.activity_today();r jsonb;BEGIN
 actor:=app.activity_guard(p_session,false);
 SELECT jsonb_build_object('date',d,'tasks',coalesce(jsonb_agg(jsonb_build_object('id',o.id,'kind',o.kind,'start',o.time_start,'end',o.time_end,'confirmed',EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL),'journalComplete',CASE WHEN o.kind='KBM' THEN EXISTS(SELECT 1 FROM app.teaching_journals j WHERE j.occurrence_id=o.id AND j.deleted_at IS NULL) WHEN o.kind='EXAM_SUPERVISOR' THEN EXISTS(SELECT 1 FROM app.exam_baps b WHERE b.occurrence_id=o.id AND b.state='active') ELSE true END)),'[]'::jsonb)) INTO r FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id WHERE o.date=d AND a.effective_user_id=actor;
 RETURN r||jsonb_build_object('planned',(SELECT coalesce(jsonb_agg(x ORDER BY x.time_start,x.id),'[]'::jsonb) FROM(
 SELECT s.id,'KBM'::text kind,s.time_start,s.time_end FROM app.teaching_schedules s WHERE s.user_id=actor AND s.state<>'archived' AND d BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM d) AND s.academic_period_id=(app.day_context_internal(d)->>'academicPeriodId')::uuid AND coalesce((app.day_context_internal(d)->>'kbmEnabled')::boolean,false) AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.schedule_id=s.id AND o.date=d)
 UNION ALL SELECT s.id,s.kind,s.time_start,s.time_end FROM app.duty_schedules s WHERE s.user_id=actor AND s.active AND d BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM d) AND s.academic_period_id=(app.day_context_internal(d)->>'academicPeriodId')::uuid AND coalesce((app.day_context_internal(d)->>'kbmEnabled')::boolean,false) AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.duty_schedule_id=s.id AND o.date=d)
 UNION ALL SELECT a.id,'EXAM_SUPERVISOR',s.time_start,s.time_end FROM app.exam_supervisor_assignments a JOIN app.exam_rooms room ON room.id=a.exam_room_id JOIN app.exam_sessions s ON s.id=room.session_id JOIN app.exam_periods p ON p.id=s.period_id WHERE a.user_id=actor AND a.active AND room.active AND s.active AND s.date=d AND p.active AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.exam_supervisor_id=a.id AND o.date=d)
 UNION ALL SELECT a.id,'EXAM_COMMITTEE',coalesce(a.exclusive_time_start,'00:00'::time),coalesce(a.exclusive_time_end,'23:59'::time) FROM app.exam_committee_assignments a JOIN app.exam_periods p ON p.id=a.period_id WHERE a.user_id=actor AND a.active AND a.date=d AND p.active AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.exam_committee_id=a.id AND o.date=d)
 )x),'pendingEventJournals',(SELECT count(*) FROM app.event_attendance a WHERE a.user_id=actor AND a.date=d AND a.cancelled_at IS NULL AND NOT EXISTS(SELECT 1 FROM app.event_journals j WHERE j.attendance_id=a.id AND j.cancelled_at IS NULL)),'attendance',(SELECT app.attendance_dto(id) FROM app.daily_attendance WHERE user_id=actor AND date=d),'honor',finance.calculate(actor,date_trunc('month',d)::date,'realized'),'pendingHolidays',(SELECT count(*) FROM finance.holiday_candidates(date_trunc('month',d)::date) c LEFT JOIN finance.holiday_entitlements h ON h.source_key=c.source_key WHERE c.user_id=actor AND coalesce(h.state,'pending')='pending'),'admin',CASE WHEN app.actor_is_admin() THEN jsonb_build_object('activeUsers',(SELECT count(*) FROM app.app_users WHERE status='active'),'failedMessages',(SELECT count(*) FROM ops.domain_outbox WHERE state IN('failed','unknown')),'failedJobs',(SELECT count(*) FROM ops.job_runs WHERE state='failed')) ELSE null END);END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance,ops FROM PUBLIC;
REVOKE ALL ON FUNCTION app.dashboard_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.dashboard_summary(text) TO sim_guru_business;
GRANT EXECUTE ON FUNCTION ops.cleanup() TO sim_guru_worker;
RESET ROLE;

SET LOCAL ROLE sim_guru_owner;
CREATE TABLE ops.worker_tickets(token_hash text PRIMARY KEY,expires_at timestamptz NOT NULL,used_at timestamptz);
ALTER TABLE ops.worker_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.worker_tickets FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON ops.worker_tickets TO sim_guru_owner USING(true) WITH CHECK(true);
CREATE FUNCTION ops.issue_worker_ticket() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'-','');BEGIN
 DELETE FROM ops.worker_tickets WHERE expires_at<clock_timestamp();
 INSERT INTO ops.worker_tickets VALUES(finance.digest(token),clock_timestamp()+interval '90 seconds',null);RETURN token;END $$;
CREATE FUNCTION ops.consume_worker_ticket(token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE n int;BEGIN
 UPDATE ops.worker_tickets SET used_at=clock_timestamp() WHERE token_hash=finance.digest(token) AND expires_at>clock_timestamp() AND used_at IS NULL;GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;END $$;
REVOKE ALL ON FUNCTION ops.issue_worker_ticket(),ops.consume_worker_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.consume_worker_ticket(text) TO sim_guru_worker;
RESET ROLE;

-- Supabase-only scheduler provisioning; portable databases skip unsupported extensions.
DO $scheduler$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') AND EXISTS(SELECT 1 FROM pg_available_extensions WHERE name='pg_net') THEN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  GRANT USAGE ON SCHEMA net TO sim_guru_owner;
  GRANT EXECUTE ON FUNCTION net.http_get(text,jsonb,jsonb,integer) TO sim_guru_owner;
  EXECUTE $ddl$CREATE FUNCTION ops.scheduler_tick() RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $body$
   SELECT net.http_get(url:='https://sim-guruv2.vercel.app/api/internal/worker',headers:=jsonb_build_object('Authorization','Bearer '||ops.issue_worker_ticket()),timeout_milliseconds:=55000)
  $body$ $ddl$;
  ALTER FUNCTION ops.scheduler_tick() OWNER TO sim_guru_owner;
  REVOKE ALL ON FUNCTION ops.scheduler_tick() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION ops.scheduler_tick() TO postgres;
  -- Install inactive: release verification activates only after the worker is ready.
  PERFORM cron.schedule('sim-guru-worker','* * * * *','select ops.scheduler_tick()');
  PERFORM cron.alter_job(job_id:=(SELECT jobid FROM cron.job WHERE jobname='sim-guru-worker'),active:=false);
 END IF;
END $scheduler$;

SET LOCAL ROLE sim_guru_owner;
ALTER TABLE app.event_journal_blocks ADD COLUMN event_type text CHECK(event_type IN('rutin','insidental'));
CREATE OR REPLACE FUNCTION app.event_block_save(p_session text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;old app.event_journal_blocks%ROWTYPE;n app.event_journal_blocks%ROWTYPE;rid uuid:=coalesce((p_data->>'id')::uuid,gen_random_uuid());BEGIN actor:=app.activity_guard(p_session,true);PERFORM auth_private.require_admin();SELECT * INTO old FROM app.event_journal_blocks WHERE id=rid FOR UPDATE;IF coalesce(old.version,0) IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
INSERT INTO app.event_journal_blocks(id,event_id,event_type,date_start,date_end,message,active) VALUES(rid,(p_data->>'eventId')::uuid,p_data->>'eventType',(p_data->>'dateStart')::date,(p_data->>'dateEnd')::date,btrim(p_data->>'message'),(p_data->>'active')::boolean) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id,event_type=excluded.event_type,date_start=excluded.date_start,date_end=excluded.date_end,message=excluded.message,active=excluded.active,version=app.event_journal_blocks.version+1 RETURNING * INTO n;PERFORM app.activity_audit('event-block',rid,p_data->>'reason',to_jsonb(old),to_jsonb(n));RETURN to_jsonb(n)||jsonb_build_object('version',n.version::text);END $$;
CREATE OR REPLACE FUNCTION app.event_journal_save(p_session text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE actor uuid;a app.event_attendance%ROWTYPE;e app.event_definitions%ROWTYPE;o app.activity_occurrences%ROWTYPE;x app.activity_assignments%ROWTYPE;j app.event_journals%ROWTYPE;w numeric;credit numeric;BEGIN actor:=app.activity_guard(p_session,true);SELECT * INTO a FROM app.event_attendance WHERE id=(p_data->>'attendanceId')::uuid FOR UPDATE;
IF a.id IS NULL OR a.user_id<>actor OR a.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;IF a.date>app.activity_today() THEN RAISE EXCEPTION 'FUTURE_DATE' USING ERRCODE='42501';END IF;IF a.date<app.activity_today()-1 THEN RAISE EXCEPTION 'DATE_EXPIRED' USING ERRCODE='42501';END IF;
IF a.date=app.activity_today()-1 AND NOT coalesce((SELECT typed_value='true'::jsonb FROM app.system_settings WHERE key='allow_h_minus_1_journal'),false) THEN RAISE EXCEPTION 'H1_DISABLED' USING ERRCODE='42501';END IF;
IF EXISTS(SELECT 1 FROM app.event_journal_blocks WHERE active AND(event_id IS NULL OR event_id=a.event_id) AND(event_type IS NULL OR event_type=(SELECT type FROM app.event_definitions WHERE id=a.event_id)) AND a.date BETWEEN date_start AND date_end) THEN RAISE EXCEPTION 'JOURNAL_BLOCKED' USING ERRCODE='42501';END IF;PERFORM finance.guard_open(a.date);
IF EXISTS(SELECT 1 FROM app.event_journals WHERE attendance_id=a.id) THEN RAISE EXCEPTION 'DUPLICATE_JOURNAL' USING ERRCODE='23505';END IF;IF a.version IS DISTINCT FROM(p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
SELECT * INTO e FROM app.event_definitions WHERE id=a.event_id AND active;IF e.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;w:=CASE WHEN a.date=app.activity_today() THEN 1 ELSE 0.8 END;credit:=round(e.jtm*w,1);
INSERT INTO app.event_journals(attendance_id,description,input_type,weight,credited_jtm) VALUES(a.id,btrim(p_data->>'description'),CASE WHEN w=1 THEN 'SAME_DAY' ELSE 'H_MINUS_1' END,w,credit) RETURNING * INTO j;
UPDATE app.event_attendance SET snapshot_jtm=credit,version=version+1 WHERE id=a.id;SELECT * INTO o FROM app.activity_occurrences WHERE event_attendance_id=a.id;SELECT * INTO x FROM app.activity_assignments WHERE occurrence_id=o.id;
INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,assignment_id) VALUES('EVENT',o.id,actor,a.date,credit,x.version,x.id);
PERFORM app.activity_audit('event-journal',j.id,'Jurnal acara tersimpan',NULL,to_jsonb(j));RETURN to_jsonb(j);END $$;
RESET ROLE;

SET LOCAL ROLE sim_guru_owner;
CREATE FUNCTION ops.worker_policy() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('securityMailEnabled',coalesce((typed_value->>'securityMailEnabled')::boolean,false)) FROM app.system_settings WHERE key='operations.config' $$;
REVOKE ALL ON FUNCTION ops.worker_policy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.worker_policy() TO sim_guru_worker;
RESET ROLE;

SET LOCAL ROLE sim_guru_owner;
CREATE INDEX announcement_dismissals_user ON app.announcement_dismissals(user_id);
CREATE INDEX domain_outbox_recipient ON ops.domain_outbox(recipient_id);
CREATE INDEX domain_outbox_assignment ON ops.domain_outbox(assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX domain_outbox_created ON ops.domain_outbox(created_at DESC);
CREATE INDEX job_runs_created ON ops.job_runs(created_at DESC);
RESET ROLE;
