-- Read-only metadata inspection. No user rows are selected.
select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','storage');
select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname='public';
select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage') and c.relkind='r';
select conrelid::regclass,conname,pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace;
select schemaname,viewname,definition from pg_views where schemaname='public';
select event_object_table,trigger_name,action_statement from information_schema.triggers where trigger_schema='public';
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets;
-- Function definitions can contain embedded credentials: review locally before sharing/exporting.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
