SET LOCAL ROLE sim_guru_owner;
CREATE INDEX users_admin_status_role ON app.app_users(status,role,lower(username),id);
-- Existing local identity and FORCE RLS remain authoritative. No table grants are added.
CREATE FUNCTION auth_private.users_admin_guard(p_session text,p_write boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; BEGIN
 IF p_write THEN PERFORM pg_advisory_xact_lock(734190,1); END IF;
 a:=auth_private.lifecycle_self(p_session);
 PERFORM auth_private.require_admin();
 RETURN a;
END $$;
CREATE FUNCTION auth_private.users_admin_context(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM auth_private.users_admin_guard(p_session,true);
 RETURN auth_private.lifecycle_context(p_session);
END $$;
CREATE FUNCTION auth_private.users_dto(p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',u.id,'username',u.username,'fullName',u.full_name,'nip',coalesce(u.nip,''),'role',u.role,'status',u.status,
 'email',coalesce(u.contact_email,(SELECT c.target_email FROM auth_private.verification_challenges c WHERE c.user_id=u.id AND c.purpose='activation' AND c.consumed_at IS NULL AND c.superseded_at IS NULL ORDER BY c.created_at DESC LIMIT 1),''),
 'emailVerified',u.email_verified_at IS NOT NULL,'phone',coalesce(u.phone,''),'address',coalesce(u.address,''),'photoUrl',coalesce(u.photo_path,''),'employmentStatus',coalesce(u.employment_status,''),'rank',coalesce(u.rank,''),'kmDistance',u.km_distance::text,'additionalRole',coalesce(u.additional_role,''),'version',u.version::text,'createdAt',u.created_at,
 'mustChangePassword',u.must_change_password,'securityQuestionReady',EXISTS(SELECT 1 FROM auth_private.security_questions q WHERE q.user_id=u.id),'temporaryExpiresAt',c.temporary_expires_at)
 FROM app.app_users u LEFT JOIN auth_private.user_credentials c ON c.user_id=u.id WHERE u.id=p_user $$;
CREATE FUNCTION auth_private.users_list(p_session text,p_q text,p_role text,p_status text,p_page integer,p_size integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE result jsonb; BEGIN
 PERFORM auth_private.users_admin_guard(p_session,false);
 IF p_q IS NULL OR p_page IS NULL OR p_size IS NULL OR p_role IS NULL OR p_status IS NULL OR length(p_q)>100 OR p_page NOT BETWEEN 1 AND 100000 OR p_size NOT BETWEEN 1 AND 100 OR p_role NOT IN ('','admin','guru') OR p_status NOT IN ('','pending_activation','active','disabled','archived') THEN RAISE EXCEPTION 'INVALID_FILTER' USING ERRCODE='22023'; END IF;
 WITH filtered AS (SELECT u.id,lower(u.username) AS ordering FROM app.app_users u WHERE (p_q='' OR position(lower(p_q) in lower(u.username||' '||u.full_name||' '||coalesce(u.nip,'')))>0) AND (p_role='' OR u.role=p_role) AND (p_status='' OR u.status=p_status)), paged AS(SELECT * FROM filtered ORDER BY ordering,id LIMIT p_size OFFSET (p_page-1)*p_size)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(auth_private.users_dto(id) ORDER BY ordering,id) FROM paged),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',p_page,'pageSize',p_size) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION auth_private.users_detail(p_session text,p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE result jsonb; BEGIN
 PERFORM auth_private.users_admin_guard(p_session,false);
 result:=auth_private.users_dto(p_user);
 IF result IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION auth_private.users_save(p_session text,p_user uuid,p_version bigint,p_data jsonb,p_temporary_hash text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid; target app.app_users%ROWTYPE; result_id uuid; old_role text; BEGIN
 a:=auth_private.users_admin_guard(p_session,true);
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 IF p_user IS NOT NULL THEN
  SELECT * INTO target FROM app.app_users WHERE id=p_user FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
  IF target.status='archived' THEN RAISE EXCEPTION 'ARCHIVED_READ_ONLY' USING ERRCODE='42501'; END IF;
  IF target.email_verified_at IS NOT NULL AND lower(coalesce(p_data->>'email','')) IS DISTINCT FROM lower(target.contact_email) THEN RAISE EXCEPTION 'VERIFIED_EMAIL_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF target.role='admin' AND target.status='active' AND p_data->>'role'<>'admin' AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE role='admin' AND status='active' AND id<>target.id AND auth_private.onboarding_ready(id)) THEN RAISE EXCEPTION 'LAST_ACTIVE_ADMIN' USING ERRCODE='42501'; END IF;
  old_role:=target.role;
  UPDATE app.app_users SET username=p_data->>'username',full_name=p_data->>'fullName',nip=nullif(p_data->>'nip',''),role=p_data->>'role',contact_email=nullif(p_data->>'email',''),phone=nullif(p_data->>'phone',''),address=nullif(p_data->>'address',''),photo_path=nullif(p_data->>'photoUrl',''),employment_status=nullif(p_data->>'employmentStatus',''),rank=nullif(p_data->>'rank',''),km_distance=(p_data->>'kmDistance')::numeric,additional_role=nullif(p_data->>'additionalRole',''),version=version+1,auth_version=auth_version+1,updated_at=clock_timestamp() WHERE id=target.id;
  PERFORM auth_private.invalidate_account_security(target.id);
  result_id:=target.id;
 ELSE
  IF p_temporary_hash IS NOT NULL AND (coalesce(p_data->>'method','') NOT IN ('tatap_muka','dokumen_dan_panggilan') OR coalesce(length(btrim(p_data->>'evidence')),0) NOT BETWEEN 5 AND 300) THEN RAISE EXCEPTION 'IDENTITY_EVIDENCE_REQUIRED' USING ERRCODE='22023'; END IF;
  INSERT INTO app.app_users(username,full_name,nip,role,status,contact_email,phone,address,photo_path,employment_status,rank,km_distance,additional_role)
  VALUES(p_data->>'username',p_data->>'fullName',nullif(p_data->>'nip',''),p_data->>'role',CASE WHEN p_temporary_hash IS NULL THEN 'pending_activation' ELSE 'active' END,nullif(p_data->>'email',''),nullif(p_data->>'phone',''),nullif(p_data->>'address',''),nullif(p_data->>'photoUrl',''),nullif(p_data->>'employmentStatus',''),nullif(p_data->>'rank',''),(p_data->>'kmDistance')::numeric,nullif(p_data->>'additionalRole','')) RETURNING id INTO result_id;
  IF p_temporary_hash IS NOT NULL THEN INSERT INTO auth_private.user_credentials(user_id,password_hash,temporary_expires_at) VALUES(result_id,p_temporary_hash,clock_timestamp()+interval '24 hours'); END IF;
 END IF;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,CASE WHEN p_user IS NULL THEN 'users.created' ELSE 'users.updated' END,result_id,p_reason,jsonb_build_object('oldRole',old_role,'role',p_data->>'role','handoverMethod',p_data->>'method','evidenceReference',p_data->>'evidence'));
 RETURN auth_private.users_dto(result_id);
END $$;
CREATE FUNCTION auth_private.users_status(p_session text,p_user uuid,p_version bigint,p_status text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; target app.app_users%ROWTYPE; BEGIN
 a:=auth_private.users_admin_guard(p_session,true);
 SELECT * INTO target FROM app.app_users WHERE id=p_user FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 IF target.status='archived' OR p_status NOT IN ('active','disabled','archived') OR p_status IS NULL OR (target.status='pending_activation' AND p_status<>'archived') OR target.status=p_status THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE='22023'; END IF;
 IF target.role='admin' AND target.status='active' AND p_status<>'active' AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE role='admin' AND status='active' AND id<>target.id AND auth_private.onboarding_ready(id)) THEN RAISE EXCEPTION 'LAST_ACTIVE_ADMIN' USING ERRCODE='42501'; END IF;
 UPDATE app.app_users SET status=p_status,version=version+1,auth_version=auth_version+1,updated_at=clock_timestamp() WHERE id=target.id;
 PERFORM auth_private.invalidate_account_security(target.id);
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,'users.status_changed',target.id,p_reason,jsonb_build_object('from',target.status,'to',p_status));
 RETURN auth_private.users_dto(target.id);
END $$;
CREATE FUNCTION auth_private.users_activation_target(p_session text,p_user uuid,p_version bigint,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE target app.app_users%ROWTYPE; BEGIN
 PERFORM auth_private.users_admin_guard(p_session,true);
 SELECT * INTO target FROM app.app_users WHERE id=p_user FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF target.status<>'pending_activation' THEN RAISE EXCEPTION 'ACTIVATION_NOT_ALLOWED' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 UPDATE app.app_users SET version=version+1,updated_at=clock_timestamp() WHERE id=p_user;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason) VALUES(auth_private.require_admin(),'users.activation_reissued',p_user,p_reason);
 RETURN auth_private.users_dto(p_user);
END $$;
CREATE FUNCTION auth_private.users_reset_requests(p_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM auth_private.users_admin_guard(p_session,false);
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'userId',u.id,'version',u.version::text,'username',u.username,'fullName',u.full_name,'createdAt',r.created_at,'reason',r.reason) ORDER BY r.created_at) FROM (SELECT * FROM auth_private.password_reset_requests WHERE status='pending' AND created_at>clock_timestamp()-interval '7 days' ORDER BY created_at LIMIT 100) r JOIN app.app_users u ON u.id=r.user_id WHERE u.status='active'),'[]'::jsonb);
END $$;
CREATE FUNCTION auth_private.users_recovery_target(p_session text,p_user uuid,p_request uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; target app.app_users%ROWTYPE; BEGIN
 a:=auth_private.users_admin_guard(p_session,true);
 SELECT * INTO target FROM app.app_users WHERE id=p_user FOR UPDATE;
 IF target.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 IF target.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001'; END IF;
 IF target.id=a OR target.status<>'active' OR NOT EXISTS(SELECT 1 FROM auth_private.password_reset_requests WHERE id=p_request AND user_id=p_user AND status='pending' AND created_at>clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'RECOVERY_REQUEST_INVALID' USING ERRCODE='42501'; END IF;
 RETURN auth_private.users_dto(p_user);
END $$;
CREATE FUNCTION auth_private.users_reject_recovery(p_session text,p_request uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid; u uuid; BEGIN
 a:=auth_private.users_admin_guard(p_session,true);
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
 SELECT user_id INTO u FROM auth_private.password_reset_requests WHERE id=p_request;
 IF u IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002'; END IF;
 PERFORM 1 FROM app.app_users WHERE id=u FOR UPDATE;
 UPDATE auth_private.password_reset_requests SET status='rejected',verified_by=a,verified_at=clock_timestamp(),reason=p_reason WHERE id=p_request AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'RECOVERY_REQUEST_INVALID' USING ERRCODE='42501'; END IF;
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,'users.recovery_rejected',u,p_reason,jsonb_build_object('requestId',p_request));
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA auth_private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.users_admin_context(text),auth_private.users_list(text,text,text,text,integer,integer),auth_private.users_detail(text,uuid),auth_private.users_save(text,uuid,bigint,jsonb,text,text),auth_private.users_status(text,uuid,bigint,text,text),auth_private.users_activation_target(text,uuid,bigint,text),auth_private.users_reset_requests(text),auth_private.users_recovery_target(text,uuid,uuid,bigint),auth_private.users_reject_recovery(text,uuid,text) TO sim_guru_auth;
RESET ROLE;
