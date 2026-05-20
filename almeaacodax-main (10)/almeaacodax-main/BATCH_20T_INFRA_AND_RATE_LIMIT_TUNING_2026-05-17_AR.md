# BATCH_20T_INFRA_AND_RATE_LIMIT_TUNING_2026-05-17_AR

التاريخ: 2026-05-17
اسم الدفعة: BATCH 20T — Infrastructure & Rate-Limit Tuning Before 500+ Retest
الحالة: Programmatically closed

## ما تم
- إضافة مفاتيح ضبط رسمية لحدود rate-limit في بيئة السيرفر لتسهيل ضبط الإنتاج قبل إعادة اختبار 500+ بدون تعديل كود لاحقًا.
- تحديث middleware لاستهلاك هذه المفاتيح بدل القيم الثابتة.

## المتغيرات الجديدة
- `RATE_LIMIT_GLOBAL_WINDOW_MS`
- `RATE_LIMIT_GLOBAL_LIMIT`
- `RATE_LIMIT_AUTH_WINDOW_MS`
- `RATE_LIMIT_AUTH_LIMIT`
- `RATE_LIMIT_SENSITIVE_WINDOW_MS`
- `RATE_LIMIT_SENSITIVE_LIMIT`

## الملفات المعدلة
- `server/src/config/env.ts`
- `server/src/middleware/rateLimiters.ts`
- `PROJECT_STATUS.md`
- `docs/SPARK_BATCH_LEDGER_AR.md`
- `BATCH_20T_INFRA_AND_RATE_LIMIT_TUNING_2026-05-17_AR.md`

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run smoke:health-readiness`: PASS
- `npm run smoke:auth-cookie`: PASS

## المخرجات التشغيلية
- أصبح ضبط سلوك throttling قابلًا للإدارة من إعدادات البيئة مباشرة، وهو شرط أساسي قبل نافذة إعادة اختبار 500+.

## المخاطر المتبقية
- ما زالت نافذة إعادة الاختبار الفعلية 500+/1000+ مطلوبة بعد تطبيق القيم على الإنتاج.

## الدفعة التالية المقترحة
BATCH 20U — 500+ Retest Window Execution & Metrics Capture
