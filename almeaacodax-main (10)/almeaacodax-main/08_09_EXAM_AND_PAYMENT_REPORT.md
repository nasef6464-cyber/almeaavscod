# Phase 8/9 - Exam Engine And Payment Access Report

Date: 2026-05-13
Branch: `complete-platform-production-v1`

## Scope

This phase hardened the quiz submission engine and confirmed that paid access/subscription unlocks continue to flow through the atomic `AccessGrant` architecture created in earlier phases.

No UI, layout, colors, fonts, or frontend visual behavior were changed.

## Exam Security Changes

### Direct Result Creation

- `POST /api/quizzes/results` remains disabled for all users.
- Any attempt to create a final quiz result directly is audited through `recordAdminAuditLog`.
- Students must submit answers through `POST /api/quizzes/:id/submit`.

### Server-Side Scoring

- The server calculates:
  - `score`
  - `passed`
  - `correctAnswers`
  - `wrongAnswers`
  - `unanswered`
  - `skillsAnalysis`
  - `questionReview`
- The submit route does not trust client-provided `score`, `passed`, or `isCorrect`.
- Question attempts also continue to calculate `isCorrect` from the stored `correctOptionIndex`.

### Attempt Limits And Double Submit Protection

- `POST /api/quizzes/:id/submit` now enforces `quiz.settings.maxAttempts`.
- Results now store:
  - `attemptNumber`
  - `submissionKey`
  - `timeSpentSeconds`
  - `source`
  - `passed`
- `submissionKey` is unique and sparse, preventing duplicate processing when the same attempt is submitted rapidly.
- Existing quiz result indexes were extended with `{ userId, quizId, attemptNumber }` for fast attempt checks.

### Time And Deadline Validation

- The submit route validates `quiz.dueDate` when present.
- The submit route validates `quiz.settings.timeLimit` when present.
- A 60-second grace window is allowed to avoid punishing minor client/network delay.

### Answer Leakage Prevention

- Learner-facing question list responses no longer expose `correctOptionIndex` or `explanation` before submission.
- Staff roles still receive full question records for admin/teacher workflows.
- Summary mode remains lightweight and answer-safe.

## Payment And Access Validation

The payment/access side remains aligned with Phase 4:

- Access-code redemption reserves usage atomically through `AccessCodeModel.findOneAndUpdate`.
- Payment review/webhook approval uses atomic pending-status transitions.
- Successful approvals create `AccessGrant` records.
- Grants are mirrored into legacy user subscription arrays via `$addToSet` for frontend compatibility.
- Direct student self-unlock remains disabled.

## Files Changed

- `server/src/models/QuizResult.ts`
- `server/src/routes/quiz.routes.ts`
- `scripts/smoke-exam-payment-phase8-contract.mjs`
- `package.json`

## New Smoke Check

Added:

```bash
npm run smoke:exam-payment-phase8
```

It verifies:

- Direct quiz result creation is blocked.
- Submit enforces time/deadline and attempt protection.
- Scoring and pass/fail are server-side.
- Learners do not receive answer keys before submission.
- Quiz results store attempt metadata.
- Payment/access unlocks still flow through `AccessGrant`.

## Validation Run

Passed:

```bash
npm run typecheck
npm run build
npm --prefix server run check
npm --prefix server run build
npm run smoke:exam-payment-phase8
npm run smoke:quiz-client-security
npm run smoke:payment-package
npm run smoke:api-phase4
npm run smoke:direct-unlock-cleanup
```

## Remaining For Later Phases

- Phase 10 should move notification/email/WhatsApp jobs fully behind BullMQ workers.
- Load testing should validate high-concurrency quiz submissions against real MongoDB indexes.
- A future payment gateway webhook can reuse the same `AccessGrant` source/idempotency architecture.

## Stop Point

Phase 8/9 is delivered. Per the agreed workflow, the next phase should not start until owner approval.
