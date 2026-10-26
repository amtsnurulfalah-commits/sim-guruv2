SET LOCAL ROLE sim_guru_owner;
-- Evaluate the session-bound admin decision once per RPC, not for every history row.
-- lifecycle_self, resolve_actor, account/session locks and row-specific duty/committee checks stay intact.
DO $patch$
DECLARE fn regprocedure := 'app.activity_read(text,text,jsonb)'::regprocedure; body text; definition text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=fn;
 IF md5(body) <> '2f61143c2f5217c557670c801f354023' THEN RAISE EXCEPTION 'PRO2_PRIOR_ROUTINE_MISMATCH'; END IF;
 -- Keep DTO work after the bounded page, including deep offsets.
 IF position($prior$ SELECT coalesce(jsonb_agg(v ORDER BY v->>'date' DESC,v->>'id'),'[]') INTO items FROM(SELECT app.attendance_dto(x.id) v FROM app.daily_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a OR app.is_piket(a,x.date) OR app.committee_target(a,x.user_id,x.date)) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') ORDER BY x.date DESC,x.id LIMIT size OFFSET(page-1)*size) q;$prior$ in body)=0 THEN RAISE EXCEPTION 'PRO2_PAGE_QUERY_MISMATCH'; END IF;
 body := replace(body,$prior$ SELECT coalesce(jsonb_agg(v ORDER BY v->>'date' DESC,v->>'id'),'[]') INTO items FROM(SELECT app.attendance_dto(x.id) v FROM app.daily_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a OR app.is_piket(a,x.date) OR app.committee_target(a,x.user_id,x.date)) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') ORDER BY x.date DESC,x.id LIMIT size OFFSET(page-1)*size) q;$prior$,$bounded$ WITH page_ids AS MATERIALIZED (SELECT x.id,x.date FROM app.daily_attendance x WHERE x.date BETWEEN f AND e AND(app.actor_is_admin() OR x.user_id=a OR app.is_piket(a,x.date) OR app.committee_target(a,x.user_id,x.date)) AND(coalesce(p_filter->>'userId','')='' OR x.user_id::text=p_filter->>'userId') ORDER BY x.date DESC,x.id LIMIT size OFFSET(page-1)*size) SELECT coalesce(jsonb_agg(app.attendance_dto(id) ORDER BY date DESC,id),'[]') INTO items FROM page_ids;$bounded$);
 body := replace(body,'DECLARE a uuid;','DECLARE v_admin boolean; a uuid;');
 body := replace(body,'app.actor_is_admin()','v_admin');
 body := replace(body,'a:=app.activity_guard(p_session,false);','a:=app.activity_guard(p_session,false); v_admin:=app.actor_is_admin();');
 EXECUTE split_part(definition,'$function$',1)||quote_literal(body);
END $patch$;
RESET ROLE;
