-- Keep weekly source schedules and dated effective assignments consistent.
-- Existing entrypoints retain their actor checks, global write lock, CAS,
-- preview binding, FINAL_PERIOD guards, audit trail, and least-privilege grants.
SET LOCAL ROLE sim_guru_owner;

DO $migration$
DECLARE
  fn regprocedure := 'app.stage4_duty_candidate(uuid,uuid)'::regprocedure;
  body text;
  needle text := $old$ IF o.kind='PIKET' THEN IF EXISTS(SELECT 1 FROM app.activity_occurrences q JOIN app.activity_assignments a ON a.occurrence_id=q.id WHERE q.id<>o.id AND q.date=o.date AND q.kind='PIKET' AND a.effective_user_id=p_user) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;RETURN;END IF;$old$;
  replacement text := $new$
 IF o.kind='PIKET' THEN
   IF EXISTS (
     SELECT 1 FROM app.activity_occurrences q
     JOIN app.activity_assignments a ON a.occurrence_id=q.id
     WHERE q.id<>o.id AND q.date=o.date AND q.kind='PIKET'
       AND q.removed_at IS NULL AND a.effective_user_id=p_user
   ) OR EXISTS (
     SELECT 1 FROM app.duty_schedules d
     WHERE d.kind='PIKET' AND d.active AND d.user_id=p_user
       AND d.id IS DISTINCT FROM o.duty_schedule_id
       AND d.academic_period_id=o.academic_period_id
       AND o.date BETWEEN d.valid_from AND d.valid_to
       AND d.day_index=extract(dow FROM o.date)
       AND NOT EXISTS (
         SELECT 1 FROM app.activity_occurrences q
         JOIN app.activity_assignments a ON a.occurrence_id=q.id
         WHERE q.duty_schedule_id=d.id AND q.date=o.date
           AND q.removed_at IS NULL AND a.effective_user_id<>p_user
       )
   ) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;
   RETURN;
 END IF;$new$;
BEGIN
  SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
  IF length(body)-length(replace(body,needle,''))<>length(needle) THEN
    RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
  END IF;
  body:=replace(body,needle,replacement);
  EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);
END
$migration$;

DO $migration$
DECLARE
  fn regprocedure := 'app.duty_schedule_save(text,uuid,jsonb)'::regprocedure;
  body text;
  overlap text := 'q.valid_from<=n.valid_to AND q.valid_to>=n.valid_from)';
  anchor text := ' IF EXISTS(SELECT 1 FROM app.activity_occurrences o WHERE o.duty_schedule_id=p_id';
  guard text := $new$
 IF n.kind='PIKET' AND n.active AND EXISTS (
   SELECT 1 FROM app.activity_occurrences o
   JOIN app.activity_assignments a ON a.occurrence_id=o.id
   WHERE o.kind='PIKET' AND o.removed_at IS NULL
     AND o.duty_schedule_id IS DISTINCT FROM n.id
     AND a.effective_user_id=n.user_id
     AND o.date BETWEEN n.valid_from AND n.valid_to
     AND extract(dow FROM o.date)=n.day_index
 ) THEN RAISE EXCEPTION 'DUTY_COLLISION' USING ERRCODE='23505';END IF;
$new$;
BEGIN
  SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
  IF length(body)-length(replace(body,overlap,''))<>length(overlap)
     OR length(body)-length(replace(body,anchor,''))<>length(anchor) THEN
    RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
  END IF;
  body:=replace(body,overlap,
    'q.valid_from<=n.valid_to AND q.valid_to>=n.valid_from AND app.schedule_weekday_exists(greatest(q.valid_from,n.valid_from),least(q.valid_to,n.valid_to),n.day_index))');
  body:=replace(body,anchor,guard||anchor);
  EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);
END
$migration$;

-- A current-day snapshot is historical assignment evidence, not a projection.
-- A future source may still be moved to today by the existing validated API.
DO $migration$
DECLARE
  fn regprocedure := 'app.exam_sync()'::regprocedure;
  body text;
  needle text := 'ELSIF prev.removed_at IS NULL AND q.date>=app.activity_today() AND';
BEGIN
  SELECT prosrc INTO body FROM pg_proc WHERE oid=fn;
  IF length(body)-length(replace(body,needle,''))<>length(needle) THEN
    RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
  END IF;
  body:=replace(body,needle,
    'ELSIF prev.removed_at IS NULL AND prev.date>app.activity_today() AND q.date>=app.activity_today() AND');
  EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(body);
END
$migration$;

RESET ROLE;
