SET LOCAL ROLE sim_guru_owner;

CREATE TABLE ops.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  event_key text NOT NULL UNIQUE CHECK (length(event_key) BETWEEN 1 AND 300),
  recipient_id uuid NOT NULL REFERENCES app.app_users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('announcement','task','assignment','honor','system')),
  source_type text NOT NULL CHECK (source_type ~ '^[a-z_]{1,50}$'),
  source_id uuid,
  source_version bigint NOT NULL CHECK (source_version > 0),
  route_key text NOT NULL CHECK (route_key IN ('inbox','tasks','journal','attendance','duty','exam','event','honor','dashboard')),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK (expires_at > occurred_at),
  fanout_state text NOT NULL DEFAULT 'pending' CHECK (fanout_state IN ('pending','completed','cancelled')),
  UNIQUE (id, recipient_id)
);
CREATE INDEX notification_events_pending ON ops.notification_events(occurred_at, id) WHERE fanout_state = 'pending';
CREATE INDEX notification_events_recipient ON ops.notification_events(recipient_id);

CREATE TABLE app.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancelled_at timestamptz,
  FOREIGN KEY (event_id, recipient_id) REFERENCES ops.notification_events(id, recipient_id) ON DELETE CASCADE,
  UNIQUE (event_id, recipient_id),
  UNIQUE (id, recipient_id)
);
CREATE INDEX notifications_inbox ON app.notifications(recipient_id, created_at DESC, id DESC);

CREATE TABLE app.push_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app.app_users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  binding_generation bigint NOT NULL DEFAULT 1 CHECK (binding_generation > 0),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  binding_expires_at timestamptz NOT NULL DEFAULT clock_timestamp() + interval '30 days',
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE (id, user_id, environment)
);
CREATE INDEX push_installations_owner ON app.push_installations(user_id, last_seen_at DESC);

CREATE TABLE ops.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  binding_generation bigint NOT NULL CHECK (binding_generation > 0),
  endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[a-f0-9]{64}$'),
  destination_encrypted jsonb NOT NULL CHECK (
    jsonb_typeof(destination_encrypted) = 'object'
    AND destination_encrypted ?& ARRAY['kid','iv','tag','data']
    AND destination_encrypted - ARRAY['kid','iv','tag','data'] = '{}'::jsonb
    AND jsonb_typeof(destination_encrypted->'kid') = 'string'
    AND jsonb_typeof(destination_encrypted->'iv') = 'string'
    AND jsonb_typeof(destination_encrypted->'tag') = 'string'
    AND jsonb_typeof(destination_encrypted->'data') = 'string'
  ),
  encryption_key_id text NOT NULL CHECK (encryption_key_id ~ '^[a-zA-Z0-9_-]{1,50}$'),
  vapid_key_id text NOT NULL CHECK (vapid_key_id ~ '^[a-zA-Z0-9_-]{1,50}$'),
  expiration_time timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (installation_id, user_id, environment)
    REFERENCES app.push_installations(id, user_id, environment) ON DELETE CASCADE,
  UNIQUE (id, user_id, binding_generation),
  CHECK (destination_encrypted->>'kid' = encryption_key_id)
);
CREATE UNIQUE INDEX push_subscription_endpoint_active ON ops.push_subscriptions(environment, endpoint_hash) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX push_subscription_installation_active ON ops.push_subscriptions(installation_id) WHERE revoked_at IS NULL;
CREATE INDEX push_subscription_installation ON ops.push_subscriptions(installation_id, user_id, environment);

CREATE TABLE ops.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('web_push','email')),
  subscription_id uuid,
  binding_generation bigint,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','sending','accepted','retry_wait','failed','unknown','cancelled','expired')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  accepted_at timestamptz,
  last_error_code text CHECK (last_error_code ~ '^[A-Z_]{1,50}$'),
  FOREIGN KEY (notification_id, recipient_id) REFERENCES app.notifications(id, recipient_id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id, recipient_id, binding_generation)
    REFERENCES ops.push_subscriptions(id, user_id, binding_generation) ON DELETE CASCADE,
  CHECK ((channel = 'web_push' AND subscription_id IS NOT NULL AND binding_generation IS NOT NULL)
      OR (channel = 'email' AND subscription_id IS NULL AND binding_generation IS NULL)),
  CHECK ((state = 'sending' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
      OR (state <> 'sending' AND lease_token IS NULL AND lease_until IS NULL)),
  CHECK ((state = 'accepted') = (accepted_at IS NOT NULL)),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX notification_delivery_device ON ops.notification_deliveries(notification_id, subscription_id, channel) WHERE subscription_id IS NOT NULL;
CREATE UNIQUE INDEX notification_delivery_email ON ops.notification_deliveries(notification_id, channel) WHERE subscription_id IS NULL;
CREATE INDEX notification_delivery_ready ON ops.notification_deliveries(next_attempt_at, id) WHERE state IN ('pending','retry_wait');
CREATE INDEX notification_delivery_subscription ON ops.notification_deliveries(subscription_id) WHERE subscription_id IS NOT NULL;

ALTER TABLE app.notification_preferences
  ADD COLUMN push_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_push boolean NOT NULL DEFAULT true,
  ADD COLUMN push_categories text[] NOT NULL DEFAULT ARRAY['announcement','task','assignment','honor','system']
    CHECK (push_categories <@ ARRAY['announcement','task','assignment','honor','system']),
  ADD COLUMN quiet_start time NOT NULL DEFAULT '20:00',
  ADD COLUMN quiet_end time NOT NULL DEFAULT '06:00',
  ADD COLUMN timezone text NOT NULL DEFAULT 'Asia/Jakarta' CHECK (timezone = 'Asia/Jakarta');

-- Keep old receipt rows and the existing ON CONFLICT DO NOTHING behavior.
ALTER TABLE app.notification_receipts ADD COLUMN notification_id uuid;
ALTER TABLE app.notification_receipts DROP CONSTRAINT notification_receipts_pkey;
ALTER TABLE app.notification_receipts ALTER COLUMN outbox_id DROP NOT NULL;
ALTER TABLE app.notification_receipts ADD CONSTRAINT notification_receipt_exactly_one
  CHECK (num_nonnulls(outbox_id, notification_id) = 1);
ALTER TABLE app.notification_receipts ADD CONSTRAINT notification_receipt_owner
  FOREIGN KEY (notification_id, user_id) REFERENCES app.notifications(id, recipient_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX notification_receipt_legacy ON app.notification_receipts(user_id, outbox_id) WHERE outbox_id IS NOT NULL;
CREATE UNIQUE INDEX notification_receipt_current ON app.notification_receipts(user_id, notification_id) WHERE notification_id IS NOT NULL;

DO $security$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['ops.notification_events','app.notifications','app.push_installations','ops.push_subscriptions','ops.notification_deliveries'] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING (true) WITH CHECK (true)', table_name);
    EXECUTE format('REVOKE ALL ON %s FROM PUBLIC,sim_guru_auth,sim_guru_business,sim_guru_worker,sim_guru_bootstrap', table_name);
  END LOOP;
END
$security$;

CREATE FUNCTION app.push_devices_read(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := app.activity_guard(p_session, false);
BEGIN
  RETURN (SELECT coalesce(jsonb_agg(to_jsonb(device) ORDER BY device."lastSeenAt" DESC, device.id), '[]'::jsonb)
    FROM (SELECT i.id, i.label, i.last_seen_at AS "lastSeenAt", i.revoked_at AS "revokedAt", i.version::text
      FROM app.push_installations i WHERE i.user_id = actor
      ORDER BY i.last_seen_at DESC, i.id LIMIT 50) device);
END
$$;

CREATE FUNCTION app.push_preferences_read(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := app.activity_guard(p_session, false);
        pref app.notification_preferences%ROWTYPE;
BEGIN
  SELECT * INTO pref FROM app.notification_preferences WHERE user_id = actor;
  RETURN jsonb_build_object(
    'pushEnabled', coalesce(pref.push_enabled, false),
    'reminderPush', coalesce(pref.reminder_push, true),
    'categories', coalesce(pref.push_categories, ARRAY['announcement','task','assignment','honor','system']),
    'quietStart', to_char(coalesce(pref.quiet_start, time '20:00'), 'HH24:MI'),
    'quietEnd', to_char(coalesce(pref.quiet_end, time '06:00'), 'HH24:MI'),
    'timezone', coalesce(pref.timezone, 'Asia/Jakarta'),
    'version', coalesce(pref.version, 0)::text
  );
END
$$;

CREATE FUNCTION app.notification_inbox_read(p_session text, p_page integer, p_unread boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := app.activity_guard(p_session, false);
BEGIN
  IF p_page IS NULL OR p_page NOT BETWEEN 1 AND 100000 OR p_unread IS NULL THEN
    RAISE EXCEPTION 'ACTIVITY_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('items', (SELECT coalesce(jsonb_agg(to_jsonb(item) ORDER BY item.created_at DESC, item.id DESC), '[]'::jsonb)
    FROM (
      SELECT n.id, n.title, n.body, n.created_at, e.category, e.route_key, r.read_at IS NOT NULL AS read
      FROM app.notifications n JOIN ops.notification_events e ON e.id = n.event_id
      LEFT JOIN app.notification_receipts r ON r.notification_id = n.id AND r.user_id = actor
      WHERE n.recipient_id = actor AND n.cancelled_at IS NULL AND (NOT p_unread OR r.read_at IS NULL)
      ORDER BY n.created_at DESC, n.id DESC LIMIT 20 OFFSET (p_page - 1) * 20
    ) item));
END
$$;

CREATE FUNCTION app.notification_mark_read(p_session text, p_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := app.activity_guard(p_session, true);
BEGIN
  PERFORM 1 FROM app.notifications WHERE id = p_id AND recipient_id = actor AND cancelled_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO app.notification_receipts(user_id, notification_id) VALUES (actor, p_id) ON CONFLICT DO NOTHING;
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION app.push_devices_read(text), app.push_preferences_read(text),
  app.notification_inbox_read(text,integer,boolean), app.notification_mark_read(text,uuid)
  FROM PUBLIC,sim_guru_auth,sim_guru_worker,sim_guru_bootstrap;
GRANT EXECUTE ON FUNCTION app.push_devices_read(text), app.push_preferences_read(text),
  app.notification_inbox_read(text,integer,boolean), app.notification_mark_read(text,uuid)
  TO sim_guru_business;
RESET ROLE;
