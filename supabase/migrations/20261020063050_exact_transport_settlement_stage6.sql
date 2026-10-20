-- Exact monthly boundary: 1000/3 + .02/3 =333.34. Keep applied migration intact.
SET LOCAL ROLE sim_guru_owner;
CREATE OR REPLACE FUNCTION finance.transport_lines(p_user uuid,p_month date,p_cutoff date) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 WITH rows AS(SELECT d.*,u.km_distance,r.id rate_id,coalesce(CASE WHEN r.enabled THEN r.amount ELSE 0 END,0) rate,
 greatest(0,coalesce(extract(epoch FROM(d.actual_time_out-d.actual_time_in))*1000000,0)-coalesce((SELECT sum(greatest(0,extract(epoch FROM(least(l.return_time,d.actual_time_out)-greatest(l.leave_time,d.actual_time_in)))*1000000)) FROM app.attendance_leaves l WHERE l.attendance_id=d.id AND l.deleted_at IS NULL AND d.actual_time_out IS NOT NULL),0)) effective_microseconds,
 EXISTS(SELECT 1 FROM finance.transport_blocks b WHERE b.active AND(b.user_id IS NULL OR b.user_id=d.user_id) AND d.date BETWEEN b.date_start AND b.date_end) blocked
 FROM app.daily_attendance d JOIN app.app_users u ON u.id=d.user_id LEFT JOIN app.rate_versions r ON r.kind='transport' AND r.archived_at IS NULL AND d.date BETWEEN r.date_start AND r.date_end WHERE d.user_id=p_user AND d.date>=p_month AND d.date<(p_month+interval '1 month')::date AND d.date<=p_cutoff),
 ratios AS(SELECT *,CASE WHEN sched_time_in IS NOT NULL AND sched_time_out>sched_time_in THEN extract(epoch FROM(sched_time_out-sched_time_in))*1000000 WHEN extra_attendee AND effective_microseconds>0 THEN effective_microseconds ELSE 0 END scheduled_microseconds FROM rows),
 amounts AS(SELECT *,CASE WHEN blocked OR scheduled_microseconds<=0 OR effective_microseconds<=0 OR km_distance<=0 THEN 0 ELSE km_distance*rate*least(1,div(effective_microseconds*'1e40'::numeric,scheduled_microseconds)*'1e-40'::numeric) END raw_amount FROM ratios)
 SELECT coalesce(jsonb_agg(jsonb_build_object('component','TRANSPORT','sourceRef',id,'date',date,'scheduledIn',sched_time_in,'scheduledOut',sched_time_out,'actualIn',actual_time_in,'actualOut',actual_time_out,'extraAttendee',extra_attendee,'version',version::text,'effectiveMinutes',(effective_microseconds/60000000)::text,'scheduledMinutes',(scheduled_microseconds/60000000)::text,'effectiveMicroseconds',effective_microseconds::text,'scheduledMicroseconds',scheduled_microseconds::text,'distance',km_distance::text,'rate',rate::text,'rateId',rate_id,'blocked',blocked,'ratio',CASE WHEN scheduled_microseconds>0 THEN round(least(1,effective_microseconds/scheduled_microseconds),3)::text ELSE '0' END,'raw',raw_amount::text) ORDER BY date,id),'[]') FROM amounts $$;
CREATE FUNCTION finance.transport_settlement(p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE line jsonb;n numeric:=0;d numeric:=1;dn numeric;dd numeric;g numeric;effective numeric;scheduled numeric;raw numeric;BEGIN
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
 effective:=coalesce((line->>'effectiveMicroseconds')::numeric,0);scheduled:=coalesce((line->>'scheduledMicroseconds')::numeric,0);
 IF coalesce((line->>'blocked')::boolean,false) OR scheduled<=0 OR effective<=0 THEN CONTINUE;END IF;
 dn:=(line->>'distance')::numeric*100*(line->>'rate')::numeric*least(effective,scheduled);dd:=100*scheduled;
 IF dn<>trunc(dn) OR dd<>trunc(dd) OR dn<0 THEN RAISE EXCEPTION 'FINANCE_INVALID' USING ERRCODE='22023';END IF;
 n:=n*dd+dn*d;d:=d*dd;g:=gcd(n,d);n:=div(n,g);d:=div(d,g);
 END LOOP;
 -- Aggregate first; flooring onto a 60-decimal grid preserves all two-decimal threshold comparisons.
 raw:=div(n*'1e60'::numeric,d)*'1e-60'::numeric;
 RETURN jsonb_build_object('raw',raw::text,'settled',finance.transport_round(raw)::text,'numerator',n::text,'denominator',d::text);
END $$;
DO $patch$ DECLARE fn regprocedure:='finance.calculate(uuid,date,text)'::regprocedure;b text;BEGIN
 SELECT prosrc INTO b FROM pg_proc WHERE oid=fn;
 IF position('SELECT coalesce(sum((x->>''raw'')::numeric),0) INTO transport_raw FROM jsonb_array_elements(trans) x;' in b)=0 THEN RAISE EXCEPTION 'ENGINE_PATCH_MISMATCH';END IF;
 b:=replace(b,'transport_raw numeric;','transport_raw numeric;transport_fraction jsonb;');
 b:=replace(b,'SELECT coalesce(sum((x->>''raw'')::numeric),0) INTO transport_raw FROM jsonb_array_elements(trans) x;','transport_fraction:=finance.transport_settlement(trans);transport_raw:=(transport_fraction->>''raw'')::numeric;');
 b:=replace(b,'''formulaVersion'',''honor-v1''','''formulaVersion'',''honor-v1.1''');
 b:=replace(b,'''transportRaw'',transport_raw::text','''transportFraction'',transport_fraction,''transportRaw'',transport_raw::text');
 EXECUTE split_part(pg_get_functiondef(fn),'$function$',1)||quote_literal(b);
END $patch$;
ALTER TABLE finance.honor_periods ALTER COLUMN formula_version SET DEFAULT 'honor-v1.1';
REVOKE ALL ON FUNCTION finance.transport_settlement(jsonb) FROM PUBLIC,sim_guru_business,sim_guru_auth,sim_guru_worker;
RESET ROLE;
