// OFFLINE ONLY: ephemeral in-memory PostgreSQL; never imports Supabase or .env.
// Optional test dependency: @electric-sql/pglite, installed outside the project.
// Executes SQL: do not run while the user's no-SQL-execution restriction is active.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {eventPayload,committeePayload} from '../src/lib/cms.js';
const require=createRequire(import.meta.url);
const {PGlite}=require(process.env.SMSA_PGLITE_MODULE || '@electric-sql/pglite');
const inspection=JSON.parse(fs.readFileSync('supabase/cms_schema_inspection_result.txt','utf8').replace(/^\uFEFF/,''));
for(const key of ['tables','columns','constraints','indexes','policies','table_privileges','column_privileges','triggers','relevant_functions','public_field_inventory','server_version'])assert(key in inspection,`Incomplete inspection: ${key}`);
const sql=fs.readFileSync('supabase/migrations/20261119_cms_ordering.sql','utf8');
const db=new PGlite();
const identifier=value=>'"'+value.replaceAll('"','""')+'"';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
try {
  console.log('Offline PostgreSQL version:',(await db.query("SELECT current_setting('server_version') AS version")).rows[0].version,'; supplied live snapshot:',inspection.server_version);
  // Only identity/admin helpers are synthetic. Table/column/constraint/policy
  // definitions below come directly from the supplied metadata, without records.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('smsa.test_uid',true),'')::uuid $$;
    CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
    $$ SELECT coalesce(current_setting('smsa.test_admin',true),'false')::boolean $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
  for(const table of ['events','committee_members']){
    const fields=inspection.columns.filter(c=>c.table_name===table).map(c=>`${identifier(c.column_name)} ${c.data_type}${c.is_nullable==='NO'?' NOT NULL':''}${c.column_default==null?'':' DEFAULT '+c.column_default}`);
    const constraints=inspection.constraints.filter(c=>c.table_name===table).map(c=>`CONSTRAINT ${identifier(c.conname)} ${c.definition}`);
    await db.exec(`CREATE TABLE public.${table} (${[...fields,...constraints].join(',')}); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
  }
  for(const p of inspection.policies)await db.exec(`CREATE POLICY ${identifier(p.policyname)} ON public.${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(identifier).join(',')} USING (${p.qual})${p.with_check?' WITH CHECK ('+p.with_check+')':''};`);
  for(const p of inspection.table_privileges){
    const privileges=['SELECT','INSERT','UPDATE','DELETE'].filter(op=>p['can_'+op.toLowerCase()]);
    if(privileges.length)await db.exec(`GRANT ${privileges.join(',')} ON public.${p.table_name} TO ${p.role_name};`);
  }
  await db.exec(`INSERT INTO public.committee_members(id,name,position,committee_year,display_order)
    VALUES ('${a}','Synthetic A','President',2026,8),('${b}','Synthetic B','President',2026,4),('${c}','Synthetic C','Advisor',2025,NULL);
    INSERT INTO public.events(id,title) VALUES ('${a}','');`);
  const baseline=(await db.query(`SELECT c.relname,c.relacl::text,pg_get_functiondef('public.is_admin()'::regprocedure) AS admin_definition
    FROM pg_class c WHERE c.oid IN ('public.events'::regclass,'public.committee_members'::regclass) ORDER BY c.relname`)).rows;
  const originalPolicies=(await db.query("SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('events','committee_members') ORDER BY tablename,policyname")).rows;
  await db.exec(sql);
  await db.exec(sql); // Full repeat-run, including policy expression validation.
  assert.deepEqual((await db.query(`SELECT c.relname,c.relacl::text,pg_get_functiondef('public.is_admin()'::regprocedure) AS admin_definition
    FROM pg_class c WHERE c.oid IN ('public.events'::regclass,'public.committee_members'::regclass) ORDER BY c.relname`)).rows,baseline);
  assert.deepEqual((await db.query("SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('events','committee_members') AND policyname<>'smsa_event_visibility' ORDER BY tablename,policyname")).rows,originalPolicies);
  for(const [table,payload] of [['events',eventPayload({description:'Synthetic description-only event'})],['committee_members',committeePayload({name:'Synthetic',position:'President',committee_year:2026})]]){
    const columns=(await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',['public',table])).rows.map(c=>c.column_name);
    assert(Object.keys(payload).every(key=>columns.includes(key)),`Actual React ${table} payload columns must exist after migration`);
  }
  assert.deepEqual((await db.query('SELECT display_order FROM public.committee_members ORDER BY id')).rows.map(r=>r.display_order),[8,4,null],'Migration must not rewrite existing ranks');
  const identity=async(role,admin=false)=>{
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('smsa.test_uid',$1,false),set_config('smsa.test_admin',$2,false)",[role==='anon'?'':a,String(admin)]);
    await db.exec(`SET ROLE ${role}`);
  };
  const snapshot=async(year=2026)=>(await db.query("SELECT coalesce(jsonb_object_agg(id::text,jsonb_build_object('position',position,'display_order',display_order)),'{}'::jsonb) AS value FROM public.committee_members WHERE committee_year=$1",[year])).rows[0].value;
  const save=async(ids=[b,a],revision=0,year=2026,positions=['President','Advisor'],expectedMembers)=>db.query('SELECT public.smsa_save_committee_layout_v1($1,$2,$3,$4,$5) AS result',[year,positions,ids,revision,expectedMembers ?? await snapshot(year)]);
  await identity('anon');
  assert.equal((await db.query('SELECT public.smsa_get_committee_layouts_v1() AS result')).rows[0].result.version,1);
  await assert.rejects(()=>save(),error=>error.code==='42501');
  await identity('authenticated');
  await assert.rejects(()=>save(),error=>error.code==='42501');
  await identity('authenticated',true);
  const saved=(await save()).rows[0].result.layout;
  assert.deepEqual(saved,{year:2026,positions:['President','Advisor'],member_ids:[b,a],revision:1});
  assert.deepEqual((await db.query('SELECT display_order FROM public.committee_members ORDER BY id')).rows.map(r=>r.display_order),[2,1,null]);
  const stableSnapshot=await snapshot();
  await db.exec(`UPDATE public.committee_members SET position='Advisor' WHERE id='${a}'`);
  await assert.rejects(()=>save([a,b],1,2026,['President','Advisor'],stableSnapshot),error=>error.code==='40001','Same-ID position edit is stale');
  await db.exec(`UPDATE public.committee_members SET position='President',display_order=99 WHERE id='${a}'`);
  await assert.rejects(()=>save([a,b],1,2026,['President','Advisor'],stableSnapshot),error=>error.code==='40001','Direct rank edit is stale');
  await db.exec(`UPDATE public.committee_members SET display_order=2 WHERE id='${a}'`);
  await assert.rejects(()=>save([a,b],0),error=>error.code==='40001');
  await assert.rejects(()=>save([a],1),error=>error.code==='40001');
  await assert.rejects(()=>save([a,b,b],1),error=>error.code==='22023');
  await assert.rejects(()=>save([a,c],1),error=>error.code==='40001');
  await assert.rejects(()=>save([a,b],1,2026,['President','President']),error=>error.code==='22023');
  await assert.rejects(()=>save([a,b],-1),error=>error.code==='22023');
  await assert.rejects(()=>save([a,b],1,2026,null),error=>error.code==='22023');
  await assert.rejects(()=>save([],0,2027),error=>error.code==='22023','Do not publish an empty committee year');
  await assert.rejects(()=>db.exec("UPDATE public.smsa_committee_layouts_v1 SET revision=100"),error=>error.code==='42501');
  await assert.rejects(()=>db.exec('DELETE FROM public.smsa_committee_layouts_v1'),error=>error.code==='42501');
  await assert.rejects(()=>db.exec('TRUNCATE public.smsa_committee_layouts_v1'),error=>error.code==='42501');
  await db.exec(`UPDATE public.events SET enabled=false WHERE id='${a}';`);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.events')).rows[0].count,1,'Admin reads disabled event');
  await identity('anon');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.events')).rows[0].count,0);
  await identity('authenticated');
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.events')).rows[0].count,0);
  assert.equal((await db.query(`UPDATE public.committee_members SET name='Denied' WHERE id='${a}' RETURNING id`)).rows.length,0,'Existing admin-only committee RLS preserved');
  await identity('authenticated',true);
  await db.exec(`INSERT INTO public.committee_members(id,name,position,committee_year) VALUES ('00000000-0000-4000-8000-000000000004','Synthetic D','Advisor',2026)`);
  await assert.rejects(()=>save([a,b],1),error=>error.code==='40001','Stale member list rejected');
  assert.equal((await db.query('SELECT public.smsa_get_committee_layouts_v1() AS result')).rows[0].result.layouts[0].revision,1,'Rejected writes leave revision unchanged');
  await db.exec('RESET ROLE');
  await db.exec(sql);
  assert.equal((await db.query('SELECT revision FROM public.smsa_committee_layouts_v1')).rows[0].revision,1,'Repeat-run preserves saved data');
  await db.exec('ALTER TABLE public.events ALTER COLUMN enabled SET DEFAULT false');
  await assert.rejects(()=>db.exec(sql),/DEFAULT true/);
  await db.exec('ROLLBACK; ALTER TABLE public.events ALTER COLUMN enabled SET DEFAULT true');
  await db.exec('GRANT TRUNCATE ON public.committee_members TO authenticated');
  await assert.rejects(()=>db.exec(sql),/TRUNCATE existing tables/);
  await db.exec('ROLLBACK; REVOKE TRUNCATE ON public.committee_members FROM authenticated');
  await db.exec('ALTER TABLE public.smsa_committee_layouts_v1 DROP CONSTRAINT smsa_committee_layouts_v1_pkey');
  await assert.rejects(()=>db.exec(sql),/PK\/CHECK\/default drift/);
  await db.exec('ROLLBACK; ALTER TABLE public.smsa_committee_layouts_v1 ADD PRIMARY KEY(year)');
  await db.exec("COMMENT ON TABLE public.smsa_committee_layouts_v1 IS 'unrelated'");
  await assert.rejects(()=>db.exec(sql),/Unrecognized existing committee layout table/);
  await db.exec('ROLLBACK');
  console.log('PASS: offline PostgreSQL migration syntax/PLpgSQL, repeat-run, existing grants/admin helper/ranks preserved; optional event title, disabled-event visibility, public read/member denial/admin save, atomic rank/revision updates, stale membership/conflict/invalid payload rejection, direct layout writes denied, unrelated-object collision rejected.');
  console.log('LIMIT: synthetic auth helpers; no live Supabase/JWT/PostgREST or multi-session concurrency test.');
} finally {await db.close();}
