# Monitoring And Logging Guide

## 2026-05-13 Cold Start Hardening

- Backend startup now opens the HTTP listener immediately after MongoDB connects.
- Non-critical startup maintenance (`ensureSkillTaxonomy` and `ensureAdminAccount`) runs in the background through `runStartupMaintenance`.
- This reduces Render cold-start wait time for real users while still logging maintenance failures for operators.
- MongoDB remains a hard dependency before listening; Redis remains reported through `/api/health` and `/api/health/ready`.
- `/api/health/ready` is the operational readiness probe: it returns 200 when MongoDB is connected even if Redis is still missing, while still reporting Redis warnings.
- `/api/health/scale-ready` is the high-concurrency gate: it returns 503 until Redis-backed rate limits and queues are configured for multi-instance scale.

## 2026-05-13 Public Bootstrap Browser Cache

- The frontend now keeps a short session cache for public bootstrap calls only:
  - taxonomy bootstrap,
  - content bootstrap,
  - homepage settings,
  - public announcement ads.
- Cached data is returned immediately on repeat visits, then refreshed in the background.
- Authenticated/admin reads still use fresh server requests where required.

## 2026-05-13 Production Speed Smoke

- Run `npm run smoke:production-speed` after each deployment to measure the real Vercel and Render URLs.
- The smoke checks frontend shell time, entry asset time, API health, readiness, taxonomy bootstrap, content bootstrap, and announcement ads.
- Timing warnings do not automatically mean the site is broken; they identify the next bottleneck to optimize.
- Redis warnings mean the app is live, but not ready for multi-instance high-concurrency scale until `REDIS_URL` is configured.

## 2026-05-13 Operations Audit Cache

- Admin operations audit now uses a short 30-second in-process cache and shares one pending audit promise between concurrent requests.
- This protects MongoDB when the admin dashboard opens multiple readiness panels or when an operator refreshes repeatedly.
- The cache only affects operational diagnostics; student-facing content and security checks still use their normal route-level data rules.
- The audit scan now uses field projections, and lesson content is reduced to a `contentPresent` flag so large lesson bodies are not loaded for diagnostics.

## 2026-05-13 Content Bootstrap Concurrency Guard

- Public content bootstrap now shares one pending load between concurrent anonymous visitors while the cache is warming.
- Public announcement ads inside bootstrap are capped to the display-sized set; admin management routes still keep full access.
- This reduces duplicate MongoDB work during traffic spikes without changing the UI or hiding student learning content.

## 2026-05-13 Operations Status Cache

- `/api/operations/status` now uses a short 30-second cache and shares one pending status build between concurrent admin requests.
- This endpoint scans learning inventory for admin readiness, so caching prevents repeated full inventory scans while an admin dashboard is opening.
- The response includes `X-Operations-Status-Cache` with `hit`, `miss`, or `shared` to make behavior visible in diagnostics.
- The status scan now uses MongoDB field projections so it does not load large lesson bodies or unused document fields into memory.

## Current Status

The backend now has production-safe request diagnostics for API failures and slow endpoints.

Implemented:

- `/api/health` returns API and MongoDB connection status.
- `requestLogger` writes structured JSON log lines for failed requests, slow requests, and debug-level request tracing.
- Slow request threshold is configurable with `SLOW_REQUEST_LOG_MS`.
- Routine health checks are not logged unless they fail, become slow, or `REQUEST_LOG_LEVEL=debug`.
- Request bodies, passwords, tokens, cookies, and authorization headers are not logged.
- Every API response includes an `x-request-id` header. The same request ID appears in slow/error logs and JSON error responses.

## Environment Variables

Set these in Render:

```text
REQUEST_LOG_LEVEL=normal
SLOW_REQUEST_LOG_MS=1000
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://almeaacodax.vercel.app
```

Use `REQUEST_LOG_LEVEL=debug` only during short investigations because it logs successful non-slow requests too.

## Log Shape

Example slow request log:

```json
{
  "level": "warn",
  "event": "http_request",
  "method": "GET",
  "path": "/api/content/bootstrap",
  "statusCode": 200,
  "durationMs": 1350.25,
  "slowThresholdMs": 1000,
  "requestId": "request-id",
  "userId": "student-id",
  "role": "student",
  "ip": "client-ip"
}
```

## How To Diagnose Vercel Or Render Slowness

1. Open the site from Vercel and reproduce the slow page.
2. Check Render logs for `event=http_request`.
3. If no slow backend logs appear, the delay is likely frontend bundle size, browser cache, network, or Render cold start before the request reaches Express.
4. If slow backend logs appear, note `path`, `durationMs`, and user role, then optimize that endpoint or MongoDB query.
5. During a short investigation, temporarily set `REQUEST_LOG_LEVEL=debug`, reproduce once, then set it back to `normal`.

## Health Check

Use:

```bash
curl https://YOUR_RENDER_SERVICE.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

## Still Needed Before Large Launch

- Connect Sentry or another error tracker with `SENTRY_DSN`.
- Add uptime monitoring from an external service.
- Add MongoDB Atlas slow-query monitoring and index review after real load tests.
- Add alert rules for repeated 5xx responses, high latency, and database disconnects.
