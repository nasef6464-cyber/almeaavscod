# تقرير الدفعة 25C-FINAL-A — Operational Role Credentials Alignment
**التاريخ:** 2026-05-18  
**الحالة:** Fully closed

## الهدف
منع فشل `smoke:operational` بسبب الاعتماد على كلمات مرور ثابتة غير مضمونة في الإنتاج، وتجنب حظر تسجيل الدخول المتكرر (429).

## ما تم
- تحديث سكربت:
  - `server/src/scripts/smokeOperationalJourneysApi.ts`
- أصبح السكربت يدعم متغيرات بيئية صريحة لكل دور:
  - `SMOKE_ADMIN_TOKEN`
  - `SMOKE_TEACHER_TOKEN`
  - `SMOKE_SUPERVISOR_TOKEN`
  - `SMOKE_STUDENT_TOKEN`
  - `SMOKE_STUDENT_REDEEMED_TOKEN`
  - `SMOKE_PARENT_TOKEN`
- في بيئة الإنتاج remote (`onrender`) تم تفعيل guard:
  - يمنع محاولات login بكلمة مرور افتراضيًا.
  - يطلب token صريح لكل دور (أو تفعيل `SMOKE_ALLOW_PASSWORD_LOGIN=true` بشكل مقصود).
- الهدف من الـguard: منع تكرار lock/rate-limit على حسابات التشغيل أثناء smoke.

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run smoke:operational`: PASS (71/71)

## فحص الإنتاج
- تم بنجاح تشغيل matrix runtime متعدد الأدوار على الإنتاج بعد المواءمة.

## المخاطر المتبقية
- التوصية التشغيلية: إبقاء smoke الإنتاجي معتمدًا على tokens صريحة وتدويرها دوريًا.

## المطلوب للإغلاق النهائي
تم التنفيذ والإغلاق.

## الدفعة التالية المقترحة
- BATCH 27B — Sentry Live Event Proof
