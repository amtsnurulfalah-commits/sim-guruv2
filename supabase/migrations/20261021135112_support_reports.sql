SET LOCAL ROLE sim_guru_owner;
CREATE TABLE ops.support_events (
 request_id uuid PRIMARY KEY,
 occurred_at timestamptz NOT NULL,
 module text NOT NULL CHECK(module ~ '^[a-z-]{1,40}$'),
 code text NOT NULL CHECK(code ~ '^[A-Z0-9_]{1,80}$'),
 status integer NOT NULL CHECK(status BETWEEN 400 AND 599)
);
CREATE INDEX support_events_time ON ops.support_events(occurred_at);
ALTER TABLE ops.support_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.support_events FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_internal ON ops.support_events TO sim_guru_owner USING(true) WITH CHECK(true);
REVOKE ALL ON ops.support_events FROM PUBLIC,sim_guru_auth,sim_guru_business;
CREATE FUNCTION ops.record_support_event(p_id uuid,p_time timestamptz,p_module text,p_code text,p_status integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 INSERT INTO ops.support_events VALUES(p_id,p_time,p_module,p_code,p_status) ON CONFLICT(request_id) DO NOTHING;
 DELETE FROM ops.support_events WHERE occurred_at < clock_timestamp()-interval '30 days';
END $$;
CREATE FUNCTION ops.find_support_event(p_session text,p_reference uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM app.activity_guard(p_session,false);
 PERFORM auth_private.require_admin();
 RETURN (SELECT jsonb_build_object('requestId',request_id,'occurredAt',occurred_at,'module',module,'code',code,'status',status)
 FROM ops.support_events WHERE request_id=p_reference AND occurred_at >= clock_timestamp()-interval '30 days');
END $$;
REVOKE ALL ON FUNCTION ops.record_support_event(uuid,timestamptz,text,text,integer),ops.find_support_event(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ops.record_support_event(uuid,timestamptz,text,text,integer) TO sim_guru_auth;
GRANT USAGE ON SCHEMA ops TO sim_guru_auth,sim_guru_business;
GRANT EXECUTE ON FUNCTION ops.find_support_event(text,uuid) TO sim_guru_business;

RESET ROLE;
