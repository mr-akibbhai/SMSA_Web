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
