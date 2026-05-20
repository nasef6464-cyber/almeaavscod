# Load Testing

These scripts are for staging or production-like environments only. Do not run the 500/1000 user stages against a free Render instance and then treat the result as a product failure.

## k6 Platform Journey

Install k6 locally, then run:

```bash
k6 run load-tests/k6-platform-journey.js \
  -e API_BASE=https://YOUR_RENDER_SERVICE.onrender.com/api \
  -e STUDENT_EMAIL=student@example.com \
  -e STUDENT_PASSWORD=StrongPassword123 \
  -e QUIZ_ID=quiz_id_optional \
  -e QUIZ_SOURCE=training
```

The script covers:

- `/api/health`
- `/api/content/bootstrap`
- `/api/taxonomy/bootstrap`
- `/api/auth/login`
- `/api/auth/me`
- `/api/quizzes/results`
- optional `/api/quizzes/:id/submit`

## Readiness Rules

- 100 concurrent users: pilot readiness.
- 500 concurrent users: paid launch minimum after Render and MongoDB are upgraded.
- 1000 concurrent users: scaling decision gate.
- 10k users: requires staged tests, queue-backed notifications, upgraded Render/MongoDB, and repeated successful runs.

Save each run summary in `load-tests/results/` and update `LOAD_TEST_REPORT.md` with the p95/p99 latency, error rate, Render CPU/memory, MongoDB connection count, and slow query notes.

## Run Recording Template

Copy this block into the final report after each real run:

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

## Do Not Skip

- Warm the backend once before the official run if the instance has been sleeping.
- Keep one run with a cold backend recorded separately so the owner understands real first-open behavior.
- Do not run 500/1000 virtual users against a free Render service and treat that as a platform limit.
- Do not claim 10k readiness until repeated runs pass on upgraded infrastructure.
