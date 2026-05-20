# Production Smoke Checks

This project has two quick production checks for the Vercel frontend and Render API.

## Regular Check

```bash
npm run smoke:frontend
```

Checks that:

- Render API health is reachable.
- MongoDB is connected from the API.
- Vercel serves the frontend shell.
- Main hash routes return the SPA shell.
- The deployed entry asset can be downloaded.
- The deployed asset is inspected for the current local commit/version.

If the output includes `WARN production deployment is stale`, the site is reachable and Render is responding, but Vercel is still serving an older deployment or cache. Redeploy the production deployment from the `main` branch or wait for Vercel to finish, then run the strict check.

## Strict Check

```bash
npm run smoke:frontend:strict
```

Use this after Vercel says the deployment is complete. It fails if the production asset does not include the current Git commit/version, which is the clearest sign that the browser is still seeing an older frontend build.

## Useful Environment Overrides

```bash
SMOKE_FRONTEND_URL=https://almeaacodax.vercel.app npm run smoke:frontend
SMOKE_API_URL=https://almeaacodax-k2ux.onrender.com/api npm run smoke:frontend
SMOKE_EXPECT_VERSION=2e9950d npm run smoke:frontend:strict
```

On Windows PowerShell:

```powershell
$env:SMOKE_EXPECT_VERSION="2e9950d"; npm run smoke:frontend:strict
```
