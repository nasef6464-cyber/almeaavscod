# Frontend Structure

## Main pages / routes
Defined in `App.tsx` using `HashRouter`.

### Full-screen routes
- `/quiz`
- `/quiz/:quizId`
- `/results`

### Staff dashboards
- `/admin-dashboard`
- `/instructor-dashboard`
- `/supervisor-dashboard`

### Parent dashboard
- `/parent-dashboard`

### Main application routes
- `/`
- `/dashboard`
- `/courses`
- `/course/:courseId`
- `/quizzes`
- `/reports`
- `/favorites`
- `/plan`
- `/qa`
- `/book-session`
- `/live-sessions`
- `/profile`
- `/admin/quiz-gen`
- `/achievements`
- `/blog`
- `/category/:pathId`
- `/category/:pathId/packages`
- `/category/:pathId/:subjectId`
- `/section/:catId`

## Main components
### Layout and navigation
- `components/Layout.tsx`
- `components/MainLayout.tsx`
- `components/DashboardLayout.tsx`
- `components/PathLayout.tsx`
- `components/Header.tsx`
- `components/RoleSwitcher.tsx`

### Learning and content
- `components/CourseOverview.tsx`
- `components/CoursePlayer.tsx`
- `components/CustomVideoPlayer.tsx`
- `components/LearningSection.tsx`
- `components/SmartLearningPath.tsx`
- `components/QuizGenerator.tsx`

### Modals and utility UI
- `components/DetailedAnalysisModal.tsx`
- `components/FileModal.tsx`
- `components/PaymentModal.tsx`
- `components/QuizDetailsModal.tsx`
- `components/SkillDetailsModal.tsx`
- `components/VideoModal.tsx`
- `components/ChatWidget.tsx`

### Auth helpers
- `components/auth/RequireRole.tsx`

### UI primitives
- `components/ui/Card.tsx`
- `components/ui/ProgressBar.tsx`

## Layout structure
- The app uses a shared main layout for normal pages.
- Dashboard pages use a separate dashboard layout.
- The header is dynamic and uses taxonomy from store state.
- A chat widget and floating communication action are present in the main layout.

## State management
Primary client state lives in:
- `store/useStore.ts`

Authentication state lives in:
- `contexts/AuthContext.tsx`

API translation / normalization layer:
- `services/adapter.ts`

HTTP client:
- `services/api.ts`

Local persistence:
- `localStorage` keys are used for session and platform state

## Forms
Visible form-heavy areas include:
- auth modal in `components/Header.tsx`
- quiz creation in `dashboards/admin/QuizBuilder.tsx`
- question creation in `dashboards/admin/builders/UnifiedQuestionBuilder.tsx`
- lesson creation in `dashboards/admin/builders/UnifiedLessonBuilder.tsx`
- content and taxonomy management managers
- payment request forms
- study-plan form

## UI library / design system
The frontend relies on:
- React components
- utility-style CSS class names
- motion/animation
- icons from Lucide
- rich content editor from React Quill
- charts from Recharts

No formal external design-system package was clearly confirmed, but the interface is highly componentized.

## Important user flows
### Student flow
1. Open landing page.
2. Log in.
3. See dynamic navbar based on paths/subjects.
4. Enter course or path page.
5. Watch lesson or open resource.
6. Take a quiz.
7. Review score and skill analysis.
8. Open reports/favorites/study plan.

### Staff flow
1. Log in as admin/teacher/supervisor.
2. Open staff dashboard.
3. Manage taxonomy, content, questions, quizzes, lessons, schools, groups, finance, homepage.

### Parent flow
1. Log in.
2. Open parent dashboard.
3. Review the linked student’s performance.

## Missing screens / likely cleanup areas
- Certificate center is not clearly visible as a dedicated page.
- Notification inbox / message center is not clearly visible.
- Assignment management is not clearly visible as its own page.
- Some legacy Firebase sync logic may still exist as fallback.
- Google sign-in is shown in the UI but not implemented in the auth context.

## Reusable components
Especially reusable:
- `Header`
- `CustomVideoPlayer`
- `RichTextEditor`
- `FileModal`
- `PaymentModal`
- `QuizDetailsModal`
- `DetailedAnalysisModal`
- `SkillDetailsModal`
- `RoleSwitcher`
- `ProgressBar`

## Areas that need cleanup
- Legacy fallback logic needs ongoing review.
- Some pages may still mix teacher/admin/student concerns.
- Quiz/result reporting is rich but may need simplification for younger users.
- Any direct AI usage should remain behind the backend proxy.

