# تسليم العمل للوكيل أو الحساب التالي

آخر تحديث: 2026-05-08

آخر إنجاز: إصلاح حارس السيرفر للباقات المدفوعة بحيث يعتمد التدريب على باقة `banks` والاختبار على باقة `tests`، مع تدعيم سابق لـ `smoke:reports-role` حتى يحرس التقارير العلاجية للطالب وولي الأمر والأدوار الإدارية.

هذا الملف هو نقطة البداية لأي حساب أو وكيل جديد يعمل على المشروع. الهدف منه منع التكرار أو التخريب، واستكمال نفس النهج الذي كان متبعًا: تطوير صغير، فحص واضح، ثم توثيق ورفع.

## قاعدة العمل

- ابدأ دائمًا من ملفات الريبو الحالية، وليس من صور أو مرفقات قديمة.
- لا تعد فتح أجزاء أُغلقت بحارس smoke إلا إذا فشل فحصها أو ظهر خلل مباشر في التجربة.
- حافظ على بساطة واجهة الطالب وولي الأمر، واجعل التفاصيل والتحكم الكثيف داخل الإدارة.
- في الباقات: قرار المفتوح/المجاني/المدفوع يكون من مكان العرض داخل إدارة مساحة التعلم للتأسيس والتدريبات والاختبارات والمكتبة. نفس الاختبار أو التدريب قد يكون مدفوعًا هنا ومفتوحًا داخل دورة أو سياق آخر، فلا توحد القفل على العنصر عالميًا دون قصد واضح.
- ملفات الدعم في التأسيس تربط مباشرة بالموضوع أو الموضوع الفرعي عبر `libraryItemIds`، مثل `lessonIds` و`quizIds`. لا ترجع لعرض ملفات المكتبة تلقائيًا حسب المهارة إلا كاقتراح إداري واضح.
- الدورات تحتاج دفعة مستقلة: ربط منشئ الدورة ببنك الدروس والمسارات والمواد والمهارات الحقيقية، وإضافة معلمين/مدربين ونسبة ربحهم.
- لا ترجع أي تغييرات موجودة في Git قبل فهمها؛ اعتبرها عملًا قيد التنفيذ.
- قبل أي رفع: شغل فحوص الجزء المستهدف، ثم `npm run build` و`npm --prefix server run build`.
- بعد الرفع: شغل فحص الإنتاج المناسب للتأكد من Vercel/Render/MongoDB Atlas.

## ما أعرفه من حالة الريبو الحالية

- الفرع الحالي: `main`.
- الريموت: `origin` على GitHub repository `nasef6464/almeaacodax`.
- المشروع مبني على:
  - Frontend: Vite + React.
  - Backend: Express + TypeScript داخل `server`.
  - Database: MongoDB Atlas في الإنتاج، مع خيار MongoDB محلي.
  - Deploy: Vercel للواجهة وRender للـ API.
- المستندات النشطة:
  - `docs/ACTIVE_BATCH_CHECKLIST_AR.md`
  - `docs/CURRENT_EXECUTION_PLAN_AR.md`
  - `docs/CURRENT_DEVELOPMENT_STATUS_AR.md`
  - `docs/DEPLOYMENT.md`
  - `docs/OPERATIONAL_QA_FLOW_AR.md`

## الحالة الفنية الأخيرة

الفحوص التي نجحت في هذه الجلسة:

- `npm run smoke:operational` في 2026-05-08: نجح 71/71.
- `npm run smoke:student-journey`: نجح 6/6.
- `npm run smoke:learning-quiz`: نجح 7/7.
- `npm run smoke:quiz-access`: نجح 15/15.
- `npm --prefix server run build`
- `npm run typecheck`
- `npm run build`
- `npm --prefix server run check`
- `npm --prefix server run build`
- `npm run smoke:quiz-access`
- `npm run smoke:mock-exams`
- `npm run smoke:my-quizzes`
- `npm run smoke:reports-role`
- `npm run smoke:saher-skills`
- `npm run smoke:library-support`
- `npm run smoke:results`

فحص رحلة التعلم:

- كان `npm run smoke:learning-quiz` يفشل في بيانات الإنتاج لأن الاختبارات المنسوخة القديمة كانت تحتوي مرجع سؤال غير موجود:
  - `q_1777887544584_copy`
- الاختبارات المتأثرة في API الإنتاجي:
  - `quiz_1777887903014_copy`
  - `quiz_1777887902510_copy`
  - `quiz_1777887901798_copy`
  - `quiz_1777887901198_copy`
- تم حفظ نسخة احتياطية محلية قبل الإصلاح في `backups/quiz-ref-repair-20260507-135818.json`.
- تم حذف المرجع المكسور فقط من `questionIds` في الاختبارات الأربعة عبر API المحلي المتصل بقاعدة `almeaa`.
- بعد الإصلاح نجح `npm run smoke:learning-quiz` بنتيجة 7/7.

إصلاح بيانات إنتاج إضافي في 2026-05-08:

- فشل `npm run smoke:operational` أولًا بنتيجة 70/71 بسبب مرجع سؤال مفقود في اختبار ظاهر للطالب.
- الاختبار: `quiz_1777887887174`
- المرجع المكسور: `q_1777887544584_copy`
- تم حفظ نسخة احتياطية محدودة للاختبار في:
  `backups/quiz-ref-repair-2026-05-07T21-30-10-900Z-quiz_1777887887174.json`
- تم حذف المرجع المكسور فقط من `questionIds`.
- بعد الإصلاح:
  - `npm run smoke:operational` نجح 71/71.
  - `npm run smoke:learning-quiz` نجح 7/7.
  - `npm run smoke:quiz-access` نجح 15/15.

## التغيير المفتوح حاليًا

لا توجد تعديلات كود مفتوحة من دفعة الباقات؛ آخر commit محلي:

- `8d06331 Gate subject learning content by packages`

الفرع `main` متقدم عن `origin/main` بـ 4 commits محلية قبل توثيق إصلاح بيانات 2026-05-08.

## فحص المتصفح الداخلي

- استخدم دائمًا `http://localhost:3000` وليس `127.0.0.1:3000`.
- في 2026-05-08 فحص مسارات المتصفح المباشرة لم ينتج أخطاء console للطالب والمعلم والمشرف والمدير.
- محاكي الأدوار المحلي موجود في `components/RoleSwitcher.tsx` ويظهر فقط عندما تكون `import.meta.env.DEV` فعالة.
- إذا لم يظهر محاكي الأدوار في المتصفح، لا تعتبر ذلك فشل أدوار وحده؛ اعتمد على `npm run smoke:operational` لأنه يسجل دخولًا فعليًا لكل دور.

## الدفعات المغلقة بحراس

- نتائج الاختبار ومراجعة الحلول: `npm run smoke:results`
- مركز المكتبة وملفات الدعم: `npm run smoke:library-support`
- صلاحيات الاختبارات والباقات: `npm run smoke:quiz-access`
- رحلة الطالب داخل المادة: `npm run smoke:student-journey`
- مركز الاختبارات المحاكية المستقل: `npm run smoke:mock-exams`
- صفحة اختباراتي: `npm run smoke:my-quizzes`
- تقارير الأدوار: `npm run smoke:reports-role`
- ساهر متعدد المهارات: `npm run smoke:saher-skills`

لا تعد تصميم هذه الأجزاء من الصفر. أصلح فقط ما يفشل في الحارس أو ما يظهر كخلل واضح.

## الخطوة التالية المقترحة

1. أعد تشغيل فحوص الإغلاق قبل أي رفع:
   - `npm run typecheck`
   - `npm run build`
   - `npm --prefix server run check`
   - `npm --prefix server run build`
   - `npm run smoke:quiz-access`
   - `npm run smoke:learning-quiz`
2. إذا نجحت، ثبّت تحديث ملفات التسليم في commit صغير جديد أو عدل commit المرجع السابق إذا كان هذا مناسبًا قبل الدفع.
3. بعدها انتقل إلى فحص الإنتاج حسب `README.md` و`docs/DEPLOYMENT.md`:
   - `npm run smoke:frontend`
   - وعند اكتمال Vercel: `npm run smoke:frontend:strict`

## بخصوص الحساب القديم والصلاحيات

لا يمكن للوكيل الجديد قراءة محادثة حساب ChatGPT/Codex القديم تلقائيًا. إن احتجنا سياقًا منه، أفضل شيء أن يضع الحساب القديم ملخصًا داخل هذا الملف أو ملف جديد في `docs`.

لكن لا يلزم الحساب القديم إذا كانت هذه الأشياء متاحة في البيئة الحالية:

- الريبو موجود محليًا ومربوط بـ GitHub.
- إعدادات الإنتاج موثقة في `README.md` و`docs/DEPLOYMENT.md`.
- أسرار Render/MongoDB/Vercel موجودة في منصاتها أو في ملفات env المحلية غير المرفوعة.
- أدوات CLI، إن كانت مطلوبة، مسجلة دخول في الجهاز الحالي.

إذا لم تكن أدوات GitHub/Vercel/Render مسجلة دخول في الحساب الحالي، فالخطوة الصحيحة ليست نسخ أسرار داخل المحادثة، بل تسجيل الدخول محليًا أو استخدام لوحات المنصات.
