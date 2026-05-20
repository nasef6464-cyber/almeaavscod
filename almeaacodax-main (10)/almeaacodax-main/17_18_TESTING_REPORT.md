# Phase 17/18 - Load Testing And QA Report

Scope: testing and quality gates only. No UI/UX changes were made.

## What This Phase Closes

This phase turns the previous hardening work into repeatable acceptance checks. The platform is not declared `10,000+` concurrent-student ready yet; instead, it now has a clearer testing ladder and contract checks that must pass before any large launch.

## Available Test Layers

### Static And Build Gates

Run before every deployment:

```bash
npm run typecheck
npm run build
npm --prefix server run check
npm --prefix server run build
```

### Security And API Contract Gates

Run before every backend deployment:

```bash
npm run smoke:api-security
npm run smoke:security-rbac-phase6
npm run smoke:quiz-client-security
npm run smoke:exam-payment-phase8
npm run smoke:package-course-split
npm run smoke:payment-providers
npm run smoke:notifications
npm run smoke:production-ops-phase14
```

These checks cover the main non-negotiable rules:

- Students cannot self-unlock paid access.
- Quiz scoring and correctness stay server-controlled.
- Payment/package/course flows stay separated.
- Redis, queues, and production readiness contracts remain wired.
- Request logging avoids sensitive payloads.

### Frontend Regression Gates

Run before frontend deployment:

```bash
npm run smoke:frontend
npm run smoke:frontend:strict
npm run smoke:performance
npm run smoke:route-loading
npm run smoke:homepage-hero
```

These checks protect the current UI and performance split without intentionally changing visual design.

## Load Test Ladder

Load tests should run against a staging or production-like environment, not a free sleeping Render service.

### Stage 1 - 100 Students

Goal: pilot readiness.

Acceptance target:

- Error rate below 2%.
- p95 API response below 1500 ms.
- No MongoDB connection exhaustion.
- No Render restart or memory pressure.

### Stage 2 - 500 Students

Goal: paid launch minimum after infrastructure upgrade.

Acceptance target:

- Error rate below 2%.
- p95 stays acceptable for login, bootstrap, and quiz submit.
- MongoDB slow query log is reviewed.
- Redis-backed rate limiting and notification queues are enabled.

### Stage 3 - 1000 Students

Goal: scaling decision gate.

Acceptance target:

- Backend remains stable under peak quiz submit traffic.
- Queue work does not block HTTP requests.
- Admin dashboard remains usable when student traffic is active.

### Stage 4 - Toward 10,000 Students

This requires staged proof, not a claim:

- Multiple Render instances.
- Managed Redis.
- MongoDB Atlas dedicated tier sized from earlier runs.
- Socket.IO Redis adapter enabled if realtime is used at scale.
- Repeated successful load tests with p95/p99 and error-rate evidence.

## Existing Load Test Script

Primary k6 journey:

```bash
k6 run load-tests/k6-platform-journey.js \
  -e API_BASE=https://YOUR_RENDER_SERVICE.onrender.com/api \
  -e STUDENT_EMAIL=student@example.com \
  -e STUDENT_PASSWORD=StrongPassword123 \
  -e QUIZ_ID=optional_quiz_id \
  -e QUIZ_SOURCE=training
```

The journey covers:

- Health.
- Content bootstrap.
- Taxonomy bootstrap.
- Login.
- Current user.
- Student quiz results.
- Optional quiz submit.

Output:

```text
load-tests/results/k6-platform-summary.json
```

## Result Recording Template

For every real run, record:

```text
Date:
Environment:
Render plan / instance count:
MongoDB Atlas tier:
Redis provider:
Concurrent users:
Duration:
Error rate:
p50 / p95 / p99:
Slowest endpoint:
MongoDB connections:
MongoDB slow queries:
Render CPU / memory:
Decision:
Next action:
```

## Current Status

Code and contract checks are ready. Real high-concurrency certification is still pending because it requires live infrastructure, credentials, and a staging/prod-like environment.

## Acceptance Checks Added

Run:

```bash
npm run smoke:qa-phase17
npm run smoke:load-tests
```

## Conclusion

Phase 17/18 is delivered as a repeatable QA and load-testing framework. The next production step is to run the staged k6 tests on upgraded infrastructure, then tune Render, MongoDB, Redis, and the slowest endpoints using the recorded data.
