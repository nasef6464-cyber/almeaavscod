# Repository Map

## Important top-level folders
| Folder | Responsibility |
|---|---|
| `components/` | Shared UI components, layout shells, video player, rich text editor, modal windows, learning widgets, auth helpers |
| `contexts/` | React context providers, including authentication/session behavior |
| `dashboards/` | Role-based dashboard implementations, especially the admin dashboard and builders |
| `pages/` | Main route pages for student-facing and content-facing screens |
| `server/` | Express backend, models, routes, services, scripts, sockets, and runtime build output |
| `services/` | Client API wrapper, adapters, and external integrations |
| `store/` | Zustand application state and data hydration/actions |
| `utils/` | Helper utilities |
| `scripts/` | Local helper scripts such as local MongoDB start/stop |
| `local-mongodb/` | Local MongoDB support/data area visible in the repository tree |
| `backups/` | Backup artifacts and historical snapshots |
| `migrated_prompt_history/` | Historical migration or prompt artifacts |
| `dist/` | Frontend build output |

## Entry points
### Frontend
- `index.html`
- `index.tsx`
- `App.tsx`

### Backend
- `server/src/server.ts`
- `server/src/app.ts`
- `server/src/routes/index.ts`

## Important configuration files
- `package.json`
- `server/package.json`
- `tsconfig.json`
- `server/tsconfig.json`
- `vite.config.ts`
- `server/.env.example`
- `.env.development`
- `firebase-applet-config.json`
- `firebase-blueprint.json`
- `firestore.rules`

## Important scripts
### Root scripts
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run typecheck`
- `npm run server:dev`
- `npm run server:build`
- `npm run server:check`
- `npm run smoke:operational`

### Backend scripts
- `npm --prefix server run dev`
- `npm --prefix server run build`
- `npm --prefix server run start`
- `npm --prefix server run check`
- `npm --prefix server run seed:admin`
- `npm --prefix server run seed:platform`
- `npm --prefix server run seed:courses:api`
- `npm --prefix server run seed:users`
- `npm --prefix server run seed:operational`
- `npm --prefix server run seed:operational:api`
- `npm --prefix server run seed:learning:api`
- `npm --prefix server run smoke:operational:api`

## Build and run commands
### Local development
1. Install root dependencies: `npm install`
2. Install backend dependencies: `npm --prefix server install`
3. Run frontend: `npm run dev`
4. Run backend: `npm run server:dev`

### Production build
1. Frontend build: `npm run build`
2. Backend build: `npm run server:build`
3. Start backend from built output: `npm --prefix server run start`

## Testing commands
No dedicated automated test suite was clearly visible in the repository.  
Visible validation commands:
- `npm run lint`
- `npm run typecheck`
- `npm run server:check`
- `npm run smoke:operational`
- `npm --prefix server run smoke:operational:api`

## Database migration / seed commands
No formal migration framework was visible.  
Seed and scenario scripts are present in `server/src/scripts/`:
- admin seed
- platform seed
- demo users seed
- courses seed
- operational scenario seed
- learning inventory seed

## What each main area does
### `components/`
Contains the reusable UI building blocks:
- navigation
- layouts
- players
- modals
- AI-related widgets
- editor widgets

### `pages/`
Contains the user-facing routes:
- landing page
- dashboard
- courses
- quizzes
- results
- reports
- favorites
- plan
- QA
- profile
- blog
- lesson/course views

### `dashboards/admin/`
Contains the administration console:
- path management
- foundation management
- users, groups, schools, questions, quizzes, lessons, courses, library, live sessions, finance, homepage, and skill tree management

### `server/src/`
Contains the real application backend:
- configuration
- auth middleware
- database models
- API routes
- business services
- socket server
- seed scripts

