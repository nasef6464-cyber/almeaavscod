# خريطة المنصة التشغيلية

هذا الملف مرجع عملي قبل أي تطوير جديد، حتى نحافظ على الأجزاء التي تم اختبارها فعليًا ولا نكسرها لاحقًا.

## 1. المسارات العامة للموقع

- `/`
  الصفحة الرئيسية العامة.
- `/dashboard`
  لوحة الطالب الشخصية.
- `/courses`
  مركز الدورات المفتوحة والمشتراة.
- `/course/:courseId`
  صفحة عرض الدورة وتشغيل محتواها.
- `/quizzes`
  مركز الاختبارات الموحد:
  اختبارات جاهزة، اختبارات موجهة، واختبارات علاجية.
- `/quiz`
  اختبار ساهر الذاتي.
- `/quiz/:quizId`
  صفحة تنفيذ اختبار محدد.
- `/results`
  صفحة النتيجة الموحدة بعد الاختبار.
- `/reports`
  التقارير والتحليل المهاري حسب الدور.
- `/favorites`
  المفضلة والمراجعة لاحقًا.
- `/plan`
  الخطة العلاجية/الدراسية.
- `/qa`
  سؤال وجواب.
- `/book-session`
  حجز جلسة خاصة.
- `/profile`
  الملف الشخصي.
- `/achievements`
  الإنجازات والنقاط والشارات.
- `/blog`
  صفحة المقالات. ما زالت تحتاج تطويرًا تشغيليًا.

## 2. مسارات التعلم والمسارات التعليمية

- `/category/:pathId`
  صفحة المسار العامة.
- `/category/:pathId/:subjectId`
  صفحة المادة داخل المسار، وهي المرجع الصحيح المرتبط بما يظهر في الشريط العلوي.
- تم توحيد الروابط القديمة لتتحول إلى هذا المسار بدل فتح صفحات تعلم قديمة أو متضاربة.

## 3. لوحات العمل الداخلية

- `/admin-dashboard`
  لوحة الإدارة الأساسية.
- `/instructor-dashboard`
  تستخدم نفس لوحة العمل لكن بنطاق المعلم.
- `/supervisor-dashboard`
  تستخدم نفس لوحة العمل لكن بنطاق المشرف.

## 4. مراكز الإدارة داخل لوحة العمل

من [AdminDashboard.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/AdminDashboard.tsx):

- نظرة عامة
- إدارة المسارات (مساحات العمل)
- مركز الدروس
- مركز الاختبارات
- مركز الأسئلة
- مركز المهارات
- إدارة المستخدمين
- المجموعات والمدارس
- المالية والاشتراكات
- الإشعارات
- مراقبة النظام
- الإعدادات

## 5. مراكز الإدارة الفعلية في الكود

داخل مجلد [dashboards/admin](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin):

- [PathsManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/PathsManager.tsx)
- [CoursesManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/CoursesManager.tsx)
- [LessonsManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/LessonsManager.tsx)
- [QuestionBankManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/QuestionBankManager.tsx)
- [QuizzesManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/QuizzesManager.tsx)
- [SkillsManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/SkillsManager.tsx)
- [SkillsTreeManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/SkillsTreeManager.tsx)
- [FoundationManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/FoundationManager.tsx)
- [LibraryManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/LibraryManager.tsx)
- [SchoolsManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/SchoolsManager.tsx)
- [UsersManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/UsersManager.tsx)
- [FinancialManager.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/FinancialManager.tsx)
- [QuizBuilder.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/QuizBuilder.tsx)
- [CourseBuilder.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/CourseBuilder.tsx)
- [AdvancedCourseBuilder.tsx](C:/ALMEAA%20MAY%20-%20codax/dashboards/admin/AdvancedCourseBuilder.tsx)

## 6. الأدوار التشغيلية المعتمدة

- مدير المنصة `admin`
- معلم المادة `teacher`
- مشرف المجموعة/المدرسة `supervisor`
- طالب `student`
- ولي أمر `parent`

## 7. قاعدة التشغيل الحالية للمحتوى

المحتوى يسير الآن بهذه الدورة:

1. المعلم أو المشرف يضيف المحتوى.
2. المحتوى يدخل `pending_review`.
3. المدير فقط يعتمد ويقرر النشر.
4. الطالب والزائر لا يرون إلا المحتوى `approved` والمنشور.

هذا مطبق على:

- الدورات
- الدروس
- الأسئلة
- الاختبارات
- ملفات المكتبة

## 8. مصدر المهارات المعتمد

المصدر الصحيح الوحيد للمهارات:

- `المسار`
- `المادة`
- `المهارة الرئيسة (Section)`
- `المهارة الفرعية (Skill)`

أما `التأسيس/الموضوعات` فهو مساحة تعلم منفصلة، وليس مصدرًا لتحليل المهارات.

## 9. السيناريو التشغيلي الذي تم حقنه واختباره

### حسابات التشغيل

- مدير:
  `nasef64@gmail.com / Nn@0120110367`
- معلم قدرات كمي:
  `teacher.quant@almeaa.local / Teacher@123`
- معلم تحصيلي رياضيات:
  `teacher.math@almeaa.local / Teacher@123`
- مشرف مجموعة:
  `supervisor.group@almeaa.local / Supervisor@123`
- طالب:
  `student.a@almeaa.local / Student@123`
- ولي أمر:
  `parent.a@almeaa.local / Parent@123`

### كيانات تم حقنها

- مدرسة تشغيلية
- فصل/مجموعة للقدرات الكمي
- فصل/مجموعة للتحصيلي رياضيات
- طلاب مربوطون بالمجموعات
- أولياء أمور مربوطون بالطلاب
- باقتان تشغيليتان
- كود تفعيل:
  `RIYADA-QUANT-2026`

### محتوى تم حقنه

- دروس فيديو حقيقية
- أسئلة حقيقية
- اختبارات حقيقية
- محتوى معلق بانتظار المراجعة
- ملفات مكتبة
- دورات
- موضوعات تأسيس

## 10. ما تم اختباره فعليًا

- تسجيل الدخول لكل دور أساسي
- `/auth/me`
- تحليلات الاختبارات حسب الدور
- تقرير المدرسة
- نتائج الطالب
- الوصول للدورات والاختبارات للطالب
- كود التفعيل
- فصل المحتوى المعتمد عن المعلق

## 11. قواعد لا يجب كسرها لاحقًا

- عدم إعادة أي رابط قديم يفتح صفحة تعلم مختلفة عن صفحة الشريط العلوي.
- عدم السماح للمحتوى `pending_review` أن يظهر للطالب أو الزائر.
- عدم كسر ربط:
  `مسار -> مادة -> مهارة رئيسة -> مهارة فرعية`
- عدم إعادة منطق الباقات إلى “شراء دورة فقط”؛ الباقات الآن scoped حسب نوع المحتوى والمسار والمادة.
- عدم كسر تقارير:
  المدير، المعلم، المشرف، ولي الأمر.

## 12. الجيوب التي ما زالت تحتاج تطويرًا لاحقًا

- [Blog.tsx](C:/ALMEAA%20MAY%20-%20codax/pages/Blog.tsx) ما زالت Placeholder.
- هناك بعض نوافذ الإدارة ما زالت تستخدم رسائل `alert` قديمة وتحتاج تحويلًا لتجربة تشغيلية أهدأ.
- نحتاج لاحقًا توسيع اختبارات ساهر الموجهة والخطط العلاجية التنفيذية من التقارير نفسها.

## 13. مرجع الفحص قبل أي تطوير جديد

- خريطة التشغيل السريع اليدوي:
  [docs/OPERATIONAL_QA_FLOW_AR.md](C:/ALMEAA%20MAY%20-%20codax/docs/OPERATIONAL_QA_FLOW_AR.md)
- الفحص الآلي السريع:

```bash
npm run smoke:operational
```
