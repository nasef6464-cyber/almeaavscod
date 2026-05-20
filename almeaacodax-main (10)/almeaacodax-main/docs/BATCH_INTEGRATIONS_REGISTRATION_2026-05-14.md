# Batch Closeout - Integrations & Registration Control (2026-05-14)

## Scope Closed in This Batch

1. Added a full admin module to manage integrations and registration policy.
2. Added backend persistence for integration settings.
3. Added integration readiness endpoint for production credential verification.
4. Verified production role journeys through API (admin/supervisor/student/parent).
5. Re-ran build and smoke contracts.

## Backend Changes

- New model:
  - `server/src/models/PlatformIntegrationSettings.ts`
- Updated route:
  - `server/src/routes/content.routes.ts`
    - `GET /api/content/platform-integrations` (admin)
    - `PATCH /api/content/platform-integrations` (admin)
- Updated environment schema:
  - `server/src/config/env.ts`
  - Added:
    - `GOOGLE_CLIENT_ID`
    - `GOOGLE_CLIENT_SECRET`
    - `GOOGLE_REDIRECT_URI`
    - `GOOGLE_OAUTH_ENABLED`
    - `SENTRY_DSN`
    - `SENTRY_ENVIRONMENT`
    - `SENTRY_TRACES_SAMPLE_RATE`
- Updated env example:
  - `server/.env.example`

## Monitoring / Readiness Changes

- Updated route:
  - `server/src/routes/operations.routes.ts`
  - Added:
    - `GET /api/operations/integrations-readiness` (admin)
- Readiness covers:
  - Google OAuth
  - Email provider
  - WhatsApp provider
  - Sentry
  - Managed Redis

## Frontend Changes

- New admin manager:
  - `dashboards/admin/PlatformIntegrationsManager.tsx`
- Integrated into admin dashboard:
  - `dashboards/admin/AdminDashboard.tsx`
  - New tab: `platform-integrations`
  - Label: "إدارة التكاملات والتسجيل"
- API client updates:
  - `services/api.ts`
  - Added:
    - `getPlatformIntegrations`
    - `updatePlatformIntegrations`
    - `getIntegrationsReadiness`

## Deployment/Runbook Updates

- Updated:
  - `DEPLOYMENT_GUIDE.md`
- Added production credential section and readiness endpoint usage.

## Verification Results

- Build and type checks:
  - `npm run typecheck` ✅
  - `npm run build` ✅
  - `npm --prefix server run build` ✅
- Contracts:
  - `npm run smoke:frontend:strict` ✅
  - `npm run smoke:api-phase4` ✅
  - `npm run smoke:monitoring` ✅
- Production role API verification:
  - Vercel web shell reachable: `200` ✅
  - Admin login + core scoped calls ✅
  - Supervisor login + core scoped calls ✅
  - Student login + core scoped calls ✅
  - Parent login + core scoped calls ✅

## Notes / Limits

- In this environment, direct in-app browser role automation tooling was not available, so role end-to-end was verified through live production API journeys and route shell checks.
- OAuth/WhatsApp/Sentry require owner-provided real credentials to become fully active in production.

## Next Immediate Steps

1. Set production env vars in Render for Google/Email/WhatsApp/Sentry/Redis.
2. Open admin:
   - `#/admin-dashboard?tab=platform-integrations`
3. Configure providers and registration fields.
4. Check:
   - `GET /api/operations/integrations-readiness`
   - status should become `ready`.
