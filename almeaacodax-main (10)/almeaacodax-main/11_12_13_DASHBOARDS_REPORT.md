# Phase 11/12/13 - Dashboards System Report

Date: 2026-05-13
Branch: `complete-platform-production-v1`

## Scope

This phase hardened the dashboard/reporting data layer for admin, supervisor, teacher, parent, and student views.

No UI, layout, colors, fonts, or frontend visual design were changed.

## Main Problem Found

The reports/dashboard backend had a scalability risk:

- Some analytics paths loaded all students and then filtered them in memory.
- Large result and attempt reads were not explicitly bounded in the analytics overview.
- This can become slow when the platform grows to thousands of students, even if the current question bank is still small.

## What Changed

### Role-Scoped Student Queries

Added a role-aware scoped query builder:

- Admin: all students, bounded by `studentLimit`.
- Teacher/Supervisor: students sharing assigned groups or school.
- Parent: linked students only.
- Student: own record only.

The backend now queries MongoDB directly by scope instead of loading every student first.

### Bounded Analytics Overview

`GET /api/quizzes/analytics/overview` now accepts bounded limits:

```text
studentLimit
resultLimit
attemptLimit
```

Defaults:

```text
studentLimit=500
resultLimit=2000
attemptLimit=3000
```

Hard caps:

```text
studentLimit <= 1000
resultLimit <= 5000
attemptLimit <= 5000
```

The response now includes:

- `studentCount`: full scoped count.
- `sampledStudentCount`: number analyzed in this request.
- `isTruncated`: whether the scope was larger than the sampled dashboard window.
- `limits`: the applied limits.

This keeps dashboards responsive while preserving honest reporting about sampled vs total data.

### Lean Queries

Dashboard-heavy reads now use `.lean()` where the route only needs plain JSON:

- scoped students
- groups
- quiz results
- question attempts
- skills/subjects/sections
- assigned follow-up quizzes

This reduces Mongoose object overhead during dashboard loads.

### Scoped Quiz Results

`GET /api/quizzes/results/scoped` remains paginated and now reuses the role-scoped student resolver.

The response now also includes:

- `studentCount`
- `sampledStudentCount`

### Frontend API Compatibility

The frontend API client now passes safe default limits:

- `api.getQuizAnalyticsOverview()`
- `api.getScopedQuizResults()`

Existing pages can keep calling the methods without visual or code-level UI changes.

## Files Changed

- `server/src/routes/quiz.routes.ts`
- `services/api.ts`
- `scripts/smoke-dashboards-phase11-contract.mjs`
- `package.json`
- `11_12_13_DASHBOARDS_REPORT.md`

## Validation Run

Passed:

```bash
npm --prefix server run check
npm --prefix server run build
npm run typecheck
npm run smoke:dashboards-phase11
npm run smoke:api-phase4
npm run smoke:exam-payment-phase8
npm run build
```

## Operational Notes

For very large schools, the dashboard should use the current overview as a fast first screen and add deeper paginated drill-down pages later when explicitly requested.

The backend is now safer for growth because the first dashboard screen does not need to load all students and all history into memory.

## Remaining For Later Phases

- Add CSV/PDF export jobs through BullMQ instead of generating large reports in HTTP requests.
- Add Redis caching for stable school/group summaries after load testing.
- Add deeper paginated report endpoints for institutional contracts if the UI needs detailed drill-down screens.

## Stop Point

Phase 11/12/13 is delivered. Per the agreed workflow, the next phase should not start until owner approval.
