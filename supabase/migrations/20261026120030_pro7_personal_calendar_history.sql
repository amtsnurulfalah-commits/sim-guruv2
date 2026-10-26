-- PRO-7 private read models only. No schedules, audit evidence, finance or session policy replaced.
SET LOCAL ROLE sim_guru_owner;
CREATE FUNCTION app.personal_calendar(p_session text,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid; items jsonb;
BEGIN
 actor:=app.activity_guard(p_session,false);
 IF p_from IS NULL OR p_to IS NULL OR p_from<'2000-01-01' OR p_to>='2200-01-01' OR p_to-p_from NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 WITH days AS MATERIALIZED (SELECT p_from+i d,app.day_context_internal(p_from+i) context FROM generate_series(0,p_to-p_from) i),
 rows AS (
 SELECT o.kind||':'||coalesce(o.schedule_id,o.duty_schedule_id,o.exam_supervisor_id,o.exam_committee_id,e.event_id,o.id)::text||':'||o.date uid,
 o.date,to_char(o.time_start,'HH24:MI') start,to_char(o.time_end,'HH24:MI') finish,o.kind,
 coalesce(o.snapshot->>'subjectName',o.snapshot->>'sessionName',o.snapshot->>'eventName',o.kind) title,
 coalesce(o.snapshot->>'className','') location,
 CASE WHEN a.effective_user_id=actor THEN 'effective' ELSE 'allocated' END state,
 CASE WHEN o.kind='EXAM_COMMITTEE' THEN EXISTS(SELECT 1 FROM app.exam_committee_assignments c WHERE c.id=o.exam_committee_id AND c.exclusive_time_start IS NULL) ELSE false END all_day
 FROM app.activity_occurrences o JOIN app.activity_assignments a ON a.occurrence_id=o.id LEFT JOIN app.event_attendance e ON e.id=o.event_attendance_id
 WHERE o.date BETWEEN p_from AND p_to AND o.removed_at IS NULL AND (a.effective_user_id=actor OR EXISTS(SELECT 1 FROM finance.jtm_allocations r WHERE r.occurrence_id=o.id AND r.user_id=actor AND r.cancelled_at IS NULL))
 UNION ALL
 SELECT 'KBM:'||s.id||':'||d.d,d.d,to_char(s.time_start,'HH24:MI'),to_char(s.time_end,'HH24:MI'),'KBM',coalesce(s.snapshot->>'subjectName','KBM'),coalesce(s.snapshot->>'className',''),'planned',false
 FROM days d JOIN app.teaching_schedules s ON s.user_id=actor AND s.state<>'archived' AND d.d BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM d.d) AND s.academic_period_id::text=d.context->>'academicPeriodId'
 WHERE coalesce((d.context->>'kbmEnabled')::boolean,false) AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.schedule_id=s.id AND o.date=d.d)
 UNION ALL
 SELECT s.kind||':'||s.id||':'||d.d,d.d,to_char(s.time_start,'HH24:MI'),to_char(s.time_end,'HH24:MI'),s.kind,s.kind,'','planned',false
 FROM days d JOIN app.duty_schedules s ON s.user_id=actor AND s.active AND d.d BETWEEN s.valid_from AND s.valid_to AND s.day_index=extract(dow FROM d.d) AND s.academic_period_id::text=d.context->>'academicPeriodId'
 WHERE coalesce((d.context->>'kbmEnabled')::boolean,false) AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.duty_schedule_id=s.id AND o.date=d.d)
 UNION ALL
 SELECT 'EXAM_SUPERVISOR:'||a.id||':'||s.date,s.date,to_char(s.time_start,'HH24:MI'),to_char(s.time_end,'HH24:MI'),'EXAM_SUPERVISOR',s.name,r.name,'planned',false
 FROM app.exam_supervisor_assignments a JOIN app.exam_rooms r ON r.id=a.exam_room_id JOIN app.exam_sessions s ON s.id=r.session_id JOIN app.exam_periods p ON p.id=s.period_id
 WHERE a.user_id=actor AND a.active AND r.active AND s.active AND p.active AND s.date BETWEEN p_from AND p_to AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.exam_supervisor_id=a.id AND o.date=s.date)
 UNION ALL
 SELECT 'EXAM_COMMITTEE:'||c.id||':'||c.date,c.date,to_char(coalesce(c.exclusive_time_start,'00:00'::time),'HH24:MI'),to_char(coalesce(c.exclusive_time_end,'23:59'::time),'HH24:MI'),'EXAM_COMMITTEE',p.name,'','planned',c.exclusive_time_start IS NULL
 FROM app.exam_committee_assignments c JOIN app.exam_periods p ON p.id=c.period_id
 WHERE c.user_id=actor AND c.active AND p.active AND c.date BETWEEN p_from AND p_to AND NOT EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.exam_committee_id=c.id AND o.date=c.date)
 UNION ALL
 SELECT 'EVENT:'||e.id||':'||d.d,d.d,to_char(e.time_start,'HH24:MI'),to_char(e.time_end,'HH24:MI'),'EVENT',e.name,'','available',false
 FROM days d JOIN app.event_definitions e ON app.event_occurs(e.id,d.d)
 WHERE NOT EXISTS(SELECT 1 FROM app.event_attendance a JOIN app.activity_occurrences o ON o.event_attendance_id=a.id WHERE a.event_id=e.id AND a.date=d.d AND a.user_id=actor AND a.cancelled_at IS NULL AND o.removed_at IS NULL)
 ), limited AS (SELECT * FROM rows ORDER BY date,start,uid LIMIT 2001)
 SELECT coalesce(jsonb_agg(to_jsonb(limited) ORDER BY date,start,uid),'[]') INTO items FROM limited;
 IF jsonb_array_length(items)>2000 THEN RAISE EXCEPTION 'EXPORT_TOO_LARGE' USING ERRCODE='54000';END IF;
 RETURN jsonb_build_object('from',p_from,'to',p_to,'generatedAt',clock_timestamp(),'items',items);
END $$;
CREATE FUNCTION app.personal_history(p_session text,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid;admin boolean;result jsonb;
BEGIN
 actor:=app.activity_guard(p_session,false);admin:=app.actor_is_admin();
 IF p_from IS NULL OR p_to IS NULL OR p_from<'2000-01-01' OR p_to>='2200-01-01' OR p_to-p_from NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 WITH source AS (
 SELECT id,'schedule'::text kind,entity_id,actor_id,reason,created_at,old_data IS NOT NULL has_before,new_data IS NOT NULL has_after,old_data,new_data FROM ops.master_revisions r
 WHERE r.kind='schedules' AND (admin OR EXISTS(SELECT 1 FROM app.teaching_schedules s WHERE s.id=r.entity_id AND s.user_id=actor))
 UNION ALL
 SELECT id,entity_kind,entity_id,actor_id,reason,created_at,old_data IS NOT NULL,new_data IS NOT NULL,old_data,new_data FROM ops.activity_revisions r
 WHERE r.entity_kind IN('confirmation','duty-substitute','duty-cancel-substitute','duty-confirm','duty-revoke','duty-adjust','duty-relocate','duty-replace','duty-allocate','duty-remove-allocation','duty-reset','journal','correction-request','honor-correction') AND (admin OR r.actor_id=actor OR (r.entity_kind IN('confirmation','duty-substitute','duty-cancel-substitute','duty-confirm','duty-revoke','duty-adjust','duty-relocate','duty-replace','duty-allocate','duty-remove-allocation','duty-reset') AND EXISTS(SELECT 1 FROM app.activity_assignments a WHERE a.occurrence_id=r.entity_id AND actor IN(a.original_user_id,a.effective_user_id)) OR r.entity_kind IN('duty-allocate','duty-remove-allocation','duty-reset') AND EXISTS(SELECT 1 FROM finance.jtm_allocations j WHERE j.occurrence_id=r.entity_id AND j.user_id=actor)))
 ), limited AS (SELECT * FROM source WHERE created_at>=p_from::timestamp AT TIME ZONE 'Asia/Jakarta' AND created_at<(p_to+1)::timestamp AT TIME ZONE 'Asia/Jakarta' ORDER BY created_at DESC,id LIMIT 101)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'reference',x.entity_id,'actor',CASE WHEN admin OR x.actor_id=actor THEN (SELECT full_name FROM app.app_users WHERE id=x.actor_id) ELSE 'Petugas berwenang' END,'reason',CASE WHEN admin OR x.actor_id=actor THEN x.reason ELSE null END,'createdAt',x.created_at,'hasBefore',x.has_before,'hasAfter',x.has_after,'changedFields',coalesce((SELECT jsonb_agg(f.label) FROM (VALUES('userId','Petugas efektif'),('confirmed','Status konfirmasi'),('timeStart','Jam mulai'),('timeEnd','Jam selesai'),('time_start','Jam mulai jadwal'),('time_end','Jam selesai jadwal'),('valid_from','Awal masa berlaku'),('valid_to','Akhir masa berlaku'),('scheduledJtm','JTM terjadwal'),('adjustedJtm','Penyesuaian JTM')) f(key,label) WHERE x.old_data->f.key IS DISTINCT FROM x.new_data->f.key),'[]'::jsonb)) ORDER BY x.created_at DESC,x.id) FROM (SELECT * FROM limited ORDER BY created_at DESC,id LIMIT 100) x),'[]'),'truncated',(SELECT count(*)>100 FROM limited)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app.personal_calendar(text,date,date),app.personal_history(text,date,date) FROM PUBLIC,sim_guru_auth,sim_guru_worker;
GRANT EXECUTE ON FUNCTION app.personal_calendar(text,date,date),app.personal_history(text,date,date) TO sim_guru_business;
RESET ROLE;
