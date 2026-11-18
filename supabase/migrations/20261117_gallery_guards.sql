-- 02. Gallery ownership/visibility guards; retain the existing gallery limit trigger.
-- This is an RLS intersection, never a replacement of permissive policies.
-- Parent-reference serialization is installed atomically by migration 04.
-- Do not use batch deletion during a partially applied rollout.
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

DO $legacy$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='batch-gallery' AND NOT public) THEN RAISE EXCEPTION 'Private batch-gallery bucket is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE t.tgrelid='public.gallery_photos'::regclass AND t.tgname='gallery_batch_limit_trigger' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A') AND n.nspname='public' AND p.proname='check_gallery_batch_limit') THEN RAISE EXCEPTION 'Expected enabled gallery_batch_limit_trigger -> public.check_gallery_batch_limit() not found'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.gallery_photos'::regclass AND tgname='smsa_gallery_guard' AND NOT tgisinternal) THEN RAISE EXCEPTION 'Old proposed smsa_gallery_guard trigger is also installed. Inspect both definitions; do not automatically drop/disable either.'; END IF;
END;
$legacy$;
-- Mandatory manual review: legacy limit must enforce <=100 APPROVED photos,
-- including status transitions and concurrent approvals. Its body is not available
-- locally. This migration does not certify, replace or duplicate its logic.
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_batch_name(text)'); desired text:=$desired$
DECLARE cleaned text; year_match text[];
BEGIN
  cleaned := regexp_replace(coalesce(value,''), '^\s+|\s+$', '', 'g');
  year_match := regexp_match(cleaned, '^(?:batch|dakhil)[-\s]*([0-9]{2}|[0-9]{4})$', 'i');
  IF year_match IS NULL THEN RETURN cleaned; END IF;
  RETURN 'Dakhil-' || CASE WHEN length(year_match[1])=2 THEN '20' ELSE '' END || year_match[1];
END;
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=false AND provolatile='i' AND pg_get_function_result(oid)='text' AND pg_get_function_arguments(oid)='value text' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_batch_name(value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_batch_name(text) TO anon,authenticated';
 END IF;
 IF NOT has_function_privilege('authenticated','public.smsa_batch_name(text)','EXECUTE') OR NOT has_function_privilege('anon','public.smsa_batch_name(text)','EXECUTE') THEN RAISE EXCEPTION 'Existing smsa_batch_name ACL needs manual review'; END IF;
END;
$install$;
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_gallery_own_orphan(text)'); desired text:=$desired$
 SELECT auth.uid() IS NOT NULL AND split_part($1,'/',2)=auth.uid()::text
 AND NOT EXISTS(SELECT 1 FROM public.gallery_photos WHERE storage_path=$1);
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='s' AND pg_get_function_result(oid)='boolean' AND pg_get_function_arguments(oid)='object_path text' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_gallery_own_orphan(object_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_gallery_own_orphan(text) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_gallery_own_orphan(text) TO authenticated';
 END IF;
END;
$install$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_submission' AND (permissive<>'RESTRICTIVE' OR cmd<>'INSERT' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_submission command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_submission') THEN
  CREATE POLICY smsa_gallery_submission ON public.gallery_photos AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK ((CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END) OR (auth.uid() IS NOT NULL AND uploader_id=auth.uid() AND status='pending' AND split_part(storage_path,'/',1)=batch_id::text AND split_part(storage_path,'/',2)=auth.uid()::text AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.batches b ON public.smsa_batch_name(b.name)=public.smsa_batch_name(p.batch) WHERE p.id=auth.uid() AND b.id=gallery_photos.batch_id AND b.is_active IS TRUE)));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_submission; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_moderation' AND (permissive<>'RESTRICTIVE' OR cmd<>'UPDATE' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_moderation command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_moderation') THEN
  CREATE POLICY smsa_gallery_moderation ON public.gallery_photos AS RESTRICTIVE FOR UPDATE TO PUBLIC USING ((CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END)) WITH CHECK ((CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_moderation; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_visibility' AND (permissive<>'RESTRICTIVE' OR cmd<>'SELECT' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_visibility command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_visibility') THEN
  CREATE POLICY smsa_gallery_visibility ON public.gallery_photos AS RESTRICTIVE FOR SELECT TO PUBLIC USING (status='approved' OR uploader_id=auth.uid() OR (CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_visibility; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_delete' AND (permissive<>'RESTRICTIVE' OR cmd<>'DELETE' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_delete command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gallery_photos' AND policyname='smsa_gallery_delete') THEN
  CREATE POLICY smsa_gallery_delete ON public.gallery_photos AS RESTRICTIVE FOR DELETE TO PUBLIC USING ((CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_delete; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_visibility' AND (permissive<>'RESTRICTIVE' OR cmd<>'SELECT' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_object_visibility command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_visibility') THEN
  CREATE POLICY smsa_gallery_object_visibility ON storage.objects AS RESTRICTIVE FOR SELECT TO PUBLIC USING (bucket_id<>'batch-gallery' OR (CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END) OR EXISTS (SELECT 1 FROM public.gallery_photos g WHERE g.storage_path=storage.objects.name AND (g.status='approved' OR g.uploader_id=auth.uid())) OR (CASE WHEN auth.uid() IS NULL THEN false ELSE public.smsa_gallery_own_orphan(storage.objects.name) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_object_visibility; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_upload' AND (permissive<>'RESTRICTIVE' OR cmd<>'INSERT' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_object_upload command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_upload') THEN
  CREATE POLICY smsa_gallery_object_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK (bucket_id<>'batch-gallery' OR (auth.uid() IS NOT NULL AND (storage.foldername(name))[2]=auth.uid()::text AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.batches b ON public.smsa_batch_name(b.name)=public.smsa_batch_name(p.batch) WHERE p.id=auth.uid() AND b.id::text=(storage.foldername(name))[1] AND b.is_active IS TRUE)));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_object_upload; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_delete' AND (permissive<>'RESTRICTIVE' OR cmd<>'DELETE' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_gallery_object_delete command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_gallery_object_delete') THEN
  CREATE POLICY smsa_gallery_object_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO PUBLIC USING (bucket_id<>'batch-gallery' OR (CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END) OR (CASE WHEN auth.uid() IS NULL THEN false ELSE public.smsa_gallery_own_orphan(storage.objects.name) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_gallery_object_delete; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
-- Existing table/storage RLS, permissive policies and grants remain unchanged.
COMMIT;
