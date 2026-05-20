# 02 System Architecture - منصة المئة

Date: 2026-05-13  
Branch: `complete-platform-production-v1`  
Scope: Phase 2 architecture blueprint only. No UI/UX or runtime behavior changes are included in this phase.

## Executive Summary

This architecture keeps the current product and UI intact while hardening the platform for staged production scaling toward `10,000+` concurrent students. The platform must not be described as 10k-ready until the Redis, queue, pagination, atomic-access, database-pooling, monitoring, and load-test gates are implemented and measured.

The target architecture is additive:

- Keep the current React/Vite UI and route structure.
- Keep the existing Express/MongoDB backend as the core API.
- Add Redis as shared infrastructure for multi-instance safety.
- Move heavy and bulk work to BullMQ workers.
- Standardize pagination and atomic access changes.
- Prove capacity through staged load testing before large launch.

## Non-Negotiable Preservation Rules

- No visual redesign, color changes, layout rewrites, or broad Tailwind changes.
- No deletion of working files or major logic without explicit owner approval.
- Backend/security/performance work must be injected in small, testable slices.
- Any public/student/admin page touched in later phases must pass automated checks and browser visual verification.
- Existing user subscription arrays remain supported during migration so current access does not break.

## Production Infrastructure Target

| Layer | Target Decision | Purpose |
|---|---|---|
| Frontend | Vercel static React/Vite app | Fast CDN delivery for public/student/admin UI |
| API | Render web service with multiple instances | Horizontal API scaling after state is externalized |
| Database | MongoDB Atlas dedicated tier | Durable data store, backups, slow-query monitoring |
| Redis | Managed Redis, preferably Upstash or Render-compatible Redis | Shared rate limits, queues, Socket.IO adapter, optional cache |
| Queue Workers | Render background worker service | Process email, WhatsApp, reports, and maintenance jobs |
| Monitoring | Sentry or equivalent + uptime checks + structured logs | Production visibility and incident response |

Required environment variables in later implementation phases:

- `REDIS_URL`
- `MONGODB_URI`
- `JWT_SECRET`
- `CLIENT_URL`
- `CORS_ALLOWED_ORIGINS`
- `SENTRY_DSN`
- `EMAIL_PROVIDER`, `RESEND_API_KEY` or equivalent
- `WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
- `PAYMENT_WEBHOOK_SECRET`

## Redis Backbone

Redis is the first shared production primitive because the current backend has memory-local state that will not work correctly across multiple API instances.

Required packages for later phases:

- `ioredis`
- `rate-limit-redis`
- `bullmq`
- `@socket.io/redis-adapter`

Redis responsibilities:

- Distributed API rate limiting for all sensitive endpoints.
- BullMQ queue broker for background jobs.
- Socket.IO pub/sub adapter for multi-instance rooms/events.
- Optional cache for safe public summary data after load testing.

Redis must not store:

- Correct quiz answers.
- Raw password reset or verification tokens.
- User-specific access decisions unless TTL and invalidation are explicitly implemented.
- Payment secrets or provider credentials.

## API Route Map

Auth and account:

- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/me`
- `/api/auth/me/preferences`
- `/api/auth/me/redeem-access-code`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/email/verify`
- `/api/auth/email/resend-verification`
- `/api/auth/admin/users`

Taxonomy and learning structure:

- `/api/taxonomy/bootstrap`
- `/api/taxonomy/paths`
- `/api/taxonomy/levels`
- `/api/taxonomy/subjects`
- `/api/taxonomy/sections`
- `/api/taxonomy/skills`

Content and learning materials:

- `/api/content/bootstrap`
- `/api/content/topics`
- `/api/content/lessons`
- `/api/content/library`
- `/api/content/groups`
- `/api/content/b2b-packages`
- `/api/content/access-codes`
- `/api/content/announcement-ads`
- `/api/content/homepage-settings`
- `/api/content/platform-font-settings`

Courses:

- `/api/courses`
- `/api/courses/:id`

Quizzes and reports:

- `/api/quizzes`
- `/api/quizzes/questions`
- `/api/quizzes/:id/submit`
- `/api/quizzes/question-attempts`
- `/api/quizzes/results`
- `/api/quizzes/results/scoped`
- `/api/quizzes/results/latest`
- `/api/quizzes/skill-progress`

Payments and access:

- `/api/payments/settings`
- `/api/payments/requests`
- `/api/payments/requests/:id/review`
- `/api/payments/discount-codes`
- `/api/payments/discount-codes/preview`
- `/api/payments/webhooks/payment`

Notifications:

- `/api/notifications/me`
- `/api/notifications/:id/read`
- `/api/notifications/admin/templates`
- `/api/notifications/admin/deliveries`
- `/api/notifications/admin/send`
- `/api/notifications/admin/process-pending`

Operations, backup, monitoring:

- `/api/health`
- `/api/health/live`
- `/api/health/ready`
- `/api/operations/status`
- `/api/operations/audit`
- `/api/operations/client-events`
- `/api/operations/admin-audit-logs`
- `/api/backups/learning/*`
- `/api/seo/*`

## RBAC Model

Admin:

- Full platform management.
- Can manage users, content, packages, payments, reports, notifications, settings, and operations.
- All admin actions must be audit logged.

Supervisor:

- Manages assigned school, group, path, or subject scope only.
- Can view scoped students and reports.
- Can manage scoped groups/packages/access codes where explicitly allowed.
- Cannot approve platform-wide payment/security settings unless promoted to admin.

Teacher:

- Manages owned or assigned content.
- Can view assigned students and scoped reports.
- Can create follow-up quizzes for managed path/subject scope.
- Cannot access unrelated student, school, payment, or admin data.

Parent:

- Can view linked student progress and reports only.
- Cannot modify quizzes, content, packages, or unrelated students.

Student:

- Can access own profile, enrolled paths, unlocked content, attempts, results, notifications, and payment requests.
- Cannot self-unlock paid content.
- Cannot create quiz results directly.
- Cannot submit `isCorrect`; correctness is always server-calculated.

Guest:

- Can view public homepage, public packages, public learning previews, public SEO pages, and login/register flows.
- Cannot access private reports, attempts, payments, or dashboards.

## Pagination Policy

Every list endpoint must adopt a shared contract in implementation phases:

Required pagination response shape:

Query:

```text
page=1
limit=20
```

Derived:

```text
skip = (page - 1) * limit
```

Response:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

Default limits:

- Public/student lists: `20`
- Admin tables: `50`
- Export jobs: queued, not normal unbounded HTTP responses
- Hard maximum: `200` unless a route has a documented reason

Endpoints that must be converted early:

- Admin users.
- Payment requests.
- Discount codes.
- Quiz results.
- Scoped report results.
- Skill progress.
- Notification templates and deliveries.
- Audit logs and client events.

## Atomic Access Architecture

Current state:

- Direct learner purchase unlock is disabled.
- Access-code use count is reserved with atomic `findOneAndUpdate`.
- Payment webhook approval verifies signature and duplicate event id.
- Some user purchase/application flows still mutate documents and call `save()`.

Target state:

- Add `AccessGrant` records as the durable access ledger.
- Keep current user subscription arrays as compatibility mirrors during migration.
- All grant creation must use idempotency keys.
- All payment approval/webhook/code-redemption transitions must use preconditioned atomic updates.

AccessGrant proposed fields for later implementation:

- `id`
- `userId`
- `sourceType`: `payment_request`, `payment_webhook`, `access_code`, `admin_manual`, `membership`
- `sourceId`
- `packageId`
- `courseIds`
- `contentTypes`
- `pathIds`
- `subjectIds`
- `status`: `active`, `revoked`, `expired`
- `grantedBy`
- `grantedAt`
- `expiresAt`
- `idempotencyKey`

Atomic rules:

- Never use `findById` then `save()` for final access granting.
- Use `$addToSet` for package/course mirrors.
- Use `status: "pending"` preconditions for approvals.
- Use unique idempotency indexes for webhook event ids and grant keys.
- Record an audit log for every access grant, reject, revoke, and duplicate event.

## Queue Architecture

Queues:

- `notifications`
- `email`
- `whatsapp`
- `reports`
- `audit-maintenance`

Job payload minimum:

```json
{
  "jobId": "stable-idempotency-key",
  "type": "notification.email.send",
  "actorId": "user-or-system",
  "targetIds": ["user-id"],
  "deliveryId": "notification-delivery-id",
  "metadata": {}
}
```

Retry policy:

- Email/WhatsApp: 3 attempts with exponential backoff.
- Reports/PDF: 2 attempts unless the failure is validation-related.
- Maintenance: 1 to 3 attempts depending on task.

Failure handling:

- Store final failure reason on `NotificationDelivery` or matching report/audit record.
- Do not retry validation failures endlessly.
- Worker logs must include `jobId`, `queueName`, `attempt`, and `requestId` when available.

HTTP behavior:

- Bulk notification endpoints create delivery records and queue jobs.
- They return `202 Accepted`.
- They never call external providers for hundreds of users inside the request.

## Caching Strategy

Allowed now:

- Short in-process cache for public bootstrap and summary endpoints already present.
- Immutable Vercel cache for hashed frontend assets.

Allowed after Redis foundation:

- Redis cache for public taxonomy/content summaries with short TTL.
- Redis cache for quiz list summaries that do not include correct answers.
- Redis cache for public package lists.

Never cache:

- User-specific permissions without explicit invalidation.
- Quiz correct answers before submission.
- Payment review decisions without strong invalidation.
- Admin user lists with sensitive data.

Invalidation:

- Taxonomy mutations clear taxonomy cache.
- Content mutations clear content cache.
- Package/payment/access changes invalidate access-related summaries.
- Quiz/question changes invalidate quiz/question summary caches.

## Database Hardening

Connection settings for later implementation:

- `maxPoolSize`: start with `20` to `50` per API instance, tune from Atlas metrics.
- `minPoolSize`: `2` to keep warm connections on paid Render services.
- `serverSelectionTimeoutMS`: `5000`.
- `socketTimeoutMS`: `45000`.
- `maxIdleTimeMS`: `60000`.

Connection logs:

- Connected.
- Disconnected.
- Reconnected.
- Error.
- Slow startup or readiness failure.

Index policy:

- Keep existing indexes.
- Add new indexes only when required by known high-volume queries or slow-query evidence.
- Avoid compound indexes with multiple array fields.
- Build indexes during low-traffic windows.
- Document every index added in `03_DATABASE_SCHEMA_REPORT.md`.

## Deployment Scaling Model

Phase 1 production pilot:

- One paid Render API instance.
- MongoDB Atlas dedicated/shared paid tier.
- Managed Redis configured.
- Queue worker can run as one service.
- Load test up to 100 concurrent students.

Phase 2 school launch:

- Two or more Render API instances.
- One or more queue workers.
- Redis-backed rate limiting and Socket.IO.
- Load test 500 and 1000 concurrent students.

Phase 3 high-scale launch:

- Multiple API instances sized from p95 latency and CPU.
- Separate workers for notifications and reports if needed.
- MongoDB Atlas tier upgraded based on connection count, CPU, IOPS, and slow queries.
- Load test beyond 1000 in staged increments before any 10k claim.

## Monitoring And Readiness

Required production signals:

- `/api/health/live` for process liveness.
- `/api/health/ready` for MongoDB readiness.
- Redis readiness once Redis is added.
- Queue depth and failed job counts.
- Slow API logs.
- MongoDB slow-query dashboard.
- Sentry frontend/backend errors.
- Uptime monitor for frontend and backend.
- Admin audit logs for sensitive actions.

Recommended alert thresholds:

- API p95 > 1500 ms for five minutes.
- Error rate > 2 percent.
- MongoDB connection saturation > 80 percent.
- Queue failed jobs > 10 in 10 minutes.
- Queue waiting jobs growing for more than 10 minutes.
- Health ready endpoint returns non-200.

## Migration Order

1. Redis foundation.
   - Add Redis config and health check.
   - Add `ioredis`.
   - Do not change UI.

2. Distributed rate limits.
   - Add `rate-limit-redis`.
   - Keep current route limits.
   - Change only the store backing the limiter.

3. MongoDB pooling.
   - Add explicit connection options and lifecycle logs.
   - Verify health readiness still works.

4. Pagination contract.
   - Convert highest-risk list endpoints first.
   - Preserve frontend compatibility by keeping existing field names where needed during transition.

5. Atomic access grants.
   - Add `AccessGrant`.
   - Convert payment approval, webhook approval, and access-code redemption.
   - Mirror to current user subscription arrays with `$addToSet`.

6. BullMQ queues.
   - Add queue infrastructure.
   - Move email/WhatsApp delivery to workers.
   - Keep existing delivery records.

7. Socket.IO Redis adapter.
   - Add adapter only after Redis is stable.
   - Verify rooms/events across instances.

8. Load testing after each major backend slice.
   - 100 users after Redis/rate limits.
   - 500 users after pagination/access hardening.
   - 1000 users after queues and DB pooling.
   - Higher only after metrics are clean.

## Acceptance Gates For Future 10k Claim

The platform may only be described as ready for `10,000+` concurrent students after:

- Redis-backed rate limits are active.
- BullMQ workers handle all heavy/bulk jobs.
- MongoDB connection pooling is configured and measured.
- Every large list endpoint is paginated.
- Access grants are atomic and idempotent.
- Socket.IO uses Redis adapter if real-time features are used at scale.
- Load tests pass staged targets with acceptable p95/p99 latency and low error rate.
- MongoDB Atlas and Render metrics confirm capacity.
- Monitoring and alerting are active.

## Phase 2 Conclusion

The architecture path is clear: keep the current platform experience, add shared production infrastructure, remove unbounded API patterns, make access changes atomic, and prove scale through measured tests. Phase 3 should start with database schema/reporting work that prepares `AccessGrant`, pagination readiness, indexes, and MongoDB connection hardening without changing the UI.
