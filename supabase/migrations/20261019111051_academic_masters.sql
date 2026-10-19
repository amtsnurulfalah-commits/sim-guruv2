SET LOCAL ROLE sim_guru_owner;
CREATE TABLE app.school_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),singleton boolean NOT NULL DEFAULT true UNIQUE CHECK(singleton),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),address text NOT NULL DEFAULT '' CHECK(length(address)<=500),npsn text NOT NULL CHECK(npsn='' OR npsn~'^[0-9]{8}$'),level text NOT NULL CHECK(level IN('SD','SMP','SMA','SMK')),use_parallel boolean NOT NULL,parallel_max integer NOT NULL CHECK(parallel_max BETWEEN 1 AND 24),minutes_per_jtm integer NOT NULL CHECK(minutes_per_jtm BETWEEN 1 AND 180),headmaster_id uuid REFERENCES app.app_users(id),version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,CHECK(parallel_max<=CASE level WHEN 'SD' THEN 4 WHEN 'SMP' THEN 11 WHEN 'SMA' THEN 12 ELSE 24 END));
CREATE TABLE app.academic_years(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),label text NOT NULL CHECK(label~'^[0-9]{4}/[0-9]{4}$' AND substring(label,6,4)::integer=substring(label,1,4)::integer+1),date_start date NOT NULL,date_end date NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,CHECK(isfinite(date_start) AND isfinite(date_end) AND date_start<=date_end));
CREATE UNIQUE INDEX academic_year_label ON app.academic_years(lower(label));
CREATE TABLE app.academic_periods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academic_year_id uuid NOT NULL REFERENCES app.academic_years(id),semester smallint NOT NULL CHECK(semester IN(1,2)),date_start date NOT NULL,date_end date NOT NULL,is_active boolean NOT NULL DEFAULT false,version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,CHECK(isfinite(date_start) AND isfinite(date_end) AND date_start<=date_end),CHECK(NOT is_active OR archived_at IS NULL),UNIQUE(academic_year_id,semester));
CREATE UNIQUE INDEX one_active_academic_period ON app.academic_periods(is_active) WHERE is_active;
CREATE TABLE app.classes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academic_period_id uuid NOT NULL REFERENCES app.academic_periods(id),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),level text NOT NULL CHECK(level IN('SD','SMP','SMA','SMK')),grade smallint NOT NULL,parallel text NOT NULL CHECK(parallel='' OR parallel~'^[A-X]$'),expected_students smallint NOT NULL CHECK(expected_students BETWEEN 0 AND 36),version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,
 CHECK((level='SD' AND grade BETWEEN 1 AND 6 AND expected_students<=28 AND (parallel='' OR parallel<='D')) OR(level='SMP' AND grade BETWEEN 7 AND 9 AND expected_students<=32 AND(parallel='' OR parallel<='K')) OR(level IN('SMA','SMK') AND grade BETWEEN 10 AND 12 AND(parallel='' OR parallel<=CASE level WHEN 'SMA' THEN 'L' ELSE 'X' END))),CHECK(parallel='' OR expected_students=0 OR expected_students>=15));
CREATE UNIQUE INDEX classes_period_name ON app.classes(academic_period_id,lower(btrim(name)));
CREATE UNIQUE INDEX classes_period_grade_parallel ON app.classes(academic_period_id,grade,parallel);
CREATE TABLE app.subjects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),normalized_name text GENERATED ALWAYS AS(lower(btrim(name))) STORED UNIQUE,version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz);
CREATE TABLE app.rate_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN('jtm','transport')),amount numeric(9,0) NOT NULL CHECK(amount BETWEEN 0 AND 999999999),enabled boolean NOT NULL,date_start date NOT NULL,date_end date NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,CHECK(isfinite(date_start) AND isfinite(date_end) AND date_start<=date_end),CHECK(kind<>'transport' OR NOT enabled OR amount>0));
CREATE INDEX rates_window ON app.rate_versions(kind,date_start,date_end) WHERE archived_at IS NULL;
CREATE TABLE app.allowances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES app.app_users(id),duty_name text NOT NULL CHECK(length(btrim(duty_name)) BETWEEN 1 AND 200),amount numeric(9,0) NOT NULL CHECK(amount BETWEEN 0 AND 999999999),date_start date NOT NULL,date_end date NOT NULL,version bigint NOT NULL DEFAULT 1 CHECK(version>0),archived_at timestamptz,CHECK(isfinite(date_start) AND isfinite(date_end) AND date_start<=date_end));
CREATE INDEX allowances_user_window ON app.allowances(user_id,lower(btrim(duty_name)),date_start,date_end) WHERE archived_at IS NULL;
CREATE INDEX school_headmaster ON app.school_profiles(headmaster_id) WHERE headmaster_id IS NOT NULL;
CREATE INDEX classes_period ON app.classes(academic_period_id);
CREATE TABLE ops.master_revisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL,entity_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES app.app_users(id),reason text NOT NULL,old_data jsonb,new_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX master_revisions_entity ON ops.master_revisions(kind,entity_id,created_at DESC);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['app.school_profiles','app.academic_years','app.academic_periods','app.classes','app.subjects','app.rate_versions','app.allowances','ops.master_revisions'] LOOP
 EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',t);EXECUTE format('CREATE POLICY owner_internal ON %s TO sim_guru_owner USING(true) WITH CHECK(true)',t);END LOOP;END $$;
CREATE FUNCTION app.master_guard(p_session text,p_write boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;BEGIN
 -- Shared lock order with account management prevents actor/target lock inversion.
 IF p_write THEN PERFORM pg_advisory_xact_lock(734190,1);END IF;
 a:=auth_private.lifecycle_self(p_session);PERFORM auth_private.require_admin();RETURN a;END $$;
CREATE FUNCTION app.master_table(p_kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$ SELECT CASE p_kind WHEN 'school' THEN 'school_profiles' WHEN 'academic-years' THEN 'academic_years' WHEN 'academic-periods' THEN 'academic_periods' WHEN 'classes' THEN 'classes' WHEN 'subjects' THEN 'subjects' WHEN 'rates' THEN 'rate_versions' WHEN 'allowances' THEN 'allowances' END $$;
CREATE FUNCTION app.master_validate() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE s app.school_profiles%ROWTYPE;y app.academic_years%ROWTYPE;p app.academic_periods%ROWTYPE;today date:=(clock_timestamp() AT TIME ZONE 'Asia/Jakarta')::date; BEGIN
 IF TG_TABLE_NAME='school_profiles' THEN
  IF NEW.headmaster_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=NEW.headmaster_id AND status='active' AND additional_role='KEPALA_SEKOLAH') THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
 ELSIF TG_TABLE_NAME='academic_years' THEN
  IF EXISTS(SELECT 1 FROM app.academic_years WHERE id<>NEW.id AND archived_at IS NULL AND NEW.archived_at IS NULL AND daterange(date_start,date_end,'[]') && daterange(NEW.date_start,NEW.date_end,'[]')) THEN RAISE EXCEPTION 'MASTER_OVERLAP' USING ERRCODE='23505';END IF;
  IF EXISTS(SELECT 1 FROM app.academic_periods WHERE academic_year_id=NEW.id AND (date_start<NEW.date_start OR date_end>NEW.date_end OR(NEW.archived_at IS NOT NULL AND archived_at IS NULL))) THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;
 ELSIF TG_TABLE_NAME='academic_periods' THEN
  IF TG_OP='UPDATE' AND NEW.academic_year_id<>OLD.academic_year_id THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;
  SELECT * INTO y FROM app.academic_years WHERE id=NEW.academic_year_id;
  IF y.id IS NULL OR y.archived_at IS NOT NULL OR NEW.date_start<y.date_start OR NEW.date_end>y.date_end THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM app.academic_periods WHERE academic_year_id=NEW.academic_year_id AND id<>NEW.id AND archived_at IS NULL AND NEW.archived_at IS NULL AND daterange(date_start,date_end,'[]') && daterange(NEW.date_start,NEW.date_end,'[]')) THEN RAISE EXCEPTION 'MASTER_OVERLAP' USING ERRCODE='23505';END IF;
  IF NEW.archived_at IS NOT NULL AND EXISTS(SELECT 1 FROM app.classes WHERE academic_period_id=NEW.id AND archived_at IS NULL) THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;
 ELSIF TG_TABLE_NAME='classes' THEN
  IF TG_OP='UPDATE' AND NEW.academic_period_id<>OLD.academic_period_id THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;
  SELECT * INTO s FROM app.school_profiles;SELECT * INTO p FROM app.academic_periods WHERE id=NEW.academic_period_id;
  IF p.id IS NULL OR p.archived_at IS NOT NULL THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
  IF NEW.archived_at IS NULL AND (s.id IS NULL OR NEW.level<>s.level OR (s.use_parallel AND(NEW.parallel='' OR ascii(NEW.parallel)-64>s.parallel_max)) OR(NOT s.use_parallel AND NEW.parallel<>'')) THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
 ELSIF TG_TABLE_NAME IN('rate_versions','allowances') THEN
  IF TG_OP='UPDATE' AND (OLD.date_start<=today OR NEW.archived_at IS NULL OR OLD.archived_at IS NOT NULL OR (to_jsonb(NEW)-ARRAY['archived_at','version']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['archived_at','version'])) THEN RAISE EXCEPTION 'MASTER_IMMUTABLE' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' AND NEW.date_start<today THEN RAISE EXCEPTION 'MASTER_PAST' USING ERRCODE='22023';END IF;
  IF TG_TABLE_NAME='rate_versions' THEN
   IF EXISTS(SELECT 1 FROM app.rate_versions WHERE id<>NEW.id AND kind=NEW.kind AND archived_at IS NULL AND NEW.archived_at IS NULL AND daterange(date_start,date_end,'[]') && daterange(NEW.date_start,NEW.date_end,'[]')) THEN RAISE EXCEPTION 'MASTER_OVERLAP' USING ERRCODE='23505';END IF;
  ELSE
   IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM app.app_users WHERE id=NEW.user_id AND status='active') THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
   IF EXISTS(SELECT 1 FROM app.allowances WHERE id<>NEW.id AND user_id=NEW.user_id AND lower(btrim(duty_name))=lower(btrim(NEW.duty_name)) AND archived_at IS NULL AND NEW.archived_at IS NULL AND daterange(date_start,date_end,'[]') && daterange(NEW.date_start,NEW.date_end,'[]')) THEN RAISE EXCEPTION 'MASTER_OVERLAP' USING ERRCODE='23505';END IF;
  END IF;
 END IF;RETURN NEW;END $$;
CREATE FUNCTION app.master_audit() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ DECLARE a uuid; r text;BEGIN
 a:=auth_private.require_admin();r:=current_setting('app.master_reason',true);IF r IS NULL OR length(btrim(r)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
 INSERT INTO ops.master_revisions(kind,entity_id,actor_id,reason,old_data,new_data) VALUES(TG_ARGV[0],NEW.id,a,r,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE null END,to_jsonb(NEW));
 INSERT INTO ops.audit_logs(actor_id,action,entity_id,reason,redacted_changes) VALUES(a,'master.'||TG_ARGV[0]||CASE WHEN TG_OP='INSERT' THEN '.created' ELSE '.updated' END,NEW.id,r,jsonb_build_object('version',NEW.version,'archived',NEW.archived_at IS NOT NULL));RETURN NEW;END $$;
DO $$ DECLARE k text; t text;BEGIN FOREACH k IN ARRAY ARRAY['school','academic-years','academic-periods','classes','subjects','rates','allowances'] LOOP t:=app.master_table(k);
 EXECUTE format('CREATE TRIGGER master_validate BEFORE INSERT OR UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.master_validate()',t);
 EXECUTE format('CREATE TRIGGER master_audit AFTER INSERT OR UPDATE ON app.%I FOR EACH ROW EXECUTE FUNCTION app.master_audit(%L)',t,k);END LOOP;END $$;
CREATE FUNCTION app.master_dto(p_kind text,p_row jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=pg_catalog AS $$ DECLARE label text;BEGIN
 IF p_kind='academic-periods' THEN SELECT y.label INTO label FROM app.academic_years y WHERE y.id=(p_row->>'academic_year_id')::uuid;
 ELSIF p_kind='classes' THEN SELECT y.label||' · Semester '||p.semester INTO label FROM app.academic_periods p JOIN app.academic_years y ON y.id=p.academic_year_id WHERE p.id=(p_row->>'academic_period_id')::uuid;
 ELSIF p_kind='allowances' THEN SELECT full_name||' ('||username||')' INTO label FROM app.app_users WHERE id=(p_row->>'user_id')::uuid;
 ELSIF p_kind='school' THEN SELECT full_name||' ('||username||')' INTO label FROM app.app_users WHERE id=(p_row->>'headmaster_id')::uuid;
 END IF;RETURN p_row||jsonb_build_object('parent_label',label);END $$;
CREATE FUNCTION app.master_list(p_session text,p_kind text,p_filter jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE t text; result jsonb;q text:=coalesce(p_filter->>'q','');page integer:=(p_filter->>'page')::integer;size integer:=(p_filter->>'pageSize')::integer;parent text:=coalesce(p_filter->>'parentId','');arc text:=coalesce(p_filter->>'archived','false');BEGIN
 PERFORM app.master_guard(p_session,false);t:=app.master_table(p_kind);
 IF t IS NULL OR page IS NULL OR size IS NULL OR page NOT BETWEEN 1 AND 100000 OR size NOT BETWEEN 1 AND 100 OR length(q)>100 OR arc NOT IN('','true','false') THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
 EXECUTE format($query$ WITH all_rows AS(SELECT app.master_dto($7,to_jsonb(x)||jsonb_build_object('version',x.version::text)) AS d FROM app.%I x), filtered AS(SELECT d FROM all_rows WHERE ($1='' OR position(lower($1) in lower(coalesce(d->>'name',d->>'label',d->>'duty_name',d->>'kind','')||' '||coalesce(d->>'semester','')))>0) AND($2='' OR coalesce(d->>'academic_period_id',d->>'academic_year_id',d->>'user_id','')=$2) AND($3='' OR (d->>'archived_at' IS NOT NULL)=($3='true'))),page_rows AS(SELECT d FROM filtered ORDER BY coalesce(d->>'name',d->>'label',d->>'duty_name',d->>'kind',''),d->>'id' LIMIT $4 OFFSET $5) SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(d ORDER BY coalesce(d->>'name',d->>'label',d->>'duty_name',d->>'kind',''),d->>'id') FROM page_rows),'[]'::jsonb),'total',(SELECT count(*) FROM filtered),'page',$6,'pageSize',$4) $query$,t) INTO result USING q,parent,arc,size,(page-1)*size,page,p_kind;
 RETURN result;END $$;
CREATE FUNCTION app.master_save(p_session text,p_kind text,p_id uuid,p_version bigint,p_data jsonb,p_archive boolean,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE a uuid;t text;old jsonb;result jsonb;allowed text[];cols text;vals text;BEGIN
 a:=app.master_guard(p_session,true);t:=app.master_table(p_kind);
 IF t IS NULL OR p_archive IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
 PERFORM set_config('app.master_reason',p_reason,true);
 IF p_id IS NOT NULL THEN
  EXECUTE format('SELECT to_jsonb(x) FROM app.%I x WHERE id=$1 FOR UPDATE',t) INTO old USING p_id;
  IF old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='P0002';END IF;
  IF (old->>'version')::bigint IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'VERSION_CONFLICT' USING ERRCODE='40001';END IF;
  IF old->>'archived_at' IS NOT NULL THEN RAISE EXCEPTION 'ARCHIVED_READ_ONLY' USING ERRCODE='42501';END IF;
 ELSE IF p_version IS DISTINCT FROM 0 OR p_archive THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;END IF;
 IF p_archive THEN
  IF p_kind='school' THEN RAISE EXCEPTION 'MASTER_REFERENCED' USING ERRCODE='23503';END IF;
  EXECUTE format('UPDATE app.%I x SET archived_at=clock_timestamp(),version=version+1%s WHERE id=$1 RETURNING to_jsonb(x)',t,CASE WHEN p_kind='academic-periods' THEN ',is_active=false' ELSE '' END) INTO result USING p_id;
 ELSE
  IF p_id IS NOT NULL AND p_kind IN('rates','allowances') THEN RAISE EXCEPTION 'MASTER_IMMUTABLE' USING ERRCODE='42501';END IF;
  allowed:=CASE p_kind WHEN 'school' THEN ARRAY['name','address','npsn','level','use_parallel','parallel_max','minutes_per_jtm','headmaster_id'] WHEN 'academic-years' THEN ARRAY['label','date_start','date_end'] WHEN 'academic-periods' THEN ARRAY['academic_year_id','semester','date_start','date_end','is_active'] WHEN 'classes' THEN ARRAY['academic_period_id','name','level','grade','parallel','expected_students'] WHEN 'subjects' THEN ARRAY['name'] WHEN 'rates' THEN ARRAY['kind','amount','enabled','date_start','date_end'] WHEN 'allowances' THEN ARRAY['user_id','duty_name','amount','date_start','date_end'] END;
  IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data-allowed<>'{}'::jsonb OR NOT p_data ?& allowed THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
  IF p_kind IN('rates','allowances') AND (jsonb_typeof(p_data->'amount')<>'string' OR coalesce(p_data->>'amount','')!~'^(0|[1-9][0-9]{0,8})$') THEN RAISE EXCEPTION 'MASTER_INVALID' USING ERRCODE='22023';END IF;
  IF p_kind='academic-periods' AND (p_data->>'is_active')::boolean THEN UPDATE app.academic_periods SET is_active=false,version=version+1 WHERE is_active AND id IS DISTINCT FROM p_id;END IF;
  SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),',') INTO cols,vals FROM unnest(allowed) key;
  IF p_id IS NULL THEN
   EXECUTE format('INSERT INTO app.%I(%s) SELECT %s FROM jsonb_populate_record(null::app.%I,$1) r RETURNING to_jsonb(%I)',t,cols,vals,t,t) INTO result USING p_data;
  ELSE
   EXECUTE format('UPDATE app.%I x SET (%s)=(SELECT %s FROM jsonb_populate_record(null::app.%I,$1) r),version=x.version+1 WHERE id=$2 RETURNING to_jsonb(x)',t,cols,vals,t) INTO result USING p_data,p_id;
  END IF;
 END IF;
 RETURN result||jsonb_build_object('version',result->>'version');END $$;
CREATE FUNCTION app.master_history(p_session text,p_kind text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 PERFORM app.master_guard(p_session,false);RETURN coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM(SELECT actor_id,(SELECT u.full_name FROM app.app_users u WHERE u.id=actor_id) AS actor_name,reason,old_data,new_data,created_at FROM ops.master_revisions WHERE kind=p_kind AND entity_id=p_id ORDER BY created_at DESC LIMIT 50) r),'[]'::jsonb);END $$;
REVOKE ALL ON FUNCTION app.master_guard(text,boolean),app.master_table(text),app.master_dto(text,jsonb),app.master_validate(),app.master_audit(),app.master_list(text,text,jsonb),app.master_save(text,text,uuid,bigint,jsonb,boolean,text),app.master_history(text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.master_list(text,text,jsonb),app.master_save(text,text,uuid,bigint,jsonb,boolean,text),app.master_history(text,text,uuid) TO sim_guru_business;
RESET ROLE;
