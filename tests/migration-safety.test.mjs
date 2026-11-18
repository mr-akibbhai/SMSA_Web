import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='supabase/migrations/';
const content=fs.readFileSync(root+'20261117_content_features.sql','utf8');
const gallery=fs.readFileSync(root+'20261117_gallery_guards.sql','utf8');
const ui=fs.readFileSync(root+'20261119_ui_experience.sql','utf8');
const batch=fs.readFileSync(root+'20261119_batch_actions.sql','utf8');
const strip=s=>s.replace(/^\s*--.*$/gm,'');
for(const sql of [content,gallery,ui,batch]){
 assert(!/ALTER DEFAULT PRIVILEGES|ALTER POLICY|GRANT ALL|DROP TABLE|CREATE TABLE/i.test(strip(sql)));
 assert(!/CREATE(?: OR REPLACE)? FUNCTION public\.(?:is_admin|protect_profile_status|check_gallery_batch_limit)\s*\(/i.test(strip(sql)));
 assert(!/CREATE(?: OR REPLACE)? TRIGGER (?:gallery_batch_limit_trigger|protect_profile_status|smsa_gallery_guard)\b/i.test(strip(sql)));
}
assert(ui.includes('file_size_limit IS NULL OR file_size_limit IN (52428800,10485760)'));
assert(ui.indexOf('DO $column_types$')<ui.indexOf('ALTER TABLE public.events ADD COLUMN'));
assert(/WHERE id='batch-gallery' AND NOT public/.test(ui));
assert(!/UPDATE storage\.buckets[^;]+site-media/.test(ui));
assert(batch.includes('b.is_active=true'));
assert(batch.includes('NOT same_reference'));
assert(batch.includes('AND provolatile=\'v\' AND pg_get_function_result(oid)=\'boolean\''));
assert(batch.includes('FOR SHARE'));
assert(batch.includes('FOR UPDATE'));
assert(batch.includes('READ COMMITTED'));
for(const name of ['smsa_lock_profile_batch','smsa_lock_committee_batch','smsa_lock_content_batch','smsa_lock_gallery_batch','smsa_lock_storage_batch','smsa_protect_batch_delete']){
 assert(batch.includes('CREATE TRIGGER '+name),name+' installation missing');
 assert(batch.includes("'"+name+"'"),name+' runtime prerequisite missing');
}
assert(batch.includes('fk.conkey,fk.confkey,fk.conpfeqop'));
assert(batch.includes('jsonb_populate_record(NULL::public.batches,$1)'));
assert(!batch.includes('WHERE parent.id'));
assert(batch.includes('USING target_batch'));
assert(batch.includes('IF matches IS NULL THEN RAISE'));
assert(batch.includes('SELECT public.smsa_assert_batch_reference_guards();'));
console.log('PASS: unlimited bucket transition, early type checks, active selection, complete reference guards, actual FK columns/operators, protected-object/permission preservation. Static only; no SQL execution.');
