-- Read optional state through JSON: duty_schedules has active, not state.
-- Preserve the existing affected-date range and FINAL_PERIOD locking rules.
SET LOCAL ROLE sim_guru_owner;
CREATE OR REPLACE FUNCTION finance.final_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE lo date;hi date;d date;BEGIN
 PERFORM pg_advisory_xact_lock(734190,1);
 IF TG_TABLE_NAME IN('academic_calendar','day_context_overrides') THEN lo:=NEW.date;hi:=NEW.date;
 ELSIF TG_TABLE_NAME='teaching_schedules' OR TG_TABLE_NAME='duty_schedules' THEN lo:=NEW.valid_from;hi:=NEW.valid_to;IF TG_OP='UPDATE' THEN
 IF (to_jsonb(NEW)-ARRAY['valid_to','state','version','archived_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['valid_to','state','version','archived_at']) AND NEW.valid_to<>OLD.valid_to AND (to_jsonb(NEW)->>'state') IS DISTINCT FROM 'archived' THEN lo:=least(NEW.valid_to,OLD.valid_to)+1;hi:=greatest(NEW.valid_to,OLD.valid_to);
 ELSE lo:=least(lo,OLD.valid_from);hi:=greatest(hi,OLD.valid_to);END IF;END IF;
 ELSIF TG_TABLE_NAME='jtm_ledger' THEN lo:=NEW.date;hi:=NEW.date;
 ELSE lo:=NEW.date_start;hi:=NEW.date_end;END IF;
 FOR d IN SELECT period_start FROM finance.period_guards WHERE finalized_at IS NOT NULL AND period_start<=hi AND(period_start+interval '1 month')::date>lo ORDER BY period_start LOOP RAISE EXCEPTION 'FINAL_PERIOD' USING ERRCODE='42501';END LOOP;RETURN NEW;END $$;
RESET ROLE;
