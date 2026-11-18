> SQL নির্দেশনার আপডেট: বর্তমান live setup-এর জন্য [নতুন manual migration review plan](supabase/LIVE_MIGRATION_PLAN_BN.md) অনুসরণ করুন। নিচের পুরোনো fresh-install SQL নির্দেশনা superseded।

# SMSA Upgrade — বাংলা handover (১৯ নভেম্বর ২০২৬)

এই কাজ শুধু স্থানীয় source ও SQL প্রস্তুতিতে সীমিত। Live SQL/database/bucket settings, .env, GitHub বা Vercel পরিবর্তন করা হয়নি। আগের audit-এর সব ত্রুটি সমাধান হয়েছে বা পুরো production system secure—এমন দাবি করা হচ্ছে না।

## সম্পন্ন পরিবর্তন

- Home-এর মূল পরিচিতি সবার আগে; তিনটি promotional card বাদ। Home/About/Events-এর continuous flow ও sticky navigation রাখা হয়েছে।
- Alumni/Committee আলাদা selection/detail experience। Batch photos selection cards-এ; batch detail-এ একটি Batch Gallery button ও সদস্যরা। Main sections detail page-এ মেশে না।
- History-backed route state: Back/Forward, batch/gallery context, searches এবং login choices সংরক্ষণ। URL hash-এ credential থাকে না; gallery link-এ record metadata বাদ দিয়ে নাম রাখা হয়।
- Batch/committee rails: ডান থেকে বামে automatic movement, mouse drag/touch/manual arrows; interaction-এর পরে ৭ সেকেন্ড pause; reduced-motion support। Loop-এর visual duplicate keyboard/screen-reader list থেকে বাদ।
- About images-এর পৃথক content kind, visibility/display order ও ২ সেকেন্ডের opacity fade slideshow।
- Events image/description, enabled ও display_order controls। Public UI disabled events লুকায়; SQL-তেও restrictive visibility guard প্রস্তুত।
- Passing Year forms/cards থেকে সরানো; column বা historical data মুছে দেওয়া হয়নি। Existing profile edit historical year ধরে রাখে; নতুন registration-এর legacy required value batch year থেকে নেওয়া হয়। Non-year custom batches-এর জন্য database constraint review লাগতে পারে।
- Admin overview cards ও পৃথক content/batch/member/gallery/event/committee panels। Member Management batch-first ও searchable। Member editor selected record ID দিয়ে update করে এবং returned row যাচাই করে। Approval ও account operations পৃথক থাকে।
- Batch editor: display order, explicit name editing, activation/deactivation এবং খালি inactive batch deletion। Referenced batches rename/delete করতে অস্বীকার করে; order-only update legacy batch name বদলায় না।
- Content edit immutable ID দিয়ে update করে; key বদলালে primary-key conflict তৈরি হয় না। New record insert duplicate natural key overwrite না করে পরিষ্কার error দেখায়।
- Avatar নিজের profiles.photo_url ব্যবহার করে; সফল profile save-এ state refresh হয়।
- Central English/Bengali dictionary ও persisted language toggle। User-entered names/content/batch identifiers translate হয় না। Required labels-এ *, associated labels/placeholders এবং translated validation।
- Safe notifications: raw SQL/RLS/schema/bucket errors public message-এ যায় না। Development diagnostics redact করে log করা হয়।
- Upload validation দুই bucket-এর জন্য JPEG/PNG/WebP, সর্বোচ্চ ১০ MB। Public site-media এবং private batch-gallery আলাদা। নতুন Storage UPDATE বা site-media DELETE permission দেওয়া হয়নি।
- Gallery deletion: DB delete ব্যর্থ হলে image delete হয় না। Storage cleanup ব্যর্থ হলে record আর public gallery-তে থাকে না, কিন্তু retained object-এর cleanup warning দেখায়। কোনো পুরোনো image স্বয়ংক্রিয় purge নেই।

## পরিবর্তিত existing files

- src/App.jsx — routing/state, section order, isolated details, admin forms/panels, translated interface, safe notifications এবং gallery/profile flows।
- src/components/ContentFeatures.jsx — content identity-safe saving, About type, ১০ MB validation, translations ও stale-request protection।
- src/main.jsx — LanguageProvider।
- src/styles.css — balanced gradients, cards, rails, About fade, dashboard/mobile styles, required indicators।
- package.json — expanded npm test command; নতুন runtime dependency নেই।
- tests/content.test.mjs — existing tests-এর সঙ্গে About, pause duration ও language assertions।
- supabase/migrations/20261117_content_features.sql — নতুন install-এর জন্য About kind এবং ১০ MB site-media setting। Existing ৫ MB bucket overwrite করে না; drift পেলে থামে।
- supabase/migrations/20261117_gallery_guards.sql — is_admin reuse, canonical batch helper, repeatable trigger/policies, private bucket existence/privacy check, own-orphan cleanup guard।

## নতুন files

- src/lib/domain.js — shared normalization/order/image/phone validation, content/member writes এবং safe gallery deletion operations।
- src/lib/navigation.js — coalesced history entries, Back/Forward ও URL route persistence।
- src/lib/i18n.jsx, src/lib/translations.bn.json — maintainable language system ও form accessibility।
- src/lib/notifications.js — user-safe messages ও diagnostic redaction।
- src/components/Experience.jsx — reusable rails ও About fade slideshow।
- src/components/BatchEditor.jsx — batch editing এবং explicit safe-delete UI।
- supabase/migrations/20261119_ui_experience.sql — About kind extension, events visibility/order, batch order, uploader-name RPC, ১০ MB bucket configuration।
- supabase/migrations/20261119_batch_actions.sql — admin-only reference check, inactive empty-batch delete RPC, profile-reference locking ও linked-name protection triggers। Installing the functions deletes no records; only an explicit authorised delete RPC can delete a batch row।
- tests/domain.test.mjs — normalization, ordering, validation, member/content payloads, duplicate conflicts ও delete sequencing।
- tests/structure.test.mjs — admin panel isolation ও member-edit navigation regression checks।
- tests/experience-preview.html, tests/experience-preview.jsx — synthetic local-only fixture; কোনো Supabase client/write নেই।
- UPGRADE_CHECKLIST.md, artifacts/smsa-home-desktop.jpg — progress record ও desktop visual verification।

## Manual SQL review — প্রয়োগ করা হয়নি

প্রথমে actual schema, public.is_admin(), grants, policies ও existing trigger names staging/SQL Editor-এ review করতে হবে। নতুন SQL নিজে থেকে চালানো হয়নি।

Fresh setup-এর dependency order:

1. 20261117_content_features.sql
2. 20261117_gallery_guards.sql
3. 20261119_ui_experience.sql
4. 20261119_batch_actions.sql

Existing setup-এ পুরোনো migration applied ধরে সব blind rerun করবেন না। বিশেষ করে site-media যদি ৫ MB হয়, revised content migration configuration mismatch দেখে থামবে। Existing content setup থাকলে gallery revision review করে, UI migration দিয়ে ১০ MB settings/About fields যোগ করুন; তারপর batch-actions migration review করুন। Content migration fresh foundation-এর জন্য; প্রয়োজনে rerun-এর আগে grants/constraints মিলিয়ে নিন।

UI migration দুই bucket-এর file size/MIME settings বদলানোর SQL রাখে, কিন্তু public/private flag বদলায় না। এটি এখনো live-এ execute হয়নি। About kind CHECK-এর পরিচিত সংজ্ঞা ছাড়া custom constraint থাকলে script থামে, অনুমান করে সেটি মুছে না।

Gallery script existing unrelated policies/grants বাদ দেয় না। Named restrictive guards reconcile করে; existing permissive read/upload/moderation policies এখনও প্রয়োজন। Own-folder orphan SELECT/DELETE gate failed-upload cleanup-এর জন্য; অন্যের referenced/private ছবি member-কে দেয় না। No Storage UPDATE grant। PostgreSQL 14+ CREATE OR REPLACE TRIGGER দরকার।

Batch-actions migration existing RLS অক্ষত রাখে। Empty-batch delete SECURITY INVOKER হওয়ায় current DELETE policies এখনও প্রযোজ্য। Full reference check admin-gated SECURITY DEFINER; profile batch write SHARE lock-এর সঙ্গে parent-row deletion/name update coordinate করে। Existing custom triggers, FK cascades ও concurrent Storage/content creation-এর সঙ্গে staging review জরুরি। Storage/database operations distributed transaction নয়; orphan image retained থাকতে পারে।

## করা পরীক্ষা এবং ফল

- npm test — সব assertions পাস: legacy names, canonical matching, stable order, ১০ MB boundary/MIME, phone validation, safe errors, content key edit/create/conflict, member ID/allowlist/protected fields, gallery delete sequencing/partial cleanup, About grouping/order, ৭ সেকেন্ড pause calculation, language and panel structure।
- npm run build — সফল।
- git diff --check — শেষ formatting check-এ whitespace সংশোধিত।
- PostgreSQL parser — চারটি migration-এর top-level SQL ও embedded policy/table DDL parse করা হয়েছে; SQL execute হয়নি। PL/pgSQL runtime ও actual schema resolution parser দিয়ে যাচাই হয় না।
- Actual browser: public Home/About/Events; পৃথক Alumni list; পুরোনো batch cards/photos; Dakhil-2020 detail; Gallery→browser Back→same batch→Back→list; About anchor/active nav; login choice Back; বাংলা/English labels; user names unchanged; required-field বাংলা tooltip — দেখা হয়েছে।
- Rail timing: manual action-এর পরে measured ১.৫ সেকেন্ডে movement delta ০; pause observation-এর পর মোট প্রায় ৭.১ সেকেন্ডে automatic movement resumed।
- Synthetic About fixture: প্রায় ২.২ সেকেন্ডে image changed; CSS transition property opacity। এটি component test, production About records-এর end-to-end CRUD test নয়।
- Mobile viewport 390: document width 375; horizontal document overflow পাওয়া যায়নি। Desktop screenshot artifacts/smsa-home-desktop.jpg।

## এখনও যাচাই হয়নি / সীমাবদ্ধতা

- বাস্তব authenticated login/signup/reset email, avatar upload, member edit/moderation, event/content/batch CRUD ও gallery upload/approval/rejection/delete live-এ করা হয়নি। Test credentials বা database permission review ছাড়া সেগুলো fully verified নয়।
- নতুন migrations applied কি না নিশ্চিত নয়। Missing RPC/column হলে সংশ্লিষ্ট action friendly error দেখাবে। Uploader name RPC না থাকলে existing public_alumni names বা Member fallback ব্যবহৃত হয়। Actual uploader name guarantee করতে RPC ও public_alumni.id/full_name compatibility যাচাই করুন।
- Existing public_alumni view-এর privacy, profiles/user_roles grants, is_admin definition, custom triggers, Storage permissive policies ও admin-manage-user Edge Function এখানে live-inspect করা হয়নি।
- Admin member Approve/Reject controls existing approval_status column-এর approved/rejected values ধরে; actual enum/CHECK review করতে হবে।
- Old image references সরালে Storage object retained থাকে। Cleanup automatic নয়। Public site-media URL disable/delete করলেই গোপন হয় না।
- Public lists-এর existing Supabase row limits/pagination এবং production-scale performance আলাদা পরীক্ষা প্রয়োজন।
- Browser-এ live committee data ছিল না; committee grouping automated/synthetic checks হয়েছে, real committee selection/data mutation নয়।

## স্থানীয়ভাবে চালানো ও review

```powershell
npm install
npm run dev
npm test
npm run build
git diff --check
git diff
```

Terminal-এর Local URL খুলুন। এই কাজের preview http://127.0.0.1:5175/ । Component fixture /tests/experience-preview.html শুধু স্থানীয় QA-এর জন্য। Build tests fixture-কে production entry হিসেবে bundle করে না।

Push/deploy-এর আগে .env ignored ও untracked নিশ্চিত করুন, source diff ও SQL review করুন, তারপর staging-এ anonymous/member/admin তিনটি session দিয়ে permissions পরীক্ষা করুন। এই কাজ থেকে কোনো push/deploy হয়নি।
