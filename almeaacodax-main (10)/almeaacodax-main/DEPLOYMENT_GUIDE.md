# Deployment Guide

Primary operational deployment notes live in `docs/DEPLOYMENT.md`.

## Current Production Targets

- Frontend: Vercel, `https://almeaacodax.vercel.app`
- Backend: Render, `https://almeaacodax-k2ux.onrender.com/api`
- Database: MongoDB Atlas
- Production branch: `main`

## Required Production Checks

Run these before pushing a release intended for students:

```bash
npm run smoke:deployment-cache
npm run smoke:load-tests
npm run smoke:monitoring
npm run smoke:database
npm run smoke:notifications
npm run smoke:auth-account
npm run smoke:auth-frontend
npm run smoke:auth-login-security
npm run smoke:api-security
npm run smoke:runtime-source
npm run smoke:nosql-sanitizer
npm run smoke:performance
npm run typecheck
npm run build
npm --prefix server run build
```

## Vercel Cache Rule

Do not use `Cache-Control: no-store` for all files. Vite builds hashed asset names, so Vercel should cache them aggressively:

- Built assets: `public, max-age=31536000, immutable`
- HTML shell: `no-cache, max-age=0, must-revalidate`

This keeps repeat visits fast while still allowing new deployments to be discovered.

## Load Test Gate

Use `load-tests/k6-platform-journey.js` against staging or production-like infrastructure before claiming high traffic readiness.

```bash
k6 run load-tests/k6-platform-journey.js \
  -e API_BASE=https://YOUR_RENDER_SERVICE.onrender.com/api \
  -e STUDENT_EMAIL=student@example.com \
  -e STUDENT_PASSWORD=StrongPassword123
```

For quiz-submit pressure, add `QUIZ_ID` and `QUIZ_SOURCE`.

## Monitoring And Slow Request Logs

Set these in Render:

- `REQUEST_LOG_LEVEL=normal`
- `SLOW_REQUEST_LOG_MS=1000`

Use `REQUEST_LOG_LEVEL=debug` only briefly when investigating a specific issue. Backend logs now emit structured `http_request` lines for failed and slow API requests without logging request bodies or secrets.

## Redis For Production Scale

Set these in Render before running multiple backend instances or any large launch:

- `REDIS_URL`
- `REDIS_KEY_PREFIX=almeaa`
- `RATE_LIMIT_REDIS_ENABLED=true`
- `NOTIFICATION_QUEUE_ENABLED=true`
- `NOTIFICATION_QUEUE_CONCURRENCY=5`

Redis is used for distributed rate limiting and BullMQ notification queues. Without Redis, local development can still run, but multi-instance production should not rely on memory-only behavior.

## Health Checks

Use these probes in Render, uptime monitors, and release smoke checks:

- `/api/health/live`: checks that the API process is running. It does not require MongoDB.
- `/api/health/ready`: checks that the API is ready to serve real traffic and returns `503` if MongoDB is disconnected. Redis warnings are reported here but do not block normal serving.
- `/api/health/scale-ready`: checks high-concurrency readiness and returns `503` until Redis-backed rate limits/queues are configured.
- `/api/health`: backward-compatible readiness endpoint for existing checks.

The health payload includes service name, environment, app version, short commit when the platform provides one, uptime, timestamp, and database check state. Health routes are excluded from routine logs unless they fail or become slow.

## Notification Provider Setup

For staging-only provider simulation:

- `EMAIL_PROVIDER=resend` with `EMAIL_FROM` and `RESEND_API_KEY`, or `EMAIL_PROVIDER=http` with `EMAIL_WEBHOOK_URL`
- `WHATSAPP_PROVIDER=whatsapp_cloud` with `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`, or `WHATSAPP_PROVIDER=http` with `WHATSAPP_WEBHOOK_URL`
- `EMAIL_PROVIDER=console` and `WHATSAPP_PROVIDER=console` are staging-only smoke modes.

For production, keep these unset until a real provider adapter and credentials are configured. Notification records will still be created and visible in delivery logs.

## External Credentials (Google / Email / WhatsApp / Sentry / Redis)

Set these on Render backend:

- `GOOGLE_OAUTH_ENABLED=true`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `EMAIL_PROVIDER` + provider-specific keys (`RESEND_API_KEY` / `EMAIL_WEBHOOK_URL`)
- `WHATSAPP_PROVIDER` + provider-specific keys (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` or webhook)
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT=production`
- `SENTRY_TRACES_SAMPLE_RATE=0.05` (start low in production)
- `REDIS_URL` and `REDIS_KEY_PREFIX`

Verification endpoint (admin token required):

- `GET /api/operations/integrations-readiness`

This endpoint returns per-integration status (`pass`, `warning`, `fail`) and required env keys so deployment teams can close missing credentials quickly.

## Still Needed For Large Launch

- Upgrade Render away from free cold-start behavior.
- Run measured load tests against 100, 500, and 1000 concurrent users before any 10k-user claim.
- Add queue-backed notification delivery before bulk messaging.
- Keep production secrets in Vercel/Render only, never in Git.
