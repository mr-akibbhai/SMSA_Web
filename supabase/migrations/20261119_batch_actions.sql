-- 04. Reviewed batch actions, including committee and additional FK references.
-- Existing live setup upgrade, NOT a fresh-install schema. No SQL has been executed.
BEGIN ISOLATION LEVEL READ COMMITTED;
-- REQUIRED: inspect supabase/preflight_checks.sql output before EACH file.
-- In the SAME SQL execution, prefix this file with:
-- SELECT set_config('smsa.reviewed_state','<review_fingerprint>',false);
-- This is a review acknowledgement, not a security credential or proof of RLS correctness.
DO $review$
DECLARE actual text;
BEGIN
 WITH reviewed_state AS (
 SELECT jsonb_build_object(
  'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,'owner',c.relowner) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname IN ('site_content','events','committee_members','profiles','batches','user_roles','gallery_photos')) OR (n.nspname='storage' AND c.relname='objects')),
  'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.table_schema,a.table_name,a.ordinal_position) FROM information_schema.columns a WHERE (a.table_schema='public' AND a.table_name IN ('site_content','events','committee_members','profiles','batches','user_roles','gallery_photos')) OR (a.table_schema='storage' AND a.table_name='objects')),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conrelid,c.conname) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname) FROM pg_policies p WHERE p.schemaname IN ('public','storage')),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgrelid,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND ((n.nspname='public' AND c.relname IN ('site_content','events','committee_members','profiles','batches','user_roles','gallery_photos')) OR (n.nspname='storage' AND c.relname='objects'))),
  'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND (n.nspname='public' AND (p.proname='is_admin' OR p.proname='check_gallery_batch_limit' OR left(p.proname,5)='smsa_') OR EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE t.tgfoid=p.oid AND NOT t.tgisinternal AND ((n.nspname='public' AND c.relname IN ('site_content','events','committee_members','profiles','batches','user_roles','gallery_photos')) OR (n.nspname='storage' AND c.relname='objects'))))),
  'indexes',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.schemaname,i.tablename,i.indexname) FROM pg_indexes i WHERE i.schemaname IN ('public','storage')),
  'views',(SELECT jsonb_agg(to_jsonb(v) ORDER BY v.schemaname,v.viewname) FROM pg_views v WHERE v.schemaname='public' AND v.viewname='public_alumni'),
  'column_grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_schema,g.table_name,g.column_name,g.grantee,g.privilege_type,g.grantor) FROM information_schema.column_privileges g WHERE g.table_schema IN ('public','storage')),
  'role_flags',(SELECT jsonb_agg(jsonb_build_object('oid',r.oid,'role',r.rolname,'superuser',r.rolsuper,'bypassrls',r.rolbypassrls,'inherit',r.rolinherit) ORDER BY r.oid) FROM pg_roles r),
  'role_memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
  'buckets',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'limit',file_size_limit,'mime',allowed_mime_types) ORDER BY id) FROM storage.buckets WHERE id IN ('site-media','batch-gallery'))
 ) AS state
)
 SELECT md5(state::text) INTO actual FROM reviewed_state;
 IF current_setting('smsa.reviewed_state',true) IS DISTINCT FROM actual THEN
  RAISE EXCEPTION 'Metadata review required or database state changed. Run supabase/preflight_checks.sql and review this migration before acknowledging its fingerprint.';
 END IF;
END;
$review$;

DO $dependencies$
BEGIN
 IF to_regprocedure('public.smsa_batch_name(text)') IS NULL THEN RAISE EXCEPTION 'Run reviewed gallery migration first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='protect_profile_status' AND NOT tgisinternal AND tgenabled IN ('O','A')) THEN RAISE EXCEPTION 'Expected protect_profile_status trigger missing/disabled; inspect before proceeding'; END IF;
END;
$dependencies$;

DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_lock_batch_target(text,text,boolean)'); desired text:=$desired$
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 -- FOR SHARE conflicts with parent DELETE and name/active-state UPDATE.
 -- Ordering also makes alias matches lock multiple parent rows consistently.
 PERFORM b.id FROM public.batches b
 WHERE (($1 IS NOT NULL AND b.id::text=$1) OR ($2 IS NOT NULL AND public.smsa_batch_name(b.name)=public.smsa_batch_name($2)))
 AND (NOT $3 OR b.is_active=true) ORDER BY b.id FOR SHARE;
 RETURN FOUND;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='v' AND pg_get_function_result(oid)='boolean' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_lock_batch_target(reference_id text,reference_name text,active_only boolean) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired); changed:=true;
 END IF;
 IF changed THEN EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_lock_batch_target(text,text,boolean) FROM PUBLIC'; END IF;
END;
$install$;

DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_lock_other_batch_reference()'); desired text:=$desired$
DECLARE target_id text; target_name text; same_reference boolean:=false;
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='committee_members' THEN
  target_name:=NEW.batch;
  IF target_name IS NULL OR btrim(target_name)='' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN same_reference:=public.smsa_batch_name(NEW.batch)=public.smsa_batch_name(OLD.batch); END IF;
 ELSIF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='site_content' THEN
  IF NEW.kind<>'batch' THEN RETURN NEW; END IF;
  target_name:=NEW.key;
  IF TG_OP='UPDATE' THEN same_reference:=OLD.kind='batch' AND public.smsa_batch_name(NEW.key)=public.smsa_batch_name(OLD.key); END IF;
 ELSIF TG_TABLE_SCHEMA='public' AND TG_TABLE_NAME='gallery_photos' THEN
  target_id:=NEW.batch_id::text;
 ELSIF TG_TABLE_SCHEMA='storage' AND TG_TABLE_NAME='objects' THEN
  IF NEW.bucket_id<>'batch-gallery' THEN RETURN NEW; END IF;
  target_id:=split_part(NEW.name,'/',1); target_name:=target_id;
  IF TG_OP='UPDATE' THEN same_reference:=OLD.bucket_id='batch-gallery' AND split_part(OLD.name,'/',1)=target_id; END IF;
 ELSE RAISE EXCEPTION 'Unexpected batch-reference trigger target';
 END IF;
 IF public.smsa_lock_batch_target(target_id,target_name,false) THEN RETURN NEW; END IF;
 -- Preserve existing legacy orphans only when their reference identity is unchanged.
 IF same_reference THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Referenced batch no longer exists';
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='v' AND pg_get_function_result(oid)='trigger' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_lock_other_batch_reference() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired); changed:=true;
 END IF;
 IF changed THEN EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_lock_other_batch_reference() FROM PUBLIC'; END IF;
END;
$install$;
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_batch_has_content(text)'); desired text:=$desired$
DECLARE target_batch jsonb; batch_name text; fk record; matches text; linked boolean;
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)) THEN RAISE EXCEPTION 'Reference checker owner cannot bypass hidden RLS rows; review ownership without granting privileges automatically'; END IF;
 -- The API selects by batches.id. FK checks below use actual confkey values, NOT parent.id.
 SELECT to_jsonb(b) INTO target_batch FROM public.batches b WHERE b.id::text=$1;
 IF NOT FOUND THEN RETURN true; END IF;
 batch_name:=target_batch->>'name';
 IF EXISTS(SELECT 1 FROM public.profiles p WHERE public.smsa_batch_name(p.batch)=public.smsa_batch_name(batch_name))
 OR EXISTS(SELECT 1 FROM public.gallery_photos g WHERE g.batch_id::text=$1)
 OR EXISTS(SELECT 1 FROM public.site_content c WHERE c.kind='batch' AND public.smsa_batch_name(c.key)=public.smsa_batch_name(batch_name))
 OR EXISTS(SELECT 1 FROM public.committee_members m WHERE public.smsa_batch_name(m.batch)=public.smsa_batch_name(batch_name))
 OR EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='batch-gallery' AND (split_part(o.name,'/',1)=$1 OR public.smsa_batch_name(split_part(o.name,'/',1))=public.smsa_batch_name(batch_name))) THEN RETURN true; END IF;
 FOR fk IN SELECT con.conkey,con.confkey,con.conpfeqop,con.conrelid,n.nspname,c.relname
  FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE con.contype='f' AND con.confrelid='public.batches'::regclass
 LOOP
  -- Handles single/composite/alternate-key FKs, with each FK's PK-to-FK equality operator.
  SELECT string_agg(format('(pg_catalog.jsonb_populate_record(NULL::public.batches,$1)).%I OPERATOR(%I.%s) child.%I',pa.attname,op_ns.nspname,op.oprname,ca.attname),' AND ' ORDER BY keys.pos) INTO matches
  FROM unnest(fk.conkey,fk.confkey,fk.conpfeqop) WITH ORDINALITY AS keys(child_num,parent_num,operator_oid,pos)
  JOIN pg_attribute ca ON ca.attrelid=fk.conrelid AND ca.attnum=keys.child_num
  JOIN pg_attribute pa ON pa.attrelid='public.batches'::regclass AND pa.attnum=keys.parent_num
  JOIN pg_operator op ON op.oid=keys.operator_oid JOIN pg_namespace op_ns ON op_ns.oid=op.oprnamespace;
  IF matches IS NULL THEN RAISE EXCEPTION 'Cannot resolve batch FK columns; refusing deletion'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I child WHERE %s)',fk.nspname,fk.relname,matches) INTO linked USING target_batch;
  IF linked THEN RETURN true; END IF;
 END LOOP;
 RETURN false;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='v' AND pg_get_function_result(oid)='boolean' AND pg_get_function_arguments(oid)='batch_id text' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_batch_has_content(batch_id text) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_batch_has_content(text) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_batch_has_content(text) TO authenticated';
 END IF;
END;
$install$;
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_delete_empty_batch(text)'); desired text:=$desired$
DECLARE batch_name text; active boolean; affected integer;
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 PERFORM public.smsa_assert_batch_reference_guards();
 -- All reference writers acquire FOR SHARE on this same row first.
 SELECT name,is_active INTO batch_name,active FROM public.batches WHERE id::text=$1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Batch not found'; END IF;
 IF active IS DISTINCT FROM false THEN RAISE EXCEPTION 'Deactivate the batch before deletion'; END IF;
 IF public.smsa_batch_has_content($1) THEN RAISE EXCEPTION 'Batch has linked content and cannot be deleted'; END IF;
 DELETE FROM public.batches WHERE id::text=$1;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Batch deletion was not permitted'; END IF;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=false AND provolatile='v' AND pg_get_function_result(oid)='void' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_delete_empty_batch(batch_id text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_delete_empty_batch(text) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_delete_empty_batch(text) TO authenticated';
 END IF;
END;
$install$;
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_lock_profile_batch()'); desired text:=$desired$
DECLARE same_reference boolean:=false;
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF NEW.batch IS NULL OR btrim(NEW.batch)='' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN same_reference:=public.smsa_batch_name(NEW.batch)=public.smsa_batch_name(OLD.batch); END IF;
 -- A NEW selection/registration MUST resolve to is_active=true.
 -- An unchanged historical inactive/orphan reference is not a new selection.
 IF public.smsa_lock_batch_target(NULL,NEW.batch,NOT same_reference) THEN RETURN NEW; END IF;
 IF same_reference THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Selected batch is missing or inactive';
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='v' AND pg_get_function_result(oid)='trigger' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_lock_profile_batch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  NULL;
 END IF;
END;
$install$;
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_protect_batch_name()'); desired text:=$desired$
BEGIN
 IF public.smsa_batch_name(NEW.name) IS DISTINCT FROM public.smsa_batch_name(OLD.name) THEN
   PERFORM public.smsa_assert_batch_reference_guards();
   IF public.smsa_batch_has_content(OLD.id::text) THEN RAISE EXCEPTION 'Batch has linked content and cannot be renamed'; END IF;
 END IF;
 RETURN NEW;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=false AND provolatile='v' AND pg_get_function_result(oid)='trigger' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_protect_batch_name() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  NULL;
 END IF;
END;
$install$;

DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_assert_batch_reference_guards()'); desired text:=$desired$
DECLARE required record;
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'Batch actions require origin trigger execution'; END IF;
 FOR required IN SELECT * FROM (VALUES ('public.profiles','smsa_lock_profile_batch','public.smsa_lock_profile_batch()',23,ARRAY['batch']::text[]),
 ('public.committee_members','smsa_lock_committee_batch','public.smsa_lock_other_batch_reference()',23,ARRAY['batch']::text[]),
 ('public.site_content','smsa_lock_content_batch','public.smsa_lock_other_batch_reference()',23,ARRAY['key','kind']::text[]),
 ('public.gallery_photos','smsa_lock_gallery_batch','public.smsa_lock_other_batch_reference()',23,ARRAY['batch_id']::text[]),
 ('storage.objects','smsa_lock_storage_batch','public.smsa_lock_other_batch_reference()',23,ARRAY['bucket_id','name']::text[]),
 ('public.batches','smsa_protect_batch_name','public.smsa_protect_batch_name()',19,ARRAY['name']::text[]),
 ('public.batches','smsa_protect_batch_delete','public.smsa_protect_batch_delete()',11,ARRAY[]::text[])) AS rules(table_name,trigger_name,function_name,event_mask,columns)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=to_regclass(required.table_name) AND t.tgname=required.trigger_name AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND t.tgtype=required.event_mask AND t.tgqual IS NULL AND t.tgfoid=to_regprocedure(required.function_name)
   AND coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[])=required.columns) THEN
   RAISE EXCEPTION 'Missing/incompatible batch-reference guard % on %; refusing deletion',required.trigger_name,required.table_name;
  END IF;
 END LOOP;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=false AND provolatile='v' AND pg_get_function_result(oid)='void' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_assert_batch_reference_guards() RETURNS void LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='''' ' || 'AS ' || quote_literal(desired); changed:=true;
 END IF;
 IF changed THEN EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_assert_batch_reference_guards() FROM PUBLIC'; EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_assert_batch_reference_guards() TO authenticated'; END IF;
END;
$install$;

DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_protect_batch_delete()'); desired text:=$desired$
BEGIN
 IF current_setting('transaction_isolation') NOT IN ('read committed','read uncommitted') THEN RAISE EXCEPTION 'Batch reference writes/deletes require READ COMMITTED isolation'; END IF;
 IF auth.uid() IS NULL OR NOT coalesce(public.is_admin(),false) THEN RAISE EXCEPTION 'Administrator access required'; END IF;
 PERFORM public.smsa_assert_batch_reference_guards();
 IF OLD.is_active IS DISTINCT FROM false THEN RAISE EXCEPTION 'Deactivate the batch before deletion'; END IF;
 -- VOLATILE reference checker obtains a fresh RC snapshot after the parent lock wait.
 IF public.smsa_batch_has_content(OLD.id::text) THEN RAISE EXCEPTION 'Batch has linked content and cannot be deleted'; END IF;
 RETURN OLD;
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=false AND provolatile='v' AND pg_get_function_result(oid)='trigger' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_protect_batch_delete() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='''' ' || 'AS ' || quote_literal(desired); changed:=true;
 END IF;
 IF changed THEN NULL; END IF;
END;
$install$;

DO $reference_owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='public.smsa_batch_has_content(text)'::regprocedure AND (r.rolsuper OR r.rolbypassrls)) THEN RAISE EXCEPTION 'Batch reference checker owner must already have complete RLS visibility'; END IF;
END;
$reference_owner$;
DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.profiles'::regclass AND t.tgname='smsa_lock_profile_batch' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>23 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_lock_profile_batch()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['batch']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_lock_profile_batch; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='smsa_lock_profile_batch') THEN
  CREATE TRIGGER smsa_lock_profile_batch BEFORE INSERT OR UPDATE OF batch ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.smsa_lock_profile_batch();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.committee_members'::regclass AND t.tgname='smsa_lock_committee_batch' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>23 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_lock_other_batch_reference()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['batch']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_lock_committee_batch; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.committee_members'::regclass AND tgname='smsa_lock_committee_batch') THEN
  CREATE TRIGGER smsa_lock_committee_batch BEFORE INSERT OR UPDATE OF batch ON public.committee_members FOR EACH ROW EXECUTE FUNCTION public.smsa_lock_other_batch_reference();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.site_content'::regclass AND t.tgname='smsa_lock_content_batch' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>23 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_lock_other_batch_reference()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['key','kind']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_lock_content_batch; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.site_content'::regclass AND tgname='smsa_lock_content_batch') THEN
  CREATE TRIGGER smsa_lock_content_batch BEFORE INSERT OR UPDATE OF kind,key ON public.site_content FOR EACH ROW EXECUTE FUNCTION public.smsa_lock_other_batch_reference();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.gallery_photos'::regclass AND t.tgname='smsa_lock_gallery_batch' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>23 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_lock_other_batch_reference()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['batch_id']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_lock_gallery_batch; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.gallery_photos'::regclass AND tgname='smsa_lock_gallery_batch') THEN
  CREATE TRIGGER smsa_lock_gallery_batch BEFORE INSERT OR UPDATE OF batch_id ON public.gallery_photos FOR EACH ROW EXECUTE FUNCTION public.smsa_lock_other_batch_reference();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='storage.objects'::regclass AND t.tgname='smsa_lock_storage_batch' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>23 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_lock_other_batch_reference()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['bucket_id','name']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_lock_storage_batch; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname='smsa_lock_storage_batch') THEN
  CREATE TRIGGER smsa_lock_storage_batch BEFORE INSERT OR UPDATE OF bucket_id,name ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.smsa_lock_other_batch_reference();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.batches'::regclass AND t.tgname='smsa_protect_batch_name' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>19 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_protect_batch_name()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY['name']::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_protect_batch_name; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.batches'::regclass AND tgname='smsa_protect_batch_name') THEN
  CREATE TRIGGER smsa_protect_batch_name BEFORE UPDATE OF name ON public.batches FOR EACH ROW EXECUTE FUNCTION public.smsa_protect_batch_name();
 END IF;
END;
$trigger$;

DO $trigger$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.batches'::regclass AND t.tgname='smsa_protect_batch_delete' AND (t.tgisinternal OR t.tgenabled NOT IN ('O','A') OR t.tgtype<>11 OR t.tgqual IS NOT NULL OR t.tgfoid IS DISTINCT FROM to_regprocedure('public.smsa_protect_batch_delete()') OR coalesce((SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(t.tgattr::smallint[]) k(attnum) JOIN pg_attribute a ON a.attrelid=t.tgrelid AND a.attnum=k.attnum),ARRAY[]::text[]) IS DISTINCT FROM ARRAY[]::text[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_protect_batch_delete; inspect rather than overwrite'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.batches'::regclass AND tgname='smsa_protect_batch_delete') THEN
  CREATE TRIGGER smsa_protect_batch_delete BEFORE DELETE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.smsa_protect_batch_delete();
 END IF;
END;
$trigger$;

-- Required guards must all be installed atomically; unsupported Storage trigger privileges roll back this file.
SELECT public.smsa_assert_batch_reference_guards();
-- Existing protect_profile_status, check_gallery_batch_limit and their triggers/ACLs are untouched.
COMMIT;
