-- Controlled native invariant probe; ALL fixtures, sessions and effects are rolled back.
-- Does not send email or modify real users. Does not prove a two-connection race.
BEGIN;
SET LOCAL ROLE sim_guru_owner;
DO $probe$
DECLARE a uuid:=gen_random_uuid();g uuid:=gen_random_uuid();r uuid:=gen_random_uuid();e uuid:=gen_random_uuid();ad text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);h text:='$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';reason text:='Verifikasi rollback Tahap 4';y uuid;p uuid;ds uuid;o uuid;assignment uuid;s app.school_profiles%ROWTYPE;allocation uuid;v jsonb;sum_jtm numeric;
BEGIN
 INSERT INTO app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at)
 SELECT id,'stage4probe.'||replace(id::text,'-',''),'Probe Tahap4',CASE WHEN id=a THEN 'admin' ELSE 'guru' END,'active',false,id::text||'@example.invalid',clock_timestamp() FROM unnest(ARRAY[a,g,r,e]) id;
 INSERT INTO auth_private.user_credentials(user_id,password_hash) VALUES(a,h);
 INSERT INTO auth_private.security_questions(user_id,question,answer_hash) VALUES(a,'Probe saja',h);
 INSERT INTO auth_private.app_sessions(user_id,token_hash,auth_version_at_issue,scope,expires_at,idle_expires_at) VALUES(a,ad,1,'business',clock_timestamp()+interval '30 minutes',clock_timestamp()+interval '20 minutes');
 PERFORM auth_private.lifecycle_self(ad);PERFORM set_config('app.master_reason',reason,true);
 SELECT * INTO s FROM app.school_profiles;
 IF s.id IS NULL THEN INSERT INTO app.school_profiles(name,address,npsn,level,use_parallel,parallel_max,minutes_per_jtm) VALUES('Probe sementara','','','SMP',false,1,40) RETURNING * INTO s;END IF;
 INSERT INTO app.academic_years(label,date_start,date_end) VALUES('2180/2181','2180-01-01','2181-12-31') RETURNING id INTO y;
 INSERT INTO app.academic_periods(academic_year_id,semester,date_start,date_end,is_active) VALUES(y,1,'2180-01-01','2180-06-30',false) RETURNING id INTO p;
 v:=app.duty_schedule_save(ad,null,jsonb_build_object('kind','PIKET','userId',g,'academicPeriodId',p,'dayIndex',extract(dow FROM date '2180-01-03')::int,'date',null,'validFrom','2180-01-03','validTo','2180-01-10','timeStart','07:00','timeEnd','14:00','active',true,'version','0','reason',reason));ds:=(v->>'id')::uuid;
 INSERT INTO app.activity_occurrences(kind,duty_schedule_id,date,academic_period_id,time_start,time_end,scheduled_jtm,expected_students,snapshot) VALUES('PIKET',ds,'2180-01-03',p,'07:00','14:00',4,0,jsonb_build_object('teacherName','Probe Guru')) RETURNING id INTO o;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id) VALUES(o,g,g) RETURNING id INTO assignment;
 INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason) VALUES(assignment,a,reason);
 PERFORM finance.guard_open('2180-01-03');PERFORM finance.reconcile_occurrence(o);
 SELECT sum(jtm) INTO sum_jtm FROM finance.jtm_ledger WHERE occurrence_id=o;IF sum_jtm<>4 THEN RAISE EXCEPTION 'NATIVE_PIKET_CREDIT';END IF;
 INSERT INTO finance.jtm_adjustments(occurrence_id,adjusted_jtm,reason,updated_by) VALUES(o,2,reason,a);
 INSERT INTO finance.jtm_allocations(occurrence_id,user_id,allocated_jtm,allocated_by,reason) VALUES(o,r,2,a,reason) RETURNING id INTO allocation;
 UPDATE app.activity_assignments SET version=version+1 WHERE id=assignment;
 PERFORM finance.reconcile_occurrence(o);SET CONSTRAINTS ALL IMMEDIATE;
 SELECT sum(jtm) INTO sum_jtm FROM finance.jtm_ledger WHERE occurrence_id=o;IF sum_jtm<>4 THEN RAISE EXCEPTION 'NATIVE_NET_INFLATION';END IF;
 IF (SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=o AND user_id=r)<>2 THEN RAISE EXCEPTION 'NATIVE_PARTIAL_NOT_EXACT';END IF;
 BEGIN INSERT INTO finance.jtm_allocations(occurrence_id,user_id,allocated_jtm,allocated_by,reason) VALUES(o,e,0.0001,a,reason);RAISE EXCEPTION 'NATIVE_OVERSPEND_ACCEPTED';EXCEPTION WHEN invalid_parameter_value THEN IF SQLERRM<>'CONSERVATION_VIOLATION' THEN RAISE;END IF;END;
 IF(SELECT count(*) FROM finance.jtm_allocations WHERE occurrence_id=o AND cancelled_at IS NULL)<>1 THEN RAISE EXCEPTION 'NATIVE_FAILED_WRITE_REMAINED';END IF;
 PERFORM finance.reverse_occurrence(o);PERFORM finance.reverse_occurrence(o);
 IF(SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=o)<>0 THEN RAISE EXCEPTION 'NATIVE_REVERSAL_DUPLICATE';END IF;
 BEGIN UPDATE finance.jtm_ledger SET jtm=99 WHERE occurrence_id=o;RAISE EXCEPTION 'NATIVE_LEDGER_MUTABLE';EXCEPTION WHEN insufficient_privilege THEN IF SQLERRM<>'LEDGER_IMMUTABLE' THEN RAISE;END IF;END;
END $probe$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'checks',jsonb_build_array('typed-piket-credit4','adjustment-and-partial-net4','partial-exact2','native-conservation-constraint','failed-write-rollback','reversal-idempotent','ledger-immutable'),'rolledBack',true,'sendsEmail',false) result;
