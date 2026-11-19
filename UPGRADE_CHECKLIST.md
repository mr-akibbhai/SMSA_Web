- [x] Homepage order Home → About → Alumni → Committee → Events; navbar order/design preserved; Gallery nav absent.
- [x] In-section committee year details, Current/Previous, empty state, multiple-member/custom ordering retained.
- [x] Correct DOM-order scrollspy, separate navigation RAF, initial-data anchor alignment, plain/legacy hashes, refresh/back-forward.
- [x] 390/1440 browser + fresh visual QA, unit/static checks, production build/smoke passed (mock verification).
- [ ] Existing DB privilege/schema preparation and actual auth/Storage/JWT/concurrency verification require explicit approval; production ordering stays disabled.

- [x] Security audit: fail-closed owner/TRUNCATE/default/PK/CHECK guards; same-ID position/rank snapshot conflicts; client confirmed-rank refresh and lock retry text.
- [x] Current revised SQL parser/static/unit/mock browser/build passed without SQL execution.
- [ ] Collect missing role/ownership/TRUNCATE metadata with explicit permission; authorize and run revised five-argument SQL/runtime concurrency tests before activation. Previous SQL runtime results do not cover this revision.

- [x] Supplied CMS JSON parsed/completeness checked; actual events/committee schema, PK/index/privileges/RLS reviewed.
- [x] Standalone CMS ordering migration prepared and offline PostgreSQL repeat-run/role/conflict tests passed; existing four migrations unchanged.
- [x] Existing committee display_order fallback/per-year hierarchy corrected; empty year save blocked; mock browser/build passed.
- [ ] Explicit approval, manual migration apply, actual JWT/PostgREST/two-session conflict tests, then production ordering flag activation. No live changes made.

# Current optional content / committee ordering status — 2026-11-19

- [x] Schema-independent ordering-response hardening; malformed/stale/mismatched results rejected; all local suites rerun and passed
- [x] Exact read-only inspection file consolidated into one JSON result; actual table results still pending

- [x] Both live buckets confirmed at 10 MB/JPEG-PNG-WebP; gallery private, site-media public; preserve settings/policies (table schema still pending)

- [x] About saved-only optional text; 30-image slots; caption-free uploads; existing files/kind CHECK preserved
- [x] Optional-title/name slider, 1.5s autoplay and resettable 5s manual pause
- [x] Optional-title Events frontend and useful constraint/storage errors
- [x] Default Bengali hierarchy, position/member ordering UI and proposed-backend tests
- [x] Read-only schema inspection file; no unverified display_order writes or DDL
- [x] Unit/migration safety/mobile+desktop browser/production smoke/build/diff checks passed
- [ ] Live event constraints/optional-field compatibility — actual metadata export required
- [ ] Live custom ordering persistence — proposed backend not installed; production save intentionally disabled
- [ ] Live RLS/Storage/concurrency/real-device verification

Latest details and exact next steps: HANDOVER_BN.md (top revision). Earlier checklist entries below are historical.

---

# Current feature-repair checklist — 2026-11-19

- [x] Caption-free multi-image About autosave, optional caption editing, replacement/removal, zero/single image states
- [x] Confirmed CMS mutations; no success on zero affected rows; saved identity survives refresh failures
- [x] Events image/create/edit/delete/visibility and optional date
- [x] Gallery exact batch-ID matching, scoped response/render filtering, inline batch album and historical ID routes
- [x] Gallery approval refresh, per-viewer signed URL cache, duplicate-upload lock and uncertain-acknowledgement file safety
- [x] Committee 2006–current year index; honest empty/undated states; next-year draft and member/photo CRUD
- [x] Responsive image presentation, local previews, restrained entrance/decorative motion, reduced-motion support
- [x] Existing/new unit, migration safety, 390px/1440px workflow tests, production smoke/build and diff checks passed
- [x] No new migrations/dependencies; no live SQL, credentials, RLS/grant changes, push or deployment
- [ ] Live Supabase schema/history, RLS/Storage grants, real CRUD/persistence and 100-photo concurrency verification

Current authoritative repair details: HANDOVER_BN.md (top revision). Older implementation notes below are historical.

---

# SMSA upgrade checklist (2026-11-19)

- [x] Gallery is_admin consistency, legacy normalization, repeatable private-bucket guards
- [x] Identity-safe content editing and regression tests
- [x] History-backed isolated details and Back navigation
- [x] Home-first layout; About fade; batch/committee rails; independent About/Events content (display-order UI removed)
- [x] Dedicated About/Social managers, colourful responsive redesign, named mobile account header and Home auth redirects
- [x] Offline Playwright browser coverage, CMS screenshots and reduced-motion checks
- [x] Admin panels; batch/member navigation; identity-safe member update payloads
- [x] Passing Year removed from UI; database column/historical values preserved
- [x] Central bilingual UI; required indicators; safe notifications; 10 MB validation
- [x] Separate SQL for UI fields, bucket configuration and batch safety actions
- [x] Build, existing/new tests, SQL parser review and public browser checks
- [ ] Apply/review migrations in staging — requires external database access; not performed
- [ ] Live authenticated upload/CRUD/moderation and RLS matrix — not performed
- [ ] Production-scale performance and real committee content checks — not performed

No live SQL/database/bucket change, .env edit, GitHub push or Vercel deployment.
Full results and limitations: HANDOVER_BN.md.
