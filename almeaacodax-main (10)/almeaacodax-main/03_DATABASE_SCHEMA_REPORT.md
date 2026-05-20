# 03 Database Schema Report - منصة المئة

Date: 2026-05-13  
Branch: `complete-platform-production-v1`  
Scope: Phase 3 database model and connection hardening only. No UI/UX changes were made.

## Executive Summary

This phase prepares the database layer for production hardening without changing current student/admin behavior. It adds a future-safe access ledger, explicit MongoDB connection pooling controls, and a shared pagination contract for later API work.

The current user subscription arrays remain untouched for compatibility. Phase 4 and Phase 8/9 can gradually move approval, webhook, and access-code flows to atomic `AccessGrant` records while continuing to mirror access into the existing user fields.

## Changes Delivered

### 1. New `AccessGrant` Model

Added `server/src/models/AccessGrant.ts`.

Purpose:

- Create a durable ledger for paid/free access grants.
- Support payment approvals, payment webhooks, access codes, manual admin grants, and memberships.
- Make future access changes atomic and idempotent.
- Avoid relying only on mutable arrays inside the `User` document.

Schema structure:

| Field | Purpose |
|---|---|
| `id` | Public stable grant id |
| `userId` | Student/user receiving access |
| `sourceType` | `payment_request`, `payment_webhook`, `access_code`, `admin_manual`, `membership` |
| `sourceId` | Payment request id, webhook event id, access code id, or admin action id |
| `packageId` | Package opened by the grant |
| `courseIds` | Course ids opened by the grant |
| `contentTypes` | `courses`, `foundation`, `banks`, `tests`, `library`, `all` |
| `pathIds` | Scoped path access |
| `subjectIds` | Scoped subject access |
| `status` | `active`, `revoked`, `expired` |
| `grantedBy` | Actor/system that created the grant |
| `grantedAt` | Grant timestamp |
| `expiresAt` | Optional expiry |
| `revokedAt`, `revokedBy`, `revokeReason` | Future revoke audit fields |
| `idempotencyKey` | Unique key preventing duplicate grants |
| `metadata` | Provider/audit details |

Indexes added:

- Unique `id`.
- Unique `idempotencyKey`.
- Unique `{ sourceType, sourceId }`.
- `{ userId, status, grantedAt }`.
- `{ userId, packageId, status }`.
- `{ userId, contentTypes, status }`.
- `{ userId, pathIds, status }`.
- `{ userId, subjectIds, status }`.
- `{ status, expiresAt }`.
- `{ packageId, status, grantedAt }`.

Why this matters:

- Repeated webhook delivery can map to the same source/idempotency key.
- Double-click approval can be rejected by atomic uniqueness.
- Future reports can audit who got access, when, why, and from which payment/code.

### 2. MongoDB Connection Pooling

Updated:

- `server/src/config/env.ts`
- `server/src/config/db.ts`

New environment controls:

- `MONGODB_MAX_POOL_SIZE` default `30`
- `MONGODB_MIN_POOL_SIZE` default `2`
- `MONGODB_SERVER_SELECTION_TIMEOUT_MS` default `5000`
- `MONGODB_SOCKET_TIMEOUT_MS` default `45000`
- `MONGODB_MAX_IDLE_TIME_MS` default `60000`

Connection behavior:

- `mongoose.set("strictQuery", true)` remains active.
- `mongoose.connect` now receives explicit pooling/timeouts.
- Connection lifecycle listeners log:
  - connected,
  - disconnected,
  - reconnected,
  - error.

Why this matters:

- Multiple Render instances need predictable MongoDB connection usage.
- Atlas connection saturation becomes easier to reason about.
- Readiness failures become easier to diagnose.

### 3. Pagination Setup Utility

Added `server/src/utils/pagination.ts`.

Purpose:

- Standardize the future list API contract before converting routes in Phase 4.
- Prevent each route from inventing a different pagination shape.

Exports:

- `paginationQuerySchema`
- `resolvePagination`
- `buildPaginatedResponse`

Standard query:

```text
page=1
limit=20
```

Standard response:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

Rules:

- Default `limit` is `20`.
- Maximum `limit` is `200`.
- Large exports should become queued jobs, not unbounded API responses.

## Existing Models Reviewed

The following model groups already have useful indexing and remain unchanged in this phase:

- Users and role/school/group access.
- Courses and packages.
- Topics, lessons, library items.
- Questions, quizzes, quiz results, attempts, and skill progress.
- Payment requests and discount codes.
- Notification templates and deliveries.
- Admin audit logs, AI interactions, and client events.

No destructive schema migration was introduced.

## Compatibility Notes

- Current `User.subscription.purchasedCourses` and `User.subscription.purchasedPackages` remain intact.
- Existing access checks continue to work as before.
- `AccessGrant` is not wired into routes yet; that belongs to Phase 4 and Phase 8/9.
- No frontend API contract changed in this phase.
- No UI visual behavior changed.

## Phase 4 Readiness

Phase 4 should use the new database setup to:

1. Convert large list endpoints to `resolvePagination` and `buildPaginatedResponse`.
2. Convert payment approval/webhook/access-code grant paths to atomic `AccessGrant` creation.
3. Mirror successful grants to existing user subscription arrays with `$addToSet`.
4. Keep every transition idempotent through `idempotencyKey` and `{ sourceType, sourceId }`.
5. Add backend tests proving duplicate approval/webhook/code attempts do not duplicate access.

## Verification

Executed successfully:

- `npm --prefix server run build`
- `npm --prefix server run check`
- `npm run smoke:database`
- `npm run smoke:production-audit`
- `npm run smoke:load-tests`

`smoke:database` now verifies:

- Existing learning/payment/operations indexes.
- New `AccessGrant` ledger indexes.
- MongoDB pooling environment/config usage.
- Shared pagination utility contract.

## Phase 3 Conclusion

The database layer now has the schema foundation needed for atomic access grants, safer production MongoDB pooling, and route pagination standardization. This phase intentionally stops before changing business routes or UI behavior.

Do not proceed to Phase 4 until the owner approves.
