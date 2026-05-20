# خطة الإطلاق النهائية المناسبة لـ Codex 5.3

**المشروع:** ALMEAA CODAX / منصة المئة  
**الإصدار المرجعي:** V9  
**النموذج المستهدف للتنفيذ:** Codex 5.3  
**الهدف:** إغلاق المتبقي حتى الإطلاق الرسمي بدون خلط دفعات أو قرارات غير محسومة.

## 1) قواعد التشغيل لـ Codex 5.3

- دفعة واحدة فقط في كل جلسة.
- لا تبدأ دفعة جديدة قبل إغلاق الحالية أو تسجيل blocker واضح.
- كل دفعة يجب أن تحتوي على:
  - قراءة الملفات المعنية قبل التعديل.
  - تنفيذ محدود النطاق.
  - فحوص `API + Smoke`.
  - تقرير دفعة عربي.
  - تحديث `PROJECT_STATUS.md`.
  - تحديث `docs/SPARK_BATCH_LEDGER_AR.md`.
  - تحديث `docs/NEXT_SESSION_HANDOVER_AR.md`.
  - commit + push.
- إذا فشل smoke: توقف، وثق الفشل، ولا تنتقل للدفعة التالية.
- إذا الدفعة تحتاج مفاتيح أو ترقية خارجية: لا تبدأ التنفيذ البرمجي، فقط وثق المطلوب من المالك.
- إذا التغيير يلمس أكثر من 5 ملفات إنتاجية: اشرح النطاق أولًا وانتظر موافقة المالك.
- لا تغييرات UI/ألوان/خطوط/تصميم إلا إذا كانت الدفعة نفسها تطلب ذلك.
- لا تغييرات schema كبيرة بدون موافقة المالك.

## 2) قراءة الحالة الحالية قبل البدء

في بداية أي جلسة شغل، نفذ:

```powershell
git status --short --branch
git log --oneline -n 10
Get-Content -Tail 180 PROJECT_STATUS.md
Get-Content -Tail 180 docs/SPARK_BATCH_LEDGER_AR.md
Get-Content -Tail 180 docs/NEXT_SESSION_HANDOVER_AR.md
```

ثم أعلن بالعربية:

```text
وصلنا إلى آخر دفعة موثقة: [اسم الدفعة].
النسبة الحالية حسب الخطة: [النسبة].
الدفعة التالية: [اسم الدفعة].
سأبدأ بدفعة واحدة فقط.
```

## 3) ترتيب الدفعات النهائي لـ Codex 5.3

### F1 — إغلاق التقارير المعلقة

**الهدف:** تنظيف التضارب بين حالة `BATCH_40` و`BATCH_27C`.

**ينفذ الآن بدون متطلبات خارجية.**

خطوات التنفيذ:

1. اقرأ:
   - `BATCH_40_LIVE_DASHBOARD_AND_LEARNING_VISUAL_EXECUTION_2026-05-19_AR.md`
   - `BATCH_27C_SENTRY_SDK_INTEGRATION_AND_LIVE_EVENT_CLOSURE_2026-05-18_AR.md`
   - `BATCH_27B_SENTRY_LIVE_EVENT_PROOF_2026-05-18_AR.md`
2. شغل:
   - `npm run smoke:homepage-hero`
   - `npm run smoke:announcement-ads`
   - `npm run smoke:reports-role`
   - `npm run smoke:dashboards-phase11`
   - `npm run smoke:learning-quiz`
   - `npm run smoke:student-journey`
   - `npm run smoke:quiz-access`
   - `npm run smoke:results`
   - `npm run smoke:sentry-runtime`
3. شغل `npm run smoke:sentry-live-proof` فقط إذا كان `SMOKE_ADMIN_TOKEN` موجودًا.
4. تحقق من:
   - `https://almeaacodax.vercel.app/` => 200
   - `https://almeaacodax-k2ux.onrender.com/api/health` => `status=ok`, `ready=true`
5. أنشئ:
   - `BATCH_F1_CLOSURE_REPORT_AR.md`
6. حدّث:
   - `PROJECT_STATUS.md`
   - `docs/SPARK_BATCH_LEDGER_AR.md`
   - `docs/NEXT_SESSION_HANDOVER_AR.md`

معيار الإغلاق:

- `BATCH_40`: Fully closed API+Smoke، مع ملاحظة أن visual click evidence يعتمد على قناة Browser control.
- `BATCH_27C`: Fully closed إذا `sentry-runtime` و`sentry-live-proof` PASS أو إذا تم اعتماد eventId الموثق سابقًا كدليل إنتاجي.

النسبة بعد F1: **93%**.

### F2 — حذف Firebase نهائيًا

**الهدف:** إزالة بقايا Firebase غير المستخدمة في الإنتاج.

**ينفذ الآن بدون متطلبات خارجية، لكن بحذر لأنه قد يلمس أكثر من 5 ملفات.**

قبل التنفيذ:

1. اعرض قائمة المراجع:
   - `rg -n "firebase|Firebase" -S --glob "*.ts" --glob "*.tsx" --glob "*.json"`
2. إذا تجاوزت التعديلات 5 ملفات إنتاجية، اطلب موافقة المالك.

خطوات التنفيذ بعد الموافقة:

1. إزالة `useEffect` الخاص بـ `allowLegacyFirebaseSync` من `App.tsx`.
2. حذف:
   - `services/firebase.ts`
   - `services/firebaseSync.ts`
   - `firebase-applet-config.json` إذا لم يعد مستخدمًا.
3. إزالة dependency `firebase` من `package.json` إن لم يعد لها أي استخدام.
4. تشغيل:
   - `npm run build` قبل/بعد وتوثيق الحجم.
   - `npm run typecheck`
   - `npm run smoke:runtime-source`
   - `npm run smoke:frontend:strict`
5. إنشاء:
   - `BATCH_F2_FIREBASE_FINAL_DELETION_AR.md`

النسبة بعد F2: **94%**.

### F3 — Redis Activation

**Blocker خارجي:** يحتاج المالك يضيف `REDIS_URL` في Render.

لا تبدأ التنفيذ حتى يقول المالك:

```text
أضفت REDIS_URL
```

بعدها:

1. اقرأ:
   - `server/src/config/redis.ts`
   - `server/src/middleware/rateLimiters.ts`
   - `server/src/queues/notificationQueue.ts`
2. تحقق من health قبل/بعد.
3. مطلوب health:
   - `redis.rateLimit=ready`
   - `redis.queue=ready`
4. شغل:
   - `npm run smoke:health-readiness`
   - `npm run smoke:notifications`
   - `npm run smoke:production-hardening`
5. أنشئ:
   - `BATCH_F3_REDIS_ACTIVATION_AR.md`

النسبة بعد F3: **96%**.

### F4 — Tap Payments

**Blocker خارجي:** يحتاج مفاتيح Tap.

لا تبدأ حتى يوفر المالك:

- `TAP_API_KEY`
- `TAP_SECRET_KEY`
- `TAP_WEBHOOK_SECRET`

نهج Codex 5.3:

- لا تضف dependency جديدة إلا إذا ضرورية.
- يفضل استخدام `fetch`/HTTP مباشر إن كان كافيًا.
- لا تغيّر schema كبير بدون موافقة.

خطوات التنفيذ:

1. اقرأ:
   - `server/src/routes/payment.routes.ts`
   - `server/src/models/PaymentRequest.ts`
2. صمم minimal integration:
   - initiate charge
   - store external charge id
   - webhook verify
   - captured => unlock access
3. شغل:
   - `npm run smoke:payment-providers`
   - `npm run smoke:payment-tampering`
   - `npm run smoke:payment-package`
4. اختبر sandbox transaction.
5. أنشئ:
   - `BATCH_F4_TAP_PAYMENT_INTEGRATION_AR.md`

النسبة بعد F4: **97%**.

### F5 — Verifiable Certificates QR

ينفذ بعد F4 أو عند موافقة المالك على تقديمه.

Codex 5.3 scope:

- تنفيذ V1 بسيط.
- لا PDF معقد في أول نسخة.
- QR + صفحة تحقق عامة + زر شهادة في مكان مناسب.

مطلوب:

- model/service/routes/frontend page.
- smoke أو test بسيط للعقد.
- `typecheck + build`.
- `BATCH_F5_CERTIFICATES_AR.md`.

النسبة بعد F5: **98%**.

### F6 — Lesson Discussion Forum

ينفذ كـ V1 محدود:

- threads/replies.
- auth required.
- role guard للـ resolve.
- pagination.
- لا redesign للواجهة.

مطلوب:

- server build.
- typecheck/build.
- تقرير `BATCH_F6_DISCUSSION_FORUM_AR.md`.

النسبة تبقى **98%** لكن ترفع جاهزية المنتج.

### F7 — Weakness Detection Engine

V1 مناسب لـ Codex 5.3:

- تحليل من `QuestionAttempt`/`QuizResult`.
- weak skills أقل من 60%.
- recommendations من الدروس المرتبطة.
- قسم في صفحة النتيجة.

فحوص:

- `npm run smoke:results`
- `npm run smoke:learning-quiz`
- typecheck/build عند تعديل frontend.

النسبة بعد F7: **99%**.

### F8 — Spaced Repetition

V1 فقط:

- `ReviewCard`
- SM-2 service
- due/stats/answer routes
- dashboard widget بسيط
- review session بسيط

لا توسع في gamification أو redesign.

النسبة تبقى **99%**.

### F9 — Scale Verification

**Blocker خارجي:** لا يبدأ قبل:

- MongoDB Atlas M2
- Render Starter
- Redis live

بعدها شغل load tests ووثق:

- p99
- error rate
- قبل/بعد

النسبة بعد F9: **100%**.

### F10 — Final Launch Declaration

لا يبدأ إلا بعد F1-F9.

ينتج:

- `FINAL_LAUNCH_DECLARATION_AR.md`
- `PROJECT_STATUS.md` score 100%
- `docs/NEXT_SESSION_HANDOVER_AR.md` => `LAUNCHED`
- `docs/SPARK_BATCH_LEDGER_AR.md` كل final batches مغلقة.

## 4) الدفعة التالية الآن

الدفعة التالية المناسبة فورًا:

```text
BATCH-F1 — Close Pending Reports
```

السبب:

- لا تحتاج مفاتيح خارجية.
- تنظف backlog قبل features جديدة.
- تناسب Codex 5.3 لأنها توثيق/تحقق محدود المخاطر.

