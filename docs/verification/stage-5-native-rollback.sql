-- Native invariant probe. All synthetic users, sessions, masters and ledger rows ROLLBACK.
-- No email; no persistent test users; not a two-connection race test.
BEGIN;
SET LOCAL ROLE sim_guru_owner;
DO $probe$
DECLARE a uuid:=gen_random_uuid();g uuid:=gen_random_uuid();ad text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);h text:='$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';reason text:='Verifikasi rollback Tahap 5';y uuid;p uuid;subject uuid;ep uuid;ses uuid;room uuid;source uuid;o uuid;assignment uuid;v jsonb;event uuid;ea uuid;eo uuid;ex uuid;
BEGIN
 INSERT INTO app.app_users(id,username,full_name,role,status,must_change_password,contact_email,email_verified_at) SELECT id,'stage5probe.'||replace(id::text,'-',''),'Probe Tahap5',CASE WHEN id=a THEN 'admin' ELSE 'guru' END,'active',false,id::text||'@example.invalid',clock_timestamp() FROM unnest(ARRAY[a,g]) id;
 INSERT INTO auth_private.user_credentials(user_id,password_hash) VALUES(a,h);
 INSERT INTO auth_private.security_questions(user_id,question,answer_hash) VALUES(a,'Probe sementara',h);
 INSERT INTO auth_private.app_sessions(user_id,token_hash,auth_version_at_issue,scope,expires_at,idle_expires_at) VALUES(a,ad,1,'business',clock_timestamp()+interval '30 minutes',clock_timestamp()+interval '20 minutes');
 PERFORM auth_private.lifecycle_self(ad);PERFORM set_config('app.master_reason',reason,true);
 INSERT INTO app.academic_years(label,date_start,date_end) VALUES('2182/2183','2182-01-01','2183-12-31') RETURNING id INTO y;
 INSERT INTO app.academic_periods(academic_year_id,semester,date_start,date_end,is_active) VALUES(y,1,'2182-01-01','2182-06-30',false) RETURNING id INTO p;
 INSERT INTO app.subjects(name) VALUES('Probe Tahap5 '||a::text) RETURNING id INTO subject;
 v:=app.exam_save(ad,jsonb_build_object('entity','period','version','0','reason',reason,'data',jsonb_build_object('academicPeriodId',p,'name','Probe ujian','dateStart','2182-01-02','dateEnd','2182-01-05','committeeJtm','2')));ep:=(v->>'id')::uuid;
 v:=app.exam_save(ad,jsonb_build_object('entity','session','version','0','reason',reason,'data',jsonb_build_object('periodId',ep,'date','2182-01-02','name','Sesi probe','timeStart','08:00','timeEnd','09:00','jtm','3')));ses:=(v->>'id')::uuid;
 v:=app.exam_save(ad,jsonb_build_object('entity','room','version','0','reason',reason,'data',jsonb_build_object('sessionId',ses,'name','Ruang probe','subjectId',subject,'totalStudents',0,'classIds','[]'::jsonb)));room:=(v->>'id')::uuid;
 v:=app.exam_save(ad,jsonb_build_object('entity','supervisor','version','0','reason',reason,'data',jsonb_build_object('roomId',room,'userId',g,'overrideJtm','4')));source:=(v->>'id')::uuid;
 SELECT id INTO o FROM app.activity_occurrences WHERE exam_supervisor_id=source;SELECT id INTO assignment FROM app.activity_assignments WHERE occurrence_id=o;
 INSERT INTO app.activity_confirmations(assignment_id,confirmed_by,reason) VALUES(assignment,a,reason);PERFORM finance.guard_open('2182-01-02');PERFORM finance.reconcile_occurrence(o);
 IF EXISTS(SELECT 1 FROM finance.jtm_ledger WHERE occurrence_id=o) THEN RAISE EXCEPTION 'NATIVE_SUPERVISOR_WITHOUT_BAP';END IF;
 INSERT INTO app.exam_baps(occurrence_id,assignment_id,user_id,present,absent,notes) VALUES(o,assignment,g,0,0,'Probe sementara');UPDATE app.activity_assignments SET version=version+1 WHERE id=assignment;PERFORM finance.reconcile_occurrence(o);
 IF(SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=o)<>4 THEN RAISE EXCEPTION 'NATIVE_BAP_OVERRIDE';END IF;
 INSERT INTO finance.jtm_adjustments(occurrence_id,adjusted_jtm,reason,updated_by) VALUES(o,0,reason,a);UPDATE app.activity_assignments SET version=version+1 WHERE id=assignment;PERFORM finance.reconcile_occurrence(o);SET CONSTRAINTS ALL IMMEDIATE;
 IF(SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=o)<>0 THEN RAISE EXCEPTION 'NATIVE_ZERO_BASIS';END IF;
 PERFORM app.duty_cleanup(o,a);IF NOT EXISTS(SELECT 1 FROM app.exam_baps WHERE occurrence_id=o AND state='locked') THEN RAISE EXCEPTION 'NATIVE_BAP_NOT_LOCKED';END IF;
 INSERT INTO app.event_definitions(name,type,days,dates,time_start,time_end,jtm,description,date_start,date_end) VALUES('Probe acara '||a::text,'insidental',ARRAY[]::int[],ARRAY[date '2182-01-02'],'10:00','11:00',3,'Probe','2182-01-02','2182-01-02') RETURNING id INTO event;
 INSERT INTO app.event_attendance(event_id,date,user_id,time_in,recorded_by,snapshot_jtm) VALUES(event,'2182-01-02',g,'10:15',a,2.4) RETURNING id INTO ea;
 INSERT INTO app.activity_occurrences(kind,date,academic_period_id,time_start,time_end,scheduled_jtm,expected_students,snapshot,event_attendance_id) VALUES('EVENT','2182-01-02',p,'10:00','11:00',3,0,'{}',ea) RETURNING id INTO eo;
 INSERT INTO app.activity_assignments(occurrence_id,original_user_id,effective_user_id) VALUES(eo,g,g) RETURNING id INTO ex;
 INSERT INTO app.event_journals(attendance_id,description,input_type,weight,credited_jtm) VALUES(ea,'Probe jurnal H-1','H_MINUS_1',0.8,2.4);
 INSERT INTO finance.jtm_ledger(source_kind,occurrence_id,user_id,date,jtm,revision,assignment_id) VALUES('EVENT',eo,g,'2182-01-02',2.4,1,ex);
 IF(SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=eo)<>2.4 THEN RAISE EXCEPTION 'NATIVE_EVENT_CREDIT';END IF;
 PERFORM finance.reverse_occurrence(eo);PERFORM finance.reverse_occurrence(eo);IF(SELECT sum(jtm) FROM finance.jtm_ledger WHERE occurrence_id=eo)<>0 THEN RAISE EXCEPTION 'NATIVE_EVENT_REVERSAL';END IF;
END $probe$;
ROLLBACK;
SELECT jsonb_build_object('ok',true,'checks',jsonb_build_array('supervisor-confirmation-no-credit','bap-override-credit4','zero-adjustment','cleanup-locks-bap','event-credit2.4','event-reversal-idempotent'),'rolledBack',true,'sendsEmail',false) result;
