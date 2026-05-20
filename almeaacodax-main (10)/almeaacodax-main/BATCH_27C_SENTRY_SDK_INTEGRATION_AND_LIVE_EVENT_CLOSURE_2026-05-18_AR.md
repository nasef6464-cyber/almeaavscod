# تقرير الدفعة 27C — Sentry SDK Integration + Live Event Closure
**التاريخ:** 2026-05-18  
**الحالة:** Programmatically closed, production verification pending

## السبب
دفعة 27B أثبتت أن فحوص المراقبة تعمل، لكن لا يوجد ربط Sentry SDK فعلي داخل runtime؛ لذلك لم يكن ممكنًا استخراج Live Event Proof.

## نطاق الدفعة
- تفعيل تكامل Sentry SDK فعليًا في backend.
- تفعيل تكامل Sentry SDK فعليًا في frontend.
- إضافة مسار admin آمن لإرسال Sentry test event (`eventId`) لإثبات حي لاحق.
- بدون أي تغيير UI أو تصميم.

## ما تم تنفيذه
1. إضافة طبقة Observability لـ Sentry في السيرفر:
   - ملف جديد: `server/src/observability/sentry.ts`
   - `initSentry()` + `captureSentryException()` + `captureSentryMessage()`.
2. ربط التهيئة في سيرفر Express:
   - تعديل: `server/src/app.ts`
   - استدعاء `initSentry()` عند إنشاء التطبيق.
3. ربط التقاط أخطاء 5xx تلقائيًا:
   - تعديل: `server/src/middleware/errorHandler.ts`
   - إرسال الأخطاء الحرجة إلى Sentry مع سياق (`requestId`, `path`, `method`, `userId`, `role`).
4. إضافة endpoint للإثبات الحي (Admin only):
   - تعديل: `server/src/routes/operations.routes.ts`
   - مسار: `POST /api/operations/sentry/test-event`
   - يرجع `eventId` عند التهيئة الصحيحة.
5. ربط Sentry في frontend:
   - ملف جديد: `src/observability/sentry.ts`
   - تعديل: `index.tsx` لاستدعاء `initFrontendSentry()`.
6. إضافة smoke contract للتحقق من wiring:
   - ملف جديد: `scripts/smoke-sentry-runtime-contract.mjs`
   - سكربت npm جديد: `smoke:sentry-runtime`.
7. إضافة الاعتمادات المطلوبة:
   - `@sentry/node` في `server/package.json`
   - `@sentry/react` في `package.json`

## الملفات المعدلة في هذه الدفعة
- `server/src/observability/sentry.ts` (جديد)
- `server/src/app.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/routes/operations.routes.ts`
- `src/observability/sentry.ts` (جديد)
- `index.tsx`
- `scripts/smoke-sentry-runtime-contract.mjs` (جديد)
- `package.json`
- `server/package.json`

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run smoke:monitoring`: PASS
- `npm run smoke:health-readiness`: PASS
- `npm run smoke:sentry-runtime`: PASS
- `npm run smoke:sentry-live-proof`: FAIL (Missing `SMOKE_ADMIN_TOKEN`)

## فحص الإنتاج
- تم التحقق البرمجي من readiness/monitoring contracts بنجاح.
- إثبات Sentry الحي (Issue/Event داخل لوحة Sentry الإنتاجية) ما زال **pending** حتى تنفيذ نداء endpoint على الإنتاج ببيئة تحتوي `SENTRY_DSN` صالح ثم توثيق `eventId`.

## المخاطر المتبقية
- بدون تنفيذ نداء حي على الإنتاج وتوثيق `eventId` من Sentry Dashboard لا يمكن إعلان Fully closed.
- نشر Render الحالي ما زال على commit أقدم من دمج 27C، لذلك endpoint الجديد يحتاج إكمال دورة deploy أولًا.

## خطوات التحقق اليدوي (الإنتاج)
1. تأكد أن `SENTRY_DSN` مضبوط في Render (backend) و`VITE_SENTRY_DSN` في Vercel (frontend).
2. ادخل كـ admin.
3. نفّذ:
   - `POST /api/operations/sentry/test-event`
4. احفظ `eventId` من الرد.
5. افتح لوحة Sentry وتأكد وصول الحدث بنفس `eventId`.
6. حدّث التقرير بحالة الإغلاق النهائي بعد التطابق.

## الدفعة التالية المقترحة
- BATCH 27D — Sentry Live Production Event Proof (final evidence + closure)

## Update 2026-05-19 - Final Production Closure
**Final status:** Fully closed

### Final live proof
- Production endpoint used: `POST /api/operations/sentry/test-event`
- Smoke command: `npm run smoke:sentry-live-proof`
- Result: PASS
- Verified `eventId`: `39a8881844724be6844dd2f7fd63c88c`
- Verified visually in Sentry dashboard under issue: `Manual Sentry smoke event`
- Verified release in Sentry: `83832c0426e5`
- Verified environment in Sentry: `production`

### Deployment and runtime closure notes
- Render was redeployed until backend production served the required Sentry-enabled commit path.
- Missing backend CSRF middleware was added to Git and deployed.
- Production auth flow required CSRF support, so the smoke tooling was updated accordingly.
- `scripts/resolve-smoke-admin-token.mjs` now supports CSRF-protected production login.
- Render production health verification passed: `https://almeaacodax-k2ux.onrender.com/api/health` => `200 OK`, `ready=true`.

### Closure outcome
BATCH 27C is no longer pending. The batch is now **Fully closed** with real production evidence captured both from the API response and from the Sentry dashboard itself.
