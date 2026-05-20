# Security Checklist

## Critical Access Rules

- Learners cannot unlock paid courses or packages through a direct purchase API.
- Quiz results must be generated through server-side quiz submission.
- Question correctness must be computed by the server.
- Access-code redemption must be atomic.
- Paid/free visibility is controlled from learning-space placement settings.
- Foundation topic paid/free visibility is controlled by the topic itself.
- Sensitive admin and blocked access events must be written to admin audit logs.
- Legacy Firebase sync is development-only and cannot become a production source of truth.
- Local admin bypass is blocked when `NODE_ENV=production`, even if the bypass env flag is accidentally enabled.

## Backend Middleware

- Helmet enabled.
- Compression enabled.
- CORS restricted to configured frontend/local development origins.
- Production CORS can be restricted with `CORS_ALLOWED_ORIGINS`; local dev origins are only added outside `NODE_ENV=production`.
- Request IDs are returned and logged for tracing support tickets and Render logs.
- NoSQL operator/dotted-key sanitizer rejects unsafe keys in API request bodies and query strings before route handlers.
- Global rate limiting enabled with Redis-backed distributed storage when `REDIS_URL` is configured.
- Rate limiters use `passOnStoreError: true` so a temporary Redis outage is logged as an operational issue instead of turning student requests into 500 responses.
- Auth, payment, AI, access-code, and quiz-submit routes have stricter limits through the shared limiter factory.
- `requireRole` re-checks the current MongoDB user role and active state instead of trusting a stale JWT role.
- Socket.IO can use `@socket.io/redis-adapter` when `REDIS_URL` is configured for multi-instance deployment.
- JSON payload limits are route scoped: auth 100kb, quiz/payment/AI 1mb, and general API 5mb.
- Production 5xx responses return a safe generic message with a request ID.

## Remaining Hardening

- Move from localStorage bearer-token reliance to a safer production token strategy.
- Add refresh token rotation and logout invalidation.
- Expand admin audit-log coverage to every admin mutation route.
- Add input validation review for every mutation route.
- Add dependency and secret scanning in CI.
- Verify `DEV_LOCAL_ADMIN_BYPASS=false` in production.
- Keep `DEV_LOCAL_ADMIN_BYPASS=false` in `.env.example`; local overrides stay local only.
- Configure managed Redis before running multiple Render instances.
