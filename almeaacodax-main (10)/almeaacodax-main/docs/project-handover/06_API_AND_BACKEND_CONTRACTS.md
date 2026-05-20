# API and Backend Contracts

## General backend style
- Base API prefix: `/api`
- Express router composition in `server/src/routes/index.ts`
- Request parsing via `express.json()`
- CORS is restricted to `CLIENT_URL`
- Auth via JWT bearer token
- Validation uses `zod` in route files
- Error handling is centralized in `server/src/middleware/errorHandler.ts`

## Common auth rules
- `optionalAuth` is used for public pages that become richer when a user is logged in
- `requireAuth` protects user-specific endpoints
- `requireRole(...)` protects staff-only operations
- Dev-only local admin bypass exists for localhost if enabled in env

## Route groups

### `/api/health`
| Method | Endpoint | Purpose | Auth | Response |
|---|---|---|---|---|
| GET | `/api/health` | Returns service/database health | No | `{ status, database, timestamp }` |

### `/api/auth`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | Create account | No | Returns token/user |
| POST | `/api/auth/login` | Login | No | Returns token/user |
| GET | `/api/auth/me` | Current logged-in user | Yes | Used for session bootstrap |
| PATCH | `/api/auth/me/preferences` | Update favorites/review-later preferences | Yes | User-specific preferences |
| POST | `/api/auth/me/purchase` | Apply purchase to account | Yes | Connects to packages/courses |
| POST | `/api/auth/me/redeem-access-code` | Redeem access code | Yes | Opens purchased content |
| GET | `/api/auth/admin/users` | List users | Admin | Admin-only management |
| POST | `/api/auth/admin/users` | Create user | Admin | Admin-only management |
| PATCH | `/api/auth/admin/users/:id` | Update user | Admin | Admin-only management |

### `/api/taxonomy`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/taxonomy/bootstrap` | Load paths/levels/subjects/sections/skills | Optional | Learners see active paths; staff see more |
| POST/PATCH/DELETE | `/api/taxonomy/paths` and `/api/taxonomy/paths/:id` | Manage paths | Staff | Cascades to related content |
| POST/PATCH/DELETE | `/api/taxonomy/levels` and `/api/taxonomy/levels/:id` | Manage levels | Staff | Taxonomy management |
| POST/PATCH/DELETE | `/api/taxonomy/subjects` and `/api/taxonomy/subjects/:id` | Manage subjects | Staff | Taxonomy management |
| POST/PATCH/DELETE | `/api/taxonomy/sections` and `/api/taxonomy/sections/:id` | Manage sections | Staff | Taxonomy management |
| POST/PATCH/DELETE | `/api/taxonomy/skills` and `/api/taxonomy/skills/:id` | Manage skills | Staff | Core skill source |

### `/api/content`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/content/homepage-settings` | Load homepage settings | Optional | Creates defaults if missing |
| PATCH | `/api/content/homepage-settings` | Update homepage settings | Admin | Homepage management |
| GET | `/api/content/bootstrap` | Load topics, lessons, library, groups, packages, access codes, study plans | Optional | Learner data is filtered by visibility |
| POST/PATCH/DELETE | `/api/content/topics` and `/api/content/topics/:id` | Topic CRUD | Staff | Topic tree management |
| POST/PATCH/DELETE | `/api/content/lessons` and `/api/content/lessons/:id` | Lesson CRUD | Staff | Supports workflow and skill linking |
| POST/PATCH/DELETE | `/api/content/library-items` and `/api/content/library-items/:id` | Library CRUD | Staff | File/resource manager |
| POST/PATCH/DELETE | `/api/content/groups` and `/api/content/groups/:id` | Group CRUD | Staff | School/class/private group management |
| POST/PATCH/DELETE | `/api/content/b2b-packages` and `/api/content/b2b-packages/:id` | B2B package CRUD | Staff | Commercial packaging |
| POST/PATCH/DELETE | `/api/content/access-codes` and `/api/content/access-codes/:id` | Access-code CRUD | Staff | Distribution codes |
| POST/PATCH/DELETE | `/api/content/study-plans` and `/api/content/study-plans/:id` | Study plan CRUD | Auth | Personal learning plans |
| GET | `/api/content/schools/:id/report` | School analytics | Admin/Supervisor | Aggregated report |
| POST | `/api/content/schools/:id/import-students` | Bulk import students | Admin/Supervisor | Accepts row-based import data |

### `/api/courses`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/courses` | List courses | Optional | Learner visibility rules apply |
| GET | `/api/courses/:id` | Fetch one course | Optional | Uses same visibility logic |
| POST | `/api/courses` | Create course | Staff | Course authoring |
| PATCH | `/api/courses/:id` | Update course | Staff | Course authoring |
| DELETE | `/api/courses/:id` | Delete course | Staff | Course lifecycle |

### `/api/quizzes`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/quizzes/questions` | List questions | Optional / staff aware | Question bank |
| POST | `/api/quizzes/questions` | Create question | Staff | Question authoring |
| PATCH | `/api/quizzes/questions/:id` | Update question | Staff | Question authoring |
| DELETE | `/api/quizzes/questions/:id` | Delete question | Staff | Question authoring |
| GET | `/api/quizzes` | List quizzes | Optional | Visibility/access rules apply |
| POST | `/api/quizzes` | Create quiz | Staff | Exam authoring |
| PATCH | `/api/quizzes/:id` | Update quiz | Staff | Exam authoring |
| DELETE | `/api/quizzes/:id` | Delete quiz | Staff | Exam lifecycle |
| POST | `/api/quizzes/:id/submit` | Submit attempt | Auth | Calculates score and skill analysis |
| GET | `/api/quizzes/results` | List quiz results | Auth | User or staff scope |
| POST | `/api/quizzes/results` | Save result | Auth | Used by submit flow |
| GET | `/api/quizzes/results/latest` | Latest result | Auth | Student UX shortcut |
| GET | `/api/quizzes/skill-progress` | Skill progress list | Auth | Mastery/remediation |
| GET | `/api/quizzes/question-attempts` | Question attempts list | Auth | Question-level analytics |
| POST | `/api/quizzes/question-attempts` | Save question attempt | Auth | Single-question analytics |
| GET | `/api/quizzes/analytics/overview` | Quiz analytics summary | Staff | Dashboard analytics |

### `/api/payments`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/payments/settings` | Payment configuration | Optional | Public view is sanitized |
| PATCH | `/api/payments/settings` | Update payment settings | Admin | Manual payment setup |
| GET | `/api/payments/requests` | List payment requests | Auth | Admin sees all |
| POST | `/api/payments/requests` | Create payment request | Auth | Student submits request |
| PATCH | `/api/payments/requests/:id/review` | Review payment request | Admin | Approve/reject/manual review |

### `/api/ai`
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/api/ai/status` | AI provider status | Auth | Shows provider availability |
| POST | `/api/ai/chat` | Tutor chat | Auth | Server-side AI proxy |
| POST | `/api/ai/study-plan` | Generate study plan | Auth | AI-assisted planning |
| POST | `/api/ai/learning-path` | Generate learning path | Auth | AI-assisted sequencing |
| POST | `/api/ai/remediation-plan` | Generate remediation plan | Auth | Weak-skill support |
| POST | `/api/ai/question` | Generate question | Auth | Question authoring aid |
| POST | `/api/ai/course-summary` | Generate course summary | Auth | Course/lesson summary |

## Request/response structures seen clearly
- Login/register return `{ token, user }`
- Current-user endpoint returns `{ user }`
- Health returns service status and database connectivity
- Payment request review returns request data and optionally updated user data
- Quiz submit returns score, question review, and skill analysis through persisted `QuizResult`

## Validation rules
Visible validation sources:
- `zod` schemas in route files
- env parsing in `server/src/config/env.ts`

Likely validation themes:
- required IDs and references
- role checks
- access-control checks
- quiz submission eligibility
- payment request ownership/review permissions

## Error handling style
- Centralized not-found handler
- Centralized error handler
- Routes are wrapped with async helpers
- Backend generally returns JSON errors rather than HTML

## Missing or undocumented APIs
No explicit OpenAPI/Swagger spec was visible.  
The API is documented by code, route files, and the client wrapper `services/api.ts`.

