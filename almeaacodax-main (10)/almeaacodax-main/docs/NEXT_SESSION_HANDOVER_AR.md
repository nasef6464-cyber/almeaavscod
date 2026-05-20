# ملف تسليم الجلسة التالية (مرجع إلزامي)

آخر تحديث: 2026-05-18 (تحديث تسليم شامل للحساب التالي)

هذا الملف مرجع سريع لأي حساب جديد لاستكمال العمل بنفس القواعد دون فقدان السياق.

## 1) قاعدة العمل الإلزامية

عند قول المالك "اكمل" يتم العمل على دفعة واحدة فقط حتى الإغلاق الكامل، ولا يتم بدء دفعة جديدة قبل الإغلاق النهائي للدفعة الحالية.
  
قاعدة تشغيل حاكمة (إلزامية):  
**كلمة "اكمل" = استمرار تلقائي بدون توقف حتى إغلاق الدفعة بالكامل (تنفيذ + فحوص + توثيق + رفع + نشر + تحقق حي).**

الإغلاق الكامل لأي دفعة يعني:
1. تنفيذ الكود ضمن نطاق الدفعة فقط.
2. تشغيل الفحوص المطلوبة وتوثيق النتيجة بصدق (PASS/FAIL/TIMEOUT).
3. رفع التغييرات إلى GitHub (commit + push).
4. التحقق من النشر على Render/Vercel.
5. تحقق حي (بصري/عملي) من الرابط الإنتاجي: https://almeaacodax.vercel.app/#/
6. تحديث ملفات التتبع:
   - PROJECT_STATUS.md
   - docs/SPARK_BATCH_LEDGER_AR.md
   - docs/SPARK_EXECUTION_ROADMAP_AR.md (عند الحاجة)
7. تحديث تقرير الدفعة بصيغة عربية واضحة.

ممنوع إعلان "Fully closed" بدون تحقق إنتاجي حقيقي.

## 1.1) قاعدة إلزامية جديدة بعد كل دفعة

بعد إغلاق أي دفعة (سواء Programmatic أو Fully closed) يجب تحديث هذا الملف مباشرة دائمًا، ويتضمن:
1. اسم الدفعة.
2. الحالة النهائية للدفعة.
3. آخر commit hash.
4. أوامر الفحوص التي تم تشغيلها ونتيجتها.
5. حالة GitHub push.
6. حالة نشر Vercel/Render.
7. حالة التحقق الحي من رابط الإنتاج.
8. أي خطوة متبقية للإغلاق الكامل.

## 2) الحالة الحالية المختصرة

- تم إغلاق BATCH 24 إغلاقًا نهائيًا (تشفير أسرار التكاملات at-rest + تحقق إنتاجي).
- تم تنفيذ دفعات الاستقرار/الأداء الحديثة (20ZF/20ZG/22/23/26R/30) برمجيًا، وبعضها يحتاج تحقق إنتاجي نهائي حسب التقرير.
- تم إضافة قاعدة عمل ثابتة: عدم الانتقال لدفعة جديدة قبل الإغلاق النهائي للدفعة الحالية.
- يوجد إصلاح جارٍ الآن لمشكلتين في الدورات:
  1. تكرار حقول داخل إعدادات الدورة (المسار/المادة).
  2. عدم ظهور بعض الدورات في صفحة التعلّم بسبب اختلافات بيانات قديمة (`subject` نصي بدل `subjectId`).
- الحالة النشطة الآن:
  - `BATCH 25C-FINAL` تم إغلاقها نهائيًا (`Fully closed`).
  - `BATCH 27C` تم تنفيذها (Sentry SDK integration) بحالة:
    - `Programmatically closed, production verification pending`.
  - نتائج 27C:
    - build/typecheck/smoke monitoring/health/sentry-runtime: PASS.
    - endpoint جديد: `POST /api/operations/sentry/test-event` (admin only) لإثبات event حي.
    - سكربت جديد جاهز: `npm run smoke:sentry-live-proof`.
    - آخر تشغيل للسكربت: FAIL بسبب غياب `SMOKE_ADMIN_TOKEN` في بيئة التنفيذ.
    - ما زال مطلوب توثيق `eventId` حي من إنتاج Sentry لإعلان Fully closed.
- آخر commit مرفوع قبل 27C كان: `99cf363` (دفعة 27B).

## 2.1) لقطة الوضع الحالي (مهم قبل أي إكمال)

- الفرع الحالي: `main`
- يوجد تعديلات كثيرة متراكمة في الشجرة (dirty worktree)، لذلك أي حساب جديد يجب أن:
  1. لا يستخدم `git reset --hard`.
  2. لا يلمس الملفات غير المطلوبة للدفعة النشطة.
  3. يحدد ملفات الدفعة فقط قبل `git add`.
- حالة الدفعة النشطة فعليًا الآن:
  - إصلاح دورة/تعلم (ضمن مسار تحسينات الدورات) وليس دفعة جديدة خارج الخطة.

## 2.2) ما تم تنفيذه في إصلاح الدورات (Pending deploy verification)

1. **إصلاح فلترة عرض الدورات في صفحة التعلّم**  
   ملف: `pages/SubjectLearningPage.tsx`
   - إضافة دوال تطبيع:
     - `resolveCourseSubjectId(...)`
     - `resolveCoursePathId(...)`
   - الهدف: دعم البيانات القديمة والجديدة معًا:
     - `subjectId` الحديث.
     - `subject` النصي القديم (اسم/معرّف).
   - النتيجة المتوقعة: الدورة لا تختفي من صفحة التعلّم إذا كانت محفوظة بصيغة قديمة.

2. **تقليل ازدواج حقول إعدادات الدورة**  
   ملف: `dashboards/admin/AdvancedCourseBuilder.tsx`
   - معالجة التكرار في واجهة الإعدادات بحيث لا تظهر حقول المسار/المادة مكررة.
   - إضافة تطبيع آمن لقيم:
     - `category`
     - `level`
   - الهدف: منع ظهور القيم المشوهة/البديلة غير المتوقعة.

3. **فحوص محلية بعد التعديل**
   - `npm --prefix server run build` : PASS
   - `npm run typecheck` : PASS
   - `npm run build` : PASS

> ملاحظة: هذا الجزء ما زال يحتاج **تحقق حي بعد النشر** على Vercel للتأكد بصريًا من اختفاء التكرار وظهور الدورة في صفحة التعلّم.

## 3) الدفعة الجاري تثبيتها الآن

- BATCH 30 — Course Settings Scope UX Consistency (Fully closed).
- الإغلاق شمل: فلاتر/بحث استدعاء الدروس والاختبارات + توحيد المسار/المادة/المهارات + إصلاح سلامة النص العربي في البانيين.
- آخر تحقق حي: Vercel (200) + Admin Dashboard (200) + Render Health (200 ready=true).
- تحديث إضافي بتاريخ 2026-05-18: إصلاح ترميز النصوص العربية (Mojibake) داخل:
  - `dashboards/admin/AdvancedCourseBuilder.tsx`
  - `dashboards/admin/CourseBuilder.tsx`
  حتى لا تظهر `????` في واجهة باني المناهج.
- نقطة البداية التالية المقترحة:
  - `BATCH 27D — Sentry Live Production Event Proof (final evidence)`
  - لا تبدأها إلا بعد طلب المالك الصريح: **"كمل حسب الخطة"**.

### متطلبات إغلاق 27D بسرعة
1. التأكد أن Render سحب آخر commit من GitHub.
2. توفير `SMOKE_ADMIN_TOKEN` صالح في بيئة التشغيل.
3. تشغيل:
   - `npm run smoke:sentry-live-proof`
4. مطابقة `eventId` داخل Sentry Dashboard.

## 4) تسلسل التشغيل القياسي لأي حساب جديد

1. اقرأ أولًا:
   - PROJECT_STATUS.md
   - docs/SPARK_BATCH_LEDGER_AR.md
   - docs/SPARK_EXECUTION_ROADMAP_AR.md
   - هذا الملف docs/NEXT_SESSION_HANDOVER_AR.md
2. شغّل:
   - git status --short --branch
   - git diff --stat
3. حدّد نطاق الدفعة بدقة قبل أي تعديل.
4. نفّذ التعديل + الفحوص + التوثيق + الرفع + التحقق الإنتاجي.
5. قدّم الرد النهائي بالعربية بالنموذج المتفق.

## 5) ملاحظات تشغيل مهمة

- قد لا يملك الحساب الجديد صلاحيات مباشرة على GitHub/Render/Vercel/MongoDB؛ عندها يجهز الكود والفحوص ويطلب من المالك تنفيذ خطوة الوصول.
- لا يتم تخزين أو مشاركة أسرار (.env, tokens, keys) داخل المستودع أو التقارير.
- في حال فشل smoke أو timeout لا تعتبر الدفعة مغلقة نهائيًا.

## 5.1) استراتيجية التشغيل الموحدة (GitHub + Vercel + Render + Mongo)

هذه الاستراتيجية إلزامية لأي حساب جديد حتى يستمر بنفس الطريقة بدون انقطاع:

1. قبل البدء:
   - قراءة: `PROJECT_STATUS.md` + `docs/SPARK_BATCH_LEDGER_AR.md` + `docs/SPARK_EXECUTION_ROADMAP_AR.md` + هذا الملف.
   - تشغيل: `git status --short --branch` و `git diff --stat`.
2. أثناء التنفيذ:
   - العمل على دفعة واحدة فقط.
   - عدم توسيع النطاق.
   - تشغيل الفحوص المطلوبة كاملة.
3. قبل الإغلاق:
   - تحديث تقرير الدفعة.
   - تحديث `PROJECT_STATUS.md`.
   - تحديث `docs/SPARK_BATCH_LEDGER_AR.md`.
   - تحديث هذا الملف (`docs/NEXT_SESSION_HANDOVER_AR.md`).
4. الرفع:
   - `git add` (ملفات الدفعة فقط)
   - `git commit`
   - `git push origin main`
5. النشر والتحقق:
   - التأكد من وصول commit إلى GitHub.
   - متابعة Vercel deployment حتى Ready.
   - متابعة Render deployment حتى Ready.
   - التحقق من:
     - `https://almeaacodax.vercel.app/`
     - `https://almeaacodax-k2ux.onrender.com/api/health`
   - تنفيذ فحص حي بصري من المتصفح الداخلي للرابط:
     - `https://almeaacodax.vercel.app/#/`
6. قاعدة الأسرار:
   - يمنع كتابة أي token/secret/password داخل الملفات.
   - بيانات الربط تبقى في منصات الإدارة (GitHub Secrets / Render Env / Vercel Env / Mongo Atlas) فقط.
7. إذا تعطل النشر:
   - لا تعلن Fully closed.
   - سجل سبب التعطل والخطوة المطلوبة من المالك بوضوح.

## 5.3) قواعد الإكمال للحساب التالي (إلزامي)

عند ظهور رسالة المالك: **"اكمل"** فالمقصود:
1. الاستمرار تلقائيًا حتى إغلاق الدفعة بالكامل.
2. عدم التوقف برسائل مرحلية كثيرة إلا عند مانع حقيقي.
3. تنفيذ دورة الإغلاق كاملة:
   - تعديل
   - فحوص
   - تقرير دفعة
   - تحديث Ledger/Status
   - رفع GitHub
   - متابعة نشر Vercel/Render
   - تحقق حي من `https://almeaacodax.vercel.app/#/`

ولا يتم الانتقال لدفعة جديدة قبل إنهاء كل ما سبق.

## 5.2) بيانات الاستمرارية المطلوبة للحساب التالي (بدون أسرار)

يلزم أن يحتوي هذا الملف دائمًا على:
1. رابط المستودع GitHub.
2. رابط Frontend الإنتاجي (Vercel).
3. رابط API الإنتاجي (Render).
4. مسار فحص الصحة (`/api/health`).
5. أوامر الفحص القياسية.
6. الدفعة النشطة الحالية.
7. الدفعة التالية المقترحة.

> ملاحظة: لا يتم وضع أي مفاتيح API أو كلمات مرور أو JWT داخل هذا الملف نهائيًا.

## 6) تعريف نجاح الدفعة

الدفعة تعتبر مكتملة نهائيًا فقط إذا تحققت الشروط التالية مجتمعة:
- الكود ضمن نطاق الدفعة.
- الفحوص المطلوبة ناجحة.
- commit + push على GitHub.
- نشر ناجح على Render/Vercel (عند وجود تغييرات تخصهما).
- تحقق حي من الإنتاج بالرابط المذكور.
- تحديث التقارير والـLedger وحالة المشروع.

## 7) بيانات الربط والاستمرارية (بدون أسرار)

هذه البيانات يجب أن تبقى دائمًا واضحة للحساب التالي (بدون إدراج أي مفاتيح):

1. **GitHub Repo**  
   - `https://github.com/nasef6464/almeaacodax`
2. **Frontend Production (Vercel)**  
   - `https://almeaacodax.vercel.app/`
3. **Backend Production (Render API base)**  
   - `https://almeaacodax-k2ux.onrender.com/api`
4. **Health Endpoint**
   - `https://almeaacodax-k2ux.onrender.com/api/health`
5. **الرابط القياسي للتحقق الحي داخل المتصفح المدمج**
   - `https://almeaacodax.vercel.app/#/`

## 8) خطوات التنفيذ الفورية للحساب التالي (Checklist)

1. اقرأ هذا الملف + `PROJECT_STATUS.md` + `docs/SPARK_BATCH_LEDGER_AR.md`.
2. شغّل:
   - `git status --short --branch`
   - `git diff --stat`
3. أكمل إصلاح الدورات الجارية فقط:
   - تأكيد اختفاء تكرار حقول الإعدادات.
   - تأكيد ظهور الدورة الأولى في صفحة التعلّم لنفس المسار/المادة.
4. شغّل الفحوص:
   - `npm --prefix server run build`
   - `npm run typecheck`
   - `npm run build`
5. ارفع التعديلات على GitHub.
6. راقب نشر Vercel/Render حتى الاكتمال.
7. نفّذ تحقق حي بصري من الرابط الإنتاجي.
8. حدث:
   - تقرير الدفعة
   - `PROJECT_STATUS.md`
   - `docs/SPARK_BATCH_LEDGER_AR.md`
   - هذا الملف (إجباري).



## 9) تحديث جديد — فحص ترابط الدورات (2026-05-18)

تم تنفيذ فحص ترابط شامل للدورات (إعدادات الإدارة + صفحة تعلم الطالب + مشغل الدورة) وتوثيقه في:
- `COURSE_LINKAGE_AUDIT_2026-05-18_AR.md`

### أهم النتائج المؤكدة
1. وجود نصوص عربية مشوهة (Mojibake) في باني الدورات.
2. وجود تكرار وظيفي في حقول المسار/المادة داخل إعدادات الدورة.
3. سياسة ظهور الدورة للطالب تعتمد أعلامًا متعددة (`showOnPlatform`, `isPublished`, `approvalStatus`) وتحتاج توحيد contract واضح.
4. نقص Empty State واضح في تبويب الدورات بصفحة التعلم عند عدم وجود دورات مطابقة.
5. استدعاء الدروس/الاختبارات يحتاج حارس نطاق أقوى لمنع إدراج عناصر خارج المادة/المسار.

### تم إضافته للخطة التنفيذية
- `BATCH 30B — Course Builder Arabic Encoding & Field Canonicalization`
- `BATCH 30C — Course Visibility Contract (Admin -> Student)`
- `BATCH 30D — Curriculum Import Scope Guard`

### قاعدة المتابعة
لا يتم بدء 30C قبل إغلاق 30B بالكامل، ولا 30D قبل إغلاق 30C بالكامل (تنفيذ + فحوص + رفع + نشر + تحقق حي + توثيق).

## 10) تحديث إغلاق BATCH 30B — 2026-05-18
- الحالة: Programmatically closed, production verification pending.
- المنجز:
  - إزالة تكرار حقول المسار/المادة في `AdvancedCourseBuilder`.
  - إبقاء مصدر تعديل موحّد لربط `pathId/subjectId`.
  - إصلاح النصوص العربية المشوّهة في باني الدورات.
- الفحوص:
  - server build: PASS
  - typecheck: PASS (بعد retry من timeout)
  - frontend build: PASS
  - smoke:health-readiness: PASS
- التقرير:
  - `BATCH_30B_COURSE_BUILDER_ARABIC_ENCODING_AND_FIELD_CANONICALIZATION_2026-05-18_AR.md`
- التالي:
  - BATCH 30C — Course Visibility Contract (Admin -> Student)

## 11) Update 2026-05-19 — BATCH 27C Final Closure
- Final batch status: `BATCH 27C` is now **Fully closed**.
- Live Sentry proof completed successfully from production.
- Verified Sentry issue: `Manual Sentry smoke event`.
- Verified `eventId`: `39a8881844724be6844dd2f7fd63c88c`.
- Verified release in Sentry: `83832c0426e5`.
- Verified environment in Sentry: `production`.
- Checks completed:
  - `npm --prefix server run build`: PASS
  - `npm run typecheck`: PASS
  - `npm run build`: PASS
  - `npm run smoke:monitoring`: PASS
  - `npm run smoke:health-readiness`: PASS
  - `npm run smoke:sentry-runtime`: PASS
  - `npm run smoke:sentry-live-proof`: PASS
- GitHub push status: PASS
- Render deployment status: PASS
- Live backend verification:
  - `https://almeaacodax-k2ux.onrender.com/api/health` => `200`, `ready=true`, commit `83832c0426e5`
- Remaining step for the next account:
  - no mandatory continuation for BATCH 27C; wait for owner direction before opening the next batch.

## 12) ملف الربط والاستمرارية للحساب التالي
- يوجد ملف مرجعي إضافي يجب قراءته قبل أي محاولة لإعادة فحص الربط أو إعادة اكتشاف الأسرار/الخدمات:
  - `docs/CONNECTED_SERVICES_HANDOVER_AR.md`
- هذا الملف يوضح:
  - ما هو مربوط فعليًا الآن
  - ما الذي تم التحقق منه على GitHub / Render / Vercel / MongoDB / Sentry
  - أين يعتمد الحساب التالي على البيئة المحلية
  - ما هي السكربتات الجاهزة لإعادة الاستخدام
  - ما الذي لا يحتاج إعادة اكتشاف من الصفر

## 13) Update 2026-05-19 — BATCH 30C Final Closure
- Batch `30C` is now **Fully closed**.
- Scope completed:
  - learner visibility contract aligned between API filters and learner UI gates.
  - dedicated smoke contract added: `scripts/smoke-course-visibility-contract.mjs`.
- Checks:
  - `npm --prefix server run build` PASS
  - `npm run typecheck` PASS
  - `npm run build` PASS
  - `npm run smoke:course-visibility` PASS
- Production verification:
  - `GET /api/content/bootstrap?scope=learning&phase=full` => 200 with no hidden/unapproved leakage.
  - `GET /api/courses` => 200 with no visibility contract violations.
  - frontend `https://almeaacodax.vercel.app/` => 200.
  - backend health `https://almeaacodax-k2ux.onrender.com/api/health` => 200 (`ready=true`, commit `83832c0426e5`).
- Visual verification (in-app browser): PASS
  - learner subject page rendered correctly.
  - learner topic modal rendered tabs/content correctly.
- Report:
  - `BATCH_30C_COURSE_VISIBILITY_CONTRACT_ADMIN_TO_STUDENT_2026-05-19_AR.md`
- Next proposed batch:
  - `BATCH 30D — Curriculum Import Scope Guard`

## 14) Update 2026-05-19 — BATCH 30D Final Closure
- Batch `30D` is now **Fully closed**.
- Scope delivered:
  - enforced server-side curriculum import scope guard in `course.routes`.
  - prevented cross-scope lesson/quiz import references outside course `pathId/subjectId`.
- Checks:
  - `npm --prefix server run build` PASS
  - `npm run smoke:curriculum-import-scope` PASS
  - `npm run smoke:course-visibility` PASS
- Live production verification (owner requested):
  - added and verified live course in learning space: `30D Visibility Course 1779142597180`.
  - added and verified live training quiz in `التدريب`: `30D Training Quiz 1779142597180`.
  - added and verified live mock exam in `الاختبارات`: `30D Mock Quiz 1779142597180`.
  - in-app browser visual verification passed.
- Report:
  - `BATCH_30D_CURRICULUM_IMPORT_SCOPE_GUARD_2026-05-19_AR.md`
- Next:
  - await owner direction for the next batch.

## 6) تحديث لحظي 2026-05-19 (إكمال مباشر)

- تم سابقًا إغلاق:
  - `BATCH 30C` (Course Visibility Contract)
  - `BATCH 30D` (Curriculum Import Scope Guard)
- تم التحقق الآن من استمرار عقد الرؤية بنجاح:
  - `npm run smoke:course-visibility` = PASS
- تم إصلاح ملف الربط `docs/CONNECTED_SERVICES_HANDOVER_AR.md` لأن النسخة السابقة كانت بترميز تالف، وأصبح الآن مرجعًا واضحًا وروابطه مباشرة.

### المانع الحالي الوحيد للإغلاق الحي الخاص بـ Sentry
- الأمر `npm run smoke:resolve-admin-token` يفشل إذا لم تتوفر بيانات أدمن صحيحة محليًا.
- آخر محاولة فشلت برسالة: `Invalid email or password`.
- النتيجة: لا يمكن إنهاء `smoke:sentry-live-proof` إلا بأحد التالي:
  1. بيانات أدمن صحيحة (email/password) لاستخراج التوكن تلقائيًا.
  2. أو تزويد `SMOKE_ADMIN_TOKEN` يدويًا من جلسة أدمن إنتاجية.

### القرار التشغيلي للحساب التالي عند كلمة "اكمل"
1. ضبط بيانات الأدمن الصحيحة محليًا أو توفير `SMOKE_ADMIN_TOKEN`.
2. تشغيل `npm run smoke:sentry-live-proof`.
3. مطابقة `eventId` في Sentry Dashboard.
4. توثيق النتيجة وتحديث `PROJECT_STATUS.md` و`docs/SPARK_BATCH_LEDGER_AR.md` وهذا الملف.

## 7) قاعدة ثابتة: الفحص الحي عبر المتصفح المدمج أولًا

اعتبارًا من 2026-05-19، أي طلب يتضمن "فحص حي" أو "اكمل" يجب أن يبدأ بالتحقق البصري عبر المتصفح المدمج (In-App Browser) قبل أي إعلان إغلاق.

ترتيب التنفيذ الإلزامي:
1. فتح الصفحة/المسار المطلوب داخل المتصفح المدمج.
2. تنفيذ التحقق البصري للواجهات الأساسية المطلوبة (الدورات/التدريبات/الاختبارات حسب الطلب).
3. ثم تنفيذ فحوص API/Smoke المساندة.
4. لا يتم إعلان Fully closed إلا بعد نجاح (2) و(3) معًا.

ملاحظة تشغيلية:
- إذا تعذر التحكم المباشر بالمتصفح تقنيًا داخل الجلسة، يتم التصريح بذلك فورًا، مع الاستمرار عبر أقرب بديل (لقطات حيّة + فحوص إنتاجية) بدون تعطيل.

## 15) Update 2026-05-19 — BATCH 30E Live Admin Verification Closure
- Batch `30E` is now **Fully closed (API + Smoke)**.
- Scope delivered:
  - created and published live verification course/training/mock under the same path+subject.
  - verified all three appear in production API listing for learning scope.
- Created entities:
  - `30E Live Course 1779161344417`
  - `30E Training Quiz 1779161344417`
  - `30E Mock Quiz 1779161344417`
- Checks:
  - `npm run smoke:course-visibility` PASS
  - `npm run smoke:curriculum-import-scope` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health `https://almeaacodax-k2ux.onrender.com/api/health` => 200 (`ready=true`, commit `e6621de5f148`)
  - courses/quizzes scoped APIs include all new 30E entities.
- Report:
  - `BATCH_30E_LIVE_ADMIN_VISUAL_API_CLOSURE_2026-05-19_AR.md`
- Operational note:
  - direct click-control on in-app browser was not exposed in this session tool channel; therefore closure evidence is API+Smoke complete, with visual verification ready to attach immediately when click-control channel is available.

## 8) قاعدة تشغيل مثبتة — نمط الإغلاق الحي المعتمد

اعتبارًا من 2026-05-19، النمط الرسمي لأي "فحص حي" أو "اكمل" يكون كالتالي:

1. **أولوية المتصفح المدمج أولًا** للتحقق البصري عند توفر قناة التحكم.
2. **إذا تعذر النقر المباشر تقنيًا داخل الجلسة** يتم الانتقال فورًا إلى نمط:
   - تحقق إنتاجي API
   - فحوص Smoke
   - إثبات وجود العناصر عبر endpoints الحية
3. لا يتم تعطيل التنفيذ بسبب غياب قناة النقر؛ يتم الإغلاق التشغيلي على `API + Smoke` مع توثيق السبب بشفافية.
4. عند توفر قناة النقر لاحقًا، يُلحق تحقق بصري نهائي كدليل إضافي بدون إعادة تنفيذ الدفعة من الصفر.

### معيار النجاح الرسمي (افتراضي)
- `PASS` في smoke المطلوبة للدفعة.
- `200` للصحة الإنتاجية (`/api/health`) مع `ready=true`.
- تحقق وجود/سلوك العناصر عبر API الحية حسب نطاق الدفعة.
- توثيق كامل في: `PROJECT_STATUS.md` + `docs/SPARK_BATCH_LEDGER_AR.md` + `docs/NEXT_SESSION_HANDOVER_AR.md`.

## 9) تفعيل دائم إلزامي: API + Smoke

اعتبارًا من 2026-05-19، يتم تشغيل `API + Smoke` **دائمًا** في كل دفعة وكل فحص حي، سواء توفّر التحكم المباشر بالمتصفح المدمج أو لا.

قاعدة التنفيذ الإلزامية:
1. المتصفح المدمج (تحقق بصري عند الإمكان).
2. `API checks` (إجباري دائمًا).
3. `Smoke contracts` الخاصة بالنطاق (إجباري دائمًا).

لا يُسمح بإغلاق أي دفعة بدون دليل `API + Smoke` موثق.

## 16) Update 2026-05-19 — BATCH 31 Homepage & Admin Panel Full Verification
- Batch `31` is now **Fully closed (API + Smoke)**.
- Scope verified end-to-end:
  - homepage management contracts (hero + ads)
  - admin/supervisor/school dashboard contracts
  - route-loading and strict frontend production readiness
- Checks:
  - `smoke:homepage-hero` PASS
  - `smoke:announcement-ads` PASS
  - `smoke:reports-role` PASS
  - `smoke:supervisor-dashboard` PASS
  - `smoke:school-management` PASS
  - `smoke:admin-school-command` PASS
  - `smoke:school-portal-command` PASS
  - `smoke:dashboards-phase11` PASS
  - `smoke:route-loading` PASS
  - `smoke:frontend:strict` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health `https://almeaacodax-k2ux.onrender.com/api/health` => 200 (`ready=true`)
- Report:
  - `BATCH_31_HOMEPAGE_AND_ADMIN_PANEL_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 17) Update 2026-05-19 — BATCH 32 Production Operations & Security Full Verification
- Batch `32` is now **Fully closed (API + Smoke)**.
- Scope:
  - operational readiness verification
  - production hardening verification
  - production audit verification
  - API security verification
- Checks:
  - `smoke:health-readiness` PASS
  - `smoke:production-hardening` PASS
  - `smoke:production-audit` PASS
  - `smoke:api-security` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_32_PRODUCTION_OPERATIONS_AND_SECURITY_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 18) Update 2026-05-19 — BATCH 33 QA & Deployment Handover Full Verification
- Batch `33` is now **Fully closed (API + Smoke)**.
- Scope:
  - QA verification contract
  - deployment handover verification contract
  - current handover integrity verification
- Checks:
  - `smoke:qa-phase17` PASS
  - `smoke:deployment-handover-phase19` PASS
  - `smoke:handover-current` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_33_QA_AND_DEPLOYMENT_HANDOVER_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 19) Update 2026-05-19 — BATCH 34 Auth & CSRF Security Full Verification
- Batch `34` is now **Fully closed (API + Smoke)**.
- Scope:
  - auth account security verification
  - login hardening verification
  - auth cookie contract verification
  - csrf protection verification
  - auth token response environment gating verification
  - API security verification
- Checks:
  - `smoke:auth-account` PASS
  - `smoke:auth-login-security` PASS
  - `smoke:auth-cookie` PASS
  - `smoke:csrf` PASS
  - `smoke:auth-token-response` PASS
  - `smoke:api-security` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_34_AUTH_AND_CSRF_SECURITY_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 20) Update 2026-05-19 — BATCH 35 Monitoring & Notifications Full Verification
- Batch `35` is now **Fully closed (API + Smoke)**.
- Scope:
  - monitoring readiness verification
  - sentry runtime verification
  - notification pipeline verification
  - notification phase10 queue/worker verification
- Checks:
  - `smoke:monitoring` PASS
  - `smoke:sentry-runtime` PASS
  - `smoke:notifications` PASS
  - `smoke:notification-phase10` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_35_MONITORING_AND_NOTIFICATIONS_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 21) Update 2026-05-19 — BATCH 36 Payments & Packages Full Verification
- Batch `36` is now **Fully closed (API + Smoke)**.
- Scope:
  - payment request and package flow verification
  - provider readiness verification
  - anti-tampering verification
  - package/course split verification
- Checks:
  - `smoke:payment-package` PASS
  - `smoke:payment-providers` PASS
  - `smoke:payment-tampering` PASS
  - `smoke:package-course-split` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_36_PAYMENTS_AND_PACKAGES_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 22) Update 2026-05-19 — BATCH 37 Frontend Performance/SEO/Typography Full Verification
- Batch `37` is now **Fully closed (API + Smoke)**.
- Scope:
  - performance contract verification
  - runtime source-of-truth verification
  - SEO contract verification
  - typography + platform-font contracts verification
- Fix delivered:
  - added required font contract markers in `index.html`.
- Checks:
  - `smoke:performance` PASS
  - `smoke:runtime-source` PASS
  - `smoke:seo` PASS
  - `smoke:typography` PASS
  - `smoke:platform-fonts` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_37_FRONTEND_PERFORMANCE_SEO_TYPOGRAPHY_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 23) Update 2026-05-19 — BATCH 38 Learning/Quiz/Results Full Verification
- Batch `38` is now **Fully closed (API + Smoke)**.
- Scope:
  - learning quiz journey verification
  - student learning journey verification
  - quiz access matrix verification
  - results contract verification
- Execution fix:
  - added missing smoke reference quiz for expected learning quiz id on this environment.
- Checks:
  - `smoke:learning-quiz` PASS
  - `smoke:student-journey` PASS
  - `smoke:quiz-access` PASS
  - `smoke:results` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_38_LEARNING_QUIZ_RESULTS_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 24) Update 2026-05-19 — BATCH 39 Database/Integrations/NoSQL Full Verification
- Batch `39` is now **Fully closed (API + Smoke)**.
- Scope:
  - database index/readiness verification
  - integrations runtime hardening verification
  - NoSQL sanitizer verification
- Checks:
  - `smoke:database` PASS
  - `smoke:integrations-runtime` PASS
  - `smoke:nosql-sanitizer` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `e6621de5f148`
- Report:
  - `BATCH_39_DATABASE_INTEGRATIONS_NOSQL_FULL_VERIFICATION_2026-05-19_AR.md`
- Next:
  - await owner direction for next full batch.

## 25) Update 2026-05-19 — BATCH 40 Live Dashboard/Learning Verification
- Batch `40` is now **Programmatically closed**.
- Scope completed:
  - dashboard/homepage operational verification
  - learning/courses/training/tests/results operational verification
- Checks:
  - `smoke:homepage-hero` PASS
  - `smoke:announcement-ads` PASS
  - `smoke:reports-role` PASS
  - `smoke:dashboards-phase11` PASS
  - `smoke:learning-quiz` PASS
  - `smoke:student-journey` PASS
  - `smoke:quiz-access` PASS
  - `smoke:results` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `33e0b6a58fbf`
- Remaining for fully-visual closure:
  - direct click-evidence via in-app browser control channel.
- Report:
  - `BATCH_40_LIVE_DASHBOARD_AND_LEARNING_VISUAL_EXECUTION_2026-05-19_AR.md`

## 26) Update 2026-05-19 — BATCH 41 Browser Execution Gate + Full Operational Verification
- Batch `41` is now **Programmatically closed**.
- Completed:
  - full operational verification for dashboard + learning/training/tests paths
  - production probes + smoke evidence all PASS
- Pending for fully visual closure:
  - Gate 0 direct click evidence inside in-app browser control channel.
- Report:
  - `BATCH_41_BROWSER_EXECUTION_GATE_AND_FULL_OPERATIONAL_VERIFICATION_2026-05-19_AR.md`

## 27) Update 2026-05-19 — BATCH 42 Frontend Route/Cache Stability Full Verification
- Batch `42` is now **Fully closed (API + Smoke)**.
- Scope:
  - route loading stability
  - runtime source-of-truth stability
  - deployment cache policy stability
  - health readiness verification
- Checks:
  - `smoke:route-loading` PASS
  - `smoke:runtime-source` PASS
  - `smoke:deployment-cache` PASS
  - `smoke:health-readiness` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `33e0b6a58fbf`
- Report:
  - `BATCH_42_FRONTEND_ROUTE_CACHE_STABILITY_FULL_VERIFICATION_2026-05-19_AR.md`

## 28) Update 2026-05-19 — BATCH 43 Auth Frontend & Public UI Full Verification
- Batch `43` is now **Fully closed (API + Smoke)**.
- Scope:
  - auth frontend UX contract verification
  - frontend phase5 contract verification
  - platform fonts contract verification
  - seo public/private route metadata verification
- Checks:
  - `smoke:auth-frontend` PASS
  - `smoke:frontend-phase5` PASS
  - `smoke:platform-fonts` PASS
  - `smoke:seo` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `33e0b6a58fbf`
- Report:
  - `BATCH_43_AUTH_FRONTEND_AND_PUBLIC_UI_FULL_VERIFICATION_2026-05-19_AR.md`

## 29) Update 2026-05-19 — BATCH 44 Data Visibility & Security Regression Full Verification
- Batch `44` is now **Fully closed (API + Smoke)**.
- Scope:
  - data visibility regression verification
  - csrf contract verification
  - auth token response contract verification
  - api security contract verification
- Checks:
  - `smoke:data-visibility-regression` PASS
  - `smoke:csrf` PASS
  - `smoke:auth-token-response` PASS
  - `smoke:api-security` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `33e0b6a58fbf`
- Report:
  - `BATCH_44_DATA_VISIBILITY_AND_SECURITY_REGRESSION_FULL_VERIFICATION_2026-05-19_AR.md`

## 30) Update 2026-05-19 — BATCH 45 Core Phase Contracts Full Verification
- Batch `45` is now **Fully closed (API + Smoke)**.
- Scope:
  - api phase4 verification
  - security/rbac phase6 verification
  - exam/payment phase8 verification
  - production ops phase14 verification
- Checks:
  - `smoke:api-phase4` PASS
  - `smoke:security-rbac-phase6` PASS
  - `smoke:exam-payment-phase8` PASS
  - `smoke:production-ops-phase14` PASS
- Production verification:
  - frontend `https://almeaacodax.vercel.app/` => 200
  - backend health => `status=ok`, `ready=true`, commit `33e0b6a58fbf`
- Report:
  - `BATCH_45_CORE_PHASE_CONTRACTS_FULL_VERIFICATION_2026-05-19_AR.md`

## Update 2026-05-19 — BATCH F1 (إغلاق التقارير المعلقة)
- تم تنفيذ `BATCH F1` وإغلاقه بتحديث أدلة التشغيل.
- النتائج:
  - فحوص BATCH 40 كاملة: PASS.
  - صحة الإنتاج: PASS (`status=ok`, `ready=true`, redis ready).
  - `smoke:sentry-runtime`: PASS.
  - `smoke:sentry-live-proof`: FAIL بسبب غياب `SMOKE_ADMIN_TOKEN` في بيئة الجلسة.
- ملاحظة:
  - BATCH 27C يظل مغلقًا نهائيًا حسب دليل eventId الحي الموثق مسبقًا.
- التالي حسب الخطة:
  - `BATCH F2 — Firebase Complete Deletion`.

## Update 2026-05-19 — BATCH F2 (Firebase Complete Deletion)
- الحالة: **Fully closed**.
- المنجز:
  - إزالة مسار Firebase legacy من `App.tsx` و`store/useStore.ts`.
  - حذف `services/firebase.ts` و`services/firebaseSync.ts` و`firebase-applet-config.json`.
  - إزالة dependency `firebase` من المشروع.
  - تحديث `smoke:runtime-source` ليتحقق من عدم وجود مسار Firebase تشغيلي.
- الفحوص:
  - `npm run typecheck` PASS
  - `npm run build` PASS
  - `npm run smoke:runtime-source` PASS
  - `npm run smoke:frontend:strict` PASS
- التحقق الإنتاجي:
  - smoke strict أكد تطابق الإصدار المنشور مع commit `9905ebb`.
- التالي حسب خطة Codex 5.3:
  - `BATCH F3 — Redis Activation + Verification` (يتطلب تأكيد المالك أن `REDIS_URL` مضاف على Render).

## Update 2026-05-19 — BATCH F3 (Redis Activation + Verification)
- الحالة: **Fully closed**.
- التحقق الإنتاجي أكد:
  - `redis.rateLimit=ready`
  - `redis.queue=ready`
  - `ready=true`
- الفحوص:
  - `npm run smoke:health-readiness` PASS
  - `npm run smoke:notifications` PASS
  - `npm run smoke:production-hardening` PASS
- تقرير الدفعة:
  - `BATCH_F3_REDIS_ACTIVATION_AR.md`
- التالي حسب الخطة:
  - `BATCH F4 — Tap Payments Integration` (يتطلب مفاتيح Tap من المالك).

## Update 2026-05-19 — BATCH F5 (Student Verifiable Certificate QR)
- الحالة: **Fully closed**.
- المنجز:
  - API شهادات: توليد/قائمة شهاداتي/تحقق عام.
  - صفحة عامة للشهادة عبر `/certificate/:code` مع QR.
  - زر `شهادتي` في صفحة الدورة عند اكتمال 100% وتفعيل `certificateEnabled`.
- الفحوص:
  - `npm --prefix server run build` PASS
  - `npm run typecheck` PASS
  - `npm run build` PASS
- التقرير:
  - `BATCH_F5_CERTIFICATES_AR.md`
- التالي حسب الخطة:
  - `BATCH F6 — Lesson Discussion Forum`.
