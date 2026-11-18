# Existing live SMSA database: manual migration review plan

এই নথি HANDOVER_BN.md-এর পুরোনো fresh-install SQL নির্দেশনার পরিবর্তে প্রযোজ্য। Source code unchanged in this task. কোনো live SQL চালানো হয়নি।

## ব্যবহারকারীর live audit-এ যাচাইকৃত baseline; এখানে স্বাধীন live verification হয়নি

- site_content, তার columns/unique constraint/RLS এবং smsa_content_read/write policies আছে।
- site-media public, 10485760 bytes, JPEG/PNG/WebP।
- নতুন verified finding: batch-gallery private, file_size_limit=NULL এবং allowed_mime_types=NULL (unlimited)। UI migration এই state থেকে 10485760 bytes ও JPEG/PNG/WebP-এ transition গ্রহণ করে; আগের 50 MB state-ও স্বীকৃত।
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
