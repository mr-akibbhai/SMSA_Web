-- Additive content migration. Does not change existing table RLS/permissions
-- or the batch-gallery bucket. Review in staging before production use.
BEGIN;

-- Reuse the project's existing admin function; never replace its definition
-- or change its EXECUTE grants here.
DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Required existing function public.is_admin() is missing';
  END IF;
  IF (SELECT prorettype <> 'boolean'::regtype
      FROM pg_proc WHERE oid = 'public.is_admin()'::regprocedure) THEN
    RAISE EXCEPTION 'public.is_admin() must return boolean';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('official', 'batch', 'social', 'carousel')),
  key text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_content_kind_key_key UNIQUE (kind, key),
  CHECK (url = '' OR url ~ '^https://'),
  CHECK (image_url = '' OR image_url ~ '^https://')
);

-- CREATE TABLE IF NOT EXISTS does not repair an incompatible existing table.
-- Fail safely rather than silently skipping columns required by React.
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

-- Required by ContentManager.upsert(..., { onConflict: 'kind,key' }).
-- If an existing table has duplicate keys, this fails without deleting rows.
CREATE UNIQUE INDEX IF NOT EXISTS site_content_kind_key_key
  ON public.site_content (kind, key);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
-- Only this new content table's API grants are managed by this migration.
REVOKE ALL ON public.site_content FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;

-- Reconcile only this migration's named content policies on repeat runs.
-- Anonymous reads never need permission to execute is_admin().
-- The permissive FOR ALL admin policy also allows SELECT of disabled rows.
-- Together: enabled OR is_admin() for authenticated reads, enabled for anon.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'site_content' AND policyname = 'smsa_content_read') THEN
    CREATE POLICY smsa_content_read ON public.site_content
      FOR SELECT TO anon, authenticated USING (enabled);
  ELSE
    ALTER POLICY smsa_content_read ON public.site_content
      TO anon, authenticated USING (enabled);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'site_content' AND policyname = 'smsa_content_write') THEN
    CREATE POLICY smsa_content_write ON public.site_content
      FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  ELSE
    ALTER POLICY smsa_content_write ON public.site_content
      TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;
END;
$$;

-- Existing policies/grants remain responsible for admin-only event and
-- committee writes. Existing profile/batch/role permissions are untouched.
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

-- React ImageUpload uses <user UUID>/<random filename> for member pictures
-- and admin/<random filename> for admin-managed public images.
-- Do not overwrite an existing bucket's configuration on a repeat run.
INSERT INTO storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('site-media', 'site-media', true, 5242880,
   ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- getPublicUrl() requires a public bucket. Fail safely on configuration drift.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'site-media' AND name = 'site-media' AND public = true
      AND file_size_limit = 5242880
      AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
      AND allowed_mime_types <@ ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
  ) THEN
    RAISE EXCEPTION 'Existing site-media settings differ; review public visibility, 5 MB limit and allowed image types manually';
  END IF;
END;
$$;

-- Check schema/table/policy names before creation; never drop/replace
-- existing storage policies or alter storage.objects grants/RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
      AND tablename = 'objects' AND policyname = 'smsa_media_read') THEN
    CREATE POLICY smsa_media_read ON storage.objects
      FOR SELECT TO anon, authenticated USING (bucket_id = 'site-media');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
      AND tablename = 'objects' AND policyname = 'smsa_media_insert') THEN
    CREATE POLICY smsa_media_insert ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'site-media' AND (
          (storage.foldername(name))[1] = auth.uid()::text
          OR ((storage.foldername(name))[1] = 'admin' AND public.is_admin())
        )
      );
  END IF;


END;
$$;
-- No object UPDATE or DELETE policies: React uploads new UUID paths without
-- upsert and never deletes site-media objects, even when content is removed.
-- Already-applied policies are not revoked or dropped by this migration.
-- No changes to profiles, batches, user_roles, gallery_photos, batch-gallery,
-- existing admin functions, existing table policies, or existing table grants.
COMMIT;
