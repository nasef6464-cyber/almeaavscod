# تقرير الدفعة 08 — ترقيم الأسئلة و Safe Serializer
**التاريخ:** 2026-05-16
**الموديل:** GPT-5.3-Codex / High
**الحالة:** مكتملة ✅

## ما تم
- تفعيل وضع ترقيم آمن لواجهة `GET /api/quizzes/questions` عبر `paginate=true` مع الإبقاء على التوافق الخلفي للشكل القديم (Array) عند عدم طلب paginate.
- تطبيق حد أقصى صارم `limit=100` بطريقة clamp (حتى لو أُرسل `limit=999`).
- إضافة `pagination` object في وضع paginate: `total, page, limit, totalPages, hasNext, hasPrev`.
- تقوية Safe Serializer لردود المتعلم بحيث لا تُعاد حقول الإجابات الصحيحة أو الحقول الداخلية الحساسة.
- تحديث شاشة `QuestionBankManager` (الموجودة مسبقًا) لاستخدام الجلب المرقّم فعليًا بدل الاعتماد على تحميل كبير.
- ضبط Bootstrap الأسئلة في `App.tsx` ليحترم سقف `100` بدل `120`.
- إصلاح سكربتات smoke الخاصة برحلة التعلم لتتعامل مع شكل `/quizzes` الحالي (array أو envelope) بدون فشل كاذب.

## الملفات المعدّلة في هذه الدفعة
| الملف | نوع التغيير | السبب |
|---|---|---|
| `server/src/routes/quiz.routes.ts` | Backend | إضافة paginate mode + limit clamp + safe serializer hardening |
| `services/api.ts` | Frontend API | دعم `getQuestionsPaginated` وتوافق `getQuestions` مع array/object |
| `dashboards/admin/QuestionBankManager.tsx` | Frontend شاشة موجودة | جلب مرقّم للأسئلة + تحكم الصفحة |
| `App.tsx` | Frontend bootstrap | احترام سقف 100 في تحميل الأسئلة |
| `scripts/smoke-learning-quiz-journey.mjs` | Test/Smoke | دعم payload `/quizzes` بشكل مرن |
| `scripts/smoke-student-learning-journey.mjs` | Test/Smoke | دعم payload `/quizzes` بشكل مرن |
| `QUESTIONS_PAGINATION_AND_SAFE_SERIALIZER_FIX_2026-05-14_AR.md` | توثيق | تقرير الدفعة 08 |
| `docs/SPARK_BATCH_LEDGER_AR.md` | توثيق | تحديث حالة الدفعة 08 |
| `docs/SPARK_EXECUTION_ROADMAP_AR.md` | توثيق | تحديث تنفيذ وإغلاق الدفعة 08 |
| `PROJECT_STATUS.md` | توثيق | تحديث الحالة العامة للمشروع |

## الملفات التي كانت معدّلة مسبقًا ولم يتم لمسها
لا ينطبق داخل الـworktree النظيف لهذه الدفعة.

## نتائج الفحوصات
| الأمر | النتيجة | ملاحظات |
|---|---|---|
| `npm --prefix server run build` | ✅ | ناجح |
| `npm run typecheck` | ✅ | ناجح (حدث timeout في محاولة وسيطة ثم نجح بإعادة التشغيل) |
| `npm run build` | ✅ | ناجح |
| `npm run smoke:quiz-client-security` | ✅ | 4/4 PASS |
| `npm run smoke:saher-skills` | ✅ | 4/4 PASS |
| `npm run smoke:results` | ✅ | 6/6 PASS |
| `npm run smoke:learning-quiz` | ✅ | 7/7 PASS (بعد إصلاح عقد السكربت) |
| `npm run smoke:student-journey` | ✅ | 7/7 PASS (بعد إصلاح عقد السكربت) |
| `npm run smoke:route-loading` | ✅ | PASS |
| `npm run smoke:auth-cookie` | ✅ | 5/5 PASS |
| `npm run smoke:health-readiness` | ✅ | PASS |

## التحقق اليدوي
| السيناريو | النتيجة |
|---|---|
| `/api/quizzes/questions?summary=true&limit=5&page=1` | 200 + array متوافق |
| `/api/quizzes/questions?...&paginate=true&limit=999` | 200 + `pagination.limit=100` |
| عدم تسريب `correctOptionIndex` و`explanation` في رد المتعلم | ✅ |
| عدم تسريب `ownerId/createdBy/assignedTeacherId/reviewerNotes/approvedBy/approvedAt` في summary المتعلم | ✅ |
| فحص بصري (تشغيل واجهة محلية) | `http://localhost:5173/` يعمل 200 + بدون كسر ظاهر في شاشة بنك الأسئلة ضمن النطاق |

## فحص الإنتاج
- تحقق حي بعد النشر إلى `main`:
  - `GET /api/quizzes/questions?summary=true&limit=5&page=1` => `200` (shape=array).
  - `GET /api/quizzes/questions?summary=true&limit=999&page=1&paginate=true` => `200` مع `pagination.limit=100`.
  - حقول summary العامة أصبحت بدون الحقول الحساسة المذكورة أعلاه.
- النتيجة: التغيير منشور وفعّال على الإنتاج.

## المخاطر المتبقية
- لا يوجد خطر مانع ضمن نطاق الدفعة 08.

## مشاكل اكتُشفت خارج نطاق الدفعة (لا تُصلح الآن)
- لا يوجد.

## الدفعة التالية المقترحة
BATCH-09 — RBAC Security Audit Plan
