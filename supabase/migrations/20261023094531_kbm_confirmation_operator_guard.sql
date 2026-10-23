-- Align the command visibility guard with the existing dated KBM operator permission.
-- All action, ownership, today-only, final-period, CAS and journal guards remain intact.
SET LOCAL ROLE sim_guru_owner;
DO $migration$
DECLARE
  fn regprocedure := 'app.occurrence_command(text,uuid,text,bigint,text)'::regprocedure;
  body text;
  old_guard text := 'IF o.id IS NULL OR(NOT app.actor_is_admin() AND x.effective_user_id<>a) THEN';
  new_guard text := 'IF o.id IS NULL OR(NOT app.actor_is_admin() AND x.effective_user_id<>a AND NOT(o.kind=''KBM'' AND app.is_piket(a,o.date))) THEN';
BEGIN
  SELECT prosrc INTO body FROM pg_proc WHERE oid = fn;
  IF strpos(body, old_guard) = 0 OR
     length(body) - length(replace(body, old_guard, '')) <> length(old_guard) THEN
    RAISE EXCEPTION 'PRIOR_ROUTINE_MISMATCH';
  END IF;
  body := replace(body, old_guard, new_guard);
  EXECUTE split_part(pg_get_functiondef(fn), '$function$', 1) || quote_literal(body);
END
$migration$;

RESET ROLE;
