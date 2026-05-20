# دليل التسليم بين الحسابات (نسخة التشغيل)

آخر تحديث: 2026-05-10

## الهدف
هذا الملف هو المرجع الموحد لأي حساب جديد حتى يكمل مباشرة بدون:
- إعادة شغل سابق
- كسر أجزاء مستقرة
- استهلاك توكن بدون تقدم فعلي

## قاعدة مهمة جدا
المحادثات نفسها لا تنتقل تلقائيا بين الحسابات.  
المرجع الحقيقي المشترك هو ملفات المشروع داخل GitHub/الريبو، وعلى رأسها هذا الملف.

## اقرأ هذا الترتيب قبل أي تعديل
1. `docs/SHIFT_HANDOFF_AR.md` (هذا الملف)
2. `docs/CURRENT_EXECUTION_PLAN_AR.md`
3. `docs/CURRENT_DEVELOPMENT_STATUS_AR.md`
4. `docs/AGENT_HANDOFF_AR.md`

## طريقة العمل الإلزامية (نفس النهج)
1. اختر جزئية واحدة فقط من الخطة.
2. نفذها كاملة (كود + فحص + تجربة الدور المناسب).
3. لا تلمس جزئية أخرى إلا بعد إغلاق الحالية.
4. حدّث هذا الملف بجملة: ماذا أُغلق؟ وما الذي بقي؟

## تعريف "الإغلاق"
الجزئية تعتبر مغلقة فقط إذا:
- الكود مكتمل
- فحوصها مرت
- تجربة الواجهة تمت للدور المعني (طالب/ولي أمر/مدير/مشرف/معلم حسب الحالة)
- تم توثيق النتيجة هنا

## حدود الصلاحيات والمنصات
- الاستمرار يعتمد على صلاحية نفس الجهاز/البيئة (GitHub/Render/Vercel/Mongo).
- لا نضع أسرار حساسة داخل المحادثة.
- أي تعديل بيئة إنتاج يتم توثيقه كـ "تغيير إعدادات" داخل هذا الملف.

## سياسة منع التكرار
- ممنوع إعادة تصميم جزء مستقر إلا لو ظهر خلل واضح.
- أي طلب جديد لا يلغي ما قبله إلا إذا كان "تعديل صريح".
- الأولوية: رحلة الطالب + البساطة + ثبات السلوك.
- طلب جديد مثبت للخطة: إدارة خطوط المنصة تكون دفعة مستقلة تشمل اختيار الخط العام، رفع ملفات خطوط، قائمة خطوط عربية مناسبة، معاينة قبل التفعيل، وتطبيق موحد على كل الصفحات. لا تغير الخطوط ضمن أي دفعة أخرى إلا إذا كان هذا هو نطاق الدفعة صراحة.

## سجل التسليم السريع
### 2026-05-10
- تم تثبيت مرجع تسليم موحّد بين الحسابات.
- المطلوب من أي حساب لاحق: البدء من هذا الملف ثم الخطة الحالية.
- تم إغلاق جزئية (المكتبة + ملف الدعم + مجاني/مدفوع حسب مكان العرض) بعد فحص ناجح:
  - `smoke:library-support` (10/10)
  - `smoke:student-journey` (6/6)
  - `smoke:quiz-access` (17/17)
- الجزئية الجارية التالية: ثبات رحلة الطالب داخل المادة بعد تحديث الصفحة (refresh) مع الحفاظ على نفس التبويب والسياق.
- تم تنفيذ دفعة أولى في الدورات: منشئ الدورة يستطيع الآن اختيار المدرب/المعلم، حفظ نسبة المدرب من دخل الدورة، واستدعاء درس موجود أو اختبار موجود داخل أقسام الدورة بدل الإضافة الجديدة فقط. الفحوص:
  - `smoke:course-builder` (4/4)
  - `smoke:quiz-access` (17/17)
  - `server build`
  - `frontend build`
- تم بدء وإغلاق عقد أسئلة الفيديو التفاعلية: الدرس يستطيع حفظ أسئلة بتوقيت محدد، والسؤال إما من بنك الأسئلة أو سؤال جديد ينشأ من منشئ الأسئلة الموحد، والمشغل يمررها في موضوعات التأسيس والدورات. الفحص: `smoke:video-questions` (5/5).
- تم إغلاق دفعة الباقات المدرسية ونسبة المعلم: الباقة المدرسية لها الآن معلم/مدرب ونسبة دخل محفوظة في النوع والسيرفر، وتظهر في إدارة المدارس وتقرير التصدير ولوحة المالية. الفحص: `smoke:package-revenue` (4/4)، مع نجاح `smoke:course-builder` و`smoke:quiz-access` والبناء الكامل.

## قالب تحديث مختصر (انسخه عند كل دفعة)
```
تاريخ:
الدفعة:
ما تم:
ما تم فحصه:
المتبقي المباشر:
مخاطر/ملاحظات:
```

## تحديث دفعة 2026-05-10 - فصل التدريب عن الاختبارات بصريًا
- القاعدة المثبتة: التدريب والاختبارات يظلان قسمين منفصلين في واجهة الطالب وإدارة المحتوى، حتى لو اشتركا داخليًا في نفس مشغل الأسئلة وبنك الأسئلة.
- ما تم: تحسين قائمة التدريب/الاختبارات داخل مساحة التعلم بإظهار ملخص بسيط: إجمالي العناصر، المفتوح الآن، وما هو ضمن باقة، مع شارات واضحة على كل عنصر.
- ما تم: زر التدريب يظهر كـ "ابدأ التدريب"، وزر الاختبار يظهر كـ "ابدأ الاختبار"، والاختبار/التدريب المغلق يفتح مسار الباقة.
- فحص الحماية المضاف: `smoke:quiz-access` يتحقق الآن من أن `mode="bank"` للتدريب، وأن مصادر `training` و`tests` منفصلة، وأن النصوص البصرية لا تدمج القسمين.
- المتبقي المباشر: استكمال تحسين تجربة الباقات/الإعلانات/تقارير الطالب وولي الأمر بنفس قاعدة البساطة وعدم نقل تفاصيل الإدارة للطالب.
## Production Hardening Sprint - 2026-05-10
- Closed critical direct-unlock route: `POST /api/auth/me/purchase` now returns `410 Gone`; paid access must come from payment review/webhook or access-code redemption.
- Closed direct quiz-result injection: `POST /api/quizzes/results` now returns `410 Gone`; real quiz results must come from `/api/quizzes/:id/submit`.
- Question attempts no longer trust client `isCorrect`; the server compares the selected option with the stored correct answer.
- Access-code redemption now reserves usage with MongoDB atomic `$inc` and `$expr` guard.
- Added baseline backend hardening: Helmet, compression, global rate limit, stricter auth/payment/AI/quiz-submit limits, and smaller JSON payload limit.
- Added docs: `PRODUCTION_READINESS_REPORT.md`, `SECURITY_CHECKLIST.md`, `LOAD_TEST_REPORT.md`, `BACKUP_RESTORE_GUIDE.md`.
- Added guard: `npm run smoke:production-hardening`.
- 2026-05-12 follow-up: removed stale frontend `api.completePurchase`, removed the store-side fake `purchasedCourses` mutation from `enrollCourse`, moved operational API seed purchases to payment request + admin review, and moved seed quiz results to `/api/quizzes/:id/submit`.
- 2026-05-12 follow-up: removed the stale frontend `api.createQuizResult` helper and stopped `saveExamResult` from posting direct results. The quiz page still uses `/api/quizzes/:id/submit`, and question-attempt sync strips client-calculated `isCorrect` before sending to the server.
- 2026-05-12 follow-up: hardened question HTML rendering. The shared `normalizeQuestionHtml` now strips active script surfaces and unsafe URI/style attributes, and admin question previews use the same sanitizer as learner pages.
- Added guard: `npm run smoke:direct-unlock-cleanup`.

## Production Audit + Paid/Free Foundation Sprint - 2026-05-10
- Added `AdminAuditLog` storage and `/api/operations/admin-audit-logs` for admin-only review of sensitive actions.
- Logged sensitive events: payment settings updates, payment request reviews, admin user upserts/updates, blocked direct purchase attempts, and blocked direct quiz result attempts.
- Changed `server/.env.example` so `DEV_LOCAL_ADMIN_BYPASS=false` is the safe default.
- Foundation topics now respect the topic itself for paid/free status. If a foundation topic is not locked, the student sees it as free and can open it directly. Locked topics still open the matching package/payment path.
- Added guard: `npm run smoke:production-audit`.
- Next direct work: complete package choice UX for public discount codes, memberships, and package variants (foundation only, tests only, full subject, full path, full membership) without merging training and tests.

## Payment Packages Sprint - 2026-05-10
- Closed the first package-choice pass: locked content can now pass several suitable public packages to the payment modal, so the student sees choices such as foundation-only, tests-only, subject/path package, or full package when those packages exist.
- Added optional `discountCode` to payment requests and the payment modal. This records the code for admin review only; real automated discounts still need a dedicated discount-code rules screen.
- Path package tabs now include global membership-style packages with no path binding, so a future "membership opens everything" package can be visible from path package pages.
- Guard added: `npm run smoke:payment-package`.
- Next direct work: build the real discount-code/ membership management UI and final package entitlement rules, while keeping training and tests as separate sections.

## Discount Codes Sprint - 2026-05-11
- Added a real MongoDB `DiscountCode` model and included discount codes in learning backups.
- Added admin payment APIs to list, create/update, pause, and reactivate discount codes.
- Payment requests now validate discount codes on the server, calculate original amount, discount amount, and final amount without trusting the browser, and increment redemption counts only when the admin approves the request.
- Approval is guarded: the server checks that the buyer still exists and reserves the discount-code usage before saving the request as approved, so a failed/expired code cannot leave a falsely approved request.
- The student payment modal now previews valid/invalid discount codes and shows the discounted total before submission; this is only UX, and the server recalculates again at request creation.
- Added the admin financial UI for discount-code creation, package targeting, usage review, pause/reactivate, and CSV export.
- Updated `npm run smoke:payment-package` so it guards discount persistence, server-side calculation, admin management, and backup coverage.
- Next direct work: membership/bundle administration, then payment gateway or verified manual approval workflow. Keep the student/parent screens simple; put dense financial detail in admin only.

## Global Membership Sprint - 2026-05-11
- Closed the first global-membership administration pass: admins can create a package as "membership" from path package management, with no path binding and `packageContentTypes=['all']`.
- Global memberships appear inside each path package tab as a platform-wide option, but still use the same approval/payment request flow. Students do not unlock anything by calling an API directly.
- Existing entitlement logic already treats a purchased public package with no path binding as matching any path, so approved membership payment opens courses, foundation, training, tests, and library without duplicating rules.
- Guard added to `npm run smoke:payment-package` for membership enums, admin global toggle, and global package tab visibility.
- Next direct work: payment gateway/webhook integration or stricter manual approval evidence, then focused UX polish for student package selection.

## Manual Payment Evidence Sprint - 2026-05-11
- Closed a payment-hardening pass: creating or approving a manual payment now requires clear evidence (transfer reference, wallet number, receipt link, card note, or explicit admin evidence).
- Admin financial review disables approval for pending requests with missing evidence, while rejection stays available.
- Approved requests store `approvalEvidence` for audit and future handoff.
- Guard extended in `npm run smoke:payment-package` so direct access cannot be unlocked from a weak payment approval path.
- Next direct work: payment gateway/webhook integration, then final student-facing package selection polish.

## Verified Payment Webhook Sprint - 2026-05-11
- Closed the first gateway-safe payment pass: `POST /api/payments/webhooks/payment` now accepts signed payment events only.
- The webhook requires `x-payment-signature` HMAC verification using `PAYMENT_WEBHOOK_SECRET` or the admin payment setting secret.
- The server rejects mismatched currency/amount, stores gateway event and transaction ids, treats repeated events as idempotent duplicates, and unlocks content only after the trusted paid event is accepted.
- Manual approval and gateway approval now share the same server-side purchase application helper and discount-redemption reservation path.
- Guard extended in `npm run smoke:payment-package`.
- Next direct work: polish the student locked-content package UX into a lighter "this is paid / view suitable packages" step, then connect the webhook contract to the chosen live payment provider.

## Student Package Choice UX Sprint - 2026-05-11
- Closed the first visual polish pass for locked paid content: when more than one suitable package is available, `PaymentModal` expands to a wider comparison layout and shows package choices in up to three columns.
- This keeps the student flow simple: locked content still opens the same secure payment/request path, but the available packages are easier to compare instead of appearing as a narrow vertical stack.
- Guard extended in `npm run smoke:payment-package` to verify the wider multi-package modal contract.
- Verified: `npm run smoke:payment-package`, `npm run typecheck`, `npm run build`, `npm --prefix server run build`, and local browser load of the learning page with zero console errors.
- Next direct work: a smaller pre-payment message step ("this part is paid / view suitable packages") before showing payment methods, while keeping dense package/payment details in admin screens only.

## Student Paid-Content Intro Sprint - 2026-05-11
- Added a lightweight first step inside `PaymentModal`: students now see a short paid-content message, the selected item/package price, suitable package choices, and one clear button to continue to payment methods.
- Payment methods, discount codes, access codes, and review evidence still run through the same hardened request flow; this is UX simplification only, not a new unlock path.
- Guard extended in `npm run smoke:payment-package` for the intro step, copy, and wider layout.
- Verified: `npm run smoke:payment-package`, `npm run typecheck`, `npm run build`, `npm --prefix server run build`, and local browser load with zero console errors.
- Next direct work: polish the package landing page and package cards so the student can compare foundation-only, tests-only, subject/path, and membership packages with the same simple style.

## Student Package Landing Sprint - 2026-05-12
- Closed the package-card polish pass: package cards now use clear visual tones by package scope/content type, with a stronger subscribe action for students and the same locked/payment flow underneath.
- The UI remains simple for students: package type, price, activation state, package preview, and subscribe/open action. Dense payment and coverage details stay on admin screens.
- Added a guard to `npm run smoke:payment-package` so the package landing page keeps the colored package-tone contract and visible subscribe call-to-action.
- Updated `LOAD_TEST_REPORT.md` with the immediate causes of Vercel slowness: large frontend chunks, Render cold start on the free instance, and missing measured load-test gates for 10k+ users.
- Next direct work: performance hardening in code, starting with chunk splitting and first-load cleanup, then measured k6/autocannon load tests before claiming large-scale readiness.

## Frontend First-Load Performance Sprint - 2026-05-12
- Closed the first performance pass: student-facing video entrypoints now lazy-load `CustomVideoPlayer` instead of importing the heavy video stack immediately.
- Touched entrypoints: `VideoModal`, `CoursePlayer`, and `CourseLanding`.
- Added guard: `npm run smoke:performance`.
- Expected effect: normal student pages and result/learning pages avoid pulling ReactPlayer/HLS/DASH until a lesson preview or video modal is opened.
- Remaining direct performance work: split admin/dashboard/report chunks, then run measured load tests before any 10k-user readiness claim.

## Reports Export Performance Sprint - 2026-05-12
- Closed the reports export split: `pages/Reports.tsx` now lazy-loads `xlsx` only when exporting Excel.
- This keeps student/parent report browsing lighter while preserving the same export buttons and behavior.
- `npm run smoke:performance` now verifies the reports page does not reintroduce a static spreadsheet import.

## Admin Dashboard Performance Sprint - 2026-05-12
- Closed the first admin split: `dashboards/admin/AdminDashboard.tsx` lazy-loads each heavy manager tab.
- Production build result: the admin dashboard shell is now about 51 kB before gzip instead of loading the previous large admin bundle up front.
- Important: this did not merge training/tests or change the student journey; it only changes when admin code downloads.
- Guard: `npm run smoke:performance` checks that heavy admin managers are not statically reintroduced.

## Vercel Cache Sprint - 2026-05-12
- Closed the production cache-header fix in `vercel.json`.
- Do not restore the old global `no-store`; it made repeat visits redownload built assets and was one cause of Vercel slowness.
- Hashed assets now use one-year immutable caching, while the SPA HTML shell uses revalidation so new deployments still appear.
- 2026-05-12 follow-up: do not use a catch-all `Cache-Control` source in `vercel.json`; Vercel can apply it after `/assets/(.*)` and override immutable asset caching. The shell header is now scoped to `/` only.

## Frontend Bootstrap Performance Sprint - 2026-05-12
- Closed the Tailwind production-build pass: `cdn.tailwindcss.com` and the old importmap were removed from `index.html`; Tailwind now builds through PostCSS from `styles/main.css`.
- First render is no longer blocked by the full data bootstrap on public, dashboard, admin, and category pages. Only quiz/result routes remain blocking because they need real data before interaction.
- `AuthContext` now treats `/auth/me` as the critical auth request and defers quiz results/question attempts; admin users load only inside the users tab.
- Admin dashboard shell appears first; AI/operations status and users are loaded by the relevant tab instead of delaying the whole page.
- Added lightweight performance telemetry for slow API calls when `?perf=1` is present or in development.
- Verified locally: `npm run typecheck`, `npm run build`, `npm --prefix server run build`, `npm run smoke:performance`, `npm run smoke:route-loading`, `npm run smoke:runtime-source`, plus in-app browser checks for `/`, `/#/admin-dashboard`, `/#/dashboard`, and `/#/category/p_1777779639431`.
- Remaining direct performance work: measure the deployed Vercel build after push, then handle any slow backend endpoint separately with concrete timing.
- 2026-05-13 follow-up: fixed a regression from the non-blocking bootstrap. `GenericPathPage` must not remove `?subject=...` while taxonomy/subjects are still loading lazily, otherwise topic/lesson/question data looks missing even though it exists in production. Guarded by `npm run smoke:route-loading`.
- 2026-05-13 hardening follow-up: expanded `npm run smoke:student-journey` so the selected live subject must expose sections, skills, and question-bank items in addition to the foundation topic, playable lesson, training quiz, support files, and return route. This is the new guard against repeating the "questions/skills/lessons disappeared" regression.

## Dashboard Bootstrap Performance Sprint - 2026-05-12
- Production probe found the direct current bottleneck: `/api/quizzes/questions` returned about 726KB and took about 3.1s, while the Vercel shell and taxonomy/content bootstrap were much lighter.
- Dashboards and reports now defer the general question-bank bootstrap instead of blocking the whole route on it.
- The question-bank API now has bounded scoped pagination (`page`, `limit`, `pathId`, `subject`, `sectionId`, `skillId`, `ids`, `search`) so future growth does not require downloading the entire bank.
- It also supports `summary=true`; app bootstrap requests only the first bounded summary page with short text previews, while admin/search flows should continue moving toward scoped fetches instead of full-bank reads.
- Summary bootstrap can pass `noTotal=true` to avoid a full question-bank count on dashboard open; exact totals remain available for detailed admin/search requests.
- Public/learner taxonomy bootstrap now has a short server-side cache with automatic invalidation on taxonomy edits; staff views still get fresh admin-visible taxonomy.
- Public content bootstrap now has a short guest cache and uses one active-path lookup for topics/lessons/library items; authenticated/student-specific data remains fresh.
- Public/learner quiz list now has a short cache with automatic invalidation on quiz writes; staff/admin views remain fresh.
- Public/learner question summaries now have a short cache for bounded summary bootstrap requests; full question payloads and admin/search requests stay fresh.
- Affected non-blocking routes: student dashboard, admin/teacher/supervisor dashboards, parent dashboard, and reports.
- Question-dependent widgets hydrate when the question bank arrives in the background; quiz/category routes keep the stricter bootstrap gate.
- Guard extended in `npm run smoke:performance`.
- Guard: `npm run smoke:deployment-cache`.
- Scope: deployment/performance only. No student, parent, admin, quiz, package, payment, training, or foundation logic changed.

## Load Testing Sprint - 2026-05-12
- Added `load-tests/k6-platform-journey.js` for staged 100/500/1000 user checks.
- Added `load-tests/README.md` and `npm run smoke:load-tests`.
- This is the official measurement path before claiming large student capacity.
- Do not claim 10k-user readiness until real runs are recorded with upgraded Render and MongoDB metrics.
- Scope: test/readiness tooling only. No student, parent, admin, quiz, package, payment, training, or foundation logic changed.

## Monitoring Diagnostics Sprint - 2026-05-12
- Added backend structured request diagnostics in `server/src/middleware/requestLogger.ts`.
- Slow and failed API requests now write safe JSON logs with path, status, duration, user id/role when available, and no request body or secrets.
- Added Render env switches: `REQUEST_LOG_LEVEL=normal` and `SLOW_REQUEST_LOG_MS=1000`.
- Added `MONITORING_AND_LOGGING_GUIDE.md` and guard `npm run smoke:monitoring`.
- Scope: observability/readiness only. No student, parent, admin, quiz, package, payment, training, or foundation logic changed.

## Database Index Sprint - 2026-05-12
- Added first-pass MongoDB indexes for high-traffic reads: learning bootstrap, topics, lessons, library, courses/packages, users, groups, payment requests, discount codes, access codes, audit logs, AI metrics, and announcement ads.
- Added `DATABASE_REVIEW.md` and guard `npm run smoke:database`.
- Scope: database performance/readiness only. No student, parent, admin, quiz, package, payment, training, or foundation behavior changed.

## Notification Foundation Sprint - 2026-05-12
- Added backend notification foundation: templates, delivery logs, in-app notifications, pending email/WhatsApp records, and admin APIs.
- Added provider-safe console mode through `EMAIL_PROVIDER=console` and `WHATSAPP_PROVIDER=console` for staging only.
- Added docs: `NOTIFICATION_SYSTEM_GUIDE.md` and `WHATSAPP_INTEGRATION_GUIDE.md`.
- Added guard: `npm run smoke:notifications`.
- Scope: backend messaging foundation only. No existing student learning/payment/quiz behavior changed.

## Auth Recovery Sprint - 2026-05-12
- Added email verification and password reset backend foundation with SHA-256 hashed tokens.
- Added generic forgot-password response to reduce account enumeration.
- Reset/verification messages are queued through the notification delivery foundation.
- Added docs: `AUTH_ACCOUNT_SECURITY.md`.
- Added guard: `npm run smoke:auth-account`.
- Scope: auth/account recovery only. No student learning/payment/quiz behavior changed.

## External Notification Providers Sprint - 2026-05-12
- Added provider adapters for Resend email and generic email HTTP webhooks.
- Added provider adapters for WhatsApp Cloud API and generic WhatsApp HTTP webhooks.
- `console` mode remains staging-only; empty providers fail/retry instead of pretending to send.
- Updated deployment docs and notification guides with required env variables.

## Auth Frontend Recovery Sprint - 2026-05-12
- Added frontend pages for forgot password, reset password, and email verification.
- Linked password recovery from the login modal.
- Pages accept tokens from URL query strings and manual paste fields.
- Added guard: `npm run smoke:auth-frontend`.

## Auth Login Security Sprint - 2026-05-12
- Added backend password-strength enforcement for registration, reset password, and admin-created users.
- Added failed-login counters and temporary account lock after 5 failed attempts.
- Successful login and password reset clear failed-login state.
- Added frontend password guidance in signup/reset screens.
- Added guard: `npm run smoke:auth-login-security`.

## API Surface Hardening Sprint - 2026-05-12
- Production CORS now uses `CLIENT_URL` plus optional `CORS_ALLOWED_ORIGINS`; local dev origins stay development-only.
- Added `x-request-id` to API responses, error JSON, and structured request logs.
- Added route-scoped body limits: auth 100kb, quiz/payment/AI 1mb, general API 5mb.
- Production 5xx errors now return a safe generic message with a request ID.
- Added guard: `npm run smoke:api-security`.

## Runtime Source-Of-Truth Sprint - 2026-05-12
- Production frontend/runtime now always uses the real API path even if `VITE_USE_REAL_API=false` is accidentally set.
- Legacy Firebase sync is limited to local development only.
- Server local-admin bypass now refuses to run when `NODE_ENV=production`, even if `DEV_LOCAL_ADMIN_BYPASS=true` is accidentally set.
- Added guard: `npm run smoke:runtime-source`.

## NoSQL Injection Guard Sprint - 2026-05-12
- Added backend sanitizer before API routes to reject Mongo operator keys like `$ne` and dotted keys in request bodies/query strings.
- Rejected unsafe requests return `400` with the active `requestId` for support/debugging.
- Added guard: `npm run smoke:nosql-sanitizer`.
- Visual check rule: after each completed batch, open or refresh the app in the in-app browser/Chrome and record whether the page renders normally. For this batch, the landing page rendered correctly; local console showed existing API connection warnings because the local backend was not running.

## Public Shell Performance Sprint - 2026-05-12
- Fixed one direct cause of Vercel first-load slowness: the public landing/auth shell no longer waits for the full content bootstrap before rendering.
- Public pages no longer start the heavy bootstrap automatically during idle. This prevents first-open public pages from pulling courses, questions, quizzes, taxonomy, content bootstrap, and skill progress before the user needs them.
- Public pages now load only a small active announcement-ad endpoint so the announcement overlay can still appear without the full data load.
- If the user moves quickly into a data-heavy route, the full bootstrap starts immediately and the route remains gated until data is ready.
- Data-heavy routes still block until bootstrap is ready: dashboard, category, quiz, results, admin/staff dashboards, reports, courses, and student learning pages.
- Added guard coverage to `npm run smoke:performance`.
- Visual check: opened `http://127.0.0.1:5174/#/` in the in-app browser; the landing page rendered immediately with brand, hero content, and CTAs visible, with no blocking loading spinner.
- Scope: frontend performance only. No paid/free, package, payment, quiz scoring, training/test separation, or admin permissions changed.

## Homepage Hero Management Sprint - 2026-05-12
- Do not change fonts or the landing-page layout unless the user asks explicitly.
- Added optimized hero asset: `public/images/homepage-hero-boy-platform.jpg` showing a student studying through a simple platform-style UI; frontend defaults use `?v=20260512` to avoid stale browser/CDN cache.
- Wired the asset as the default in `pages/Landing.tsx`, `dashboards/admin/HomepageManager.tsx`, and backend default homepage settings.
- Admin homepage manager now supports direct hero image upload, image alt text, a default-boy reset button, and guidance: 1200x800 or 3:2, preferably WebP/JPG under 900KB.
- Frontend homepage settings fetch uses `cache: "no-store"` so admin changes are not hidden by browser cache.
- Added guard: `npm run smoke:homepage-hero`.
- Visual check done on `http://127.0.0.1:5174/#/`: hero renders the boy studying from the platform-style UI, and page typography/layout were not intentionally changed.

## Typography Preservation Sprint - 2026-05-12
- User explicitly requested restoring the original typography and not changing fonts unless asked.
- Kept the platform font as Tajawal and added the missing `900` weight so `font-black` hero text renders consistently like the original screenshot.
- Added Tailwind `fontFamily.tajawal` alias and applied Tajawal at `html`, `body`, and `#root`.
- Added guard: `npm run smoke:typography`.
- Browser DOM check on `http://127.0.0.1:5174/#/` confirmed the homepage heading, CTAs, and hero image are visible. Screenshot capture timed out twice in the in-app browser tool, but the page DOM rendered normally.
- Scope: typography preservation only. No layout, color, spacing, package, payment, quiz, training, or admin behavior changed.

## Video Fallback Performance Sprint - 2026-05-12
- `CustomVideoPlayer` no longer imports `react-player` directly at module load.
- YouTube lessons keep the lighter Plyr/YouTube path; `react-player` is now lazy-loaded only for generic fallback video sources.
- Timed in-video question behavior remains covered by `npm run smoke:video-questions`.
- `npm run build` still emits `video-dash` as an async fallback chunk because `react-player` supports DASH, but normal public/YouTube paths no longer pull it immediately.
- Scope: performance/load splitting only. No video question authoring, lesson layout, student payment/access, quiz, package, or admin permissions changed.
- Superseded later the same day by `Native Video Bundle Cleanup`, which removed `react-player`, `video-dash`, and `video-hls` from production entirely.

## SEO Privacy Sprint - 2026-05-12
- Closed the first SEO/privacy metadata pass without changing UI layout or typography.
- Added `SeoRouteMeta` in `App.tsx` so public pages keep `index, follow`, while dashboards, quiz, results, reports, profile, auth-token pages, and admin/staff pages switch to `noindex, nofollow`.
- Runtime metadata now updates title, description, canonical URL, Open Graph, and Twitter metadata per route.
- Strengthened `public/robots.txt` with private-route disallow rules and absolute sitemap URL.
- Added `lastmod` to `public/sitemap.xml` and Vercel `X-Robots-Tag` noindex headers for future clean private paths.
- Added `SEO_READINESS_REPORT.md` and guard `npm run smoke:seo`.
- Important: the app still uses `HashRouter`. Do not migrate to `BrowserRouter` casually; it needs a separate sprint with Vercel rewrites, old hash return URLs, payment redirects, quiz return links, and visual checks.
- Visual check: local Chrome headless loaded `http://127.0.0.1:5174/#/` and confirmed the landing page hero renders with `robots=index, follow`; it then loaded `/#/results?attempt=seo-smoke` and confirmed private metadata changes to `robots=noindex, nofollow`.

## Homepage Manager Save Fix + Health Readiness Sprint - 2026-05-12
- User reported `Authentication required` when saving homepage manager changes. Root cause: the manager called `api.updateHomepageSettings(payload)` without explicitly passing the active admin session token, so the request could arrive without admin auth in some session states.
- Fixed `dashboards/admin/HomepageManager.tsx` to use `useAuth()`, require `user.token` before saving, and call `api.updateHomepageSettings(payload, user.token)`.
- Added clearer Arabic error copy for expired/missing admin sessions instead of raw `Authentication required`.
- Extended `npm run smoke:homepage-hero` to guard the token-passing save contract.
- Upgraded health monitoring in the same production-readiness batch: `/api/health/live` checks process liveness, `/api/health/ready` checks MongoDB operational readiness and returns `503` only when MongoDB is unavailable, `/api/health/scale-ready` blocks high-concurrency readiness until Redis-backed rate limits/queues are configured, while `/api/health` stays backward-compatible.
- Health payload now includes service name, environment, version, short commit when available, uptime, startedAt, timestamp, and database check state without secrets.
- Routine logs now skip `/api/health/*` unless slow/failing.
- Added guard `npm run smoke:health-readiness` and updated `DEPLOYMENT_GUIDE.md`.
- Chrome visual/function check completed on `http://127.0.0.1:5174/#/admin-dashboard`: opened homepage manager as a dev admin, clicked `حفظ التعديلات`, and confirmed `تم حفظ إعدادات الصفحة الرئيسية بنجاح` with no raw `Authentication required`.
- Completion rule reinforced: any admin feature is not considered closed unless the save path and the public/user-facing effect are both checked.

## Platform Fonts Management Sprint - 2026-05-12
- User explicitly asked to add platform-wide font management after asking to restore the old typography. Default remains Tajawal; no visual font change happens unless an admin saves a new setting.
- Added backend model and API: `GET/PATCH /api/content/platform-font-settings`; public read, admin-only write.
- Added admin tab `platform-fonts` under the admin dashboard with body font, heading font, recommended Arabic fonts, live preview, reset to default, and WOFF/WOFF2/TTF/OTF upload capped at 500KB.
- Added runtime font bootstrap so public/student/admin pages apply saved font settings through CSS variables: `--platform-font-body` and `--platform-font-heading`.
- Added guards: `npm run smoke:platform-fonts` and updated `npm run smoke:typography`.
- Verified: `npm run smoke:platform-fonts`, `npm run smoke:typography`, `npm run typecheck`, `npm run server:build`, `npm run build`.
- Chrome visual/function check: opened `http://127.0.0.1:5174/#/admin-dashboard?tab=platform-fonts`, confirmed the manager renders with upload controls and Tajawal defaults, clicked save, and confirmed no raw `Authentication required`.

## 2026-05-12 - Advanced Platform Fonts Sprint

- Expanded the platform font manager from a basic body/heading picker into a full typography control panel.
- Admin can now manage separate typography targets: body text, headings, navigation, and buttons.
- Each target supports stored/recommended Arabic fonts, optional size, optional weight, optional color, and live preview.
- Added more suitable Arabic font presets: Almarai, Readex Pro, and Noto Naskh Arabic while preserving Tajawal as the default.
- Empty size/weight/color values intentionally keep the current platform design untouched; custom overrides apply only after admin saves them.
- Backend model and validation now persist the advanced font settings safely, so admin choices do not fail on save.
- Updated the smoke contract to cover advanced controls and the new CSS variables.
- Scope: global typography controls only. No homepage content, payment/access, quiz/training separation, package logic, layout spacing, or colors changed.

## Route Loading and Auth Cookie Sprint - 2026-05-12
- User reported that Vercel opens the landing page quickly but with an incomplete top navigation, then admin navigation can stay on a blank spinner before the dashboard appears.
- Fixed the route fallback UX: `LoadingFallback` now renders a full branded page shell with header/sidebar/card skeletons instead of a small spinner on an empty white page.
- Added early public navigation bootstrap from taxonomy data so the header menu does not look broken while the rest of the app hydrates.
- Added common route prefetch for all users (dashboard, learning space, quizzes, mock exams, courses), with an extra admin-dashboard prefetch only for privileged roles.
- Added header navigation skeleton placeholders when the saved paths have not arrived yet, with a short timeout fallback so the skeleton never stays as final UI if the API is slow/unavailable.
- Started the safer session migration: login/register now also set an HttpOnly auth cookie, auth middleware accepts either Bearer token or cookie, frontend sends credentials, and logout clears the server cookie.
- Remaining performance note: production build still reports large lazy chunks in spreadsheet/charts/editor/math/admin paths. Firebase and video DASH/HLS have since been removed from production.
- Added guards: `npm run smoke:route-loading` and `npm run smoke:auth-cookie`.

## Legacy Firebase Production Chunk Cleanup - 2026-05-12
- Closed one direct Vercel slowness source from the production bundle: legacy Firebase fallback writes are now guarded by `import.meta.env.DEV && VITE_USE_REAL_API === 'false'`, and the store also forces the real API path whenever `import.meta.env.PROD` is true.
- Removed the stale Firebase `manualChunks` rule from `vite.config.ts`; the production build no longer emits the previous heavy Firebase chunk. The latest build only had an empty placeholder before this cleanup, then the placeholder rule was removed.
- Updated `smoke:runtime-source` and `smoke:performance` so future changes cannot accidentally make production use the Firebase fallback again.
- Scope: performance/source-of-truth only. No UI, typography, homepage content, routes, package logic, or student/admin workflows were changed.
- Remaining performance note: spreadsheet/export, charts, editor, math rendering, and some page chunks are still the next measurable bundle targets. Firebase and video DASH/HLS are no longer active production bundle concerns.

## Native Video Bundle Cleanup - 2026-05-12
- Closed the next direct Vercel bundle target: removed `react-player` from dependencies and removed stale `video-player`, `video-hls`, and `video-dash` manual chunk rules.
- `CustomVideoPlayer` now uses the existing light paths: YouTube stays on Plyr, Vimeo/Drive use iframe embeds, and direct video files use native HTML5 `<video>`.
- Timed in-video questions remain supported for YouTube/Plyr and native direct-file playback, with `npm run smoke:video-questions` guarding the overlay contract.
- `npm run build` no longer emits `assets/video-dash-*.js` or `assets/video-hls-*.js`; the largest remaining production bundle targets are now spreadsheet/charts/editor/math/admin paths.
- Scope: video bundle/performance only. No visual redesign, homepage, packages, payments, quiz/training split, or admin permissions changed.

## Admin Excel Lazy Loading Sprint - 2026-05-12
- Closed the spreadsheet follow-up from the performance plan: admin managers no longer import `xlsx` statically when the tab opens.
- Added shared `utils/xlsxLoader.ts`; Excel is now loaded only on explicit export/import/template actions.
- Covered users, groups, school portal, schools, lessons, library, quizzes, and question-bank managers.
- Guard extended: `npm run smoke:performance` verifies the lazy spreadsheet contract.
- Verified: `npm run typecheck`, `npm run smoke:performance`, `npm run build`, and `npm --prefix server run build`.
- Scope: performance only. No visual design, typography, homepage, payment/package, quiz scoring, training/test separation, or permissions changed.

## Results Chart Lazy Loading Sprint - 2026-05-12
- Current batch target: reduce student result/report page startup weight without changing report layout or copy yet.
- Moved the `recharts` donut chart out of `pages/Results.tsx` into a lazy component: `components/results/ResultDonutChart.tsx`.
- `pages/Results.tsx` now loads the chart through `React.lazy` and keeps a stable circular fallback while the chart chunk arrives.
- Guard extended: `npm run smoke:performance` checks that `pages/Results.tsx` does not statically import `recharts`.
- Scope: performance only. Do not combine this with the upcoming report simplification UI sprint unless the user explicitly asks.

## Student Reports Simplification Plan - Pending
- User wants `تقاريري` in the student dashboard to be very simple by default: weak skill names, short suggestions, low-height cards, and little text.
- Add a clear `تقرير تفصيلي` action that opens a dedicated page with skill details in a simple layout.
- Weak-skill logic must be based on accumulated solved questions/attempts for each skill, with a minimum sample size, not a single question.
- Reports should support the student, parent, teacher, supervisor, and admin perspectives without showing all details to the student by default.
- Track context matters: when a student is enrolled in a track such as `نافس`, the dashboard should prioritize that track's tests/reports and show progress in the registered track.
- If a student tries to buy/access track-related content without being registered in the right track, show a simple message and route them to track registration/selection first.
- Keep the public site generally available; track-specific dashboards and pushed tests should be scoped by the student's registered track.

## Student Reports Evidence Sprint - 2026-05-12
- Default student report now treats weak-skill evidence as a collection of solved questions across one quiz or multiple quizzes.
- A skill with fewer than 2 linked attempts/questions is shown as an initial reading, not a final weak-skill judgment.
- Student summary cards show the evidence count and correct answers, e.g. `x من y`, so the student/parent understands why a skill is flagged.
- The simple student view keeps only summary, download, and detailed-report actions; Excel/extra suggestions stay behind the detailed report.
- Scope: student reports logic/UX only. Admin/teacher/parent reports, quiz scoring, package/payment access, homepage, typography, and route loading were not changed.

## Student Track-Aware Reports Sprint - 2026-05-12
- Student reports now read `enrolledPaths` from the store.
- If the student has registered paths, the simple report prioritizes weak skills from those paths when skill path data is available.
- The report shows a short track banner: either the active registered paths or a prompt to choose a path first.
- Internal path ids are not exposed to students; the report shows the path name when available or a generic registered-path label.
- Students without a registered path are directed to `/dashboard?tab=paths` before relying on track-specific tests/reports.
- Scope: student report prioritization only. It does not change package/payment gates, public content visibility, quiz scoring, or admin reports.

## Planned Institutional Reports Sprint
- Build a role-aware reporting hub for admin, supervisor, teacher, and parent without duplicating the student report logic.
- Admin sees all students, paths, directed tests, weak-skill summaries, exports, and message actions.
- Supervisor sees only assigned school/group/path scope.
- Teacher sees owned or assigned students/content and can send follow-up tests for enrolled path students.
- Parent sees linked student progress, weak skills, and simple downloadable reports.
- Needed actions: grouped reports, individual student report, skill report, directed-test report, export, import/add students, message/alert students.
- Keep the student-facing report simple; put deep detail and bulk actions in role dashboards.

## Institutional Reports Command Hub Sprint - 2026-05-12
- Added a compact `مركز متابعة مؤسسي` section for non-student report views.
- The hub gives each role one operational next step, not a long explanation.
- Quick actions now include: direct follow-up test route, copy alert text, open the relevant management scope, and export focused student rows.
- Admin routes to users/quizzes/notifications, supervisors route to groups/quizzes, teachers route to quizzes, and parents stay in their linked-student report scope.
- Student reports remain unchanged and simple.

## Reports-To-Directed-Quiz Context Sprint - 2026-05-12
- The institutional `توجيه اختبار` action now opens the quiz center with `source=reports` and `mode=central`.
- When the report has a weak skill id, the link also carries `pathId`, `subjectId`, `sectionId`, and `skillId`.
- `QuizzesManager` reads those parameters, preselects filters, shows a small "opened from report" banner, and creates a central follow-up draft with the selected skill id.
- This keeps reports, directed tests, and school follow-up workflow connected without duplicating quiz management screens.

## Reports-To-Directed-Student Sprint - 2026-05-12
- If the institutional report identifies a lead student, the follow-up quiz link now carries `targetUserId`.
- `QuizzesManager` reads `targetUserId` and seeds newly-created central follow-up quizzes with that student in `targetUserIds`.
- Optional `targetGroupId` support was added to the same link flow for future group-level report actions.
- The report-origin banner now names the targeted student or group when available.

## Reports-Student-Focus Actions Sprint - 2026-05-12
- Each student card inside institutional reports now has a direct "توجيه اختبار" action.
- The action opens the central quiz manager with `targetUserId` for that exact student and the first resolved weak skill when available.
- This keeps admin, supervisor, and teacher follow-up reports operational without sending staff to a generic student report screen.

## Reports-Student-Group Context Sprint - 2026-05-12
- Student follow-up cards now keep the student's first `groupId` in the directed quiz link when available.
- Student cards show up to two group names, so staff know the school/class context before sending follow-up work.
- Student follow-up Excel exports now include the group names column for school handover.

## Reports-Subject-Follow-Up Sprint - 2026-05-12
- The "مواد تحتاج تدخل" section now opens a central directed quiz for the selected subject instead of sending staff to a generic student quiz tab.
- When a lead student exists, the subject action carries the student's `targetUserId` and first `targetGroupId` too.
- This keeps subject-level intervention, student focus, and group context in one report-to-quiz flow.

## Reports-Recent-Attempt Follow-Up Sprint - 2026-05-12
- Recent attempt cards now expose an "اختبار متابعة" action when the attempt has weak skills.
- The action opens a central directed quiz scoped to the first weak skill and the attempt student when available.
- This turns recent-result monitoring into a direct intervention flow for admins, supervisors, teachers, and parents.

## Reports-Assigned-Follow-Up Context Sprint - 2026-05-12
- Assigned follow-up quizzes in reports now show whether they target students, groups, or the current scope.
- This keeps school/admin readers from opening directed tests blindly without knowing who the test is for.
- The change is display-only and uses the existing `targetUserIds` and `targetGroupIds` returned by scoped analytics.
