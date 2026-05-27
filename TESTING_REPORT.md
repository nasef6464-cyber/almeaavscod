# Testing Report

This file summarizes the current delivery checks for the platform. The detailed Phase 17/18 QA and load-testing plan is in `17_18_TESTING_REPORT.md`.

## Required Before Deployment

```bash
npm run typecheck
npm run build
npm --prefix server run check
npm --prefix server run build
```

## Security And Business Logic Checks

```bash
npm run smoke:api-security
npm run smoke:security-rbac-phase6
npm run smoke:quiz-client-security
npm run smoke:exam-payment-phase8
npm run smoke:package-course-split
npm run smoke:payment-providers
```

## Performance And Production Checks

```bash
npm run smoke:performance
npm run smoke:deployment-cache
npm run smoke:health-readiness
npm run smoke:monitoring
npm run smoke:production-ops-phase14
npm run smoke:load-tests
npm run smoke:qa-phase17
```

## Load Testing

Use k6 from `load-tests/k6-platform-journey.js` against staging or production-like infrastructure. Do not use a sleeping/free Render service as the basis for capacity decisions.

The platform should not be described as ready for `10,000+` concurrent students until repeated staged load tests prove the target with upgraded Render, MongoDB Atlas, and Redis.
