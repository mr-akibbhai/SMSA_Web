# Homepage correction-এর পরে database boundary

Homepage Committee এখন Alumni-এর ঠিক পরে independent section; কোনো নতুন page/submenu/table নয়। এই correction-এর জন্য কোনো SQL change/apply দরকার হয়নি। Existing committee_members/year/is_current এবং ordering adapter ব্যবহৃত; production flag false। Current local browser/build checks mock verification মাত্র।

আগের revised CMS migration, privilege inspection, approval ও runtime verification pending অবস্থাতেই আছে। এই navigation delivery migration চালানো, পুরোনো চার migration prerequisite হিসেবে চালানো বা flag activate করার অনুমোদন নয়। এই turn-এ SQL runtime test করা হয়নি। বিস্তারিত current delivery: HANDOVER_BN.md-এর প্রথম অংশ।

---

# সর্বশেষ audit নির্দেশনা — apply/activation বন্ধ

এই revised migration-এ save RPC এখন পাঁচ argument (শেষটি p_expected_members jsonb)। Supplied inspection-এ TRUNCATE/role flags/table owners/function settings নেই; অতিরিক্ত read-only query supabase/inspect_ordering_privileges.sql প্রস্তুত, চালানো হয়নি। Unsafe privilege/schema drift হলে migration abort করবে, existing grants বদলাবে না। Existing four-argument RPC পাওয়া গেলে manual review ছাড়া apply নয়।

এই ধাপে SQL/PGlite কিছুই execute হয়নি। আগের চার-argument draft-এর PostgreSQL 17.5/18.7 tests revised SQL-এর verification নয়। বর্তমান SQL/PLpgSQL parser, static/unit, mock browser/production build পাস; actual revised apply/reapply/locking/JWT tests বাকি। Exact findings/file-lines: HANDOVER_BN.md-এর প্রথম অংশ।

স্পষ্ট approval এবং missing inspection review-এর আগে migration apply বা production flag true করা যাবে না। পুরোনো নিচের নির্দেশনায় member-set checks পড়লে নতুন position/display_order snapshot check-ও প্রযোজ্য।

---

# বর্তমান CMS ordering পরিকল্পনা — inspection যাচাই: ১৯ নভেম্বর ২০২৬

**অবস্থা: review/approval-এর জন্য প্রস্তুত; live SQL apply হয়নি।** এই অংশটি শুধু events ও committee ordering-এর বর্তমান upgrade নির্দেশনা। নিচের পুরোনো চার-file পরিকল্পনা এই feature-এর prerequisite নয়।

## নিশ্চিত inspection

supabase/cms_schema_inspection_result.txt: 40,839 bytes, valid সম্পূর্ণ JSON, প্রত্যাশিত ১১টি top-level field উপস্থিত; PostgreSQL 17.11। এটি metadata snapshot; বর্তমান live state পরে বদলাতে পারে। Application records বা is_admin function body এতে নেই।

- events: id uuid PK/default gen_random_uuid(); title text NOT NULL/default নেই; description text, event_date date, location text, created_at timestamptz nullable। title non-empty CHECK নেই। image_url ও enabled অনুপস্থিত।
- committee_members: id uuid PK; name ও position text NOT NULL; batch ও photo_url text nullable; display_order integer nullable/default 0; created_at timestamptz nullable/default now(); introduction text NOT NULL/default ''; committee_year integer nullable; is_current boolean NOT NULL/default true।
- Constraints ও indexes: প্রত্যেক table-এ শুধু id primary key এবং তার unique btree index। Inspection-এ কোনো অতিরিক্ত CHECK/UNIQUE/FK/incoming FK বা user trigger নেই।
- উভয় table-এ RLS enabled, FORCE RLS false। Public SELECT policy true; authenticated Admin ALL USING/WITH CHECK is_admin()। Anon SELECT grant আছে, table-level write grant নেই। Authenticated CRUD grant আছে, কিন্তু RLS write admin-এ সীমাবদ্ধ করে। Column grants-ও export-এ আছে; migration কোনো existing table/column grants পরিবর্তন করে না।
- is_admin(): boolean, STABLE, SECURITY DEFINER; authenticated EXECUTE আছে। Definition ও ACL বদলানো হবে না।

## প্রস্তাবিত SQL ও execution order

1. **এখন কোনো SQL চালাবেন না।** 20261119_cms_ordering.sql review করে স্পষ্ট approval দিন।
2. Approval-এর পরে backup/staging এবং একই read-only inspection দিয়ে schema/policy drift পরীক্ষা করুন। Migration-এর preflight expected column types, RLS ও baseline policy drift হলে abort করবে।
3. শুধু supabase/migrations/20261119_cms_ordering.sql একটি সম্পূর্ণ transaction হিসেবে manually apply করার প্রস্তাব। আগের 20261117_content_features.sql, 20261117_gallery_guards.sql, 20261119_batch_actions.sql ও 20261119_ui_experience.sql এই কাজের জন্য চালানোর প্রয়োজন নেই; সেগুলোর আলাদা dependencies/review বজায় আছে। এই review তাদের live compatibility অনুমোদন নয়।
4. Live role tests এবং দুই admin session-এর conflict test পাসের পর src/lib/cms-capabilities.js-এ committeeOrderingReady true করা যাবে। বর্তমান false মান অপরিবর্তিত; production নতুন ordering RPC ডাকে না।

## নতুন migration কী করবে

- events.image_url text nullable এবং events.enabled boolean NOT NULL DEFAULT true যোগ করবে। Existing records delete/rewrite করবে না; নতুন enabled default পুরোনো events visible রাখে। title NOT NULL অক্ষুণ্ণ; optional title-এর জন্য React খালি string পাঠায়, NULL নয়।
- Existing permissive events policies রেখে একটি restrictive SELECT policy যোগ করবে: public enabled events পড়বে, admins disabled-ও পড়বে। Existing read grant ও public permissive policy থাকায় restrictive policy একা কোনো permission দেয় না। Committee policies অপরিবর্তিত।
- public.smsa_committee_layouts_v1: year PK, positions text[], member_ids uuid[], revision integer। Empty/custom position ও per-year revision রাখার জন্য পৃথক metadata দরকার; member records duplicate হয় না। Existing display_order শুধু admin explicit Save-এ member rank হিসেবে update হবে; migration নিজে পুরোনো ranks update করবে না।
- নতুন metadata table-এ RLS public SELECT; anon/authenticated সরাসরি write grant পাবে না। নতুন save RPC SECURITY DEFINER, auth.uid()/public.is_admin() check, fixed pg_catalog,pg_temp search_path ও সীমিত EXECUTE grant ব্যবহার করবে। Read RPC SECURITY INVOKER/STABLE। Existing default privileges পরিবর্তন নয়; শুধু নিজের নতুন objects-এর permissions নির্দিষ্ট করা হবে।
- Save transaction committee_members-এ SHARE ROW EXCLUSIVE lock নিয়ে INSERT/UPDATE/DELETE-র সঙ্গে serialize করবে; public SELECT চলতে পারে। তারপর exact year-member set ও expected revision পরীক্ষা করে member ranks এবং layout atomically লিখবে। Invalid/stale request exception হলে সব rollback। No members থাকলে empty year publish করবে না। Lock timeout 5 seconds; committee CRUD/save-এর স্বল্প অপেক্ষা বা retry লাগতে পারে। READ COMMITTED প্রয়োজন।
- Migration rerun data মুছে না; unrelated name collision বা changed existing event visibility policy abort করে। নিজস্ব marked functions-ই replace হতে পারে; is_admin বা পুরোনো functions/triggers নয়।
- Storage bucket visibility/limits/MIME/policies, site_content, profiles, batches, user_roles ও gallery অপরিবর্তিত। উভয় bucket-এর confirmed 10 MB JPEG/PNG/WebP settings অক্ষুণ্ণ।

## স্থানীয় যাচাই সম্পন্ন

- npm.cmd test, npm.cmd run test:migrations, npm.cmd run test:browser (390px ও 1440px; 320px overflow checks), production smoke ও npm.cmd run build পাস। Browser-এর external requests স্থানীয়ভাবে fulfil করা হয়েছে; Supabase network connection নয়।
- সম্পূর্ণ নতুন migration SQL ও PL/pgSQL parser পাস।
- tests/committee-migration.test.mjs দিয়ে temporary **in-memory PGlite/PostgreSQL 17.5 ও 18.7**-এ migration apply/reapply পাস। Live snapshot 17.11; exact Supabase runtime নয়। Table/column definitions, constraints ও চারটি existing policies inspection থেকে নেওয়া; auth.uid/is_admin ও records কৃত্রিম। Existing grants/policies/admin helper/ranks preservation; actual React payload columns; public read/member denial/admin atomic save; stale revision/member-set/invalid payload rollback; disabled-event visibility; saved data retained on rerun; unrelated-object collision rejection পাস।
- Multi-session contention, actual is_admin body/JWT, Supabase PostgREST response ও live ownership এখানে যাচাই হয়নি।
- Optional isolated test dependency project package/lockfile-এ যোগ করা হয়নি। Reproduce করতে বাইরে temporary directory-তে @electric-sql/pglite install করে SMSA_PGLITE_MODULE-এ তার absolute module path দিন; তারপর node tests/committee-migration.test.mjs চালান। এই shell variable credential নয়; .env বদলানোর প্রয়োজন নেই। ব্যবহৃত package archive official npm SHA512 integrity দিয়ে যাচাই করা হয়েছে।
- PostgreSQL function security ও locking reference: https://www.postgresql.org/docs/17/sql-createfunction.html এবং https://www.postgresql.org/docs/17/explicit-locking.html ।

## Approval-এর পরে live acceptance tests

- Anon ও normal member: enabled event ও committee/layout read; disabled event hidden; ordering write/direct metadata writes denied।
- Admin: disabled event read/edit; untitled image/description event save; একই পদে একাধিক member reorder; position reorder/custom empty position; year-specific order reload ও public view।
- একই revision থেকে দুই admin save: প্রথমটি success, দ্বিতীয়টি 40001; reload করে retry। Member insert/delete/year move-এর সঙ্গে concurrent save: partial ranks/layout নয়; changed membership হলে 40001।
- পুরোনো member/name/position/year/photo অপরিবর্তিত; অন্য বছরের ranks অপরিবর্তিত। Existing profile/gallery flows ও Storage policies/settings অপরিবর্তিত যাচাই।
- PostgREST RPC cache/schema reload, real JWT/admin function behavior, deployment role ownership ও multi-session locking স্থানীয় mock দিয়ে সম্পূর্ণ প্রমাণ করা যায় না।

---

# Existing live SMSA database: manual migration review plan

## সর্বশেষ live Storage confirmation — ১৯ নভেম্বর ২০২৬

ব্যবহারকারীর Supabase inspection result অনুযায়ী:

| Bucket | Public | File size limit | Allowed MIME types |
|---|---|---|---|
| batch-gallery | false | 10485760 bytes (10 MB) | image/jpeg, image/png, image/webp |
| site-media | true | 10485760 bytes (10 MB) | image/jpeg, image/png, image/webp |

এই current settings সংরক্ষণ করতে হবে। Visibility, size, MIME বা existing Storage policies পরিবর্তনের demonstrated requirement নেই। Frontend-এর 10 MB/JPEG-PNG-WebP validation ইতিমধ্যে এই settings-এর সঙ্গে মেলে; bucket পরিবর্তনের migration প্রয়োজন নেই। পুরোনো NULL/unlimited/50 MB baseline শুধু historical তথ্য—বর্তমান live state নয়। Bucket settings বদলানোর জন্য পুরোনো migration-এর bucket section চালাবেন না; অন্য sections প্রয়োজন হলে actual schema/policies ও migration history আলাদা review করতে হবে।

এটি events/committee_members column definitions, constraints বা Storage policy expressions নিশ্চিত করে না। Table inspection এবং live CRUD/RLS verification এখনও pending। এখানে Supabase-এ connect বা SQL execute করা হয়নি; তথ্যের উৎস ব্যবহারকারীর live inspection।


এই নথি HANDOVER_BN.md-এর পুরোনো fresh-install SQL নির্দেশনার পরিবর্তে প্রযোজ্য। Source code unchanged in this task. কোনো live SQL চালানো হয়নি।

## ব্যবহারকারীর live audit-এ যাচাইকৃত baseline; এখানে স্বাধীন live verification হয়নি

- site_content, তার columns/unique constraint/RLS এবং smsa_content_read/write policies আছে।
- site-media public, 10485760 bytes, JPEG/PNG/WebP।
- Current confirmed batch-gallery: private, 10485760 bytes (10 MB), JPEG/PNG/WebP। আগে রিপোর্ট করা NULL/unlimited এবং 50 MB state historical; transition code আছে বলে এখন সেটি execute করা প্রয়োজন নয়।
- gallery_batch_limit_trigger -> check_gallery_batch_limit() আছে।
- protect_profile_status trigger আছে; তার function body project-এ নেই।
- public.is_admin() existing; তার definition/ACL পরিবর্তন করা হবে না।

Project-এ actual policy/trigger exports পাওয়া যায়নি। আগের inspection SQL শুধু query, live ফল নয়। তাই combined RLS correctness যাচাই হয়েছে বলা যাবে না।

## আগে যেসব checks করবেন

1. SQL Editor-এ `supabase/preflight_checks.sql` চালান। এটি metadata-only SELECT; application records export করে না। Function definitions-এ sensitive literal থাকতে পারে—output unredacted প্রকাশ করবেন না।
2. প্রথম result-এর metadata_to_review-তে columns/defaults/constraints/indexes, সব public/storage permissive ও restrictive policies, table/column grants, role memberships, triggers/functions/owners/ACLs এবং bucket settings পড়ুন। পরের ফলাফলে FK ও grant matrix আছে।
3. `is_admin()` JWT/auth.uid()-ভিত্তিক সঠিক caller যাচাই করে কি না, authenticated EXECUTE permission আছে কি না দেখুন। Helpers-এর SECURITY DEFINER context-এ admin test ভুল হলে থামুন; is_admin নিজে এই migrations বদলায় না।
4. Legacy `check_gallery_batch_limit()` ও `gallery_batch_limit_trigger` inspect করুন: শুধু APPROVED photo limit 100 কি না; approval UPDATE-তেও কাজ করে কি না; নিজের existing row exclude করে কি না; concurrent approvals সঠিকভাবে serialize করে কি না। এর definition না দেখে migration-কে সম্পূর্ণ compatible অনুমোদন দেবেন না।
5. `smsa_gallery_guard` নামে পুরোনো proposed trigger live-এ থাকলে gallery migration থামবে। সেটি ও legacy trigger একসঙ্গে inspect করে কোন দায়িত্ব কোথায় থাকবে নির্ধারণ করতে হবে। নতুন migration নিজে কোনোটিই drop/disable করে না, নতুন limit trigger-ও যোগ করে না।
6. `protect_profile_status`-এর body ও event/timing দেখুন। নতুন batch-reference lock trigger শুধু reference lock করে; approval_status বদলায় না। কিন্তু existing custom trigger interaction staging-এ পরীক্ষা করতে হবে।
7. site_content-এর manually-created types/defaults/grants মিলিয়ে নিন। Missing schema বা unexpected policy/trigger mode পেলে scripts auto-repair/overwrite না করে থামবে। Kind CHECK custom হলে UI migration manual adjustment লাগতে পারে।
8. profile/member/gallery IDs ও foreign keys, committee_members.batch, public_alumni.id/full_name types মেলান। Batch reference checker committee, legacy/canonical content keys, ID/name-based storage folders এবং সব declared incoming FK অন্তর্ভুক্ত করে। Undeclared custom references থাকলে আলাদাভাবে যুক্ত করতে হবে।

## Combined RLS কীভাবে review করবেন

প্রতি operation ও caller-এর জন্য: applicable permissive policies-এর OR এবং restrictive policies-এর AND—দুটিই পাস করতে হয়; table/schema/column grants-ও প্রয়োজন। Policy থাকা মানেই permission পাওয়া নয়। UPDATE-এ SELECT visibility, USING ও WITH CHECK; Storage DELETE-তে SELECT ও DELETE access মিলতে হবে।

| Operation | প্রত্যাশিত ফল |
|---|---|
| Anonymous approved gallery/table/object read | Allow |
| Anonymous pending/rejected gallery read | Deny |
| Member own permitted pending/rejected read | Allow |
| Member অন্যের pending/rejected read | Deny |
| Member own active batch upload, pending submission | Allow |
| Member অন্য batch/inactive batch upload | Deny |
| Member photo approve/reject/delete referenced images | Deny |
| Admin review/delete gallery | Allow |
| Failed new upload-এর own orphan cleanup | প্রয়োজনীয় existing allow policy থাকলে Allow |
| site_content disabled read | Admin only |
| site-media own-folder upload | Owner; admin folder admin only |
| Profile create/update | Own user or authorised admin; protected status rules retained |
| Batch/event/committee management | Admin only |

নতুন restrictive guards permission বাড়ায় না। পুরোনো permissive policy-তে exact legacy-name comparison থাকলে নতুন normalizer যোগ করলেও upload আটকে যেতে পারে। সেই নির্দিষ্ট expression inspect করে justified পরিবর্তন করতে হবে; অজানা policies স্বয়ংক্রিয় rewrite করা হয়নি। Existing named guards-ও রাখা হয়, তাই তাদের expressions আলাদা review জরুরি।

## Review fingerprint কেন এবং কীভাবে

অজানা live definitions অনুমান করে overwrite ঠেকাতে প্রতিটি file শুরুতে metadata fingerprint মিলিয়ে দেখে। এটি review acknowledgement, credential নয় এবং automated security certification নয়।

প্রতি migration-এর ঠিক আগে:

1. preflight checks আবার চালিয়ে নতুন `review_fingerprint` নিন।
2. সংশ্লিষ্ট file-এর changes এবং metadata review করুন।
3. একই SQL Editor execution-এ নিচের prefix এবং সেই file-এর সম্পূর্ণ SQL একসঙ্গে চালাবেন:

```sql
SELECT set_config('smsa.reviewed_state', '<review_fingerprint>', false);
-- Paste ONE reviewed migration here, including its BEGIN/COMMIT.
```

Fingerprint ছাড়া বা state বদলে গেলে transaction থামবে। আগের file শেষ হলে metadata বদলাতে পারে—পরের file-এর জন্য preflight আবার চালাতে হবে। আলাদা pooled connection-এ আগে SET চালিয়ে পরে file চালানোর ওপর নির্ভর করবেন না। পুরোনো fingerprint অন্ধভাবে পুনর্ব্যবহার করবেন না।

## সঠিক manual execution order

1. `supabase/migrations/20261117_content_features.sql`
   - Existing setup যাচাই; missing event/committee columns ছাড়া table/policy/grant/bucket recreate নয়।
   - Existing unique constraint যেকোনো নামে হতে পারে; key/kind index ও types যাচাই হয়।
2. `supabase/migrations/20261117_gallery_guards.sql`
   - Existing legacy limit function/trigger untouched। Canonical helper ও scoped restrictive ownership/visibility guards।
   - Existing named policy definitions ALTER হয় না। Unexpected mode/roles হলে থামে।
3. `supabase/migrations/20261119_ui_experience.sql`
   - UI columns, reviewed About kind extension, missing-only event visibility cap, uploader RPC।
   - site-media ইতিমধ্যে সঠিক হলে কোনো UPDATE নয়। শুধু পরিচিত private batch-gallery-এর NULL/unlimited বা 50 MB settings 10 MB/JPEG-PNG-WebP করা হয়। পুরোনো বড়/অন্যান্য format-এর object মুছে না। Public flags বদলায় না।
4. `supabase/migrations/20261119_batch_actions.sql`
   - Gallery normalizer dependency-এর পরে। Committee-সহ references ও incoming FK checks; explicit inactive empty-batch delete।
   - Installing RPC deletes nothing. Delete remains SECURITY INVOKER and existing RLS still applies। Profile, committee, site_content, gallery row এবং private gallery Storage object-এর reference-only triggers parent batch row-তে FOR SHARE lock নেয়। Delete/rename একই row lock-এর সঙ্গে সমন্বয় করে। protect_profile_status অক্ষত; same-name unexpected triggers overwrite হয় না।

নতুন helpers missing হলে create হয়। Existing helper body/security/volatility/signature মিলে গেলে rewrite skip হয়। প্রয়োজনীয় helper revision হলে metadata review-এর পরে শুধু own smsa_* helper বদলায়; unknown custom body diff আগে পড়তে হবে। Missing/changed own helper-এর least-privilege ACL দেওয়া হয়; is_admin বা existing table grants বদলায় না।

## কোন অবস্থায় চালাবেন না

- Preflight definitions/combined permission matrix review হয়নি।
- Legacy limit trigger শুধু pending/total rows গণনা করে, UPDATE/concurrency support অস্পষ্ট বা বিরোধী দ্বিতীয় trigger আছে। আগে explicit legacy-function review/patch প্রয়োজন; migration তা অনুমান করে বদলায় না।
- protect_profile_status/custom trigger interaction অজানা।
- Schema, bucket representation, existing helper return type/argument names বা custom kind CHECK আলাদা। Error এলে table/record/function drop করে সমাধান করবেন না।
- পুরোনো versions-এর migration text—যেখানে blanket REVOKE/ALTER POLICY বা দ্বিতীয় gallery limit trigger ছিল।

## CLI সতর্কতা

বর্তমান filename version prefixes duplicate (20261117 এবং 20261119)। এই plan manual SQL Editor-এর জন্য। Migration history inspect না করে `supabase db push` চালাবেন না বা applied files blind rename করবেন না। ভবিষ্যৎ CLI adoption-এর আগে unique timestamps ও existing history reconcile করতে হবে।

## পরীক্ষা এবং সীমা

স্থানীয় PostgreSQL parser-এ full SQL, embedded DDL ও generated function-definition statements parse করা হয়; static preservation checks ও existing JS tests চালানো হয়। SQL execute হয়নি; PL/pgSQL runtime, actual RLS outcomes, trigger interactions এবং 100-photo concurrency live/staging test ছাড়া নিশ্চিত নয়। No .env/credentials/GitHub/Vercel changes।


## বর্তমান revision: unlimited limit, active selection ও concurrency

- display_order (events/batches) এবং enabled (events) existing column type আগে যাচাই হয়। integer/boolean না হলে coercion বা overwrite না করে migration rollback হয়। Missing columns পরে ADD COLUMN IF NOT EXISTS হয়।
- Profile-এর নতুন registration/নতুন batch selection-এ is_active=true বাধ্যতামূলক। Unchanged normalized পুরোনো inactive reference রেখে profile-এর অন্য তথ্য edit করা যায়। Unchanged legacy orphan reference-ও সংরক্ষিত থাকে; নতুন orphan/inactive selection তৈরি করা যায় না। Blank initial profile batch আগের মতো অপরিবর্তিত থাকে।
- New helper smsa_lock_batch_target() parent row(s) FOR SHARE করে। এটি shared trigger-only helper; নতুন user table/Storage permissions দেয় না।
- committee_members.batch, site_content(kind=batch,key), gallery_photos.batch_id এবং storage.objects(bucket=batch-gallery,name)-এর INSERT বা reference-changing UPDATE-এ parent existence/lock যাচাই হয়। Site-media objects এই trigger থেকে সরাসরি return করে; bucket configuration/publicness বদলায় না।
- Existing inactive committee/history/content references অনুমোদিত; নতুন profile selection-এর active restriction সেগুলোর ওপর ভুলভাবে চাপানো হয় না।
- Delete RPC FOR UPDATE নিয়ে references পুনরায় পরীক্ষা করে। Direct DELETE-এর জন্য smsa_protect_batch_delete trigger-ও একই empty/inactive/reference checks চালায়। Any required reference trigger missing/disabled/incompatible হলে delete/rename বন্ধ হয়।
- smsa_batch_has_content() VOLATILE: parent-lock wait-এর পরে READ COMMITTED-এ fresh queries দিয়ে committed references দেখে। STABLE caller-snapshot ব্যবহার করে আগের race আর রাখা হয়নি। Non-READ-COMMITTED writes/deletes fail closed; এই revision REPEATABLE READ/SERIALIZABLE correctness দাবি করে না। Migration transactions-ও explicitly READ COMMITTED।
- Dynamic FK query conkey/confkey/conpfeqop থেকে actual child/parent columns এবং equality operator নেয়। Selected batch-এর typed row JSON দিয়ে referenced values bind করে; FK comparison-এ parent.id ধরে না। Public API target batch নির্বাচন এখনও batches.id দিয়ে করে—React-এর batch_id argument অপরিবর্তিত। Alternate/composite FK tests staging-এ করতে হবে।
- Reference checker SECURITY DEFINER owner-এর existing SUPERUSER/BYPASSRLS visibility যাচাই করা হয়, যাতে hidden child rows বাদ না পড়ে। Role privileges স্বয়ংক্রিয়ভাবে দেওয়া হয় না; unsuitable owner হলে file/runtime থামে। preflight role_flags দেখুন।

### Managed Storage boundary

নতুন smsa_lock_storage_batch trigger storage.objects metadata INSERT/UPDATE-এ reference validation করে। Existing policies/grants/default privileges/legacy triggers বদলায় না। SQL Editor role-এর TRIGGER privilege এবং Supabase Storage service-এর compatibility staging-এ যাচাই করুন। CREATE TRIGGER ব্যর্থ হলে পুরো batch-actions transaction rollback হবে। Trigger বাদ দিয়ে পুরোনো unsafe delete RPC ব্যবহার করবেন না।

SQL locks database metadata references রক্ষা করার জন্য। Storage service-এর physical byte upload ও metadata transaction এক transaction নয়; deleted batch-এ in-flight upload reject হলে underlying byte cleanup service-dependent। Existing files স্বয়ংক্রিয় delete করা হয় না। Privileged TRUNCATE, disabled triggers, replica-mode writes বা undeclared custom reference paths এই protocol-এর বাইরে; সেগুলো manual maintenance review ছাড়া ব্যবহার করবেন না।

### বাধ্যতামূলক live/staging concurrency checks (এখানে চালানো হয়নি)

1. Session A-তে নতুন committee/site_content/gallery/storage reference uncommitted রেখে Session B-তে inactive batch deletion চেষ্টা করুন: deletion wait করবে, তারপর linked-content rejection হতে হবে।
2. Session A-তে empty batch deletion uncommitted রেখে Session B-তে নতুন reference INSERT/UPDATE করুন: writer wait করবে, delete commit-এর পরে missing-batch error হতে হবে; rollback হলে valid write চলবে।
3. উল্টো arrival order, legacy-name Storage folder, canonical name, inactive নতুন profile selection এবং unchanged inactive profile edit পরীক্ষা করুন।
4. Alternate/composite incoming FK দিয়ে populated batch deletion আটকায় কি না পরীক্ষা করুন। Existing restrict/cascade relationships/data পরিবর্তন করবেন না।
5. Actual Storage API upload/rename পথেও একই blocking/rejection এবং error cleanup পরীক্ষা করুন; direct SQL mock যথেষ্ট নয়।
6. Anonymous/member/admin দিয়ে existing permissive + restrictive policy matrix পুনরায় পরীক্ষা করুন। নতুন policy code existing predicates overwrite করে না; নতুন locking triggers কোনো access grant নয়।
7. Legacy gallery limit trigger-এ 99→100 এবং দুই concurrent approval দিয়ে 100 অতিক্রম রোধ যাচাই করুন। সেটি unchanged; এই revision legacy limit-function runtime প্রমাণ করে না।

### সম্পূর্ণ ফাইল ও local checks

চারটি migration-ই project-এ সম্পূর্ণ ফাইল হিসেবে রাখা আছে। tests/migration-safety.test.mjs source-level regression checks; এটি SQL execute করে না। npm test existing React/domain tests চালায়। PostgreSQL parser check syntax-এর জন্য; PL/pgSQL control flow, ownership, actual RLS এবং concurrency behavior live test ছাড়া verified নয়।

### স্থানীয় যাচাইয়ের ফল

- চারটি complete migration এবং preflight SQL PostgreSQL parser-এ পাস; ১৭টি embedded DDL ও ১১টি reconstructed function-definition statement-ও পাস। Dollar quoting-সহ outer syntax যাচাই হয়েছে; PL/pgSQL body/runtime execution হয়নি।
- npm test: existing domain/content/structure suites পাস। node tests/migration-safety.test.mjs: static safety checks পাস। npm run build: production build পাস।
- git diff --check: whitespace error নেই; existing LF/CRLF normalization warnings আছে।
- এই task-এ SQL execute, Supabase connection, .env edit, GitHub push বা deployment হয়নি।

Reference: PostgreSQL [function volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html) ও [foreign-key catalog fields](https://www.postgresql.org/docs/current/catalog-pg-constraint.html)। Parser/static success runtime compatibility প্রমাণ নয়।
