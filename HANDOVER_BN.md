# বর্তমান সংশোধন — Homepage Alumni → Committee → Events

**সরাসরি correction-ই navigation-এর চূড়ান্ত নির্দেশনা।** Committee পৃথক page বা Alumni submenu নয়; একই Homepage-এর independent section। Master attachment-এর safety rules বহাল। Navbar-এর existing Home/About/Events/Alumni/Committee order/design রাখা হয়েছে; physical homepage section order আলাদা Home → About → Alumni → Committee → Events। Navbar-এ Gallery নেই; existing batch-gallery route/admin tools আছে।

## A. Completed

- একই rendered homepage-এ Alumni-এর পর সরাসরি Committee, তারপর Events। Hero/stats/slider/About/batch cards/year cards/member cards/footer design পুনর্নির্মাণ নয়; existing styles ব্যবহার।
- Year cards এখন Committee of YYYY; click করলে ওই section-এর ভেতর details। Name/photo/position/introduction/year এবং real is_current অনুযায়ী Current/Previous label। একই পদে multiple members ও arrangedCommittee/layout/display_order logic অক্ষুণ্ণ। Empty year-এ existing সুন্দর empty state; year index কোনো historical member বানায় না।
- Navbar smooth scroll, actual DOM-order scrollspy, bottom Events active, plain #committee/#alumni ও legacy encoded JSON/year links, refresh ও browser back/forward পরীক্ষা হয়েছে। Internal route.page field compatibility হিসেবে থাকে; Committee URL-এও সম্পূর্ণ homepage render হয়, আলাদা page নয়।

## B. Bugs fixed / causes

1. Committee শুধু page===Committee condition-এ render হওয়ায় homepage scrolling sequence-এর অংশ ছিল না। publicView-তে এনে Alumni-এর পরে রেখেছি।
2. Scrollspy navbar order ধরে চলত এবং bottom-এ Alumni force করত। HOMEPAGE_SECTIONS ও activeHomepageSection দিয়ে physical order আলাদা করা হয়েছে।
3. useAppRoute সব non-replace route change-এ top=0 করায় homepage anchor changes jump করত। Continuous public-to-public navigation-এ top reset বন্ধ; private/batch/gallery routes আগের মতো আলাদা।
4. ResizeObserver scroll update একই RAF ID cancel করে navigation callback বাদ দিত। targetFrame/update frame পৃথক।
5. Refresh/direct navigation-এ data আসার আগে section offset মাপায় wrong alignment হতো। Homepage data/batches এবং managed content initial ready হওয়ার পর pending anchor align হয়; failure path-ও ready release করে। Existing queries/payloads/credentials বদলায়নি।
6. Hash parser শুধু encoded JSON জানত। Plain section anchors ও state-less hash history এখন normalize হয়; legacy links চলবে।
7. Committee Back button আর arbitrary previous page-এর ওপর নির্ভর করে না; একই section-এর year index খোলে।

## C. Database / security

- এই turn-এ কোনো SQL/migration edit বা execution হয়নি; নতুন database table নয়। Existing committee_members, committee_year, is_current এবং ordering implementation-ই ব্যবহার।
- committeeOrderingReady এখনও false। Mock capability true কেবল isolated browser fixture-তে। Production smoke নিশ্চিত করে real graph ordering RPC ডাকে না।
- আগের revised 20261119_cms_ordering.sql এখনও not applied/not runtime-verified। Missing TRUNCATE/owner/role privileges inspection, actual JWT/is_admin/PostgREST behavior এবং approved 17.11 concurrency/timeout tests pending। Existing grants/policies/buckets/10 MB MIME settings অপরিবর্তিত।
- .env/credentials, Git push, deploy বা release হয়নি।

## D. Actual checks

- npm.cmd test: PASS; homepage route/hash/scroll-order unit assertions ও AST section-order check যোগ।
- npm.cmd run test:migrations: PASS; static only, SQL execute নয়।
- npm.cmd run test:browser: PASS at 390px and 1440px; existing 320–1440px overflow checks, authentication/admin/member/gallery/CMS regression, per-year custom order/multiple positions, Current/Previous ও empty state, direct hash/year refresh/back-forward/active nav। All external requests mocked/intercepted।
- Fresh visual QA: 390/1440 homepage ও Committee screenshots, settled navbar-offset alignment ও no overflow PASS। screenshots: artifacts/redesign/homepage-section-qa-1795094245396/ । Mobile Committee এবং desktop full homepage visually inspected।
- npm.cmd run build: PASS; production smoke PASS; no fixture leakage into production bundle।
- git diff --check: PASS। কোনো lint script নেই; lint execution দাবি নয়।
- Local Vite test servers চালানো হয়েছে এবং test শেষে বন্ধ করা হয়েছে। Live verification দাবি নয়।

## E–F. Manual actions / readiness

এই correction-এর local implementation/test complete। Production launch পুরো project-এর জন্য **Blocked pending approved database preparation/live verification**: confirmed events schema-তে image_url/enabled অনুপস্থিত, revised migration apply হয়নি; ordering activation-ও pending। Master attachment-এর সব external/live operation completed দাবি নয়। Live auth/mail delivery, real Storage/RLS এবং database concurrency নতুন করে যাচাই হয়নি।

## G. এই turn-এর modified files

- src/App.jsx
- src/lib/navigation.js
- src/components/ContentFeatures.jsx
- src/lib/translations.bn.json
- tests/domain.test.mjs
- tests/structure.test.mjs
- tests/redesign-browser.mjs
- HANDOVER_BN.md
- UPGRADE_CHECKLIST.md
- supabase/LIVE_MIGRATION_PLAN_BN.md

Generated mock-only screenshots artifacts/redesign-এর নতুন run ও homepage-section-qa folder-এ। CSS, main.jsx, package dependencies, SQL files, Storage settings/policies ও ordering flag এই turn-এ পরিবর্তন নয়।

## H. Exact next local checks

Project root থেকে:

~~~powershell
npm.cmd test
npm.cmd run test:migrations
npm.cmd run test:browser
npm.cmd run build
git diff --check
npm.cmd run dev -- --host 127.0.0.1
~~~

শেষ command শুধু local preview server; live/manual verification-এর আগে production credential/session ব্যবহার করে mutation নয়। Local URL /#committee ও /#alumni এবং UI year card দেখুন। Database বা deploy command এখন চালানোর নির্দেশনা নেই। Explicit approval ছাড়া inspect_ordering_privileges.sql execute, migration apply, production flag true বা deploy নয়। আগের migration/security plan-এর approval boundary বহাল।

---

# সর্বশেষ security ও data-integrity audit — revised draft, not applied

**কোনো SQL execution হয়নি—local PostgreSQL/PGlite-তেও নয়। Live access, migration apply, production activation, .env/Storage change, push বা deploy হয়নি।** Production flag false। আগের draft-এর PostgreSQL 17.5/18.7 runtime ফল এই revised পাঁচ-argument RPC-এর runtime verification নয়।

1. **Event visibility/default — verified from code/snapshot; drift check fixed.** [supabase/migrations/20261119_cms_ordering.sql:114](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:114>) নতুন enabled NOT NULL DEFAULT true যোগ করে। Supplied schema-তে column নেই, তাই প্রথম apply-এ আগের events true পাবে; public visibility বজায় থাকবে। Existing enabled থাকলে type/nullability/default/generated checks mismatch-এ abort করে ([supabase/migrations/20261119_cms_ordering.sql:65](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:65>)); কোনো false value true করা হয় না। Existing public permissive SELECT-এর সঙ্গে restrictive visibility AND হবে; admins disabled records-ও পড়তে পারবেন ([supabase/migrations/20261119_cms_ordering.sql:131](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:131>))।

2. **Metadata/RPC permissions — hardening added.** [supabase/migrations/20261119_cms_ordering.sql:143](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:143>): public SELECT RLS, শুধু SELECT grant, সরাসরি write/TRUNCATE grant নেই। [supabase/migrations/20261119_cms_ordering.sql:160](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:160>): owner, ordinary table shape, RLS, policies, effective privileges, PK/CHECK/default/index/trigger/rule/inheritance drift হলে abort। [supabase/migrations/20261119_cms_ordering.sql:219](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:219>): trusted postgres-owned save RPC; pg_catalog,pg_temp search_path, qualified application objects, no dynamic SQL। [supabase/migrations/20261119_cms_ordering.sql:271](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:271>): PUBLIC/anon execute revoked; authenticated may invoke but must pass auth.uid/is_admin check। Getter SECURITY INVOKER/STABLE। Existing is_admin definition/ACL unchanged; its body/configuration/JWT correctness is not proven by the supplied snapshot। Owner/service_role remain trusted privileged actors, not normal users।

3. **Normal-member writes — policy analysis confirms denial, unknown TRUNCATE identified.** [supabase/migrations/20261119_cms_ordering.sql:225](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:225>): non-admin save raises 42501। Existing committee Admin ALL RLS retained; member direct UPDATE cannot change ranks. RLS does not protect TRUNCATE; prior inspection did not collect TRUNCATE/role ownership/bypass privileges. [supabase/migrations/20261119_cms_ordering.sql:24](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:24>): new preflight aborts on those powers without revoking existing grants. This is a missing inspection result, not a confirmed live exploit. Future read-only query prepared at supabase/inspect_ordering_privileges.sql; NOT executed. PostgreSQL RLS reference: https://www.postgresql.org/docs/17/ddl-rowsecurity.html .

4. **Year isolation — statically verified.** [supabase/migrations/20261119_cms_ordering.sql:261](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:261>): member update restricted by matching IDs AND committee_year=p_year; metadata update WHERE year=p_year. [src/lib/committee.js:30](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/lib/committee.js:30>): frontend update likewise preserves other years. Whole-table lock may temporarily delay another year's write but does not change its rows.

5. **Stale state/concurrency — genuine gap fixed, runtime test pending.** Previous IDs+revision check missed same-ID position/rank edits. New fifth argument p_expected_members captures raw position/display_order per UUID ([src/lib/committee.js:27](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/lib/committee.js:27>)); [supabase/migrations/20261119_cms_ordering.sql:253](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:253>) compares locked current membership snapshot. Invalid/null/multidimensional/nonstandard-bound arrays or duplicate/null IDs rejected before writes (22023); exact missing/extra/moved/added/deleted IDs or snapshot changes raise 40001. Saved revision mismatch also raises 40001. Lock taken before membership reads; concurrent saves serialize and the loser gets stale revision, or lock timeout 55P03; deadlock 40P01 may also abort one request. Frontend handles lock failures with retry text and updates confirmed ranks after success so a second save does not conflict with its own old ranks ([src/App.jsx:2022](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/App.jsx:2022>)). Actual multi-session SQL locking has NOT been executed/tested in this audit.

6. **Repeat-run/data preservation — stronger static checks, no destructive repair.** [supabase/migrations/20261119_cms_ordering.sql:87](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:87>): own marker plus trusted owner required; unknown objects/overloads abort. New five-argument RPC must be applied together with the updated frontend; an existing four-argument draft is NOT automatically dropped/overwritten, and will stop the migration for manual review. Existing table data, helper functions, old policies/grants, Storage and prior four migrations preserved. Own marked RPC definitions/execute grants are reasserted; own table is validated without deleting/reseeding rows. PK/CHECK/default drift aborts instead of silently proceeding ([supabase/migrations/20261119_cms_ordering.sql:200](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:200>)). Metadata UUID arrays have no FK: after later member delete/year move, stale UUIDs may remain until next valid save; public UI renders current member rows only and saves validate the complete current year. No phantom member is created.

7. **Event payload/image compatibility — confirmed in source/mock tests.** [src/lib/cms.js:17](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/lib/cms.js:17>): optional title becomes empty string, never NULL; supplied schema has NOT NULL only, no non-empty CHECK. [supabase/migrations/20261119_cms_ordering.sql:113](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:113>) supplies nullable text matching payload. [src/App.jsx:328](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/App.jsx:328>): SELECT * reloads image_url; [src/App.jsx:1280](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/App.jsx:1280>): image renders independently of title. site-media remains public, so disabled event visibility does not make its image URL private. No image cleanup or Storage UPDATE/DELETE permission added.

8. **Timeout/rollback — transaction structure verified, not fault-injected in SQL.** [supabase/migrations/20261119_cms_ordering.sql:6](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/supabase/migrations/20261119_cms_ordering.sql:6>) through COMMIT is one transaction, with LOCAL 5s lock_timeout; save RPC also sets 5s lock_timeout. This is per lock acquisition, not a five-second whole-operation deadline. No EXCEPTION WHEN handler swallows failure: an uncaught lock timeout aborts migration/RPC work; partial ranks/layout cannot commit. If an SQL client stops at the error inside the explicit transaction, ROLLBACK is still needed before reuse. NOTIFY only becomes effective on commit. [src/lib/notifications.js:36](<C:/Users/Mr. Akibbhai/OneDrive/Dokumen/SMSA_Web/src/lib/notifications.js:36>): user gets a safe retry message for 55P03/40P01. Timeout reference: https://www.postgresql.org/docs/17/runtime-config-client.html .

## এই audit-এ চালানো checks

- npm.cmd test: PASS (snapshots, other-year preservation, unchanged input, second-save rank state, exact revision response, timeout message)।
- npm.cmd run test:migrations: PASS (static only; ownership/default/PK/CHECK/snapshot/lock ordering/year scope/no swallowed exception checks)।
- Complete SQL + PL/pgSQL parser: PASS; extra read-only query parses; no database created or SQL executed।
- npm.cmd run test:browser: PASS at 390px and 1440px plus 320px overflow checks; mock second save, same-ID stale rank rejection, simulated timeout, event save/reload and production smoke/build. All external requests intercepted locally. Production ordering RPC absence verified।
- tests/committee-migration.test.mjs: updated for future authorized runtime checks; node --check only, NOT executed. Previous runtime results are historical and do not verify revised SQL semantics.

## যা এখনও বাকি

Live TRUNCATE/role flags/ownership/is_admin settings inspection; actual revised SQL apply/reapply; new constraints/default deparse checks on actual server; JWT/PostgREST authorization; two-session conflict/lock timeout/rollback fault injection. Extra guards may deliberately stop current live apply (Supabase defaults may include TRUNCATE)—do not weaken/remove guards or revoke grants without reviewing actual output and approval. No full live compatibility claim.

---

# বর্তমান CMS schema ও ordering প্রস্তুতি — ১৯ নভেম্বর ২০২৬

- Inspection file এখন সম্পূর্ণ: 40,839 bytes valid JSON; ১১টি metadata section, ১৬ columns, ২ PK/২ indexes, ৪ policies, ১৯২ column grants, কোনো user trigger নেই। PostgreSQL 17.11। নিচের পুরোনো schema-pending notes এই দুই table-এর জন্য superseded।
- events.title text NOT NULL/no default/no non-empty CHECK; image_url ও enabled নেই। Committee display_order nullable integer/default 0; introduction text NOT NULL/default ''; committee_year nullable integer; is_current NOT NULL boolean/default true।
- নতুন standalone migration: supabase/migrations/20261119_cms_ordering.sql। **Prepared only; not applied. Explicit user approval required before live DB change.** Missing event columns + justified restrictive visibility policy; existing policies/grants preserved। Atomic admin ordering RPC with member-set/revision checks and existing display_order reuse; year/positions/member_ids/revision metadata পৃথক table-এ। Existing is_admin unchanged।
- React per-year custom hierarchy ও existing display_order fallback সংশোধিত; empty year ordering save blocked; year switch-এ metadata reload; setup message এখন not enabled yet। Production committeeOrderingReady এখনও false, কোনো নতুন live RPC নয়। Approval/apply ও live acceptance tests-এর পর activation বাকি।
- Unit/static, desktop/mobile mock browser + production smoke/build, SQL/PLpgSQL parser এবং temporary offline PostgreSQL 17.5 ও 18.7 migration repeat-run/permission/atomicity tests পাস (live snapshot 17.11)। Auth helpers/records কৃত্রিম; live JWT/PostgREST ও multi-session concurrency test হয়নি।
- বিস্তারিত execution order, schema report, test সীমা ও approval-পরবর্তী checks: supabase/LIVE_MIGRATION_PLAN_BN.md-এর প্রথম অংশ। পুরোনো চারটি migration এই feature-এর prerequisite নয়; unchanged।
- This turn: src/App.jsx; src/components/CommitteeOrdering.jsx; src/lib/committee.js; src/lib/cms-capabilities.js; src/lib/notifications.js; src/lib/translations.bn.json; tests/committee.test.mjs; tests/content.test.mjs; tests/redesign-browser.mjs; tests/migration-safety.test.mjs; tests/committee-migration.test.mjs; নতুন migration; এই handover, LIVE_MIGRATION_PLAN_BN.md ও UPGRADE_CHECKLIST.md।
- No live database/Storage/.env/package dependency/credential/GitHub/Vercel changes। Existing Storage 10 MB JPEG/PNG/WebP/public-private settings অক্ষুণ্ণ।

---

# সর্বশেষ schema-independent review — ১৯ নভেম্বর ২০২৬

- Live metadata অনুপস্থিত রেখেই code review করা হয়েছে। src/lib/committee.js-এর read/write response validation শক্ত করা হয়েছে: malformed layout, invalid/duplicate year or member IDs, negative/stale revision এবং requested position/member order-এর সঙ্গে mismatched save response success হিসেবে গ্রহণ হয় না। Tests: tests/committee.test.mjs।
- Custom committee ordering production save এখনও disabled; কোনো অজানা display_order field লেখা হয়নি। Unknown events/committee_members schema নিয়ে নতুন assumption বা migration হয়নি।
- supabase/inspect_cms_requirements.sql এখন **একটি SELECT statement, একটি inspection_result JSON**। Column types/nullability/defaults, CHECK/UNIQUE/PK/FK, incoming references, indexes, policy expressions/modes, table/column grants, RLS flags, triggers, relevant function signatures/ACLs ও reusable public-field inventory একই result-এ থাকে। Function bodies ও application records নেই; Storage query/change নেই।
- Supabase SQL Editor-এ সম্পূর্ণ file একবার চালিয়ে inspection_result JSON স্থানীয়ভাবে export/save করুন। আগের multiple-SELECT result collection নির্দেশনা এই file-এর জন্য আর প্রযোজ্য নয়। Result path দেওয়া যথেষ্ট; credentials শেয়ার করার প্রয়োজন নেই।
- Query PostgreSQL parser/static read-only checks পাস; live execute হয়নি। Privilege inspection metadata-ভিত্তিক; actual JWT/RLS behavior এখনও unverified। Function argument types official PostgreSQL documentation অনুযায়ী explicit casts ব্যবহার করে: https://www.postgresql.org/docs/current/functions-info.html ।
- Final local checks passed: npm.cmd test; npm.cmd run test:migrations; npm.cmd run test:browser (390px ও 1440px mock workflows + production smoke); npm.cmd run build; git diff --check। LF/CRLF normalization notices ছাড়া whitespace error নেই।
- এই turn-এ পরিবর্তিত ফাইল: src/lib/committee.js, tests/committee.test.mjs, supabase/inspect_cms_requirements.sql, HANDOVER_BN.md, UPGRADE_CHECKLIST.md। No database/migration/Storage-policy/bucket/.env/GitHub/Vercel changes।

---

# বর্তমান optional-content ও committee-ordering revision — ১৯ নভেম্বর ২০২৬

## সর্বশেষ live Storage confirmation — ১৯ নভেম্বর ২০২৬

ব্যবহারকারীর Supabase inspection result অনুযায়ী:

| Bucket | Public | File size limit | Allowed MIME types |
|---|---|---|---|
| batch-gallery | false | 10485760 bytes (10 MB) | image/jpeg, image/png, image/webp |
| site-media | true | 10485760 bytes (10 MB) | image/jpeg, image/png, image/webp |

এই current settings সংরক্ষণ করতে হবে। Visibility, size, MIME বা existing Storage policies পরিবর্তনের demonstrated requirement নেই। Frontend-এর 10 MB/JPEG-PNG-WebP validation ইতিমধ্যে এই settings-এর সঙ্গে মেলে; bucket পরিবর্তনের migration প্রয়োজন নেই। পুরোনো NULL/unlimited/50 MB baseline শুধু historical তথ্য—বর্তমান live state নয়। Bucket settings বদলানোর জন্য পুরোনো migration-এর bucket section চালাবেন না; অন্য sections প্রয়োজন হলে actual schema/policies ও migration history আলাদা review করতে হবে।

এটি events/committee_members column definitions, constraints বা Storage policy expressions নিশ্চিত করে না। Table inspection এবং live CRUD/RLS verification এখনও pending। এখানে Supabase-এ connect বা SQL execute করা হয়নি; তথ্যের উৎস ব্যবহারকারীর live inspection।


এই অংশ নিচের historical রিপোর্টগুলোকে supersede করে। সর্বশেষ নির্দেশনা অনুযায়ী frontend/tests বাস্তবায়ন হয়েছে; live database পরিবর্তন বা schema অনুমান করা হয়নি।

## গুরুত্বপূর্ণ readiness status

- About/slider/Events-এর নতুন frontend paths এবং default committee hierarchy local browser/mock tests-এ পাস করেছে।
- Custom committee order-এর production save **ইচ্ছাকৃতভাবে disabled**। src/lib/cms-capabilities.js-এর committeeOrderingReady=false। কোনো অজানা display_order column-এ write বা অজানা RPC-তে production request হয় না।
- Ordering UI ও proposed atomic API contract mocks-এ পরীক্ষা হয়; এটি live persistence নয়। Events-এর optional-title payload empty string ব্যবহার করে, কিন্তু actual CHECK/UNIQUE/default/nullable export না পাওয়া পর্যন্ত backend compatibility নিশ্চিত নয়।

## Confirmed বনাম unknown database information

Confirmed user findings: events ও committee_members-এ Admin ALL/Public SELECT policies আছে। Working site_content_kind_check-এ official, batch, social, carousel, about—এই পাঁচটি kind আছে।

Unknown: events.title-এর nullable/default/CHECK/UNIQUE; committee_members.display_order-এর type/nullability/default; অন্য CHECK/UNIQUE/FK definitions ও applied migration history। Project-এ supabase/inspect_schema.sql ও অন্যান্য inspection queries পাওয়া গেছে; actual result export পাওয়া যায়নি।

নতুন read-only file: supabase/inspect_cms_requirements.sql। এটি columns/types/defaults/nullability, constraints, indexes, policy expressions, table privileges, triggers, function signatures, bucket settings ও migration-history table structure দেখায়। Application records বা function bodies export করে না। SQL এখানে execute করা হয়নি; PostgreSQL parser/static read-only check হয়েছে।

## Frontend changes

- About-এ hardcoded organization paragraphs, fallback story/official description এবং no-image placeholder সরানো। শুধু enabled about/story record-এর nonempty title/description ও saved About images দেখায়। Title/description দুটোই optional; খালি field public-এ placeholder text তৈরি করে না।
- About-এর image slots ৪ থেকে ৩০। Multi-file validation upload শুরু হওয়ার আগে হয়; captions optional; successful upload + database save-এর পরে slideshow update হয়। Existing records/files delete বা constraint rewrite হয়নি। ৩০টির বেশি পুরোনো record থাকলেও সেগুলো স্বয়ংক্রিয় delete করা হয় না।
- Site-content kinds frontend allowlist দিয়ে একই পাঁচটি kind-এ সীমাবদ্ধ। Working database kind CHECK স্পর্শ করা হয়নি।
- Homepage slide title/name optional। Blank name-এ unique internal key হয়; image upload carousel record autosave করে। Explicit title থাকলেই caption দেখায়। Content type বদলালে অন্য record-এর ID নিয়ে সেটি overwrite করে না।
- Slider autoplay ১৫০০ms; previous/next-এর পরে ৫০০০ms inactivity pause; প্রতিটি manual click deadline reset করে। Explicit Pause/reduced motion অগ্রাধিকার পায়। একটিমাত্র cleanup করা timeout ব্যবহার হয়; button focus স্থায়ীভাবে autoplay আটকে রাখে না।
- Slider থাকলে stats-এর পুরোনো negative margin আর controls ঢেকে রাখে না। Slider না থাকলে আগের hero/stats layout থাকে।
- Events title optional; description/date/location/image দিয়েও event draft valid। সম্পূর্ণ empty event reject হয়। Empty title public heading তৈরি করে না; optional paragraphs/date/location-ও শুধু available থাকলে দেখায়। Existing IDs/rows update, refresh-failure identity retention ও confirmed success checks রাখা।
- Supabase errors-এর 23502/23514/date/function/size/MIME/session categories এখন safe actionable message দেয়। Raw SQL details/credentials দেখায় না। Strict title-CHECK rejection mock-এ পরীক্ষা হয়; এটি real constraint relax করার দাবি নয়।
- Committee hierarchy default: উপদেষ্টা → সভাপতি → সহ-সভাপতি → সাধারণ সম্পাদক → যুগ্ম সাধারণ সম্পাদক → সাংগঠনিক সম্পাদক → ছাত্রী বিষয়ক সম্পাদক → অন্য পদ। Bengali/recognized English alias group হয়; stored position text rewrite হয় না। Same-position multiple members supported; missing-position legacy members বাদ পড়ে না।
- Admin ordering preview: year নির্বাচন, position up/down, same-position member up/down, custom position যোগ, reset/save। Saved layout থাকলে public alphabetical sorting সেটিকে override করে না; public controls/serial numbers নেই। Mixed current years-এ latest configured hierarchy ও per-year member order deterministic থাকে।
- Calendar year minute/focus check-এ বদলায়; new year index স্বয়ংক্রিয় update হয়। Refresh/Cancel-এর পরে member form selected archive year ধরে রাখে; ভুল current year-এ নতুন member save হওয়ার bug ঠিক। Unknown historical years আগের মতো unknown থাকে।

## Proposed ordering backend contract — এখনো deployed/verified নয়

Physical schema বা storage model এখনো বেছে নেওয়া হয়নি। Metadata পেলে existing display_order reuse সম্ভব কি না দেখা হবে; প্রয়োজন ছাড়া নতুন table/column হবে না। Frontend adapter contract:

- Read-only GET RPC smsa_get_committee_layouts_v1 → version:1 ও layouts array। প্রতিটি layout-এ year, revision, positions (ordered strings), member_ids (ordered string IDs)। Read-এ কোনো data mutation নয়।
- Admin write RPC smsa_save_committee_layout_v1 receives p_year, p_positions, p_member_ids, p_expected_revision; returns version:1, layout।
- Server implementation-এর অপরিহার্য শর্ত: auth.uid() ও existing public.is_admin(); proper RLS; শুধু public committee metadata read; পুরো year cohort/member IDs যাচাই; revision conflict rejection; positions/member order একটি atomic transaction-এ save; unrelated fields/data unchanged; deleted/moved members safely reconcile।
- Frontend এই RPCs existing বলে ধরে নেয় না। Production switch বন্ধ; mock adapter-এ আলাদাভাবে capability enabled। Missing backend-এ save disabled ও setup message দেখায়। API shape alone live authorization/security-এর প্রমাণ নয়।

## Manual database steps — এখন যা প্রয়োজন

1. Supabase SQL Editor-এ শুধু supabase/inspect_cms_requirements.sql-এর SELECT queries চালিয়ে local result export সংরক্ষণ করুন। কোনো key/password প্রয়োজন বা চাওয়া হয়নি।
2. Actual events.title constraints/defaults এবং other optional field requirements দেখার পরে empty-string বনাম NULL compatibility ঠিক করতে হবে। Unknown constraint blindly DROP/replace করবেন না।
3. Committee ordering persistence-এর storage/RPC migration actual types, constraints, permissions ও reusable fields দেখে তৈরি করতে হবে। Schema export ছাড়া executable DDL migration তৈরি করা হয়নি।
4. Working site_content_kind_check বা existing policies/grants/functions পুনরায় apply/overwrite করবেন না। পুরোনো চার migration এই task-এ অপরিবর্তিত; শুধু এই feature update-এর জন্য সেগুলো blind-run করবেন না।
5. Backend implementation/admin-public RLS tests সফল হওয়ার পরেই committeeOrderingReady enable করে rebuild করা যাবে। শুধু switch true করলে database feature তৈরি হয় না।

## Files in this revision

Modified: src/App.jsx; src/components/ContentFeatures.jsx; src/components/Experience.jsx; src/components/Management.jsx; src/lib/cms.js; src/lib/domain.js; src/lib/notifications.js; src/lib/translations.bn.json; src/redesign.css; package.json; tests/cms.test.mjs; tests/content.test.mjs; tests/domain.test.mjs; tests/migration-safety.test.mjs; tests/mock-supabase.js; tests/redesign-browser.mjs; tests/production-smoke.mjs; HANDOVER_BN.md; UPGRADE_CHECKLIST.md।

Added: src/lib/committee.js; src/lib/cms-capabilities.js; src/components/CommitteeOrdering.jsx; supabase/inspect_cms_requirements.sql; tests/committee.test.mjs; tests/mock-cms-capabilities.js। No dependency/.env/GitHub/Vercel/database changes।

## Test coverage ও সীমাবদ্ধতা

Unit/source checks: optional event payloads, strict content-kind allowlist, default/configured committee hierarchy, duplicate position membership, missing-position legacy data, movement/membership validation, read-only capability contract/conflict path, backend-disabled UI, empty About content, 1500/5000ms constants।

Browser workflows use synthetic data and a **proposed mock backend**, not live Supabase. Matrix: ৩৯০px ও ১৪৪০px full flows, ৩২০/৩৬০/৩৯০/৭৬৮/১০২৪/১৪৪০px layout checks। New cases: blank About text has no defaults; caption-free multiple uploads up to ৩০ with limit rejection; titled/untitled slider uploads and real timed autoplay/pause-reset; untitled description/image-only events, persistence and simulated strict CHECK failure; same-position members, custom position, position/member reorder, refresh/public order, backend-unavailable disable। Previous auth/gallery/security/UI regression checks retained।

Production smoke locally fulfils all external HTTP; real Supabase connection হয় না। Actual build-এ unverified ordering RPC request হচ্ছে না এবং test adapter নেই—এটিও পরীক্ষা করে। Physical devices, real CRUD, actual constraints/RLS, ordering persistence/atomicity live-এ যাচাই হয়নি।

Final status: npm.cmd test, npm.cmd run test:migrations, npm.cmd run test:browser, npm.cmd run build ও git diff --check পাস। Full mock workflows 390px/1440px; 320px ordering controls-ও overflow check হয়েছে। Metadata-only SQL PostgreSQL parser/static check পাস; SQL execute হয়নি।

৩০টি About slide থাকলেও initial full-size image requests current/previous/next-এ সীমিত; CMS previews lazy-load হয়। Image-only event-এর nonvisual accessible image label আছে। Screenshot overwrite-এ OneDrive workspace-তে UNKNOWN filesystem error হয়েছিল; run-specific output folders দিয়ে rerun সফল। OS-level কারণ নিশ্চিত করা হয়নি। Final screenshot folders: artifacts/redesign/run-1795088848253-390-17780 এবং artifacts/redesign/run-1795088904955-1440-8588। এগুলো mock backend-এর ছবি; enabled Save button live backend availability প্রমাণ করে না।

---

# বর্তমান feature-repair ও CMS revision — ১৯ নভেম্বর ২০২৬

এই অংশ নিচের historical redesign রিপোর্টের আগে প্রযোজ্য। সংযুক্ত দুটি requirement document একই ছিল; একই কাজ দুবার প্রয়োগ করা হয়নি। Local source, inspection notes, চারটি existing SQL migration ও tests review করা হয়েছে। Live database/schema/policy export এখানে নেই; Supabase-এ সংযোগ বা SQL execute করা হয়নি। নিচের root causes code-এ যাচাইকৃত; live production failure-এর database-side কারণ নিশ্চিত বলা হচ্ছে না।

## Code-এ পাওয়া কারণ ও সংশোধন

| সমস্যা | পাওয়া কারণ | সংশোধন |
|---|---|---|
| About ছবি প্রকাশ আটকে থাকা | Caption required; upload শুধু URL ধরে রাখত, আলাদা Save দরকার হতো; async callback await হতো না | Caption optional, multi-file upload, await করা SQL save + reload; upload শেষেই About-এ প্রকাশ |
| CMS-এ ভুল success | Events/Committee/moderation UPDATE ও DELETE affected row যাচাই করত না | select(id).single() এবং returned identity যাচাই; permission/zero-row failure-এ success নয় |
| Refresh ব্যর্থ হলে duplicate event/content | Successful insert-এর পর editor identity হারিয়ে যেত বা reload error চাপা পড়ত | Saved ID ধরে রেখে Update হিসেবে retry; আলাদা saved-but-refresh-failed message |
| Gallery ভুল batch-এ দেখা | ID অথবা normalized name-এর প্রথম match নেওয়ায় explicit ID উপেক্ষিত হতে পারত | Explicit ID অগ্রাধিকার; unknown ID-তে অন্য batch-এ fallback নয়; পুরোনো name-only route রাখা |
| পুরোনো gallery response | Batch/session/role বদলালে in-flight response ও rendered rows যথেষ্ট scoped ছিল না | Request sequencing, current identity/batch check, render-time batch/status filter, scope change-এ reset |
| Approval-এর পরে gallery পুরোনো থাকা | অন্য viewer-এর open gallery-তে automatic refresh ছিল না | Visible gallery-তে ১৫ সেকেন্ড metadata refresh ও focus/visibility refresh; expired/নতুন photo ছাড়া signed URL পুনরায় তৈরি নয় |
| Committee archive অসম্পূর্ণ | শুধু existing rows-এর group; current সদস্য বছরভিত্তিক historical view থেকে বাদ পড়ত | ২০০৬–বর্তমান year index + actual extra years; current ও year views পৃথক, উভয়েই relevant records পায় |
| Historical data বদলে যাওয়া | Unknown committee year edit-এ current year বসতে পারত | Unknown year NULL/blank রাখা; undated archive; verified member ছাড়া committee/member তৈরি নয় |

## এখন কীভাবে ব্যবহার করবেন

- About description আলাদা form-এ Save করুন। About images-এর multi-file picker-এ caption ছাড়াই ছবি বাছাই করা যায়; প্রতি file Storage upload এবং site_content save সফল হলে public slideshow-এ আসে। বিদ্যমান সর্বোচ্চ চারটি নতুন image-slot rule রাখা হয়েছে; পুরোনো অতিরিক্ত records স্বয়ংক্রিয় সরানো হয়নি।
- Existing About image Edit করে optional caption/visibility পরিবর্তন বা file replacement করা যায়। Remove explicit confirmation-এর পরে content row সরায়; site-media physical file delete হয় না। File replacement নতুন UUID path নেয়, তাই Storage UPDATE permission লাগে না।
- Multi-upload sequential। মাঝের কোনো file ব্যর্থ হলে আগের successful images অক্ষত থাকে এবং error দেখায়; পুরো batch-কে database transaction বলে দাবি করা হয়নি। Retry-এর আগে image list দেখুন।
- About images শুধু opacity fade-এ প্রতি ২ সেকেন্ডে বদলায়। একটিমাত্র ছবিতে timer/control/transition নেই; ছবি না থাকলে fixed-size decorative placeholder। Reduced-motion preference চলন্ত অবস্থায় বদলালেও timer থামে।
- Events: title/description/image, optional date, location ও visibility; edit একই ID-তে update করে। Delete confirmation ও affected-row check আছে। Public section About-এর পরেই; unrelated About content আসে না।
- Committee Management-এ Archive year নির্বাচন করুন অথবা Prepare next committee year চাপুন। এটি draft year নির্বাচন করে; database-এ ফাঁকা committee বা fake member তৈরি করে না। প্রথম verified member save হলে নতুন বছর public year index-এ আসবে। Member name, position, batch, introduction, photo, year ও current flag সম্পাদনা করা যায়। Existing current flags স্বয়ংক্রিয় demote করা হয় না।
- Public Committee-তে ২০০৬–বর্তমান year cards, actual future/older recorded years, Current ও undated records পাওয়া যায়। Empty year স্পষ্টভাবে no verified records দেখায়। নতুন independent committee-description table/container যোগ করা হয়নি; supported introduction field member record-এই থাকে।
- Batch detail-এ members-এর পরেই scoped gallery দেখা যায়। পুরোনো Gallery route-ও চলে; shared Gallery URL-এ শুধু name ও stable batch ID থাকে, photo/account metadata নয়। Batch records rename/merge বা photos অন্য batch-এ move করা হয়নি।
- Member upload-এ actual active batch ID, uploader ID, batch-id/user-id/UUID-filename path ও pending status সংরক্ষিত হয়। Member নিজের pending/rejected records দেখতে পারে; public approved photos-ই দেখে। Admin moderation/delete ও uploader name fallback রাখা হয়েছে।
- Gallery insert acknowledgement অনিশ্চিত হলে potentially referenced file মুছে দেওয়া হয় না; আগে gallery reload করতে বলে। শুধু PostgreSQL-এর নিশ্চিত rejected transaction codes-এ নতুন orphan upload cleanup চেষ্টা হয়। Existing explicit admin deletion/cleanup flow অক্ষত।

## নিরাপত্তা ও database কাজ

নতুন SQL migration প্রয়োজন বলে local review-এ প্রমাণ পাওয়া যায়নি; existing চারটি migration অপরিবর্তিত। নতুন table, column, RLS policy, grants, trigger বা bucket পরিবর্তন করা হয়নি। is_admin(), profile protection, existing gallery limit trigger ও private bucket rules অক্ষত। .env/credentials, GitHub ও Vercel পরিবর্তন হয়নি।

Live/staging-এ manual verification প্রয়োজন:

1. supabase/preflight_checks.sql metadata output এবং supabase/LIVE_MIGRATION_PLAN_BN.md review করুন। Actual applied migration history এখানে দেখা হয়নি। Unknown live policy/function definition অনুমান করে overwrite করবেন না।
2. site_content-এর about kind, unique(kind,key), existing text/boolean columns ও admin disabled-row SELECT/write permissions যাচাই করুন। Optional caption empty string হিসেবে save হয়; অজানা custom nonempty CHECK থাকলে তার actual definition review লাগবে।
3. events.image_url, enabled এবং nullable event_date; committee_members.introduction, committee_year, is_current, photo_url ও batch column types/defaults মেলান। Existing unrelated columns update payload-এ পাঠানো হয় না।
4. Admin UPDATE/DELETE-এর returned-row SELECT permission-ও দরকার; silent zero rows এখন error হবে। এর জন্য RLS weaken বা broad grant যোগ করা হয়নি।
5. site-media public/JPEG-PNG-WebP/10 MB এবং admin/UUID.ext বা user-id/UUID.ext INSERT paths যাচাই করুন। এই repair নতুন Storage UPDATE/DELETE permission চায় না।
6. batch-gallery private এবং its real SELECT/INSERT/DELETE policies যাচাই করুন। Approved public/own permitted/admin signed access, own active-batch pending insert, admin moderation ও existing orphan cleanup permissions বজায় থাকতে হবে। সর্বশেষ user inspection-এ live bucket ইতিমধ্যে private/10 MB/JPEG-PNG-WebP confirmed; পুরোনো unlimited baseline superseded। কোনো bucket change প্রয়োজন নেই।
7. ১০০ approved-photo limit-এর existing DB trigger ও concurrent approvals live/staging-এ পরীক্ষা করুন। Frontend count check ও static tests concurrency/security প্রমাণ নয়। Signed URL TTL আগের মতো ৩৬০০ সেকেন্ড; instant revocation পরীক্ষা হয়নি।
8. Migrations দরকার হলে manual review order আগের মতো: 20261117_content_features.sql → 20261117_gallery_guards.sql → 20261119_ui_experience.sql → 20261119_batch_actions.sql। প্রতি file-এর আগে fresh fingerprint review; duplicate date-prefix history reconcile ছাড়া CLI db push নয়। এখানে কিছু execute করা হয়নি।

## Files changed

Modified: src/App.jsx; src/components/ContentFeatures.jsx; src/components/Management.jsx; src/components/Experience.jsx; src/lib/navigation.js; src/lib/notifications.js; src/lib/translations.bn.json; src/redesign.css; vite.config.js; package.json; tests/content.test.mjs; tests/mock-supabase.js; tests/redesign-browser.mjs; HANDOVER_BN.md; UPGRADE_CHECKLIST.md।

Added: src/lib/cms.js; tests/cms.test.mjs; tests/browser-suite.mjs; tests/production-smoke.mjs। Existing Playwright dependency ব্যবহৃত হয়েছে; নতুন dependency যোগ করা হয়নি। Dead Feature component/unused LogOut import সরানো হয়েছে। Verification screenshots artifacts/redesign-এ refreshed হয়।

## পরীক্ষা: scope ও সীমা

- npm.cmd test: existing suites + confirmed writes/zero-row denial, allowed payloads, NULL historical year, chronological unique year index, exact-ID batch resolution, status/ownership filtering, upload association ও per-viewer signed URL cache tests।
- npm.cmd run test:migrations: existing four migrations-এর static safety/preservation checks; SQL execute নয়।
- npm.cmd run test:browser: সম্পূর্ণ workflows ৩৯০px এবং ১৪৪০px-এ আলাদাভাবে চলে; অতিরিক্ত layout widths ৩২০/৩৬০/৩৯০/৭৬৮/১০২৪/১৪৪০px। Synthetic adapter sessionStorage-এ test data রাখে, তাই page reload persistence বাস্তব browser-এ পরীক্ষা হয়; এটি actual Supabase persistence-এর প্রমাণ নয়।
- Browser coverage: caption-free multiple About uploads, automatic public appearance, replace/remove, 2s fade/reduced motion; Events create/image/edit/delete/visibility, injected failed refresh ও no-duplicate retry; ২০০৬ থেকে empty-year archive, next year prepare, committee member/photo create/edit/delete/refresh; gallery upload/batch association, zero-row moderation failure, approve/public appearance, pending/rejected hiding, focus refresh, historical Gallery ID route reload, uncertain insert cleanup safety; prior auth/name/social/rail/CMS checks।
- Production smoke: actual production build-এর vendor/CMS chunks Chromium-এ load হয়; সব external HTTP locally fulfilled, live Supabase-এ connect হয় না। Production bundle-এ test adapter/fixture নেই তা পরীক্ষা হয়। Code chunks আলাদা করে oversized main-bundle warning সমাধান করা হয়েছে।
- Browser page errors/unexpected console errors এবং unexpected network requests test fail করে; injected backend failures-এর expected safe diagnostic logs আলাদা। Physical Android/iOS hardware ও real credentials দিয়ে test হয়নি।
- Final validation status: npm.cmd test, npm.cmd run test:migrations, npm.cmd run test:browser (390px + 1440px workflows ও production smoke), npm.cmd run build এবং git diff --check পাস। Supabase/migration files git diff-এ অপরিবর্তিত। LF/CRLF normalization notices ছাড়া whitespace error নেই।

---

> বর্তমান redesign revision (১৯ নভেম্বর ২০২৬): এই অংশ নিচের historical UI বিবরণকে supersede করে। SQL-এর জন্য supabase/LIVE_MIGRATION_PLAN_BN.md অপরিবর্তিত authoritative plan।

## বর্তমান redesign: বাস্তবায়ন ও যাচাই

স্থানীয় project-এ implementation হয়েছে। Live Supabase connection, SQL execution, .env edit, GitHub push বা deployment হয়নি। Browser-এর সব records/accounts/images/uploads synthetic fixture; real member data ব্যবহার হয়নি।

### পরিবর্তিত source ও configuration

- src/App.jsx: responsive named account header; explicit Home redirect after successful login/signup; email-confirmation signup-এও Home + confirmation notice। Deferred auth callbacks ও account/public-request sequence checks দিয়ে stale responses কমানো হয়েছে। একই account reload-এ profile নাম মুছে যায় না; role query ব্যর্থ হলেও loaded profile নাম রাখা হয়। Own registration/profile save approval_status পাঠায় না; existing server approval rules বহাল থাকে। Existing passing_year profile edit-এ রাখা হয়।
- src/App.jsx: Home → About → Events → Alumni/Batch continuous flow; duplicated Featured Events সরানো। Committee আলাদা navigation/page-এ থাকে। Gallery-এর navbar/submenu সরানো; batch detail-এর Gallery button ও পুরোনো Gallery routes অক্ষত। Admin-এর gallery status filter pending/approved/rejected/all; uploader labels-এর admin profile fallback। Hidden Events public stats-এ গণনা হয় না।
- src/components/Management.jsx (নতুন): dedicated About text/images ও Facebook/Messenger editors; professional CMS overview/navigation। About text uses site_content(kind=about,key=story), image rows use kind=about with unique keys। নতুন images সর্বোচ্চ চারটি; পূর্ববর্তী অতিরিক্ত records সরানো হয় না। Image replace/remove explicit action; physical Storage files delete হয় না। Admin permission frontend থেকে দেওয়া হয়নি।
- src/components/ContentFeatures.jsx: scoped brand/highlight এবং batch-content editors; About/Social generic editor থেকে আলাদা। Upload-এর local preview, busy state, safe HTTPS/social icons, natural-key edit-এর existing ID-safe writes রাখা। Required-field marker control-এর নিচে না পড়ে label-এর পাশে দেখায়। site_content creation order-এ পড়ে; display_order-based ordering/control বাদ।
- src/components/Experience.jsx: About-এর ২ সেকেন্ড opacity fade; hidden images বাদ। Carousel-এর fractional scroll accumulation; hover/focus-এ pause, manual interaction-এর ৭ সেকেন্ড pause, drag/touch/arrows ও existing seamless cycle রাখা। Reduced-motion preference মানা হয়।
- src/redesign.css (নতুন), src/main.jsx: navy/teal/sky/purple/gold visual theme, lightweight decorative motion, responsive header/CMS/forms/cards/footer, compact mobile statistics। About fade fixed frame-এ চলে; page overflow checks হয়েছে।
- src/lib/navigation.js: malformed/partial hash/history state normalized; missing search/default fields আর page crash করে না। Unknown properties (যেমন isAdmin) route দিয়ে authorization দেয় না। Back/Forward ও batch/gallery context রাখা।
- src/components/BatchEditor.jsx, src/lib/domain.js: display-order UI বাদ; name-only edit existing legacy batch name/other columns রাখে। RPC-based linked-content check/deletion protections অক্ষত।
- src/lib/i18n.jsx, src/lib/translations.bn.json, src/lib/notifications.js: নতুন Bengali labels; textarea/select-এর content ভুলভাবে accessible label-এ যুক্ত হওয়ার bug ঠিক। Safe notifications রাখা।
- package.json ও package-lock.json: test-only Playwright dependency; test:browser ও test:migrations commands। CMS code lazy-loaded; production build-এ management আলাদা chunk।

### এই revision-এর complete file manifest

Modified: src/App.jsx; src/main.jsx; src/components/BatchEditor.jsx; src/components/ContentFeatures.jsx; src/components/Experience.jsx; src/lib/domain.js; src/lib/i18n.jsx; src/lib/navigation.js; src/lib/notifications.js; src/lib/translations.bn.json; package.json; package-lock.json; tests/content.test.mjs; tests/domain.test.mjs; HANDOVER_BN.md; UPGRADE_CHECKLIST.md।

Added: src/components/Management.jsx; src/redesign.css; tests/mock-supabase.js; tests/redesign-browser.mjs। Generated verification artifacts: artifacts/redesign/home-desktop.png; home-mobile.png; admin-desktop.png; admin-mobile.png। Existing SQL migrations/preflight/credentials অপরিবর্তিত।

### Tests ও local verification

- npm.cmd test: domain/content/structure suites। Route defaults/type protection, name-only batch edits, dedicated management sections, About ordering independence এবং existing payload/security invariants পরীক্ষা করে। SSR test-এ unnecessary dependency scanning বন্ধ করে shutdown-time scan errors সমাধান করা হয়েছে।
- npm.cmd run test:migrations: static preservation/safety suite; SQL execute হয় না।
- npm.cmd run test:browser: tests/redesign-browser.mjs + tests/mock-supabase.js। Disposable local Vite server বাস্তব Supabase module-এর বদলে test adapter ব্যবহার করে। All non-local network blocked; synthetic image host locally fulfilled। Real Supabase request হলে test fail করে। Test runner installed Windows Chrome ব্যবহার করে; SMSA_TEST_BROWSER দিয়ে অন্য Chromium executable বেছে নেওয়া যায়। Chrome না থাকলে Playwright Chromium installation প্রয়োজন।
- Browser coverage: 320/390/768/1024/1440px public layout; 320/768px সব CMS panel; mobile profile-sourced name (metadata-তে আলাদা নাম), login/signup/confirmation redirects, logout, member Admin-route denial, role-error resilience, own-profile save, 2s fade, reduced-motion, rail movement/hover/click, legacy batch-to-alumni match, uploader labels, About image create/replace/edit/remove, Events image/create/edit/delete/separation, pending/approved/rejected moderation/admin deletion, social links এবং image paths।
- npm.cmd run build: production build verification। No dedicated lint script exists। Browser run শেষে dev server বন্ধ হয়।
- Screenshots: artifacts/redesign/home-desktop.png, home-mobile.png, admin-desktop.png, admin-mobile.png। এগুলো synthetic content দিয়ে তোলা; real site/data proof নয়।
- চারটি SQL migration আগের artifacts/SMSA_SQL_revision_20261119.zip-এর complete files-এর সঙ্গে byte-content comparison-এ অপরিবর্তিত। এই redesign-এ SQL লেখা/বদলানো হয়নি।

### Database/manual steps ও অবশিষ্ট সীমা

1. Live/staging metadata ও all applicable permissive/restrictive policies inspect করুন; supabase/preflight_checks.sql এবং supabase/LIVE_MIGRATION_PLAN_BN.md অনুসরণ করুন। Inspection এখানে চালানো হয়নি।
2. site_content-এর about kind, existing columns/unique constraint এবং admin disabled-record read/write দরকার। site-media public 10 MB JPEG/PNG/WebP settings/policies দরকার; নতুন Storage UPDATE/DELETE permissions লাগে না। Image paths admin/UUID.ext ও user-id/UUID.ext অপরিবর্তিত।
3. Gallery paths batch-id/user-id/UUID-filename। Private signed URLs, own active-batch uploads, review/delete flow এবং legacy 100-approved-photo cap রাখা। Actual RLS, service Storage operations ও concurrent 100-photo limit এখনও live/staging test দরকার।
4. Safe batch deletion-এর smsa_batch_has_content/smsa_delete_empty_batch ও gallery uploader-name RPC-এর dependencies আগের migrations-এ আছে। Supabase-managed Storage trigger privilege, locking/concurrency এবং function ownership manual verification ছাড়া compatible দাবি করা যাবে না।
5. Manual migration order: 20261117_content_features.sql → 20261117_gallery_guards.sql → 20261119_ui_experience.sql → 20261119_batch_actions.sql। প্রতিটি file-এর আগে fresh metadata fingerprint review; blind execution নয়। Duplicate filename-date prefixes থাকায় history reconcile ছাড়া CLI db push নয়। ইতিমধ্যে applied হলে আবার চালানোর আগে state/definitions review করুন।
6. Batch 2006…2026, Batch-20, Dakhil-20 UI-তে Dakhil-YYYY হিসেবে মেলে; Dakhil-2027/new batches একই format। Database records mass rename হয়নি। Actual stored-name conversion চাইলে live reference audit ও আলাদা reviewed data migration দরকার; এই task-এ তা করা হয়নি।
7. Email confirmation প্রয়োজন হলে confirmation email-এর পরে member নিজের profile সম্পূর্ণ করবে; unauthenticated signup-এ profile insert করা হয় না। Existing SMTP/redirect URL/Edge Function configuration এখানে যাচাই হয়নি। Admin account operations-এর existing admin-manage-user Edge Function অপরিবর্তিত।
8. Desktop Chrome viewport emulation হয়েছে; physical Android/iOS devices, real credentials, deployed performance ও production data দিয়ে test হয়নি। Full production compatibility/security certification দাবি করা হচ্ছে না।

---

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
