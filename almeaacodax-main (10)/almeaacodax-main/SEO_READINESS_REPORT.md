# SEO Readiness Report

Date: 2026-05-12

## What Was Closed

- Added runtime route metadata through `SeoRouteMeta` in `App.tsx`.
- Public routes keep `index, follow`; private student/admin flows become `noindex, nofollow`.
- Private routes covered include dashboards, quiz pages, results, reports, profile, favorites, reset password, and verify email.
- Added canonical URL updates, Open Graph updates, Twitter title/description updates, and route-specific document titles.
- Strengthened `public/robots.txt` with private clean-path disallow rules and an absolute sitemap URL.
- Added `public/sitemap.xml` lastmod metadata for the public landing page.
- Added Vercel `X-Robots-Tag: noindex, nofollow` headers for future clean private paths.
- Added `npm run smoke:seo` as a contract test.

## Indexed Pages

- Landing page: `https://almeaacodax.vercel.app/`

## Not Indexed

- Dashboards and admin/staff dashboards
- Quiz and result pages
- Reports, profile, favorites, and private student workspace pages
- Password reset and email verification token pages

## Remaining SEO Work

- The app still uses `HashRouter`. This is stable for the current product, but it limits clean URL SEO.
- Migrating to `BrowserRouter` should be a separate controlled sprint because routes, Vercel rewrites, old hash links, and payment/quiz return URLs must be tested together.
- Public course/path pages can be added to the sitemap after clean URLs are enabled and confirmed to render directly.

## Google Setup

- Add the domain to Google Search Console.
- Submit `https://almeaacodax.vercel.app/sitemap.xml`.
- Keep private app pages out of indexing.
- Add Google Analytics or Tag Manager only through environment/config, not hardcoded secrets.
