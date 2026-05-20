# BATCH F5 - Student Verifiable Certificate (QR)

التاريخ: 2026-05-19
الحالة: Fully closed

## الهدف
تفعيل شهادات قابلة للتحقق لكل طالب عند إكمال الدورة بنسبة 100%، مع رابط تحقق عام وQR.

## ما تم تنفيذه

### Backend
- إضافة موديل شهادة جديد:
  - `server/src/models/Certificate.ts`
  - الحقول: `userId`, `courseId`, `pathId`, `issuedAt`, `verificationCode`, `studentName`, `courseName`, `completionPercentage`.
- إضافة routes جديدة:
  - `POST /api/certificates/generate`
  - `GET /api/certificates/mine`
  - `GET /api/certificates/:verificationCode` (عام بدون auth)
- منطق التوليد:
  - يتحقق من إكمال الدورة 100% عبر دروس modules + `user.completedLessons`.
  - يمنع التوليد إذا الإكمال أقل من 100%.
  - يمنع الازدواج عبر unique `(userId, courseId)`.
- ربط الراوتر ضمن API index.

### Frontend
- إضافة methods في `services/api.ts`:
  - `generateCertificate`
  - `getMyCertificates`
  - `getCertificateByCode`
- إضافة صفحة شهادة عامة:
  - `pages/CertificatePage.tsx`
  - تعرض: اسم الطالب، اسم الدورة، نسبة الإكمال، رمز التحقق.
  - توليد QR للتحقق عبر رابط `/certificate/:code`.
  - زر طباعة/حفظ PDF عبر `window.print()`.
- إضافة route:
  - `/certificate/:code` في `App.tsx`.
- إضافة زر `شهادتي` داخل `pages/CourseView.tsx` عندما:
  - `course.certificateEnabled === true`
  - `course.progress >= 100`

## الفحوص
- `npm --prefix server run build` => PASS
- `npm run typecheck` => PASS
- `npm run build` => PASS

## المخرجات
- الشهادة قابلة للتوليد والتحقق العام.
- QR يعمل عبر رابط التحقق العام.
- إغلاق F5 مكتمل على مستوى الكود + البناء.
