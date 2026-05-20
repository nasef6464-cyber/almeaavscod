# Phase 19/20 - Deployment And Final Handover Report

Scope: deployment and owner handover only. No UI/UX changes were made.

## Current Deployment Shape

- Frontend: Vercel.
- Backend: Render web service.
- Database: MongoDB Atlas.
- Shared scale backbone: Managed Redis for rate limiting, BullMQ queues, and Socket.IO scaling.
- Repository branch for this production-hardening work: `complete-platform-production-v1`.

The platform is production-shaped, but it must not be announced as `10,000+` concurrent-student ready until the staged load tests pass on upgraded infrastructure.

## Required Vercel Settings

Project root:

```text
.
```

Build command:

```text
npm run build
```

Output directory:

```text
dist
```

Required environment variable:

```text
VITE_API_URL=https://YOUR_RENDER_SERVICE.onrender.com/api
```

Cache policy:

- Hashed assets should be cached with long immutable caching.
- The SPA shell should stay fresh with `no-cache`.
- Run `npm run smoke:deployment-cache` before changing cache rules.

## Required Render Settings

Root directory:

```text
server
```

Build command:

```text
npm install && npm run build
```

Start command:

```text
npm start
```

Health check path:

```text
/api/health/ready
```

Core environment variables:

```text
NODE_ENV=production
PORT=10000
CLIENT_URL=https://YOUR_VERCEL_DOMAIN
CORS_ALLOWED_ORIGINS=https://YOUR_VERCEL_DOMAIN
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<long random secret>
JWT_EXPIRES_IN=7d
DEV_LOCAL_ADMIN_BYPASS=false
```

Scale environment variables:

```text
REDIS_URL=redis://...
REDIS_KEY_PREFIX=almeaa
RATE_LIMIT_REDIS_ENABLED=true
NOTIFICATION_QUEUE_ENABLED=true
NOTIFICATION_QUEUE_CONCURRENCY=5
```

Operational logs:

```text
REQUEST_LOG_LEVEL=normal
SLOW_REQUEST_LOG_MS=1000
```

Use `REQUEST_LOG_LEVEL=debug` only briefly during diagnosis.

## Provider Credentials Needed Later

Email:

```text
EMAIL_PROVIDER=resend|http
EMAIL_FROM=...
RESEND_API_KEY=...
EMAIL_WEBHOOK_URL=...
EMAIL_WEBHOOK_TOKEN=...
```

WhatsApp:

```text
WHATSAPP_PROVIDER=whatsapp_cloud|http
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_WEBHOOK_URL=...
WHATSAPP_WEBHOOK_TOKEN=...
```

AI:

```text
AI_PROVIDER=gemini|openrouter|qwen|deepseek|openai|none
AI_PROVIDER_ORDER=gemini,openrouter,qwen,deepseek,openai
AI_REQUEST_TIMEOUT_MS=15000
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
QWEN_API_KEY=...
DEEPSEEK_API_KEY=...
OPENAI_API_KEY=...
```

Payments:

```text
PAYMENT_WEBHOOK_SECRET=<gateway webhook secret>
```

Monitoring:

```text
SENTRY_DSN=<optional future error tracking dsn>
```

Do not commit any of these values to Git.

## MongoDB Atlas Checklist

Before giving the platform to real students:

1. Use a dedicated Atlas tier sized from load-test results.
2. Enable automated backups.
3. Enable slow query monitoring.
4. Verify indexes finish building after deployment.
5. Run one restore test against staging.
6. Keep database credentials only in Render.

## Redis Checklist

Redis is required for high-scale deployment:

- Distributed rate limiting across Render instances.
- BullMQ background notification delivery.
- Socket.IO adapter if realtime is scaled across instances.

Use a managed Redis provider compatible with Render. Do not use memory-only rate limiting for multi-instance production.

## Pre-Launch Commands

Run locally before pushing a release:

```bash
npm run smoke:qa-phase17
npm run smoke:production-ops-phase14
npm run smoke:deployment-cache
npm run smoke:health-readiness
npm run smoke:monitoring
npm run smoke:api-security
npm run smoke:security-rbac-phase6
npm run smoke:quiz-client-security
npm run smoke:exam-payment-phase8
npm run smoke:package-course-split
npm run smoke:payment-providers
npm run smoke:load-tests
npm run typecheck
npm run build
npm --prefix server run check
npm --prefix server run build
```

## Post-Deployment Smoke

After Render and Vercel finish deploying:

1. Open the Vercel frontend.
2. Check backend:

```text
https://YOUR_RENDER_SERVICE.onrender.com/api/health/live
https://YOUR_RENDER_SERVICE.onrender.com/api/health/ready
```

3. Confirm login works for admin and student test users.
4. Open one learning path.
5. Submit one quiz on staging.
6. Open the admin financial/payment settings.
7. Confirm no slow or failed request flood appears in Render logs.

## Rollback

If a deployment causes a critical issue:

1. Revert the Vercel deployment to the previous successful deployment.
2. Roll Render back to the previous Git commit or redeploy the previous commit.
3. Do not restore MongoDB unless data was corrupted.
4. If data was corrupted, restore to staging first, inspect, then decide on production restore.

## Capacity Statement

Current codebase status:

- Suitable for controlled pilot after deployment checks.
- Not certified for `10,000+` concurrent users until measured load tests prove it.
- The path to `10,000+` requires upgraded Render, MongoDB Atlas, managed Redis, queues enabled, and repeated staged load tests.

## Final Owner Notes

- Keep UI changes frozen unless requested.
- Keep all secrets in Vercel, Render, MongoDB Atlas, and provider dashboards.
- Run backups before major content imports.
- Treat load-test reports as the source of truth for scaling decisions.
- Keep this handover file updated after every infrastructure change.
