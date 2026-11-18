-- 03. UI columns, About kind, explicit unlimited/50-to-10 MB gallery restriction and uploader names.
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

-- Existing columns are validated before ALTER/IF NOT EXISTS can silently skip them.
DO $column_types$
BEGIN
 IF EXISTS(
  SELECT 1 FROM (VALUES ('events','display_order','integer'),('events','enabled','boolean'),('batches','display_order','integer')) required(table_name,column_name,data_type)
  JOIN information_schema.columns actual ON actual.table_schema='public' AND actual.table_name=required.table_name AND actual.column_name=required.column_name
  WHERE actual.data_type<>required.data_type
 ) THEN RAISE EXCEPTION 'Existing display_order/enabled column type differs; review without coercing data'; END IF;
END;
$column_types$;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
-- Extend the known kind CHECK atomically; preserve rows and other constraints.
-- The original unnamed kind CHECK is site_content_kind_check on a fresh install.
DO $kind$
DECLARE check_row record;
BEGIN
  FOR check_row IN SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid='public.site_content'::regclass AND contype='c'
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.site_content'::regclass AND attname='kind')]::smallint[]
  LOOP
    IF check_row.conname NOT IN ('site_content_kind_check','smsa_content_kind_v2')
       OR regexp_replace(check_row.definition,'\s','','g') NOT IN (
         regexp_replace($four$CHECK ((kind = ANY (ARRAY['official'::text, 'batch'::text, 'social'::text, 'carousel'::text])))$four$,'\s','','g'),
         regexp_replace($five$CHECK ((kind = ANY (ARRAY['official'::text, 'batch'::text, 'social'::text, 'carousel'::text, 'about'::text])))$five$,'\s','','g')
       ) THEN
      RAISE EXCEPTION 'Unexpected kind constraint %; review manually',check_row.conname;
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.site_content'::regclass AND conname='site_content_kind_check' AND position('''about''' IN pg_get_constraintdef(oid))=0) THEN
    ALTER TABLE public.site_content DROP CONSTRAINT site_content_kind_check;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.site_content'::regclass AND conname IN ('site_content_kind_check','smsa_content_kind_v2')) THEN
    ALTER TABLE public.site_content ADD CONSTRAINT smsa_content_kind_v2 CHECK(kind IN ('official','batch','social','carousel','about'));
  END IF;
END;
$kind$;
DO $policy$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='smsa_event_visibility' AND (permissive<>'RESTRICTIVE' OR cmd<>'SELECT' OR roles<>ARRAY['public']::name[])) THEN RAISE EXCEPTION 'Unexpected existing smsa_event_visibility command/mode/roles; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='smsa_event_visibility') THEN
  CREATE POLICY smsa_event_visibility ON public.events AS RESTRICTIVE FOR SELECT TO PUBLIC USING (enabled OR (CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END));
 ELSE
  RAISE NOTICE 'Preserving existing smsa_event_visibility; its expression must match the reviewed permission matrix';
 END IF;
END;
$policy$;
DO $buckets$
BEGIN
 PERFORM id FROM storage.buckets WHERE id IN ('site-media','batch-gallery') FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='site-media' AND public AND file_size_limit=10485760 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[] AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]) THEN RAISE EXCEPTION 'site-media configuration drift; not overwriting it'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='batch-gallery' AND NOT public AND (file_size_limit IS NULL OR file_size_limit IN (52428800,10485760)) AND (allowed_mime_types IS NULL OR (allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[] AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]))) THEN RAISE EXCEPTION 'Unexpected batch-gallery settings; review before changing'; END IF;
END;
$buckets$;
-- Explicit authorised change: NULL unlimited or 50 MB/unrestricted -> 10 MB/JPEG/PNG/WebP.
-- Existing large or other-format objects are NOT deleted; only future uploads change.
UPDATE storage.buckets SET file_size_limit=10485760,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']
WHERE id='batch-gallery' AND NOT public AND (file_size_limit IS DISTINCT FROM 10485760 OR allowed_mime_types IS DISTINCT FROM ARRAY['image/jpeg','image/png','image/webp']::text[]);
-- Only this migration's helper may be replaced, after the fingerprint review above.
-- Same-body repeat runs do not rewrite the function; public.is_admin() is never replaced.
DO $install$
DECLARE existing oid:=to_regprocedure('public.smsa_gallery_uploader_names(text[])'); desired text:=$desired$
 SELECT g.id::text,coalesce(a.full_name,CASE WHEN g.uploader_id=auth.uid() THEN p.full_name END)::text
 FROM public.gallery_photos g LEFT JOIN public.public_alumni a ON a.id=g.uploader_id
 LEFT JOIN public.profiles p ON p.id=g.uploader_id AND p.id=auth.uid()
 WHERE g.id::text=ANY($1) AND (g.status='approved' OR g.uploader_id=auth.uid()
 OR CASE WHEN auth.uid() IS NULL THEN false ELSE coalesce(public.is_admin(),false) END);
$desired$; changed boolean:=false;
BEGIN
 IF existing IS NULL OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=existing AND prosrc=desired AND prosecdef=true AND provolatile='s' AND pg_get_function_result(oid)='TABLE(photo_id text, full_name text)' AND pg_get_function_arguments(oid)='photo_ids text[]' AND coalesce(proconfig,ARRAY[]::text[]) && ARRAY['search_path=""','search_path=']::text[]) THEN
  EXECUTE 'CREATE OR REPLACE FUNCTION public.smsa_gallery_uploader_names(photo_ids text[])
RETURNS TABLE(photo_id text,full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='''' ' || 'AS ' || quote_literal(desired);
  changed:=true;
 END IF;
 IF changed THEN
  EXECUTE 'REVOKE ALL ON FUNCTION public.smsa_gallery_uploader_names(text[]) FROM PUBLIC';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.smsa_gallery_uploader_names(text[]) TO anon,authenticated';
 END IF;
END;
$install$;
COMMIT;
