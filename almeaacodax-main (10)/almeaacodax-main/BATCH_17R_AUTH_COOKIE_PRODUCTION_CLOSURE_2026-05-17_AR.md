# BATCH 17R — Auth Cookie Production Closure
**التاريخ:** 2026-05-17  
**الحالة:** Programmatically closed, final manual browser verification pending ⚠️

## ما تم
- إزالة تمرير `oauth_token` و `oauth_user` من رابط Google callback في السيرفر.
- تحويل الواجهة إلى cookie-first بشكل افتراضي (إلا إذا تم تعطيلها صراحة عبر `VITE_AUTH_COOKIE_FIRST=false`).
- إيقاف تخزين session token في `localStorage` نهائيًا.
- نقل بيانات الملف الشخصي غير الحساسة إلى `sessionStorage` فقط.
- الإبقاء على `credentials: include` لعمل الجلسة عبر HttpOnly cookie.

## الملفات المعدلة
- `server/src/routes/auth.routes.ts`
- `contexts/AuthContext.tsx`
- `services/api.ts`
- `services/clientTelemetry.ts`
- `scripts/smoke-auth-cookie-contract.mjs`

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run typecheck`: PASS (أول محاولة timeout ثم إعادة ناجحة)
- `npm run build`: PASS
- `npm run smoke:auth-cookie`: PASS (5/5)
- `npm run smoke:health-readiness`: PASS

## فحص الإنتاج
- تم نشر الإصلاح على الإنتاج (`0d25f1ee1897`).
- تحقق حي ناجح من مسارات callback:
  - `GET /api/auth/google/callback?error=...` -> `302` إلى `#/login?oauth_error=google` بدون `oauth_token`.
  - `GET /api/auth/google/call?error=...` -> `302` بنفس النتيجة بدون `oauth_token`.
- ما يزال مطلوب تحقق يدوي أخير داخل المتصفح لضمان عدم بقاء token قديم من جلسات سابقة:
  1. Hard refresh / Clear site data.
  2. تسجيل دخول Google.
  3. التأكد أن Local Storage لا يحتوي token جلسة.
  4. تأكيد استمرار الجلسة بعد refresh عبر cookie.

## القرار
- الحالة الآن: **Programmatically closed, final manual browser verification pending**.
- لا تُعد Fully closed إلا بعد خطوة التحقق اليدوي الأخيرة داخل المتصفح.
