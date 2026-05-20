# حالة العمل الحالية وتسليم الاستكمال

آخر تحديث: 2026-05-14  
الفرع النشط: `complete-platform-production-v1`  
آخر نسخة مرفوعة وقت كتابة هذا الملف: `338a96e`  
رابط الواجهة الإنتاجية: `https://almeaacodax.vercel.app/`  
رابط API الإنتاجي المستخدم في الواجهة: `https://almeaacodax-k2ux.onrender.com/api`  
مستودع GitHub: `https://github.com/nasef6464/almeaacodax.git`

هذا الملف هو نقطة البداية لأي حساب Codex أو مطور جديد. اقرأه قبل لمس الكود.

## طريقة العمل المتفق عليها

1. لا تغيّر شكل الموقع أو الخطوط أو الألوان إلا بطلب واضح من صاحب المشروع.
2. أي دفعة يجب أن تكون محددة، مكتملة، ومغلقة بفحص.
3. قبل التعديل اقرأ الملفات المرتبطة ولا تعتمد على التخمين.
4. بعد التعديل شغل الفحص المناسب ثم `typecheck` ثم البناء.
5. بعد الرفع افحص الإنتاج على `almeaacodax.vercel.app` وليس المحلي فقط.
6. استخدم المتصفح الداخلي للفحص البصري بعد كل دفعة واجهة.
7. لا تطبع أي أسرار أو مفاتيح في المحادثة أو الملفات.
8. لا تستخدم `git reset --hard` أو أي حذف واسع بدون إذن صريح.

## آخر الدفعات المنجزة

هذه آخر الدفعات التي أغلقتها ورفعتها:

| Commit | الدفعة | ماذا أضافت |
|---|---|---|
| `338a96e` | خطة متابعة الفصول في بوابة المشرف | جدول يوضح أولوية كل فصل، متوسط الأداء، عدد الطلاب المحتاجين متابعة، والإجراء التالي، مع تصدير Excel وشيت داخل تقرير المشرف |
| `90c2074` | نسخ رسالة تسليم المدرسة | زر داخل إدارة المدارس لنسخ رسالة جاهزة للإدارة مع إشعار نجاح |
| `10846fb` | إجراءات جاهزية المدرسة على البطاقات | بطاقات المدارس تعرض الخطوة التالية وتفتح التبويب المناسب مباشرة |
| `8096f00` | ملخص المشرف الأسبوعي | ملخص تنفيذي وخطة أسبوعية للمشرف داخل بوابة المدرسة |
| `cee74a4` | ملف تسليم المدرسة | ملف Excel للتسليم يشمل خطة التشغيل، checklist للمشرف، ورسالة جاهزة |
| `713b828` | مركز جاهزية تشغيل المدرسة | فحص قبل التسليم: فصول، مشرفون، باقات، أكواد، وطلاب بلا ولي أمر |
| `1d2dd7c` | تدفقات بوابة المدرسة | أدوات يومية للمشرف: تقرير، اختبار موجه، رسالة، وتصدير قائمة متابعة |
| `0790355` | تحسين بوابة المدرسة ومعاينة الإعلانات | ربط الإعلان بمعاينة مباشرة وتحسين تشغيل بوابة المدرسة |
| `3c41b20` | مركز تقارير وإشراف مدرسي | مركز إداري يخدم التعاقد مع المدارس: متابعة، تقارير، وتوجيه إجراءات |
| `9a94582` | تقوية إدارة المدارس | تحسين سير المدارس، الفصول، المشرفين، الباقات، والأكواد |
| `2a46b4f` | لوحة المشرف | دعم مشرف المدرسة أو عدة مجموعات من نفس الحساب |
| `30603a3` | الإعلانات المتقدمة | إعدادات متقدمة للإعلانات والروابط والمعاينة |

## ما تم بقوة حتى الآن

- فصل الباقات عن الدورات في السلوك: الباقات تعرض كاختيار شراء مستقل، والدورة تبقى منتجًا مستقلًا يمكن شراؤه من مكانها.
- تحسين سرعة الفتح على الإنتاج عبر إزالة انتظار bootstrap الثقيل قدر الإمكان وتحسين smoke الإنتاج.
- إضافة حراسة إنتاجية تمنع نشر نسخة غير متوقعة: `smoke:frontend` يتحقق من commit المنشور.
- تحسين إدارة المدارس والفصول والمشرفين لخدمة المدارس.
- دعم المشرف كمدير مدرسة أو مسؤول عن فصل/عدة فصول من نفس الحساب.
- إضافة تقارير ومخرجات Excel للمشرف والمدرسة.
- تحسين الإعلانات لتكون قابلة للمعاينة والروابط.
- إضافة تقارير أدوار للطالب، ولي الأمر، المشرف، المعلم، والمدير.
- تقوية أجزاء أمنية سابقة: منع فتح مباشر للمحتوى، حماية quiz client/security، وفصل الدفع عن الفتح المباشر.
- إضافة تقارير المراحل من `01_FULL_AUDIT_REPORT.md` حتى `19_20_DEPLOYMENT_HANDOVER_REPORT.md`.

## مشاكل واجهتنا أثناء العمل

- حصل كسر بصري سابق عند نقل Tailwind من CDN إلى build؛ تم الرجوع لمسار أكثر أمانًا. قاعدة مهمة: لا تلمس `index.html` أو CSS العام بدون فحص بصري فوري.
- صاحب المشروع لاحظ بطءًا في الإنتاج. تم تحسين جزء من bootstrap والتحميل، لكن قابلية 10,000 طالب لا تُثبت إلا باختبار ضغط حقيقي مع Redis وRender instances وMongo Atlas tier مناسب.
- بعض صفحات الإدارة تحتاج جلسة مدير حقيقية للفحص البصري الكامل. إذا لم تكن الجلسة مديرًا، رابط `#/admin-dashboard` قد يعيدك للواجهة العامة أو لا يظهر الإدارة.
- بعض ملفات التسليم القديمة قد تظهر بترميز غريب في PowerShell، لكن ملفات الكود نفسها تعمل. عند التوثيق العربي استخدم UTF-8 ولا تعتمد على نسخ PowerShell إذا ظهر Mojibake.

## ما يزال موجودًا ويحتاج استكمالًا

الأولوية التالية المقترحة:

1. فحص بصري حقيقي من حساب مدير وحساب مشرف وحساب طالب على الإنتاج.
2. اختبار كامل لتبويب المدارس داخل الإدارة: إنشاء مدرسة، إضافة فصل، ربط مشرف، ربط طالب، إنشاء باقة، إنشاء كود، تحميل تقرير.
3. إكمال دورة الدفع الحقيقية: مزود دفع مناسب لمصر والسعودية، webhook، وAccessGrant ذري.
4. تفعيل Redis إنتاجيًا للـ rate limit وBullMQ وSocket.IO عند الحاجة للتوسع.
5. اختبار ضغط حقيقي باستخدام scripts الموجودة في `load-tests`.
6. مراجعة تخزين token طويل المدى في الواجهة والتحول المرحلي إلى cookie strategy عند اكتمال الخطة.
7. تنظيف أي بقايا Firebase fallback إذا ثبت أن MongoDB هو المصدر الوحيد.
8. مراجعة SEO النهائية بعد استقرار الروابط.

## ربط GitHub / Vercel / Render

### GitHub

- المستودع: `https://github.com/nasef6464/almeaacodax.git`
- الفرع الذي نعمل عليه: `complete-platform-production-v1`
- يتم الدفع أيضًا إلى `main` لأن Vercel مربوط غالبًا بفرع `main`.
- أوامر الرفع المستخدمة:

```bash
git push origin complete-platform-production-v1
git push origin complete-platform-production-v1:main
```

### Vercel

- رابط الواجهة: `https://almeaacodax.vercel.app/`
- البناء: `npm run build`
- المتغير المهم للواجهة عند الحاجة:

```bash
VITE_API_URL=https://almeaacodax-k2ux.onrender.com/api
```

الواجهة تحتوي fallback إنتاجي في `services/api.ts` يشير إلى:

```text
https://almeaacodax-k2ux.onrender.com/api
```

### Render

- رابط API المستخدم: `https://almeaacodax-k2ux.onrender.com/api`
- فحص الصحة:

```text
https://almeaacodax-k2ux.onrender.com/api/health/live
https://almeaacodax-k2ux.onrender.com/api/health/ready
```

- بناء السيرفر: `npm --prefix server run build`
- تشغيل السيرفر: `npm --prefix server run start`

متغيرات Render الأساسية، بدون قيم أسرار:

```bash
NODE_ENV=production
PORT=4000
CLIENT_URL=https://almeaacodax.vercel.app
CORS_ALLOWED_ORIGINS=https://almeaacodax.vercel.app
MONGODB_URI=<MongoDB Atlas connection string>
JWT_SECRET=<long random secret, at least 32 chars recommended>
JWT_EXPIRES_IN=7d
ADMIN_NAME=<admin display name>
ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<strong password>
REDIS_URL=<managed redis url, required for high scale>
REDIS_KEY_PREFIX=almeaa
RATE_LIMIT_REDIS_ENABLED=true
NOTIFICATION_QUEUE_ENABLED=true
NOTIFICATION_QUEUE_CONCURRENCY=5
```

متغيرات اختيارية حسب المزود:

```bash
EMAIL_PROVIDER=console|resend|http
EMAIL_FROM=<verified sender>
RESEND_API_KEY=<secret>
EMAIL_WEBHOOK_URL=<provider webhook>
EMAIL_WEBHOOK_TOKEN=<secret>
WHATSAPP_PROVIDER=console|whatsapp_cloud|http
WHATSAPP_ACCESS_TOKEN=<secret>
WHATSAPP_PHONE_NUMBER_ID=<id>
WHATSAPP_WEBHOOK_URL=<provider webhook>
WHATSAPP_WEBHOOK_TOKEN=<secret>
AI_PROVIDER=none|gemini|openrouter|deepseek|qwen|openai|ollama|lmstudio
OPENAI_API_KEY=<secret if used>
GEMINI_API_KEY=<secret if used>
SENTRY_DSN=<optional>
```

### MongoDB Atlas

- `MONGODB_URI` يجب أن يكون مضبوطًا في Render فقط وليس في الواجهة.
- إعدادات pooling موجودة في `server/src/config/env.ts` و`server/src/config/db.ts`.
- القيم الافتراضية الحالية:

```bash
MONGODB_MAX_POOL_SIZE=30
MONGODB_MIN_POOL_SIZE=2
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
MONGODB_SOCKET_TIMEOUT_MS=45000
MONGODB_MAX_IDLE_TIME_MS=60000
```

للضغط العالي، راجع هذه القيم بعد اختبار حقيقي وليس بالتخمين.

## أوامر الفحص المهمة

بعد أي تعديل عام:

```bash
npm run typecheck
npm run build
npm --prefix server run build
npm run smoke:frontend
```

لفحص محور المدارس والمشرفين:

```bash
npm run smoke:school-management
npm run smoke:admin-school-command
npm run smoke:school-portal-command
```

لفحص الأداء والإنتاج:

```bash
npm run smoke:performance
npm run smoke:production-speed
npm run smoke:frontend
```

لفحص الدفع والباقات:

```bash
npm run smoke:package-course-split
npm run smoke:payment-package
npm run smoke:payment-providers
```

لفحص الاختبارات والأمان:

```bash
npm run smoke:quiz-access
npm run smoke:quiz-client-security
npm run smoke:api-security
```

## بروتوكول الفحص البصري

1. افتح الإنتاج دائمًا:

```text
https://almeaacodax.vercel.app/?v=<commit>_<batch_name>_<timestamp>#/
```

2. افحص على الأقل:

```text
/
/#/category/p_1777779639431?subject=sub_1777779748206&tab=courses
/#/reports
/#/admin-dashboard
```

3. لو لم تكن الجلسة مديرًا، سجّل ذلك بوضوح ولا تدّعي أن لوحة الإدارة تم فحصها بصريًا بالكامل.
4. لا تعتمد على المحلي وحده؛ صاحب المشروع يراجع Vercel.

## ملاحظات مهمة للدفعة التالية

- الدفعة المناسبة التالية ليست إضافة شكل جديد، بل فحص كامل لتبويب المدارس من حساب مدير حقيقي وتثبيت أي زر لا يعمل.
- إن لم تتوفر جلسة مدير داخل المتصفح الداخلي، اعمل فحصًا برمجيًا وSmoke، واذكر أن الفحص البصري الإداري يحتاج تسجيل دخول مدير.
- لا توسع لوحة المشرف بكلام كثير؛ المطلوب إمكانيات كبيرة بعرض بسيط.
- أي تحسين جديد في الإدارة يجب أن يخدم التعاقد مع المدارس: متابعة الطلاب، تقارير مجمعة وفردية، تصدير، توجيه اختبار، ومراسلة.

## حالة التسليم الآن

المشروع ليس “جاهزًا نظريًا لـ 10,000 طالب” بمجرد الكود. الكود أصبح أقرب وأكثر تنظيمًا، لكن الاعتماد الحقيقي يحتاج:

- Redis مفعل في الإنتاج.
- Render backend بعدة instances عند الحاجة.
- MongoDB Atlas tier مناسب ومراقب.
- اختبار ضغط موثق.
- مراقبة أخطاء وإشعارات.

حتى الآن يمكن اعتباره مناسبًا لتجارب أصغر ومراحل إطلاق تدريجية بعد فحص الحسابات الحقيقية والبيانات الحالية.
