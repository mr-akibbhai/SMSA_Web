# SMSA স্থানীয় বাস্তবায়ন ও Supabase setup

কোড স্থানীয়ভাবে পরিবর্তন করা হয়েছে। GitHub push, Vercel deployment বা production SQL চালানো হয়নি।

## স্থানীয়ভাবে চালানো

```powershell
npm install
npm run dev
npm test
npm run build
```

Terminal যে Local URL দেখায় সেটি খুলুন। চলমান preview: http://127.0.0.1:5174/ । `.env`-এ আগের VITE_SUPABASE_URL ও VITE_SUPABASE_ANON_KEY ব্যবহার করুন। Secret/service-role key দেবেন না।

## Database setup — প্রয়োজনীয় বাহ্যিক ধাপ

সম্পূর্ণ production schema/RLS এই checkout-এ নেই। Public API দিয়ে profiles.photo_url পাওয়া গেছে; নতুন event/history columns এবং site_content পাওয়া যায়নি।

1. Supabase SQL Editor-এ আগে `supabase/inspect_schema.sql` চালিয়ে metadata পরীক্ষা করুন। এটি user rows নেয় না। Existing policy ও trigger-এর সঙ্গে নিচের migration মিলিয়ে নিন। সম্ভব হলে staging-এ আগে পরীক্ষা করুন।
2. `supabase/migrations/20261117_content_features.sql` একবার চালান। এতে site_content, site-media public image bucket, events.image_url এবং committee history columns যুক্ত হয়। Existing rows মুছে না; পুরোনো committee current থাকে, admin পরে year সেট করবেন।
3. Existing gallery policies/storage paths মিলিয়ে `supabase/migrations/20261117_gallery_guards.sql` একবার চালান। এতে approval limit trigger ও restrictive visibility/upload policies আছে। batch-gallery private না থাকলে পুরো transaction fail করবে।
4. Scripts rerun করার জন্য নয়: table/function/policy name আগে থাকলে থামবে। Error হলে transaction rollback হবে; অনুমান করে existing object drop করবেন না।
5. Existing public_alumni view-এ photo_url আছে এবং শুধু public fields ফেরত দেয় কি না যাচাই করুন। profiles/user_roles-এর private read policies, protected columns, এবং admin-manage-user Edge Function-এর role checks আলাদাভাবে review করতে হবে। Restrictive policies existing permissive policies-কে সীমিত করে; যেখানে existing allow policy নেই সেখানে স্বয়ংক্রিয় access দেয় না।
6. site-media ছবি ইচ্ছাকৃতভাবে public: ব্যক্তিগত document দেবেন না। JPEG/PNG/WebP 5 MB পর্যন্ত। Individual uploads user-id folder-এ, admin content admin folder-এ যায়। Storage policy tests বাধ্যতামূলক। পুরোনো/অব্যবহৃত uploaded image স্বয়ংক্রিয় মুছে যায় না; references যাচাই করে cleanup করতে হবে।

## নতুন ব্যবস্থাপনা

- Top-right Login → Member/Admin। Login হলে profile dropdown: My Profile, Logout, admin-only dashboard।
- Alumni dropdown-এর Alumni/Gallery; existing Dakhil batch cards ও batch filtering রক্ষিত। Batch profile নির্বাচিত batch-এর alumni list-এর ওপরে।
- Admin → Website Content Management: official profile, batch profile, social links, carousel। Type নির্বাচন, content save; existing item Edit/Delete। Social links HTTPS, visibility স্বাধীন।
- My Profile-এ ছবি upload করে Save Profile চাপুন।
- Events form-এ ছবি upload এবং পুরোনো event CRUD। Homepage carousel-এর পর featured events।
- Committee form-এ year/current flag/introduction/photo। Current checkbox বন্ধ করলে সেই বছরের history section-এ যায়।
- Existing batch/account administration ও gallery moderation সংরক্ষিত।

## বাস্তবে করা পরীক্ষা

- Production build: সফল, duplicate-key warning সংশোধিত।
- npm test: HTTPS URL validation, unsafe/disabled link suppression, history/current separation, hidden carousel — পাস।
- Browser: logged-out public sections, Login choices, Admin form, Member form, Alumni submenu→Gallery, existing batch cards, featured event — দেখা হয়েছে।
- Mobile viewport 390: document width 375; horizontal document overflow পাওয়া যায়নি। Sticky header ও touch-scrollable nav আছে।
- Authenticated account, upload, content CRUD, approval concurrency, SQL/RLS execution, password recovery email, live carousel transitions: external configuration/test account ছাড়া end-to-end পরীক্ষা হয়নি। Missing site_content-এর কারণে additional content unavailable notice ও network 404 প্রত্যাশিত, setup সম্পন্ন হলে পুনরায় পরীক্ষা করুন।

## GitHub-এর আগে

`npm test`, `npm run build`, `git diff --check`, `git diff` চালিয়ে review করুন। `.env` ignored আছে নিশ্চিত করুন। Staging-এ admin/member/anonymous আলাদা session দিয়ে policy matrix পরীক্ষা করুন। Pending/rejected ছবি anonymous read এবং অন্য user-এর profile update প্রত্যাখ্যাত হতে হবে। নতুন schema apply ছাড়া নতুন CMS feature পুরোপুরি চলবে না। এই কাজ থেকে কোনো push বা deployment হয়নি।
