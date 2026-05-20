# BATCH F2 - Firebase Complete Deletion

التاريخ: 2026-05-19
الحالة: Fully closed

## الهدف
إزالة مسار Firebase legacy بالكامل من المنصة (كود + ملفات + dependency) مع الحفاظ على سلامة البناء والفحوص.

## ما تم تنفيذه
- إزالة legacy sync block من `App.tsx`.
- إزالة legacy Firebase fallback writes من `store/useStore.ts`.
- حذف الملفات:
  - `services/firebase.ts`
  - `services/firebaseSync.ts`
  - `firebase-applet-config.json`
- إزالة dependency `firebase` من `package.json` وتحديث `package-lock.json`.
- تحديث smoke contract `scripts/smoke-runtime-source-contract.mjs` ليصبح مطابقًا للحالة الجديدة (Firebase removed).

## فحوص التنفيذ
- `npm run typecheck` => PASS
- `npm run build` => PASS
- `npm run smoke:runtime-source` => PASS
- `npm run smoke:frontend:strict` => PASS

## التحقق الإنتاجي
- smoke frontend strict أكد أن الإنتاج يخدم commit الحالي:
  - `deployed app version matches 9905ebb` => PASS
- تم التحقق من سلامة route shells وباقي checks الحرجة في smoke strict (26/26 PASS).

## المخرجات
- Firebase references التشغيلية أزيلت من runtime paths.
- لا يوجد تحميل أو مزامنة Firebase في المسار التشغيلي.
- إغلاق الدفعة F2 مكتمل.
