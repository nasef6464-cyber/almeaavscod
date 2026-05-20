# AI Agent Context

## Who you are working for
You are working for the product owner of an Arabic educational platform.  
The owner wants the system to become a real production platform without changing the current visual identity or breaking working areas.

## What the project is
This repository is a full educational platform with:
- paths, subjects, sections, skills
- courses, lessons, questions, quizzes
- student analysis and reporting
- groups and schools
- payments and access codes
- AI-assisted learning support

## What has already been done
- Frontend and backend both exist.
- MongoDB is the primary backend data store.
- JWT authentication exists.
- Role-based access exists.
- Courses, questions, quizzes, results, and skill progress are modeled.
- School/group reports and import tools exist.
- AI provider abstraction exists on the backend.

## What must not be changed without permission
- Visual design and user-facing layout patterns should not be radically changed.
- Existing working flows should not be rewritten just for style.
- Do not remove fallback logic until the replacement is verified.
- Do not expose secrets.
- Do not destroy data or reset models without explicit approval.

## Coding style rules
- Prefer small, reversible changes.
- Preserve existing naming and conventions where possible.
- Keep route, model, and store changes consistent with the current architecture.
- Add comments only when they clarify non-obvious logic.
- Avoid unnecessary refactors when the task is feature completion or bug fixing.

## Architecture rules
- MongoDB + Mongoose is the main data backbone.
- Express backend is the source of truth for business logic.
- AI calls must go through backend routes only.
- Role checks must be enforced server-side, not only in the UI.
- Skill analysis must continue to derive from question/quiz data.

## Branching and commit rules
- Use a separate working branch for substantial work if branching is needed.
- Keep commits focused and descriptive.
- Never rewrite history unless explicitly instructed.
- Never commit secrets or `.env` values.

## How to inspect before editing
Before changing anything:
1. Read the relevant frontend page/component.
2. Read the matching backend route or model.
3. Check the store/adapter layer.
4. Confirm the data contract.
5. Only then patch the smallest safe area.

## How to avoid breaking the project
- Do not rename models, routes, or environment variables casually.
- Keep API response shapes stable.
- Do not break current role restrictions.
- Test on the relevant page and in the backend after each change.
- When a behavior is unclear, document it instead of guessing silently.

## How to handle unknowns
- Mark them as `Unknown / Needs Confirmation`.
- If an assumption is necessary, state it explicitly.
- Do not invent product rules.

## How to write summaries after each coding session
Every session summary should include:
- what was changed
- what was verified
- what remains open
- any risks introduced
- whether the change is safe to deploy

## Definition of Done
A task is done only when:
- the code compiles or the affected area is validated
- the change is tested in the relevant workflow
- no secrets were exposed
- documentation was updated if behavior changed
- the user can understand what changed without reading the entire codebase

## Testing expectations
- Validate backend endpoints when routes change.
- Validate key frontend flows in the browser when UI changes.
- Run lint/typecheck/check scripts when relevant.
- Use smoke tests for high-risk operational workflows.

## Security rules
- Never expose secrets in code, docs, or logs.
- Never move AI keys into the frontend.
- Treat school/student/payment data as sensitive.
- Keep bypasses local-only and documented.

## Documentation rules
- Update the handover docs when architecture or business rules change.
- Keep docs honest, direct, and evidence-based.
- Prefer plain language for the product owner and precise references for engineers.

