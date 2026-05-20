# Development Roadmap

## Phase 1: Stabilization and understanding
**Goal:** Lock down the current system and remove uncertainty before new feature work.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Confirm current backend as the source of truth | High | Low | Repository inspection | MongoDB + Express are documented as primary runtime |
| Map all legacy fallback paths | High | Medium | `App.tsx`, `services/adapter.ts`, Firebase files | Legacy paths are documented and controlled |
| Verify auth/session flow end to end | High | Medium | `AuthContext`, auth routes | Login/logout/current-user works consistently |
| Verify content visibility rules | High | Medium | taxonomy, course, quiz, content routes | Learner/staff visibility matches the code |

## Phase 2: Complete unfinished core features
**Goal:** Finish the incomplete educational workflows that are already partially modeled.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Finalize quiz result UX | High | Medium | quiz results, skill progress | Results are simple, clear, and age-appropriate |
| Complete certificate flow if required | Medium | Medium | courses, achievements, reports | Certificate issuance rules are explicit |
| Clarify live session integration | Medium | High | lessons, live sessions pages | Live lesson workflow is production-ready or removed |
| Complete assignment workflow | Medium | Medium | lessons, quizzes, reports | Assignment concept is consistent across UI/API |

## Phase 3: Improve UX/UI
**Goal:** Make the platform easier for students, parents, and staff to use.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Simplify results and reports screens | High | Medium | results, reports, skill analysis | Reports are easy for younger users and parents |
| Standardize mobile/tablet/desktop responsiveness | High | Medium | shared layouts/components | Core flows work well on small screens |
| Improve content creation ergonomics | Medium | Medium | admin builders | Teachers/admins can create content faster |
| Add preview-before-publish patterns | Medium | Medium | content approval workflow | Draft/preview/publish is clear |

## Phase 4: Testing and security
**Goal:** Reduce regressions and protect sensitive data.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Add route-level and UI smoke coverage | High | Medium | current routes/pages | Major flows can be verified automatically |
| Validate all env variables and deployment settings | High | Low | env config | Production config is documented and sane |
| Review AI gateway security | High | Medium | AI routes/env | No AI key is exposed in the frontend |
| Audit access control edge cases | High | Medium | auth middleware | Roles and packages cannot be bypassed |

## Phase 5: Deployment and production readiness
**Goal:** Make the project safe to deploy and support.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Document deployment target(s) | High | Low | hosting decision | One clear deployment plan exists |
| Confirm MongoDB hosting strategy | High | Low | database decision | Atlas/local/prod strategy is documented |
| Confirm file storage strategy | High | Medium | uploads/media decision | A real storage provider or policy is defined |
| Create operational runbook | High | Low | all above | Another engineer can run the system safely |

## Phase 6: Growth features
**Goal:** Expand the platform after the core is stable.

| Task | Priority | Complexity | Dependencies | Acceptance criteria |
|---|---|---:|---|---|
| Advanced AI remediation | Medium | High | AI gateway, skill analysis | AI proposes useful weak-skill paths |
| Parent/supervisor insights | Medium | Medium | reports, groups, school reports | Reports are meaningful for each role |
| School automation and batch import improvements | Medium | Medium | import students, groups | Bulk operations are reliable |
| Packaging and pricing matrix improvements | Medium | Medium | packages, access codes, payments | Commercial packaging is flexible |

