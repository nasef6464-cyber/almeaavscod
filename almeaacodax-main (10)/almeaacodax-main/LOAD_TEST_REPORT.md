# Load Test Report

## Production Quick Verification - 2026-05-17 (Safe Window)

Environment:
- API: `https://almeaacodax-k2ux.onrender.com/api`
- Method: `autocannon` quick safe run (8s per probe)
- Endpoints tested:
  - `GET /health`
  - `GET /content/bootstrap`
- Concurrency levels:
  - `20`
  - `100`

Summary:
- `GET /health`
  - `c=20`: ~`37.5 req/s`, `200` only, no timeouts/errors.
  - `c=100`: ~`49.63 req/s`, `200` only, no timeouts/errors.
- `GET /content/bootstrap`
  - `c=20`: ~`26.5 req/s`, `200` only, no timeouts/errors.
  - `c=100`: ~`43.25 req/s`, `200` only, no timeouts/errors.

Raw outputs:
- `load-tests/results/prod_quick_health_c20_2026-05-17.jsonl`
- `load-tests/results/prod_quick_health_c100_2026-05-17.jsonl`
- `load-tests/results/prod_quick_content_bootstrap_c20_2026-05-17.jsonl`
- `load-tests/results/prod_quick_content_bootstrap_c100_2026-05-17.jsonl`

## Production Autocannon Re-Run - 2026-05-14 (Phase 3 Closure)

Environment:
- Frontend: `https://almeaacodax.vercel.app`
- Backend API: `https://almeaacodax-k2ux.onrender.com/api`
- Method: `node scripts/run-production-load-autocannon.mjs`
- Duration per test: `12s`
- Concurrency levels: `20`, `100`, `500`, `1000`
- Endpoints tested:
  - `GET /health`
  - `GET /content/bootstrap`
  - `POST /auth/login`
  - `GET /quizzes/results`

### Highlights from the re-run

- `GET /content/bootstrap`
  - `c=20`: ~`61.67 req/s`, stable.
  - `c=100`: ~`71.92 req/s`, stable but higher latency (`p95 ~ 2.28s`).
  - `c=500`: degraded with `502/503` and timeouts.
  - `c=1000`: collapse/timeouts.

- `POST /auth/login`
  - highly sensitive under burst traffic (`timeouts` and `503/429` behavior depending on saturation/rate limits).

- `GET /quizzes/results`
  - still expensive under pressure and can time out early at high concurrency.

- `GET /health`
  - good at low concurrency, unstable at high burst.

Raw outputs:
- `load-tests/results/prod_*.jsonl`
- `load-tests/results/prod_load_summary.json`

### Re-run capacity decision

- `20 concurrent`: **Ready**
- `100 concurrent`: **Conditionally ready**
- `500 concurrent`: **Not ready**
- `1000+ concurrent`: **Not ready**

This confirms the platform still needs infrastructure scaling + endpoint tuning before claiming high-concurrency readiness.

## Production Autocannon Run - 2026-05-14

Environment:
- Frontend: `https://almeaacodax.vercel.app`
- Backend API: `https://almeaacodax-k2ux.onrender.com/api`
- Method: real external run using `autocannon` against production API endpoints.
- Duration per test: `12s`
- Concurrency levels: `20`, `100`, `500`, `1000`
- Endpoints tested:
  - `GET /health`
  - `GET /content/bootstrap`
  - `POST /auth/login`
  - `GET /quizzes/results` (student token)

### Observed Results (high-signal)

- `GET /health`
  - `c=20`: ~`72 req/s`, no timeouts, mostly stable.
  - `c=100`: ~`238 req/s`, notable `429` responses.
  - `c=500`: timed out heavily.
  - `c=1000`: severe degradation (`502/503` + timeouts).

- `GET /content/bootstrap`
  - `c=20`: ~`60 req/s`, stable, `200` only.
  - `c=100`: ~`62 req/s`, stable.
  - `c=500`: major degradation, many `502/503` and timeouts.
  - `c=1000`: mostly failed/timeouts.

- `POST /auth/login`
  - `c=20`: high rate but mostly throttled (`429`) and invalid payload (`400`) behavior under stress.
  - `c=100`: mostly throttled (`429`).
  - `c=500`: near total timeout failure.
  - `c=1000`: severe overload (`503`) and timeouts.

- `GET /quizzes/results`
  - `c=20`: low throughput, early throttling (`429`) and timeouts.
  - `c=100`: high throttling, very low successful responses.
  - `c=500`: mostly `502/503`.
  - `c=1000`: timeout collapse.

Raw outputs saved under:
- `load-tests/results/prod_*.jsonl`
- `load-tests/results/prod_load_summary.json`

### Capacity Conclusion From This Run

- Current production setup is **usable for low-to-moderate real traffic** but **not ready** for sustained synthetic high-concurrency spikes at `500+`.
- The first hard bottlenecks are:
  1. Render instance capacity / cold-start and saturation behavior.
  2. Rate limiting behavior under burst patterns.
  3. Expensive authenticated endpoints under load (`/quizzes/results`).

### Readiness Matrix (evidence-based)

- `20 concurrent`: **Ready** (with monitoring).
- `100 concurrent`: **Conditionally ready** (acceptable for normal usage patterns, but burst throttling is visible).
- `500 concurrent`: **Not ready** on current production sizing.
- `1000+ concurrent`: **Not ready** on current production sizing.

### Immediate Upgrade Path Before Next Run

1. Upgrade Render service class (CPU/RAM) and keep at least 2 warm instances.
2. Move to managed Redis with confirmed connectivity (`/api/health/scale-ready` + `/api/operations/integrations-readiness`).
3. Tune burst and role-aware rate limits (protect auth while reducing false-positive throttling on normal learner flows).
4. Add dedicated read-optimized query/index path for report/result endpoints.
5. Re-run staged load test with longer windows (`30s/60s`) and realistic journey mix.

## Question Summary Endpoint Guard - 2026-05-13

- Added the production speed smoke measurement for `/api/quizzes/questions?summary=true&noTotal=true&limit=80`.
- The learner/public summary path no longer expands all published quiz `questionIds` before returning a bounded summary list. That expensive expansion remains available for full question loads, explicit `ids`, and search flows where compatibility matters.
- This keeps the first question-bank summary response small and predictable as the question bank grows, without exposing answers or changing UI layout.
- Category pages now defer the general question-bank bootstrap and student skill-progress bootstrap. The route opens with courses, quizzes, taxonomy, and content first; question summaries and skill-progress hydrate in the background.
- Category course-tab bundles now lazy-load payment modals, skill details, file previews, and simulated test cards only when the student opens them or switches to their tabs. This reduces first route JavaScript without changing the UI layout.
- Category routes now hydrate taxonomy immediately when that request finishes instead of waiting for the full bootstrap group. Courses, content, quizzes, health, question summaries, and skill-progress continue independently in the background.
- Course list loading now has a 60-second learner/public server cache plus a browser session cache for non-staff sessions. Staff accounts bypass this cache so admin/teacher course management still sees fresh data.
- The chat assistant widget is now lazy-loaded from `MainLayout`, so its AI service code is not part of the first route render. The floating chat keeps the same UI when the chunk loads.
- Public taxonomy bootstrap now has a shared in-flight promise, so concurrent student opens after cache expiry wait for one MongoDB read set instead of starting duplicate path/subject/skill queries. Its public response is cacheable for 60 seconds with `stale-while-revalidate=120`, and the taxonomy models now include compound indexes for the lookup/order patterns used by `/api/taxonomy/bootstrap`.

## Status

Not executed yet in this sprint. The project now has the production-hardening checklist needed before formal pressure testing.

## Required Scenarios

- Login and session refresh.
- Home/bootstrap content loading.
- Student path and subject loading.
- Quiz start and submit.
- Student results page.
- Admin dashboard loading.

## Target Levels

- 100 concurrent students: pilot readiness.
- 500 concurrent students: paid launch minimum target.
- 1000 concurrent students: scaling decision point.

## Recommended Tools

- k6 for scenario-based traffic.
- autocannon for API endpoint pressure.
- Render and MongoDB metrics during the run.

## Output Needed

Each run should record latency p50/p95/p99, error rate, Render CPU/memory, MongoDB slow queries, and recommended scaling changes.

## Vercel Slowness Notes - 2026-05-12

The current Vercel slowness is expected from three main sources, and they need to be handled before claiming 10k+ user readiness:

- Frontend bundle size: the production build still reports large chunks, especially admin/video/dashboard-related bundles. This increases first-load time on slower devices and networks.
- Backend cold start: the Render free instance can spin down, so the first API request after inactivity may wait around 50 seconds before the server wakes.
- Runtime load readiness: 10k users needs measured capacity, not an assumption. The app needs repeatable load tests, upgraded Render capacity, MongoDB Atlas sizing, and queued background work for bulk notifications.

Latest local production build warnings after the 2026-05-12 Firebase and video fallback cleanup:

- `assets/spreadsheet-*.js`: about 429.53 kB, gzip about 143.08 kB.
- `assets/charts-*.js`: about 304.05 kB, gzip about 94.55 kB.
- The previous heavy `assets/firebase-*.js` chunk is removed from production. Legacy Firebase remains local-development-only.
- The previous heavy `assets/video-dash-*.js` and `assets/video-hls-*.js` chunks are removed from production. Direct files use native HTML5 video, Vimeo/Drive use iframe embeds, and YouTube stays on the lighter Plyr path.

## 10k User Readiness Gate

The platform should not be described as ready for 10k concurrent users until all of these are complete:

- Render is upgraded from the free cold-start service and has CPU/memory sized from test data.
- MongoDB Atlas is on a tier with enough connections, indexes, backups, and slow-query monitoring.
- k6 or autocannon scenarios pass for login, bootstrap, path loading, quiz submit, package access, and admin dashboard.
- p95 response time stays acceptable under staged tests: 100, 500, 1000, then higher traffic.
- Bulk notifications and heavy admin work run through a queue instead of normal web requests.
- Frontend chunks are reviewed and admin-only/video-heavy code is not pulled into the first student load.

## Frontend First-Load Split - 2026-05-12

Closed the first code-level performance pass for video-heavy pages:

- `VideoModal`, `CoursePlayer`, and `CourseLanding` now lazy-load `CustomVideoPlayer` only when a video is actually opened or rendered.
- This prevents pages that merely import video-capable components from eagerly pulling video player code into the first student route.
- Added `npm run smoke:performance` to guard this contract.

Remaining performance work before a 10k-user claim:

- Continue splitting admin-only dashboards and spreadsheet/reporting code.
- Measure real Vercel first-load and Render API timing after deployment.
- Run k6/autocannon against staging or production with the backend on a non-free Render instance.

## Public Shell Bootstrap Split - 2026-05-12

Closed a direct first-open bottleneck:

- The public landing/auth shell now renders immediately instead of waiting for the full app bootstrap to finish.
- The heavy bootstrap no longer starts automatically on public landing/auth pages. This avoids pulling courses, questions, quizzes, taxonomy, content bootstrap, and skill-progress data for a visitor who has not entered the learning app yet.
- Public pages now fetch only the lightweight active announcement-ad list so the opening announcement feature still works without a full data load.
- If the user moves from a public page into a data-heavy route, the app starts the full bootstrap immediately and keeps the route protected by the loading gate.
- Data-heavy quiz/result routes still block until bootstrap is ready, while category pages now use a lighter taxonomy shell gate so the page frame can appear before the full background bootstrap completes.
- `npm run smoke:performance` now guards this split so the root page cannot silently return to blocking on the full content bootstrap.

Expected effect:

- First paint on Vercel root/auth pages should improve because students do not wait for course/question/quiz/taxonomy/content/skill-progress calls before seeing the page.
- If the backend is cold on Render, the public page avoids the previous multi-endpoint bootstrap burst. The only public follow-up request is the small announcement list, and private/data pages remain protected by the bootstrap gate.

## Dashboard Question-Bank Defer - 2026-05-12

Measured production timing after the latest deployment showed the root Vercel shell is not the main bottleneck:

- Vercel shell: about 589 ms and 4 KB in the latest probe.
- Render `/api/health`: about 979 ms.
- `/api/taxonomy/bootstrap`: about 803 ms and 15 KB.
- `/api/content/bootstrap`: about 680 ms and 28 KB.
- `/api/quizzes/questions`: about 3111 ms and 726 KB.

Direct cause found:

- Private dashboards were waiting for the full app bootstrap.
- The full bootstrap included the large question-bank endpoint.
- So a slow or large question-bank response could keep admin/student/report dashboards behind the loading state even when the lighter data was already ready.

Code fix applied:

- Dashboards and reports now defer the general question-bank bootstrap.
- Core data still loads first, the page opens, then the question bank hydrates in the background.
- The question-bank API now supports scoped pagination with `page`, `limit`, `pathId`, `subject`, `sectionId`, `skillId`, `ids`, and `search`.
- The question-bank API also supports `summary=true` so dashboards can load lightweight question metadata and a short text preview without full answers/explanations/media.
- Dashboard summary loads can pass `noTotal=true` to skip a full `countDocuments` query on first open; detailed admin/search pages can still request totals.
- The bootstrap asks for a bounded summary first page instead of treating the question bank as an unbounded full-detail payload.
- Public/learner taxonomy bootstrap now uses short in-process caching, lean MongoDB reads, and automatic cache invalidation on taxonomy mutations so repeated student opens do not re-scan taxonomy collections.
- Public content bootstrap now uses a short guest cache and a single active-path lookup for topics, lessons, and library items, while authenticated/student-specific study plans stay uncached.
- Public/learner quiz list now uses a short cache and lean MongoDB reads so repeated dashboard/category opens do not re-query the same published quiz list.
- Public/learner question summaries now use a short cache for bounded `summary=true&noTotal=true` requests, while full question data and search/admin requests remain uncached.
- Quiz/category routes that need stricter data readiness remain protected by the existing bootstrap gate.
- Guard extended in `npm run smoke:performance`.

Expected effect:

- Admin, teacher, supervisor, parent, student dashboard, and reports routes should stop being blocked by the large `/quizzes/questions` response on first entry.
- Question-dependent widgets update when the deferred question bank arrives.

## Video Fallback Native Split - 2026-05-12

Closed the second video performance pass:

- `CustomVideoPlayer` no longer depends on `react-player`.
- YouTube lessons continue to use the lighter Plyr/YouTube path first.
- Direct video files now use native HTML5 `<video>`, Vimeo/Drive use iframe embeds, and timed in-video questions remain on the native/direct-file path.
- Timed in-video questions remain wired through the same overlay and were covered by `npm run smoke:video-questions`.

Build note:

- Vite no longer emits `assets/video-dash-*.js` or `assets/video-hls-*.js` in the production build.
- This is a real bundle removal, not just a lazy-load delay.

## Reports Export Split - 2026-05-12

Closed the first reports-specific performance pass:

- `pages/Reports.tsx` no longer imports `xlsx` during normal report viewing.
- Excel generation now loads the spreadsheet library only when the user clicks an export button.
- `npm run smoke:performance` now guards both the video-player lazy-load contract and the reports Excel lazy-load contract.

Expected effect:

- Student and parent report pages keep the simple visual report experience without downloading the spreadsheet stack unless export is actually used.

## Admin Excel Lazy Loading - 2026-05-12

Closed the admin spreadsheet follow-up:

- Admin managers no longer statically import `xlsx` when their tabs open.
- A shared `utils/xlsxLoader.ts` loads the spreadsheet library only when an admin exports a workbook, downloads an import template, or imports an Excel file.
- Covered managers: users, groups, school portal, schools, lessons, library, quizzes, and question bank.
- `npm run smoke:performance` now guards that these managers do not reintroduce static spreadsheet imports.

Expected effect:

- Opening admin tabs stays lighter because the spreadsheet stack waits until the admin actually uses Excel.
- The production build still emits `assets/spreadsheet-*.js` as an async chunk, which is expected and correct for export/import actions.

## Results Chart Lazy Loading - 2026-05-12

Closed the next student-facing report bundle target:

- `pages/Results.tsx` no longer statically imports `recharts` during page module load.
- The score donut chart moved to `components/results/ResultDonutChart.tsx` and loads through `React.lazy` only when the result chart is rendered.
- The fallback keeps the chart area stable so the result page does not jump while the chart chunk arrives.
- `npm run smoke:performance` now guards that results charts do not reintroduce a static `recharts` import.

Student report planning note:

- The next reports UX sprint should keep the default student/parent report very short: weak skills, simple recommendation, progress by registered track, and a button for a detailed report.
- Weak skills should be calculated from enough attempts/questions per skill, not from one isolated question.
- Detailed analytics remain available for admin, parent, supervisor, and teacher views, with export/download when needed.

## Student Reports Evidence - 2026-05-12

Closed the first student-report simplification logic pass:

- Student weak-skill ranking now distinguishes reliable evidence from a first signal.
- At least two linked attempts/questions are required before the simple report presents a skill as the primary starting point.
- If only one linked answer exists for a skill, the report labels it as an initial reading and asks for another attempt before treating it as a stable weakness.
- The simple report header actions were reduced to summary copy, PDF/download, and detailed report. Export-heavy Excel actions remain in detailed mode only.

Expected effect:

- Student and parent-facing interpretation is more realistic: the platform does not overreact to one wrong answer.
- The report remains useful after a single attempt, but clearly says when the evidence is still early.

## Student Track-Aware Reports - 2026-05-12

Closed the first track-scoping pass for student reports:

- Student reports now use `enrolledPaths` to understand the student's registered learning paths.
- When a student is registered in one or more paths, weak-skill priorities prefer skills from those paths when the skill metadata includes `pathId`.
- If the student has no registered path, the report shows a short prompt and sends the student to `مساراتي` before depending on track-specific reports/tests.

Expected effect:

- A student registered in `نافس` sees report priorities that align better with that track instead of a generic mixed list.
- This is a report-prioritization step only; purchase gates and package access remain handled by the existing access system.

Additional note:

- Internal path ids are not shown to students; the UI uses the path name when available or a generic registered-path label.

Planned institutional reporting pass:

- Add a role-aware reports hub for admin, supervisor, teacher, and parent.
- Reuse the same skill aggregation rules, but expose grouped student summaries, individual reports, directed-test reports, exports, student import/add actions, and messaging/alerts according to role scope.
- Admin manages all, supervisors see their groups/schools, teachers see assigned content/students, and parents see linked students only.

Closed first institutional command pass:

- Non-student report views now show a compact `مركز متابعة مؤسسي` section.
- It surfaces one next action from the scoped analytics, with buttons for follow-up test routing, alert copy, scope management, and student export.
- This improves school/admin usability without increasing the default student report detail.

Closed report-to-quiz context pass:

- The report follow-up action now opens the quiz center as a central directed-test workflow.
- Weak-skill context is passed through the URL when available, so the quiz center can preselect the relevant path, subject, section, and skill.
- Creating a central follow-up from that context seeds the draft with the selected skill id, reducing manual setup for schools.
- Lead-student context is now passed as `targetUserId`, so a directed follow-up draft can target the student who needs immediate support.
- The same flow accepts `targetGroupId` for later group-level report actions.

## Admin Dashboard Split - 2026-05-12

Closed the first admin dashboard performance pass:

- `dashboards/admin/AdminDashboard.tsx` now lazy-loads heavy tab managers only when their tab is opened.
- The admin shell chunk dropped from roughly 868 kB to roughly 51 kB before gzip in the production build.
- Individual admin areas now compile into separate chunks such as `PathsManager`, `LessonsManager`, `QuestionBankManager`, `SchoolsManager`, and `FinancialManager`.

Expected effect:

- Opening the admin dashboard no longer downloads every admin tool at once.
- Teachers/supervisors/admins still get the same tabs and behavior, but inactive sections wait until selected.

## Vercel Cache Headers - 2026-05-12

Closed a production deployment speed issue:

- The old `vercel.json` used `Cache-Control: no-store` for every route, including hashed Vite assets.
- That forced browsers to redownload JavaScript, CSS, fonts, and images on repeat visits.
- Hashed assets now use `public, max-age=31536000, immutable`.
- The SPA HTML shell now uses `no-cache, max-age=0, must-revalidate` so users can still receive new deployments.
- Added `npm run smoke:deployment-cache` to prevent this regression.

Expected effect:

- First visit still depends on remaining large chunks and Render API wake-up.
- Repeat visits should be faster because Vercel/browser caching can finally reuse immutable assets.

## Load Test Scripts - 2026-05-12

Closed the first measurable load-testing gate:

- Added `load-tests/k6-platform-journey.js` with staged 100, 500, and 1000 virtual-user gates.
- The journey covers health, content bootstrap, taxonomy bootstrap, login, current user, student results, and optional quiz submission.
- Added `load-tests/README.md` with the exact environment variables needed to run against Render/staging.
- Added `npm run smoke:load-tests` to guard the test plan files.

How to run a real staging test:

```bash
k6 run load-tests/k6-platform-journey.js \
  -e API_BASE=https://YOUR_RENDER_SERVICE.onrender.com/api \
  -e STUDENT_EMAIL=student@example.com \
  -e STUDENT_PASSWORD=StrongPassword123 \
  -e QUIZ_ID=quiz_id_optional \
  -e QUIZ_SOURCE=training
```

Important production note:

- This does not prove 10k-user readiness by itself.
- It creates the repeatable measurement path needed before launch.
- Real 10k readiness still needs upgraded Render, MongoDB Atlas sizing, Redis/queue-backed notifications, and multiple staged runs with p95/p99 latency recorded.

## Monitoring Diagnostics - 2026-05-12

Closed the first backend observability gate:

- Added structured JSON request diagnostics for slow requests and failed requests.
- Added `SLOW_REQUEST_LOG_MS` so staging load tests can lower or raise the slow-request threshold without code changes.
- Added `REQUEST_LOG_LEVEL=debug` for short investigations when a page feels slow but no endpoint is obviously failing.
- Added `npm run smoke:monitoring` to guard that request bodies, passwords, tokens, cookies, and authorization headers are not logged.

How this helps load testing:

- During k6/autocannon runs, Render logs will now show which API path is slow and how long it took.
- If Vercel feels slow but Render logs show no slow API request, focus on frontend bundle/cache/cold-start behavior.
- If Render logs show slow API paths, optimize that endpoint and review the related MongoDB query/index.

## Database Index Sprint - 2026-05-12

Closed the first MongoDB index pass for the routes used in load tests:

- Learning bootstrap and subject pages now have supporting indexes for topics, lessons, library items, courses, and active announcements.
- Payment/package flows now have supporting indexes for payment requests, discount codes, packages, access codes, and user purchases.
- Admin/operations pages now have supporting indexes for audit logs, AI metrics, users, and groups.
- Added `DATABASE_REVIEW.md` and `npm run smoke:database`.

What this means for load tests:

- The app is better prepared for 100/500/1000-user measurement.
- This still does not certify 10k users; it removes obvious first-pass index gaps before real pressure testing.
## Production Retest Window - 2026-05-17 (Batch 20U)

Executed short retest probes (6s) on production for high concurrency after 20T tuning prep.

Endpoints and levels:
- GET /health @ c=500, c=1000
- GET /content/bootstrap @ c=500, c=1000

Observed summary (`load-tests/results/prod_retest_summary_2026-05-17.json`):
- /health c=500: ~95.67 req/s, 200-only, no errors/timeouts, p99 ~7324ms
- /health c=1000: ~99.4 req/s, 200-only, no errors/timeouts, p99 ~7083ms
- /content/bootstrap c=500: ~11.5 req/s, 200-only, no errors/timeouts, p99 ~7314ms
- /content/bootstrap c=1000: ~9 req/s, 200-only, no errors/timeouts, p99 ~7323ms

Decision note:
- This confirms survivability for these two read probes under short high-concurrency windows.
- Full 500+ closure still requires full-journey retest (auth/results/write paths) with sustained duration and infra observability correlation.

## Production Full-Journey Edge Retest - 2026-05-17 (Batch 20V)

Scope executed (high concurrency, 6s window):
- `POST /auth/login` with invalid credentials (`c=500`, `c=1000`)
- `GET /quizzes/results` unauthenticated (`c=500`, `c=1000`)

Summary (`load-tests/results/prod_journey_retest_summary_2026-05-17.json`):
- `auth/login c=500`: ~44.5 rps, non2xx=267 (`401`,`429`), p99 ~7317ms
- `auth/login c=1000`: ~66 rps, non2xx=330 (`429`), p99 ~8584ms
- `quizzes/results unauth c=500`: ~143.2 rps, non2xx=716 (`401`), p99 ~6728ms
- `quizzes/results unauth c=1000`: ~84.8 rps, non2xx=424 (`401`), p99 ~6980ms

Interpretation:
- Under high concurrency, auth/result edges stayed responsive without transport-level timeouts in this short window.
- Elevated p99 remains visible and confirms the need for sustained-duration full authenticated/write-path retests before claiming full 500+ readiness.

## Authenticated Probe Note - 2026-05-17 (Post-20W)

A direct authenticated probe was executed with corrected header format:
- Endpoint: `GET /quizzes/results`
- Concurrency: `50`
- Duration: `5s`
- Result: `200` responses observed (`2xx=58`), no transport timeouts.
- Evidence file: `load-tests/results/prod_authd_quizzes_results_c50_probe_2026-05-17.jsonl`

Interpretation:
- Authenticated route is reachable and measurable with valid bearer token.
- High-concurrency authenticated runs at 500/1000 from the prior window remain inconclusive in several outputs (sent connections with zero counted responses), so final 500+ authenticated closure still requires a controlled retest window with infra metrics correlation.

## Production Controlled Authenticated Retest - 2026-05-17 (Batch 20Y)

Environment:
- API: `https://almeaacodax-k2ux.onrender.com/api`
- Method: `autocannon` authenticated direct bearer runs (no login burst)
- Duration: `12s` per run
- Endpoints:
  - `GET /quizzes/results`
  - `PATCH /auth/me/preferences`
- Concurrency levels:
  - `500`
  - `1000`

Observed:
- `GET /quizzes/results`:
  - `c=500`: partial success (`200=101`) with heavy timeout (`412`).
  - `c=1000`: complete timeout collapse (`timeouts=1000`, `2xx=0`).
- `PATCH /auth/me/preferences`:
  - `c=500`: heavy timeout (`358`) + many `400` (`non2xx=300`).
  - `c=1000`: heavy timeout (`699`) + many `400` (`non2xx=766`).

Conclusion:
- Authenticated 500+/1000 production readiness is still **NOT CLOSED**.
- Platform remains acceptable for lower/controlled traffic windows, but authenticated high-concurrency requires infra/query hardening before final closure.

Evidence:
- `load-tests/results/prod_authd_quizzes_results_c500_2026-05-17_r2.jsonl`
- `load-tests/results/prod_authd_quizzes_results_c1000_2026-05-17_r2.jsonl`
- `load-tests/results/prod_authd_me_preferences_patch_c500_2026-05-17_r2.jsonl`
- `load-tests/results/prod_authd_me_preferences_patch_c1000_2026-05-17_r2.jsonl`
- `load-tests/results/prod_authd_retest_summary_2026-05-17_r2.json`

## Production Authenticated Hardening Retest - 2026-05-17 (Batch 20Z)

Code hardening applied:
- Added `noTotal` query option to quiz results endpoints to skip `countDocuments` on demand.
- Wired client quiz results fetchers to request `noTotal=true` by default for list views.

Retest target:
- `GET /api/quizzes/results?noTotal=true&limit=20`
- Concurrency: `500`, `1000`
- Auth: direct bearer token

Observed:
- `c=500`: `2xx=49`, `timeouts=451`.
- `c=1000`: `2xx=36`, `timeouts=973`.

Conclusion:
- The query-count removal is functionally correct but insufficient alone for authenticated 500+/1000 closure.
- Authenticated high-concurrency remains pending deeper infra/query hardening.

Evidence:
- `load-tests/results/prod_authd_quizzes_results_nototal_c500_2026-05-17.jsonl`
- `load-tests/results/prod_authd_quizzes_results_nototal_c1000_2026-05-17.jsonl`

## Production Authenticated Cached Retest - 2026-05-17 (Batch 20ZA)

Change under test:
- Added a 5-second short-lived in-memory cache for authenticated `GET /quizzes/results` when `noTotal=true` and `includeReview=false`, with full cache invalidation on quiz submit.

Retest target:
- `GET /api/quizzes/results?noTotal=true&limit=20`
- Concurrency: `500`, `1000`

Observed (after deploy `20f05bd`):
- `c=500`: `2xx=428`, `timeouts=197`.
- `c=1000`: `2xx=330`, `timeouts=678`.

Comparison vs previous no-cache/noTotal run:
- Previous `c=500`: `2xx=49`, `timeouts=451` -> improved strongly.
- Previous `c=1000`: `2xx=36`, `timeouts=973` -> improved strongly.

Conclusion:
- The cache step materially improves authenticated read resilience under burst load.
- Final 500+/1000 closure is still pending (timeouts still non-zero/high), but the trend is clearly better and hardening direction is valid.

Evidence:
- `load-tests/results/prod_authd_quizzes_results_cached_nototal_c500_2026-05-17.jsonl`
- `load-tests/results/prod_authd_quizzes_results_cached_nototal_c1000_2026-05-17.jsonl`

## Production Journey Mix Window - 2026-05-17 (Batch 20ZB)

Window scope:
- Public reads:
  - `GET /health` (`c=300`)
  - `GET /content/bootstrap` (`c=300`)
  - `GET /taxonomy/bootstrap` (`c=300`)
- Authenticated reads:
  - `GET /auth/me` (`c=500`)
  - `GET /quizzes/results?noTotal=true&limit=20` (`c=500`, `c=1000`)

Key outcomes:
- `health` remained stable (`timeouts=0`, `errors=0`, all `200`).
- `content/bootstrap` and `taxonomy/bootstrap` still show timeout pressure under `c=300` burst.
- Authenticated results path remains the strongest improved path after cache hardening:
  - `c=500`: `2xx=552`, `timeouts=194`
  - `c=1000`: `2xx=317`, `timeouts=322`
- This is materially better than pre-cache/noTotal baselines and supports the hardening direction.

Evidence:
- `load-tests/results/prod_20zb_health_c300_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_bootstrap_c300_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_taxonomy_c300_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_auth_me_c500_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_quiz_results_nototal_c500_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_quiz_results_nototal_c1000_2026-05-17.jsonl`
- `load-tests/results/prod_20zb_journey_mix_summary_2026-05-17.json`

## Production Bootstrap/Taxonomy Retest - 2026-05-17 (Batch 20ZC)

Change under test:
- Increased public cache TTL and SWR headers for:
  - `/api/content/bootstrap`
  - `/api/taxonomy/bootstrap`

Retest:
- `GET /content/bootstrap` at `c=300`
- `GET /taxonomy/bootstrap` at `c=300`

Observed:
- `/content/bootstrap`: `2xx=153`, `timeouts=183` (worse than prior 20ZB window).
- `/taxonomy/bootstrap`: `2xx=290`, `timeouts=129` (no material improvement vs prior 20ZB).

Conclusion:
- Header/TTL-only tuning did not deliver the intended production gain for c=300 burst.
- Further hardening must target query/payload shape and endpoint decomposition rather than cache headers alone.

Evidence:
- `load-tests/results/prod_20zc_bootstrap_c300_2026-05-17.jsonl`
- `load-tests/results/prod_20zc_taxonomy_c300_2026-05-17.jsonl`

## Production Learning-Scope Shared Cache Retest - 2026-05-18 (Batch 20ZD)

Change under test:
- `content/bootstrap` now allows shared in-memory cache for authenticated non-staff when `scope=learning` (same non-personal payload class), not only guest traffic.

Runs:
- `GET /content/bootstrap?scope=learning` at `c=300` (guest)
- `GET /content/bootstrap?scope=learning` at `c=300` (authenticated)
- `GET /taxonomy/bootstrap` at `c=300` (guest)
- Stability probes:
  - `GET /health` at `c=50`
  - `GET /taxonomy/bootstrap` at `c=100`

Observed:
- `content/bootstrap?scope=learning`:
  - guest c300: `2xx=112`, `timeouts=191`
  - auth c300: `2xx=53`, `timeouts=247`
- `taxonomy/bootstrap` c300: collapse window (`2xx=0`, `timeouts=255`) in that burst.
- Stability probes confirmed service availability outside collapse window:
  - `health` c50: stable `2xx=373`, `timeouts=0`
  - `taxonomy/bootstrap` c100: stable `2xx=492`, `timeouts=0`

Conclusion:
- Shared authenticated learning-cache is functionally valid, but c300 burst behavior remains unstable and not closure-ready.
- This points to burst-saturation dynamics requiring deeper endpoint decomposition and staged traffic shaping, not only cache adjustments.

Evidence:
- `load-tests/results/prod_20zd_bootstrap_learning_guest_c300_2026-05-18.jsonl`
- `load-tests/results/prod_20zd_bootstrap_learning_auth_c300_2026-05-18.jsonl`
- `load-tests/results/prod_20zd_taxonomy_guest_c300_2026-05-18.jsonl`
- `load-tests/results/prod_20zd_health_probe_c50_2026-05-18.jsonl`
- `load-tests/results/prod_20zd_taxonomy_probe_c100_2026-05-18.jsonl`

## Production Minimal Bootstrap Decomposition - 2026-05-18 (Batch 20ZE)

Implementation:
- Added `GET /api/content/bootstrap/minimal` returning only the minimal public shell payload (announcement ads + empty heavy collections) with shared caching.
- Public client ad-hydration path now uses `content/bootstrap/minimal` instead of a separate announcement endpoint fetch path.

Load comparison (`c=300`, 10s):
- `GET /content/bootstrap/minimal`:
  - `2xx=1433`, `timeouts=0`, `errors=0`.
- `GET /content/bootstrap?scope=learning` (existing heavier path):
  - `2xx=184`, `timeouts=171`.

Conclusion:
- True payload decomposition provides a strong measurable gain for the public shell bootstrap path.
- The heavier learning bootstrap path still requires further decomposition/migration to achieve closure at high burst.

Evidence:
- `load-tests/results/prod_20ze_bootstrap_minimal_c300_2026-05-18.jsonl`
- `load-tests/results/prod_20ze_bootstrap_learning_guest_c300_2026-05-18.jsonl`
