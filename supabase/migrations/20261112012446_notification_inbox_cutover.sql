SET LOCAL ROLE sim_guru_owner;

-- Serialize the cutover with the jobs/claim path and legacy inbox writes.
SELECT pg_advisory_xact_lock(734190, 1);
LOCK TABLE ops.domain_outbox, app.notification_receipts IN SHARE ROW EXCLUSIVE MODE;

-- Preserve existing inbox text, including announcements longer than the push payload.
ALTER TABLE app.notifications DROP CONSTRAINT notifications_title_check,
  DROP CONSTRAINT notifications_body_check,
  ADD CHECK (length(title) <= 300),
  ADD CHECK (length(body) <= 8000);

CREATE FUNCTION ops.publish_notification(
  p_key text, p_recipient uuid, p_category text, p_source_type text,
  p_source_id uuid, p_version bigint, p_route text, p_title text, p_body text,
  p_email boolean DEFAULT true, p_assignment uuid DEFAULT NULL,
  p_task_keys text[] DEFAULT NULL, p_email_body text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE event_id uuid; occurred timestamptz := clock_timestamp();
BEGIN
  INSERT INTO ops.notification_events(event_key, recipient_id, category, source_type, source_id,
    source_version, route_key, occurred_at, expires_at)
  SELECT p_key, u.id, p_category, p_source_type, p_source_id,
    p_version, p_route, occurred, occurred + interval '1 day'
  FROM app.app_users u WHERE u.id = p_recipient AND u.status = 'active'
  ON CONFLICT (event_key) DO NOTHING RETURNING id INTO event_id;
  IF event_id IS NULL THEN RETURN false; END IF;

  INSERT INTO app.notifications(id, event_id, recipient_id, title, body, created_at)
  VALUES (event_id, event_id, p_recipient, p_title, p_body, occurred);

  -- The existing SMTP worker owns the only email queue. Global mail disable
  -- continues to pause claims. Recipient preferences are also checked at claim.
  IF p_email THEN
    INSERT INTO ops.domain_outbox(id, dedupe_key, recipient_id, assignment_id, subject, body, task_keys)
    SELECT event_id, p_key, u.id, p_assignment, p_title, coalesce(p_email_body, p_body), p_task_keys
    FROM app.app_users u LEFT JOIN app.notification_preferences p ON p.user_id = u.id
    WHERE u.id = p_recipient AND u.email_verified_at IS NOT NULL
      AND coalesce(p.email_enabled, true)
      AND (p_category <> 'task' OR coalesce(p.reminder_email, true))
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN true;
END
$$;

-- Called with the configured environment only when push fan-out is enabled.
-- The dispatcher owns revalidation, quiet hours and transport.
CREATE FUNCTION ops.fanout_notification_push(p_environment text, p_pilot uuid[], p_limit integer)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE event ops.notification_events%ROWTYPE; processed integer := 0; at_time timestamptz;
BEGIN
  IF p_environment IS NULL OR p_environment NOT IN ('development','staging','production')
    OR cardinality(p_pilot) IS NULL OR cardinality(p_pilot) = 0
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_PUSH_FANOUT' USING ERRCODE = '22023';
  END IF;
  FOR event IN
    SELECT e.* FROM ops.notification_events e
    WHERE e.fanout_state = 'pending' AND (e.recipient_id = ANY(p_pilot) OR e.expires_at <= now())
    ORDER BY e.occurred_at, e.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    at_time := clock_timestamp();
    IF event.expires_at > at_time THEN
      INSERT INTO ops.notification_deliveries(notification_id, recipient_id, channel,
        subscription_id, binding_generation, expires_at, created_at, next_attempt_at)
      SELECT n.id, n.recipient_id, 'web_push', s.id, s.binding_generation,
        event.expires_at, at_time, at_time
      FROM app.notifications n
      JOIN app.app_users u ON u.id = n.recipient_id AND u.status = 'active'
      JOIN app.notification_preferences p ON p.user_id = u.id
      JOIN app.push_installations i ON i.user_id = u.id AND i.environment = p_environment
      JOIN ops.push_subscriptions s ON s.installation_id = i.id AND s.user_id = i.user_id
        AND s.environment = i.environment AND s.binding_generation = i.binding_generation
      WHERE n.event_id = event.id AND n.cancelled_at IS NULL
        AND p.push_enabled AND event.category = ANY(p.push_categories)
        AND (event.category <> 'task' OR p.reminder_push)
        AND (event.category <> 'announcement' OR EXISTS (
          SELECT 1 FROM app.announcements a WHERE a.id = event.source_id
            AND a.version = event.source_version AND app.announcement_visible(a, u.id)
        ))
        AND i.revoked_at IS NULL AND i.binding_expires_at > at_time
        AND s.revoked_at IS NULL AND (s.expiration_time IS NULL OR s.expiration_time > at_time)
      ON CONFLICT DO NOTHING;
    END IF;
    UPDATE ops.notification_events SET fanout_state =
      CASE WHEN event.expires_at > at_time THEN 'completed' ELSE 'cancelled' END
    WHERE id = event.id;
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END
$$;

-- Original UUID is both the migration cursor identity and the inbox ID. Imported
-- events are complete at insertion, and no transport tables are written here.
CREATE FUNCTION ops.import_legacy_notification(old ops.domain_outbox)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE category text; route text; announcement_id uuid; announcement_version bigint;
BEGIN
  category := CASE
    WHEN old.dedupe_key LIKE 'announcement:%' THEN 'announcement'
    WHEN old.dedupe_key LIKE 'honor-%' THEN 'honor'
    WHEN old.task_keys IS NOT NULL THEN 'task'
    WHEN split_part(old.dedupe_key, ':', 1) IN
      ('activity_assignments','activity_confirmations','assignment-cancel','exam_supervisor_assignments',
       'exam_committee_assignments','event_attendance','holiday_entitlements') THEN 'assignment'
    ELSE 'system' END;
  route := CASE category WHEN 'honor' THEN 'honor' WHEN 'task' THEN 'tasks' ELSE 'dashboard' END;
  IF category = 'announcement' THEN
    announcement_id := split_part(old.dedupe_key, ':', 2)::uuid;
    announcement_version := split_part(old.dedupe_key, ':', 3)::bigint;
  END IF;
  INSERT INTO ops.notification_events(id, event_key, recipient_id, category, source_type,
    source_id, source_version, route_key, occurred_at, expires_at, fanout_state)
  VALUES (old.id, old.dedupe_key, old.recipient_id, category, 'legacy_email',
    coalesce(announcement_id, old.assignment_id), coalesce(announcement_version, 1),
    route, old.created_at, old.created_at + interval '1 day', 'completed')
  ON CONFLICT (event_key) DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO app.notifications(id, event_id, recipient_id, title, body, created_at)
  VALUES (old.id, old.id, old.recipient_id, old.subject, old.body, old.created_at);
  UPDATE app.notification_receipts SET notification_id = old.id, outbox_id = NULL
  WHERE outbox_id = old.id AND user_id = old.recipient_id;
END
$$;

CREATE FUNCTION ops.backfill_notification_inbox(p_limit integer)
RETURNS integer LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE old ops.domain_outbox%ROWTYPE; processed integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_INBOX_BATCH' USING ERRCODE = '22023';
  END IF;
  FOR old IN SELECT o.* FROM ops.domain_outbox o
    WHERE NOT EXISTS (SELECT 1 FROM ops.notification_events e WHERE e.event_key = o.dedupe_key)
    ORDER BY o.created_at, o.id LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM ops.import_legacy_notification(old);
    processed := processed + 1;
  END LOOP;
  RETURN processed;
END
$$;

-- Bootstrap in bounded batches under the cutover lock. Abort the transaction
-- if any row or receipt could not be migrated.
DO $cutover$
BEGIN
  WHILE ops.backfill_notification_inbox(250) > 0 LOOP
    NULL;
  END LOOP;
  IF EXISTS (SELECT 1 FROM ops.domain_outbox o
    WHERE NOT EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = o.id AND n.recipient_id = o.recipient_id))
    OR EXISTS (SELECT 1 FROM app.notification_receipts WHERE outbox_id IS NOT NULL) THEN
    RAISE EXCEPTION 'INBOX_CUTOVER_MISMATCH';
  END IF;
END
$cutover$;

-- A request already waiting on the cutover lock can finish an old function body.
-- New SMTP bridge rows already have an event and are ignored by the import.
CREATE FUNCTION ops.import_late_legacy_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ops.notification_events e WHERE e.event_key = NEW.dedupe_key) THEN
    PERFORM ops.import_legacy_notification(NEW);
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER inbox_legacy_outbox_insert AFTER INSERT ON ops.domain_outbox
FOR EACH ROW EXECUTE FUNCTION ops.import_late_legacy_notification();

CREATE FUNCTION ops.map_late_legacy_receipt() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM app.notifications n WHERE n.id = NEW.outbox_id AND n.recipient_id = NEW.user_id) THEN
    NEW.notification_id := NEW.outbox_id;
    NEW.outbox_id := NULL;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER inbox_legacy_receipt_insert BEFORE INSERT ON app.notification_receipts
FOR EACH ROW WHEN (NEW.outbox_id IS NOT NULL) EXECUTE FUNCTION ops.map_late_legacy_receipt();

CREATE OR REPLACE FUNCTION ops.activity_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE recipient uuid; title text; revision text; assignment_id uuid; version_no bigint := 1;
BEGIN
  IF TG_TABLE_NAME = 'activity_assignments' THEN
    assignment_id := NEW.id;
    recipient := NEW.effective_user_id;
    title := 'Penugasan kegiatan';
    version_no := NEW.version;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.effective_user_id IS NOT DISTINCT FROM recipient THEN RETURN NEW; END IF;
      PERFORM ops.publish_notification('assignment-cancel:' || NEW.id || ':' || version_no,
        OLD.effective_user_id, 'assignment', TG_TABLE_NAME, NEW.id, version_no, 'dashboard',
        'Perubahan penugasan', 'Penugasan Anda telah dialihkan. Periksa rincian pada SIM GURU.');
    END IF;
  ELSIF TG_TABLE_NAME = 'activity_confirmations' THEN
    assignment_id := NEW.assignment_id;
    SELECT a.effective_user_id INTO recipient FROM app.activity_assignments a WHERE a.id = assignment_id;
    revision := CASE WHEN NEW.revoked_at IS NULL THEN 'confirm' ELSE 'revoke' END;
    title := CASE revision WHEN 'confirm' THEN 'Konfirmasi kegiatan' ELSE 'Pencabutan konfirmasi kegiatan' END;
    IF revision = 'revoke' THEN version_no := 2; END IF;
  ELSIF TG_TABLE_NAME IN ('exam_supervisor_assignments','exam_committee_assignments') THEN
    recipient := NEW.user_id;
    title := 'Penugasan ujian';
    version_no := NEW.version;
  ELSIF TG_TABLE_NAME = 'event_attendance' THEN
    recipient := NEW.user_id;
    title := 'Kehadiran acara';
    version_no := NEW.version;
  ELSIF TG_TABLE_NAME = 'holiday_entitlements' THEN
    IF NEW.state <> 'posted' THEN RETURN NEW; END IF;
    recipient := NEW.user_id;
    title := 'Bonus hari libur';
    version_no := NEW.version;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM ops.publish_notification(TG_TABLE_NAME || ':' || NEW.id || ':' || coalesce(revision, version_no::text),
    recipient, 'assignment', TG_TABLE_NAME, NEW.id, version_no, 'dashboard', title,
    title || ' telah diperbarui. Buka SIM GURU untuk rincian dan status terbaru.', true, assignment_id);
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION ops.reminders() RETURNS integer
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE published integer;
BEGIN
  PERFORM app.ensure_occurrences(app.activity_today());
  SELECT count(*) FILTER (WHERE ops.publish_notification(
    'task-digest:' || digest.user_id || ':' || app.activity_today(), digest.user_id, 'task', 'task_digest',
    NULL, 1, 'tasks', 'Pengingat tugas hari ini',
    'Ada ' || digest.task_count || ' tugas yang dapat ditindaklanjuti. Buka Pusat tugas untuk memeriksa sumber dan batas waktunya.',
    true, NULL, digest.task_keys)) INTO published
  FROM (
    SELECT u.id AS user_id, count(*) AS task_count, array_agg(t.id ORDER BY t.id) AS task_keys
    FROM app.app_users u CROSS JOIN LATERAL app.task_items(u.id) t
    WHERE u.status = 'active' AND NOT t.blocked AND t.deadline > clock_timestamp()
      AND t.deadline <= ((app.activity_today() + 2)::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND (t.kind <> 'journal' OR EXISTS (SELECT 1 FROM app.activity_occurrences o
        WHERE o.id::text = t.source_id AND app.exam_now() >= o.date + o.time_end + interval '5 minutes'))
      AND (t.kind <> 'event' OR EXISTS (SELECT 1 FROM app.event_attendance a JOIN app.event_definitions e ON e.id = a.event_id
        WHERE a.id::text = t.source_id AND app.exam_now() >= a.date + e.time_end))
    GROUP BY u.id
  ) digest;
  RETURN published;
END
$$;

CREATE OR REPLACE FUNCTION ops.enqueue_announcements() RETURNS integer
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE published integer;
BEGIN
  SELECT count(*) FILTER (WHERE ops.publish_notification(
    'announcement:' || a.id || ':' || a.version || ':' || u.id || ':' ||
      CASE WHEN a.date_end - app.activity_today() = ANY(a.reminder_offsets)
        THEN (a.date_end - app.activity_today())::text ELSE 'initial' END,
    u.id, 'announcement', 'announcement', a.id, a.version, 'dashboard',
    a.title, a.body, a.send_email, NULL, NULL,
    a.body || CASE WHEN a.cta_url IS NULL THEN '' ELSE E'\n\n' || a.cta_text || ': ' || a.cta_url END))
  INTO published
  FROM (
    SELECT * FROM app.announcements
    WHERE active AND (date_start IS NULL OR date_start <= app.activity_today())
      AND (date_end IS NULL OR date_end >= app.activity_today())
    ORDER BY id FOR SHARE
  ) a CROSS JOIN app.app_users u
  WHERE u.status = 'active' AND app.announcement_visible(a, u.id);
  RETURN published;
END
$$;

CREATE FUNCTION ops.publish_honor_notice(p_notice finance.notification_outbox) RETURNS boolean
LANGUAGE sql SET search_path = pg_catalog AS $$
  SELECT ops.publish_notification(p_notice.dedupe_key, p_notice.recipient_id,
    'honor', 'honor_statement', p_notice.statement_id, 1, 'honor',
    'Slip honorarium tersedia',
    'Slip honorarium atau koreksi telah tersedia. Buka menu Honorarium pada SIM GURU.')
$$;

CREATE FUNCTION ops.honor_notification() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  PERFORM ops.publish_honor_notice(NEW);
  RETURN NEW;
END
$$;
CREATE TRIGGER notification_honor_insert AFTER INSERT ON finance.notification_outbox
FOR EACH ROW WHEN (NEW.state = 'pending') EXECUTE FUNCTION ops.honor_notification();

CREATE OR REPLACE FUNCTION ops.run_jobs() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE announcements integer := 0; honor integer;
BEGIN
  PERFORM pg_advisory_xact_lock(734190, 1);
  IF auth_private.maintenance_enabled() OR NOT coalesce((
    SELECT (typed_value->>'jobsEnabled')::boolean FROM app.system_settings WHERE key = 'operations.config'
  ), false) THEN RETURN jsonb_build_object('paused', true); END IF;
  PERFORM ops.scheduled_finance();
  PERFORM ops.reminders();
  IF (clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::time >= '08:00' THEN
    announcements := ops.enqueue_announcements();
  END IF;
  -- Retain processing of finance notices that had yet to reach the SMTP queue at cutover.
  SELECT count(*) FILTER (WHERE ops.publish_honor_notice(f)) INTO honor
  FROM finance.notification_outbox f WHERE f.state = 'pending'
    AND NOT EXISTS (SELECT 1 FROM ops.notification_events e WHERE e.event_key = f.dedupe_key);
  INSERT INTO ops.job_runs(business_key, kind, state, attempts, result, completed_at)
  VALUES ('notifications:' || app.activity_today(), 'notifications', 'completed', 1,
    jsonb_build_object('announcements', announcements, 'honor', honor), clock_timestamp())
  ON CONFLICT (business_key) DO UPDATE SET attempts = ops.job_runs.attempts + 1,
    result = excluded.result, completed_at = excluded.completed_at;
  RETURN jsonb_build_object('announcements', announcements, 'honor', honor);
END
$$;

-- Keep the route/RPC contract stable across the deploy. Inbox state is read_at.
CREATE OR REPLACE FUNCTION app.notifications_read(p_session text, p_page integer, p_unread boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := app.activity_guard(p_session, false); pref app.notification_preferences%ROWTYPE;
BEGIN
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR p_unread IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO pref FROM app.notification_preferences WHERE user_id = actor;
  RETURN (
    WITH counts AS (
      SELECT count(*) AS all_count, count(*) FILTER (WHERE r.read_at IS NULL) AS unread_count
      FROM app.notifications n LEFT JOIN app.notification_receipts r
        ON r.notification_id = n.id AND r.user_id = actor
      WHERE n.recipient_id = actor AND n.cancelled_at IS NULL
    ), page AS (
      SELECT n.id, n.title, n.body, n.created_at, r.read_at IS NOT NULL AS read,
        e.category, e.route_key,
        e.category = 'announcement' AND NOT EXISTS (
          SELECT 1 FROM app.announcements a WHERE a.id = e.source_id
            AND a.version = e.source_version AND app.announcement_visible(a, actor)
        ) AS source_unavailable
      FROM app.notifications n JOIN ops.notification_events e ON e.id = n.event_id
      LEFT JOIN app.notification_receipts r ON r.notification_id = n.id AND r.user_id = actor
      WHERE n.recipient_id = actor AND n.cancelled_at IS NULL AND (NOT p_unread OR r.read_at IS NULL)
      ORDER BY n.created_at DESC, n.id DESC LIMIT 20 OFFSET (p_page - 1) * 20
    ), items AS (
      SELECT id,
        CASE WHEN source_unavailable THEN 'Pengumuman' ELSE title END AS subject,
        CASE WHEN source_unavailable THEN 'Pengumuman ini sudah tidak tersedia.' ELSE body END AS body,
        created_at, read, category, route_key,
        CASE route_key WHEN 'tasks' THEN '/tugas' WHEN 'honor' THEN '/honorarium' ELSE '/dashboard' END AS href
      FROM page
    )
    SELECT jsonb_build_object(
      'preferences', jsonb_build_object('emailEnabled', coalesce(pref.email_enabled, true),
        'reminderEmail', coalesce(pref.reminder_email, true), 'version', coalesce(pref.version, 0)::text),
      'total', CASE WHEN p_unread THEN counts.unread_count ELSE counts.all_count END,
      'unread', counts.unread_count,
      'items', coalesce((SELECT jsonb_agg(to_jsonb(items) ORDER BY created_at DESC, id DESC) FROM items), '[]'::jsonb)
    ) FROM counts
  );
END
$$;

CREATE OR REPLACE FUNCTION app.notification_inbox_read(p_session text, p_page integer, p_unread boolean)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT app.notifications_read(p_session, p_page, p_unread)
$$;

CREATE OR REPLACE FUNCTION app.notification_command(p_session text,p_kind text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
 DECLARE actor uuid; old app.notification_preferences%ROWTYPE; BEGIN
 actor:=app.activity_guard(p_session,true);
 IF p_kind='notification-read' THEN
 RETURN jsonb_build_object('read',app.notification_mark_read(p_session,(p_data->>'id')::uuid));
 ELSIF p_kind='notification-preferences' THEN
 SELECT * INTO old FROM app.notification_preferences WHERE user_id=actor FOR UPDATE;
 IF coalesce(old.version,0) IS DISTINCT FROM (p_data->>'version')::bigint THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
 INSERT INTO app.notification_preferences(user_id,email_enabled,reminder_email) VALUES(actor,(p_data->>'emailEnabled')::boolean,(p_data->>'reminderEmail')::boolean)
 ON CONFLICT(user_id) DO UPDATE SET email_enabled=excluded.email_enabled,reminder_email=excluded.reminder_email,version=app.notification_preferences.version+1;
 RETURN jsonb_build_object('saved',true);
 ELSE RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE='22023';END IF;
 END $$;

REVOKE ALL ON FUNCTION ops.publish_notification(text,uuid,text,text,uuid,bigint,text,text,text,boolean,uuid,text[],text),
  ops.fanout_notification_push(text,uuid[],integer), ops.backfill_notification_inbox(integer),
  ops.publish_honor_notice(finance.notification_outbox), ops.honor_notification(),
  ops.import_legacy_notification(ops.domain_outbox), ops.import_late_legacy_notification(), ops.map_late_legacy_receipt()
  FROM PUBLIC, sim_guru_auth, sim_guru_business, sim_guru_worker, sim_guru_bootstrap;
RESET ROLE;
