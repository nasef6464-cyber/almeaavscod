# Database Review

## Current Status

This sprint closes the first MongoDB hardening pass for high-traffic readiness. It does not change business behavior; it adds query support for the routes already used by students, parents, teachers, and admins.

## Indexes Added

Student and learning reads:

- `Path`, `Level`, `Subject`, `Section`, `Skill`: taxonomy bootstrap lookup/order indexes for fast public path/subject opening.
- `Topic`: path/subject/section visibility ordering, parent ordering, and linked lesson/quiz/library lookups.
- `Lesson`: path/subject/section visible lesson loading, teacher/admin ownership review, teacher assignment review, and skill lookups.
- `LibraryItem`: same learning-space and ownership indexes as lessons.
- `Course`: published subject/path packages, global membership/package discovery, ownership review, teacher assignment review, and included-course lookups.
- `AnnouncementAd`: active announcement popups by priority and audience.

Quiz and progress reporting already had strong baseline indexes before this sprint:

- `QuizResult`: user history, quiz history, skill/subject analysis.
- `QuestionAttempt`: user attempts, skill attempts, subject/section aggregation.
- `SkillProgress`: unique user/skill progress and weak-skill queries.

Payments and access:

- `PaymentRequest`: pending/admin review lists, user history, package history, discount-code reporting, gateway event lookup, and gateway transaction lookup.
- `DiscountCode`: active/expiry checks and package/path/subject/content-type targeting.
- `AccessCode`: school/package expiry checks and package expiry checks.
- `B2BPackage`: school packages, teacher revenue packages, path/subject/content-type package discovery.

Admin/operations:

- `AdminAuditLog`: latest log review, blocked/failed checks, action/status review, actor history, and resource history.
- `AiInteraction`: AI admin metrics by endpoint, audience, status, fallback, personalization, and user.
- `User`: role lists, school role lists, group membership, parent linked students, teacher managed paths/subjects, purchased packages/courses.
- `Group`: school/class hierarchy, owner lists, supervisor scope, and student membership.

## Rules Followed

- No destructive migration was added.
- No schema field was renamed.
- No existing data shape was changed.
- Compound indexes avoid combining more than one array field in the same index.
- Production should let MongoDB build these indexes during a low-traffic deployment window.

## Scaling Notes

These indexes improve the first production bottlenecks but do not prove 10k-user readiness by themselves.

Before a large launch:

- Run the k6 scenarios in `load-tests/k6-platform-journey.js`.
- Watch Render `http_request` slow logs from `requestLogger`.
- Watch MongoDB Atlas slow queries and add only measured indexes after that.
- Upgrade MongoDB Atlas if connection or CPU limits appear.
- Move bulk notifications and heavy admin work to a queue before large campaigns.
