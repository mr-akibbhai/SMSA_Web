-- 01. Verify existing content setup; add only missing event/committee fields.
-- Verified baseline: site-media is already public/10 MB; batch-gallery may be private/unlimited.
-- Only migration 03 changes the gallery upload limits. No default/table grants are changed.
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

DO $existing$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ((n.nspname='public' AND c.relname IN ('site_content','profiles','batches','user_roles','events','committee_members','gallery_photos')) OR (n.nspname='storage' AND c.relname='objects')) AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'Expected existing RLS is disabled; inspect instead of changing permissions automatically'; END IF;
 IF to_regprocedure('public.is_admin()') IS NULL THEN RAISE EXCEPTION 'public.is_admin() is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.is_admin()'::regprocedure AND prorettype='boolean'::regtype) THEN RAISE EXCEPTION 'is_admin() must return boolean'; END IF;
 IF NOT has_function_privilege('authenticated','public.is_admin()','EXECUTE') THEN RAISE EXCEPTION 'authenticated requires existing is_admin EXECUTE permission; review grants manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.site_content'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'Existing site_content RLS must be enabled'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content' AND policyname='smsa_content_read') OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='site_content' AND policyname='smsa_content_write') THEN RAISE EXCEPTION 'Expected content policies missing; inspect rather than recreating automatically'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_media_read') OR NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='smsa_media_insert') THEN RAISE EXCEPTION 'Expected site-media policies missing; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid='public.site_content'::regclass AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=2 AND (SELECT array_agg(a.attname::text ORDER BY a.attname) FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum,pos) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum WHERE k.pos<=i.indnkeyatts)=ARRAY['key','kind']::text[]) THEN RAISE EXCEPTION 'Expected unique(kind,key) index/constraint missing; inspect manually'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='site-media' AND public AND file_size_limit=10485760 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']::text[] AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']::text[]) THEN RAISE EXCEPTION 'Existing site-media must be public, 10 MB and JPEG/PNG/WebP'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='batch-gallery' AND NOT public) THEN RAISE EXCEPTION 'Existing private batch-gallery is required'; END IF;
END;
$existing$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'uuid'), ('kind', 'text'), ('key', 'text'),
      ('title', 'text'), ('description', 'text'), ('image_url', 'text'),
      ('url', 'text'), ('enabled', 'boolean'), ('display_order', 'integer'),
      ('created_at', 'timestamp with time zone')
    ) AS required(column_name, data_type)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public' AND actual.table_name = 'site_content'
      AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL OR actual.data_type <> required.data_type
  ) THEN
    RAISE EXCEPTION 'Existing site_content schema is incompatible; inspect it before migrating';
  END IF;
END;
$$;

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.committee_members ADD COLUMN IF NOT EXISTS introduction text;
ALTER TABLE public.committee_members ADD COLUMN IF NOT EXISTS committee_year integer;
ALTER TABLE public.committee_members
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true;
-- Old committee rows remain current; no historical year is invented.
-- ADD COLUMN IF NOT EXISTS must not hide incompatible pre-existing types.
DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('events', 'image_url', 'text'),
      ('committee_members', 'introduction', 'text'),
      ('committee_members', 'committee_year', 'integer'),
      ('committee_members', 'is_current', 'boolean')
    ) AS required(table_name, column_name, data_type)
    LEFT JOIN information_schema.columns AS actual
      ON actual.table_schema = 'public'
      AND actual.table_name = required.table_name
      AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL OR actual.data_type <> required.data_type
  ) THEN
    RAISE EXCEPTION 'Existing event/committee column types differ; inspect before migrating';
  END IF;
END;
$migration$;

-- No CREATE TABLE/INDEX, policy changes, grants, admin-function or bucket changes.
COMMIT;
