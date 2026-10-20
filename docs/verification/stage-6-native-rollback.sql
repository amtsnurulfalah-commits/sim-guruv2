-- Native PostgreSQL checks; synthetic fixtures are rolled back; no email or finalization of real users.
BEGIN;
SET LOCAL ROLE sim_guru_owner;
DO $probe$
DECLARE g uuid:=gen_random_uuid();a uuid;m date:=date_trunc('month',finance.today())::date;s jsonb;lines jsonb;v jsonb;pid uuid;sid uuid:=gen_random_uuid();t text:=replace(gen_random_uuid()::text||gen_random_uuid()::text||gen_random_uuid()::text,'-','');r numeric;
BEGIN
 IF finance.transport_round(10333.33)<>10000 OR finance.transport_round(10333.34)<>10500 OR finance.transport_round(10666.66)<>10500 OR finance.transport_round(10666.67)<>11000 THEN RAISE EXCEPTION 'NATIVE_ROUNDING_FAILED';END IF;
 INSERT INTO app.app_users(id,username,full_name,role,status,km_distance) VALUES(g,'stage6probe.'||replace(g::text,'-',''),'Probe sementara','guru','active',10);
 s:=finance.calculate(g,m,'realized');IF(s->>'totalJtm')::numeric<>0 OR(s->>'total')::numeric<>0 THEN RAISE EXCEPTION 'NATIVE_ZERO_ENGINE_FAILED';END IF;
 INSERT INTO app.daily_attendance(user_id,date,sched_time_in,sched_time_out,actual_time_in,actual_time_out,time_in_source) VALUES(g,finance.today(),'07:30','14:30','07:30','11:30','admin') RETURNING id INTO a;
 INSERT INTO app.attendance_leaves(attendance_id,leave_time,return_time,reason,created_by) VALUES(a,'11:00','12:00','Probe izin sementara',g);
 lines:=finance.transport_lines(g,m,finance.today());v:=lines->0;
 IF(v->>'effectiveMinutes')::numeric<>210 OR v->>'ratio'<>'0.500' THEN RAISE EXCEPTION 'NATIVE_TRANSPORT_DURATION_FAILED';END IF;
 r:=(v->>'rate')::numeric;IF(v->>'raw')::numeric<>5*r THEN RAISE EXCEPTION 'NATIVE_TRANSPORT_RAW_FAILED';END IF;
 UPDATE app.daily_attendance SET sched_time_in=null,sched_time_out=null WHERE id=a;lines:=finance.transport_lines(g,m,finance.today());IF(lines->0->>'raw')::numeric<>0 THEN RAISE EXCEPTION 'NATIVE_MISSING_SCHEDULE_FAILED';END IF;
 UPDATE app.daily_attendance SET extra_attendee=true,extra_reason='Peserta tambahan sementara' WHERE id=a;lines:=finance.transport_lines(g,m,finance.today());IF(lines->0->>'raw')::numeric<>10*r OR(lines->0->>'ratio')::numeric<>1 THEN RAISE EXCEPTION 'NATIVE_EXTRA_ATTENDEE_FAILED';END IF;
 INSERT INTO finance.honor_periods(period_start) VALUES('2198-01-01') RETURNING id INTO pid;
 INSERT INTO finance.honor_statements(id,period_id,user_id,trx_id,snapshot,total_jtm,total_honor,checksum) VALUES(sid,pid,g,'PROBE-'||sid,s,0,0,finance.digest(s::text));
 BEGIN UPDATE finance.honor_statements SET total_honor=1 WHERE id=sid;RAISE EXCEPTION 'NATIVE_IMMUTABLE_FAILED';EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'FINAL_IMMUTABLE' THEN RAISE;END IF;END;
 INSERT INTO finance.document_tokens(token_hash,statement_id) VALUES(finance.digest(t),sid);v:=app.finance_verify(t);IF v->>'status'<>'valid' OR v?'total' OR v?'nip' OR v->>'recipient'<>'P***' THEN RAISE EXCEPTION 'NATIVE_VERIFICATION_PRIVACY_FAILED';END IF;
 INSERT INTO finance.corrections(statement_id,target_period,sequence,baseline_total,corrected_total,delta,reason,evidence,revision,approved_by) VALUES(sid,'2198-02-01',1,0,10,10,'Probe koreksi sementara','Referensi probe sementara','{}',g);IF app.finance_verify(t)->>'status'<>'corrected' THEN RAISE EXCEPTION 'NATIVE_CORRECTION_STATUS_FAILED';END IF;
 INSERT INTO finance.period_guards(period_start,finalized_at) VALUES('2198-01-01',clock_timestamp());BEGIN PERFORM finance.guard_open('2198-01-02');RAISE EXCEPTION 'NATIVE_FINAL_GUARD_FAILED';EXCEPTION WHEN SQLSTATE '42501' THEN IF SQLERRM<>'FINAL_PERIOD' THEN RAISE;END IF;END;
END $probe$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'checks',8,'rolledBack',true,'sendsEmail',false,'remainingProbeUsers',(SELECT count(*) FROM app.app_users WHERE username LIKE 'stage6probe.%')) result;
