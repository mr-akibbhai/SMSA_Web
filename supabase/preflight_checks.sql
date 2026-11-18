-- READ ONLY. Run locally in SQL Editor; no application records are exported.
-- Function definitions may contain sensitive literals: do not post the output unredacted.
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
SELECT md5(state::text) AS review_fingerprint,state AS metadata_to_review FROM reviewed_state;

-- Incoming foreign keys: inspect cascades and every referencing table.
SELECT conrelid::regclass AS referencing_table,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' AND confrelid='public.batches'::regclass;

-- Actor-independent privileges; RLS expressions still need an actor-by-actor review.
SELECT role_name,has_table_privilege(role_name,'public.site_content','SELECT') AS content_read,
 has_table_privilege(role_name,'public.site_content','INSERT') AS content_insert,
 has_table_privilege(role_name,'public.site_content','UPDATE') AS content_update,
 has_table_privilege(role_name,'public.site_content','DELETE') AS content_delete,
 has_function_privilege(role_name,'public.is_admin()','EXECUTE') AS admin_check_execute
FROM (VALUES ('anon'),('authenticated')) AS roles(role_name);

-- Full API grant matrix (these booleans do NOT evaluate RLS predicates).
SELECT r.role_name,n.nspname AS schema_name,c.relname,
 has_schema_privilege(r.role_name,n.oid,'USAGE') AS schema_usage,
 has_table_privilege(r.role_name,c.oid,'SELECT') AS can_select,
 has_table_privilege(r.role_name,c.oid,'INSERT') AS can_insert,
 has_table_privilege(r.role_name,c.oid,'UPDATE') AS can_update,
 has_table_privilege(r.role_name,c.oid,'DELETE') AS can_delete
FROM (VALUES ('anon'),('authenticated')) r(role_name)
CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname='public' AND c.relname IN ('site_content','events','committee_members','profiles','batches','user_roles','gallery_photos'))
 OR (n.nspname='storage' AND c.relname='objects')
ORDER BY r.role_name,n.nspname,c.relname;

-- The sole legacy limit and the status-protection trigger must be inspected.
SELECT t.tgrelid::regclass AS table_name,t.tgname,t.tgenabled,
 pg_get_triggerdef(t.oid) AS trigger_definition,
 p.oid::regprocedure AS function_signature,pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE NOT t.tgisinternal AND (t.tgrelid IN ('public.gallery_photos'::regclass,'public.profiles'::regclass,'public.batches'::regclass));

-- Concurrency protocol and managed Storage trigger prerequisites (read-only).
SELECT current_setting('transaction_isolation') AS transaction_isolation,
 current_setting('session_replication_role') AS session_replication_role,
 current_setting('server_version_num') AS server_version_num,
 has_table_privilege(current_user,'storage.objects','TRIGGER') AS can_install_storage_reference_trigger;

-- Actual FK column pairs/operators: no assumption that referenced columns are id.
SELECT fk.conname,fk.conrelid::regclass AS child_table,child_col.attname AS child_column,
 parent_col.attname AS referenced_column,op.oid::regoperator AS parent_to_child_equality
FROM pg_constraint fk
CROSS JOIN LATERAL unnest(fk.conkey,fk.confkey,fk.conpfeqop) WITH ORDINALITY keys(child_num,parent_num,operator_oid,pos)
JOIN pg_attribute child_col ON child_col.attrelid=fk.conrelid AND child_col.attnum=keys.child_num
JOIN pg_attribute parent_col ON parent_col.attrelid=fk.confrelid AND parent_col.attnum=keys.parent_num
JOIN pg_operator op ON op.oid=keys.operator_oid
WHERE fk.contype='f' AND fk.confrelid='public.batches'::regclass
ORDER BY fk.conname,keys.pos;

-- Group policies by actor/operation so permissive OR + restrictive AND can be
-- reviewed together. This lists predicates; it DOES NOT execute them under a JWT.
WITH actors AS (SELECT oid,rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')),
operations(command,code) AS (VALUES ('SELECT','r'),('INSERT','a'),('UPDATE','w'),('DELETE','d')),
targets AS (
 SELECT c.oid,c.relname,c.relrowsecurity,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname='public' AND c.relname IN ('site_content','profiles','batches','user_roles','events','committee_members','gallery_photos'))
 OR (n.nspname='storage' AND c.relname='objects')
)
SELECT a.rolname,t.nspname,t.relname,o.command,t.relrowsecurity,
 has_table_privilege(a.oid,t.oid,o.command) AS table_grant,
 coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) FILTER(WHERE p.oid IS NOT NULL AND p.polpermissive),'[]'::jsonb) AS permissive_or,
 coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))) FILTER(WHERE p.oid IS NOT NULL AND NOT p.polpermissive),'[]'::jsonb) AS restrictive_and
FROM actors a CROSS JOIN targets t CROSS JOIN operations o
LEFT JOIN pg_policy p ON p.polrelid=t.oid AND p.polcmd::text IN ('*',o.code)
 AND (0=ANY(p.polroles) OR EXISTS(SELECT 1 FROM unnest(p.polroles) AS role_list(role_oid) WHERE CASE WHEN role_list.role_oid<>0 THEN pg_has_role(a.oid,role_list.role_oid,'USAGE') ELSE false END))
GROUP BY a.oid,a.rolname,t.oid,t.nspname,t.relname,o.command,t.relrowsecurity
ORDER BY a.rolname,t.nspname,t.relname,o.command;
