-- Professional roadmap stage 2. No completion ledger: tasks are projections of source state.
SET LOCAL ROLE sim_guru_owner;
DO $precondition$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='ops.domain_claim()'::regprocedure) IS DISTINCT FROM 'fd9b1f6815266e453c7d909e5268f774'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='ops.reminders()'::regprocedure) IS DISTINCT FROM '9fdda39dffb8a45587a89894de650a2c' THEN
 RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
 END IF;
END $precondition$;
CREATE TABLE app.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES app.app_users(id),
 email_enabled boolean NOT NULL DEFAULT true,
 reminder_email boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE app.notification_receipts (
 user_id uuid NOT NULL REFERENCES app.app_users(id),
 outbox_id uuid NOT NULL REFERENCES ops.domain_outbox(id),
 read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,outbox_id)
);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['app.notification_preferences','app.notification_receipts'] LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,sim_guru_auth,sim_guru_business,sim_guru_worker',t);
END LOOP; END $$;
ALTER TABLE ops.domain_outbox ADD COLUMN task_keys text[];
-- This private projection never accepts a browser-supplied role. Callers resolve actor via session.
CREATE FUNCTION app.task_items(p_actor uuid)
RETURNS TABLE(id text,source_id text,kind text,title text,reason text,date date,deadline timestamptz,href text,blocked boolean)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH ctx AS (SELECT app.activity_today() d,
   coalesce((SELECT typed_value='true'::jsonb FROM app.system_settings WHERE key='allow_h_minus_1_journal'),false) h1),
 actor AS (SELECT role='admin' admin FROM app.app_users WHERE id=p_actor AND status='active'),
 owned AS (
 SELECT o.*,a.id aid,EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL) confirmed,
 EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',o.date)::date AND g.finalized_at IS NOT NULL) final
 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id CROSS JOIN ctx
 WHERE a.effective_user_id=p_actor AND o.removed_at IS NULL AND o.date<=ctx.d
 )
 SELECT 'journal:'||o.id,o.id::text,'journal','Jurnal · '||concat_ws(' · ',o.snapshot->>'className',o.snapshot->>'subjectName',to_char(o.time_start,'HH24:MI')),
 coalesce(app.journal_eligibility(o.id,p_actor),'Kegiatan terkonfirmasi; jurnal belum tersedia.'),o.date,
 ((o.date+CASE WHEN ctx.h1 THEN 2 ELSE 1 END)::timestamp AT TIME ZONE 'Asia/Jakarta'),
 '/jurnal?date='||o.date,app.journal_eligibility(o.id,p_actor) IS NOT NULL
 FROM owned o CROSS JOIN ctx WHERE o.kind='KBM' AND o.date>=ctx.d-CASE WHEN ctx.h1 THEN 1 ELSE 0 END
 AND NOT o.final AND coalesce((app.day_context_internal(o.date)->>'kbmEnabled')::boolean,false)
 AND NOT EXISTS(SELECT 1 FROM app.teaching_journals j WHERE j.occurrence_id=o.id AND j.deleted_at IS NULL)
 UNION ALL
 SELECT 'bap:'||o.id,o.id::text,'bap','BAP · '||concat_ws(' · ',o.snapshot->>'sessionName',o.snapshot->>'className',o.snapshot->>'subjectName'),
 CASE WHEN NOT o.confirmed THEN 'NO_ACTIVE_CONFIRMATION' WHEN app.exam_now()<o.date+o.time_end+interval '5 minutes' THEN 'ATTENDANCE_TIME_INVALID' ELSE 'Pengawasan terkonfirmasi; BAP belum tersedia.' END,
 o.date,((p.date_end+1)::timestamp AT TIME ZONE 'Asia/Jakarta'),'/ujian/bap?date='||o.date,
 NOT o.confirmed OR app.exam_now()<o.date+o.time_end+interval '5 minutes'
 FROM owned o JOIN app.exam_periods p ON p.id=app.exam_period_for(o.id) CROSS JOIN ctx
 WHERE o.kind='EXAM_SUPERVISOR' AND p.active AND ctx.d<=p.date_end AND NOT o.final
 AND NOT EXISTS(SELECT 1 FROM app.exam_baps b WHERE b.occurrence_id=o.id AND b.state='active')
 UNION ALL
 SELECT 'event-journal:'||a.id,a.id::text,'event','Jurnal acara · '||e.name,
 CASE WHEN EXISTS(SELECT 1 FROM app.event_journal_blocks b WHERE b.active AND (b.event_id IS NULL OR b.event_id=a.event_id) AND (b.event_type IS NULL OR b.event_type=e.type) AND a.date BETWEEN b.date_start AND b.date_end) THEN 'JOURNAL_BLOCKED' ELSE 'Kehadiran acara tercatat; jurnal belum tersedia.' END,
 a.date,((a.date+CASE WHEN ctx.h1 THEN 2 ELSE 1 END)::timestamp AT TIME ZONE 'Asia/Jakarta'),'/acara/jurnal?date='||a.date,
 EXISTS(SELECT 1 FROM app.event_journal_blocks b WHERE b.active AND (b.event_id IS NULL OR b.event_id=a.event_id) AND (b.event_type IS NULL OR b.event_type=e.type) AND a.date BETWEEN b.date_start AND b.date_end)
 FROM app.event_attendance a JOIN app.event_definitions e ON e.id=a.event_id CROSS JOIN ctx
 WHERE a.user_id=p_actor AND a.cancelled_at IS NULL AND e.active AND a.date BETWEEN ctx.d-CASE WHEN ctx.h1 THEN 1 ELSE 0 END AND ctx.d
 AND NOT EXISTS(SELECT 1 FROM app.event_journals j WHERE j.attendance_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',a.date)::date AND g.finalized_at IS NOT NULL)
 UNION ALL
 SELECT 'confirmation:'||a.id,a.id::text,'confirmation','Konfirmasi · '||concat_ws(' · ',coalesce(a.effective_name,o.snapshot->>'teacherName'),o.snapshot->>'className',o.snapshot->>'subjectName',to_char(o.time_start,'HH24:MI')),
 CASE WHEN NOT actor.admin AND o.kind='EXAM_SUPERVISOR' AND EXISTS(SELECT 1 FROM jsonb_array_elements(app.exam_required(o.date,app.exam_period_for(o.id))) x WHERE NOT(x->>'complete')::boolean) THEN 'STUDENT_ATTENDANCE_MISMATCH' ELSE 'Penugasan guru lain belum dikonfirmasi.' END,o.date,((o.date+1)::timestamp AT TIME ZONE 'Asia/Jakarta'),
 CASE WHEN o.kind='KBM' THEN '/kegiatan?date=' WHEN o.kind IN('PIKET','UPACARA') THEN '/piket?date=' ELSE '/ujian?date=' END||o.date,
 NOT actor.admin AND o.kind='EXAM_SUPERVISOR' AND EXISTS(SELECT 1 FROM jsonb_array_elements(app.exam_required(o.date,app.exam_period_for(o.id))) x WHERE NOT(x->>'complete')::boolean)
 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id CROSS JOIN ctx CROSS JOIN actor
 WHERE o.date=ctx.d AND o.removed_at IS NULL AND a.effective_user_id<>p_actor AND a.original_user_id<>p_actor
 AND ((o.kind='KBM' AND coalesce((app.day_context_internal(o.date)->>'kbmEnabled')::boolean,false) AND (actor.admin OR app.is_piket(p_actor,o.date)))
 OR (o.kind='EXAM_SUPERVISOR' AND coalesce((app.day_context_internal(o.date)->>'examEnabled')::boolean,false) AND (actor.admin OR app.is_committee(p_actor,o.date,app.exam_period_for(o.id),true)))
 OR (actor.admin AND o.kind IN('PIKET','UPACARA') AND coalesce((app.day_context_internal(o.date)->>'kbmEnabled')::boolean,false))
 OR (actor.admin AND o.kind='EXAM_COMMITTEE' AND coalesce((app.day_context_internal(o.date)->>'examEnabled')::boolean,false)))
 AND NOT EXISTS(SELECT 1 FROM app.activity_confirmations c WHERE c.assignment_id=a.id AND c.revoked_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',o.date)::date AND g.finalized_at IS NOT NULL)
 UNION ALL
 SELECT 'attendance:'||a.id,a.id::text,'attendance',CASE WHEN a.actual_time_in IS NULL THEN 'Catat jam masuk' ELSE 'Catat jam keluar' END,
 CASE WHEN a.actual_time_in IS NULL AND app.exam_now()::time<a.sched_time_in THEN 'Waktu masuk belum dimulai.'
 WHEN a.actual_time_in>a.sched_time_out THEN 'Jadwal keluar lebih awal dari jam masuk. Minta administrator memeriksa data kehadiran.' WHEN NOT actor.admin AND a.actual_time_in IS NOT NULL AND app.exam_now()::time<a.sched_time_out+interval '5 minutes' THEN 'Tunggu sampai lima menit setelah jadwal keluar.' ELSE 'Pencatatan kehadiran hari ini belum lengkap.' END,
 a.date,((a.date+1)::timestamp AT TIME ZONE 'Asia/Jakarta'),'/kehadiran?date='||a.date,
 CASE WHEN a.actual_time_in IS NULL THEN app.exam_now()::time<a.sched_time_in ELSE a.actual_time_in>a.sched_time_out OR (NOT actor.admin AND app.exam_now()::time<a.sched_time_out+interval '5 minutes') END
 FROM app.daily_attendance a CROSS JOIN ctx CROSS JOIN actor WHERE a.user_id=p_actor AND a.date=ctx.d AND a.sched_time_in IS NOT NULL AND a.sched_time_out IS NOT NULL AND a.actual_time_out IS NULL
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',a.date)::date AND g.finalized_at IS NOT NULL)
 UNION ALL
 SELECT 'students:'||(x->>'id')||':'||ctx.d,x->>'id','students','Rekap siswa · '||(x->>'name'),
 'Kelas yang diwajibkan pada tanggal ini belum memiliki rekap.',ctx.d,((ctx.d+1)::timestamp AT TIME ZONE 'Asia/Jakarta'),'/absensi-siswa/input?date='||ctx.d,false
 FROM ctx CROSS JOIN actor CROSS JOIN LATERAL (SELECT DISTINCT value x FROM jsonb_array_elements(app.students_required(ctx.d)||app.exam_required(ctx.d))) classes
 WHERE actor.admin AND NOT (x->>'complete')::boolean
 AND NOT EXISTS(SELECT 1 FROM finance.period_guards g WHERE g.period_start=date_trunc('month',ctx.d)::date AND g.finalized_at IS NOT NULL)
 UNION ALL
 SELECT 'assignment:'||o.id,o.id::text,'assignment',CASE WHEN o.kind='UPACARA' THEN 'Konfirmasi tugas upacara' ELSE 'Periksa konfirmasi penugasan' END,
 CASE WHEN o.kind='UPACARA' THEN 'Tugas upacara belum dikonfirmasi.' ELSE 'Tunggu konfirmasi administrator sebelum menjalankan kewenangan petugas.' END,
 o.date,((o.date+1)::timestamp AT TIME ZONE 'Asia/Jakarta'),CASE WHEN o.kind='EXAM_COMMITTEE' THEN '/ujian?date=' ELSE '/piket?date=' END||o.date,o.kind<>'UPACARA'
 FROM owned o CROSS JOIN ctx WHERE o.kind IN('PIKET','UPACARA','EXAM_COMMITTEE') AND o.date=ctx.d AND NOT o.confirmed AND NOT o.final
 UNION ALL
 SELECT 'job:'||j.business_key,j.business_key,'operations','Periksa pekerjaan otomatis gagal','Pekerjaan memerlukan peninjauan administrator.',ctx.d,null::timestamptz,'/admin/operasional',false
 FROM ops.job_runs j CROSS JOIN ctx CROSS JOIN actor WHERE actor.admin AND j.state='failed'
 UNION ALL
 SELECT 'mail:'||o.id,o.id::text,'operations','Periksa pengiriman email','Pengiriman gagal atau status penerimaan belum pasti.',ctx.d,null::timestamptz,'/admin/operasional',false
 FROM ops.domain_outbox o CROSS JOIN ctx CROSS JOIN actor WHERE actor.admin AND o.state IN('failed','unknown')
$$;
CREATE FUNCTION app.tasks_read(p_session text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; BEGIN
 actor:=app.activity_guard(p_session,false);
 -- Same canonical materializer and lock used by activity reads/worker; no alternative schedule engine.
 PERFORM pg_advisory_xact_lock(734190,1); PERFORM app.ensure_occurrences(app.activity_today());
 RETURN jsonb_build_object('date',app.activity_today(),'generatedAt',clock_timestamp(),
 'items',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.blocked,t.deadline NULLS LAST,t.id) FROM app.task_items(actor) t),'[]'::jsonb));
 END $$;
CREATE FUNCTION app.notifications_read(p_session text,p_page int,p_unread boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; pref app.notification_preferences%ROWTYPE; BEGIN
 actor:=app.activity_guard(p_session,false);
 IF p_page NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 SELECT * INTO pref FROM app.notification_preferences WHERE user_id=actor;
 RETURN jsonb_build_object('preferences',jsonb_build_object('emailEnabled',coalesce(pref.email_enabled,true),'reminderEmail',coalesce(pref.reminder_email,true),'version',coalesce(pref.version,0)::text),
 'total',(SELECT count(*) FROM ops.domain_outbox o WHERE o.recipient_id=actor AND (NOT p_unread OR NOT EXISTS(SELECT 1 FROM app.notification_receipts r WHERE r.user_id=actor AND r.outbox_id=o.id))),
 'unread',(SELECT count(*) FROM ops.domain_outbox o WHERE o.recipient_id=actor AND NOT EXISTS(SELECT 1 FROM app.notification_receipts r WHERE r.user_id=actor AND r.outbox_id=o.id)),
 'items',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC,x.id DESC) FROM (
 SELECT o.id,o.subject,o.body,o.state,o.created_at,EXISTS(SELECT 1 FROM app.notification_receipts r WHERE r.user_id=actor AND r.outbox_id=o.id) AS read,
 CASE WHEN o.task_keys IS NOT NULL THEN '/tugas' WHEN o.dedupe_key LIKE 'honor-%' THEN '/honorarium' ELSE '/dashboard' END href
 FROM ops.domain_outbox o WHERE o.recipient_id=actor AND (NOT p_unread OR NOT EXISTS(SELECT 1 FROM app.notification_receipts r WHERE r.user_id=actor AND r.outbox_id=o.id))
 ORDER BY o.created_at DESC,o.id DESC LIMIT 20 OFFSET (p_page-1)*20)x),'[]'::jsonb));
 END $$;
CREATE FUNCTION app.notification_command(p_session text,p_kind text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; old app.notification_preferences%ROWTYPE; BEGIN
 actor:=app.activity_guard(p_session,true);
 IF p_kind='notification-read' THEN
 IF NOT EXISTS(SELECT 1 FROM ops.domain_outbox WHERE id=(p_data->>'id')::uuid AND recipient_id=actor) THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
 INSERT INTO app.notification_receipts(user_id,outbox_id) VALUES(actor,(p_data->>'id')::uuid) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('read',true);
 ELSIF p_kind='notification-preferences' THEN
 SELECT * INTO old FROM app.notification_preferences WHERE user_id=actor FOR UPDATE;
 IF coalesce(old.version,0) IS DISTINCT FROM (p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 INSERT INTO app.notification_preferences(user_id,email_enabled,reminder_email) VALUES(actor,(p_data->>'emailEnabled')::boolean,(p_data->>'reminderEmail')::boolean)
 ON CONFLICT(user_id) DO UPDATE SET email_enabled=excluded.email_enabled,reminder_email=excluded.reminder_email,version=app.notification_preferences.version+1;
 RETURN jsonb_build_object('saved',true);
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 END $$;
CREATE OR REPLACE FUNCTION ops.reminders() RETURNS int LANGUAGE plpgsql SET search_path=pg_catalog AS $$
 DECLARE n int; BEGIN
 PERFORM app.ensure_occurrences(app.activity_today());
 INSERT INTO ops.domain_outbox(dedupe_key,recipient_id,subject,body,task_keys)
 SELECT 'task-digest:'||u.id||':'||app.activity_today(),u.id,'Pengingat tugas hari ini',
 'Ada '||count(*)||' tugas yang dapat ditindaklanjuti. Buka Pusat tugas untuk memeriksa sumber dan batas waktunya.',array_agg(t.id ORDER BY t.id)
 FROM app.app_users u CROSS JOIN LATERAL app.task_items(u.id) t
 LEFT JOIN app.notification_preferences p ON p.user_id=u.id
 WHERE u.status='active' AND NOT t.blocked AND t.deadline IS NOT NULL AND t.deadline>clock_timestamp()
 AND t.deadline<=((app.activity_today()+2)::timestamp AT TIME ZONE 'Asia/Jakarta')
 AND (t.kind<>'journal' OR EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.id::text=t.source_id AND app.exam_now()>=o.date+o.time_end+interval '5 minutes'))
 AND (t.kind<>'event' OR EXISTS(SELECT 1 FROM app.event_attendance a JOIN app.event_definitions e ON e.id=a.event_id WHERE a.id::text=t.source_id AND app.exam_now()>=a.date+e.time_end))
 AND coalesce(p.email_enabled,true) AND coalesce(p.reminder_email,true)
 GROUP BY u.id ON CONFLICT(dedupe_key) DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
-- Existing queued legacy reminders must not compete with the new daily digest.
UPDATE ops.domain_outbox SET state='cancelled' WHERE state IN('pending','retry_wait') AND (dedupe_key LIKE 'journal:%' OR dedupe_key LIKE 'confirmation-reminder:%' OR dedupe_key LIKE 'event-journal:%');
ALTER FUNCTION ops.domain_claim() RENAME TO stage7_domain_claim;
CREATE FUNCTION ops.domain_claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(734190,1);
 UPDATE ops.domain_outbox o SET state='cancelled' WHERE o.state IN('pending','retry_wait') AND (
 NOT coalesce((SELECT email_enabled FROM app.notification_preferences WHERE user_id=o.recipient_id),true)
 OR (o.task_keys IS NOT NULL AND (NOT coalesce((SELECT reminder_email FROM app.notification_preferences WHERE user_id=o.recipient_id),true)
 OR NOT EXISTS(SELECT 1 FROM app.task_items(o.recipient_id) t WHERE t.id=ANY(o.task_keys) AND NOT t.blocked AND t.deadline>clock_timestamp()))));
 RETURN ops.stage7_domain_claim(); END $$;
REVOKE ALL ON FUNCTION app.task_items(uuid),app.tasks_read(text),app.notifications_read(text,int,boolean),app.notification_command(text,text,jsonb),ops.domain_claim(),ops.stage7_domain_claim() FROM PUBLIC;
REVOKE ALL ON FUNCTION ops.stage7_domain_claim() FROM sim_guru_worker;
GRANT EXECUTE ON FUNCTION app.tasks_read(text),app.notifications_read(text,int,boolean),app.notification_command(text,text,jsonb) TO sim_guru_business;
GRANT EXECUTE ON FUNCTION ops.domain_claim() TO sim_guru_worker;
RESET ROLE;
