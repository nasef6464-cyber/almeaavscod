# BATCH 24 — Platform Integration Secrets Encryption At Rest
**التاريخ:** 2026-05-18  
**الحالة:** Programmatically closed, production verification pending

## السبب
تم اعتماد هذه الدفعة لسد فجوة أمنية: أسرار التكاملات كانت تُخفى عند العرض فقط، بينما تُخزن نصًا صريحًا في قاعدة البيانات.

## نطاق الدفعة
- تعديل مسارات `platform-integrations` فقط لضمان:
  - فك التشفير وقت التشغيل قبل الحسابات الداخلية.
  - إعادة التشفير قبل الحفظ في قاعدة البيانات.
  - استمرار masking في كل الاستجابات.
- بدون أي تغيير تصميم UI.

## ما تم تنفيذه
1. إضافة مفتاح إعداد جديد للتشفير:
   - `PLATFORM_INTEGRATIONS_SECRET_KEY` في `server/src/config/env.ts`.
2. إضافة وحدة تشفير/فك تشفير مركزية:
   - `server/src/utils/integrationSecretsCrypto.ts` (AES-256-GCM مع prefix `enc::`).
3. دمج التشفير داخل مسارات التكاملات في:
   - `GET /content/platform-integrations`
   - `PATCH /content/platform-integrations`
   - `GET /content/platform-integrations/setup-checklist`
   - `GET /content/platform-integrations/runtime-audit`
   - `POST /content/platform-integrations/history/:id/restore`
4. تحديث smoke contract للتأكد من وجود استدعاءات التشفير/فك التشفير داخل route.

## الملفات المعدلة في هذه الدفعة
- `server/src/config/env.ts`
- `server/src/utils/integrationSecretsCrypto.ts` (ملف جديد)
- `server/src/routes/content.routes.ts`
- `scripts/smoke-integrations-runtime-contract.mjs`

## الملفات التي كانت معدلة مسبقًا ولم يتم لمسها
- توجد ملفات كثيرة معدلة مسبقًا في الشجرة قبل بدء هذه الدفعة، ولم يتم تعديلها ضمن نطاق BATCH 24.

## الفحوص
- `npm --prefix server run build`: PASS
- `npm run smoke:integrations-runtime`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS

## فحص الإنتاج
- لم يتم تنفيذ فحص إنتاج مباشر عبر DB explorer في هذه الدفعة من داخل الجلسة.
- الحالة الصحيحة: **Programmatically closed, production verification pending**.

## خطوات التحقق اليدوي (إنتاج)
1. من لوحة الإدارة افتح `Platform Integrations` وعدّل secret لأي provider.
2. تأكد أن API response لا يعيد قيمة secret (masked فقط).
3. نفّذ `setup-checklist` و`runtime-audit` وتأكد أن منطق `isConfigured` ما زال صحيحًا.
4. نفّذ restore من history وتأكد أن الإعدادات تعمل ولا يظهر secret نصًا صريحًا في الاستجابة.
5. افحص الوثيقة في MongoDB وتأكد أن القيم الحساسة الجديدة تبدأ بـ `enc::` وليست plaintext.

## المخاطر المتبقية
- الأسرار القديمة المخزنة قبل هذه الدفعة تحتاج تدوير/إعادة حفظ لضمان تشفيرها (حسب نمط الاستخدام).
- يلزم تفعيل مفتاح `PLATFORM_INTEGRATIONS_SECRET_KEY` في بيئة الإنتاج بقيمة قوية ثابتة.
- يلزم فحص إنتاج مباشر للتأكد من عدم وجود plaintext legacy قيّم.

## الدفعة التالية المقترحة
- BATCH 25 — RBAC Scope Audit Batch 2 (Supervisor/Teacher/Parent scope verification)
