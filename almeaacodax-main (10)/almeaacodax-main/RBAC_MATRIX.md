# RBAC Matrix - منصة المئة

Date: 2026-05-13  
Scope: Phase 6/7 security and role-permission reference.

## Role Rules

| Area | Admin | Supervisor | Teacher | Parent | Student | Backend Protection |
|---|---|---|---|---|---|---|
| Platform settings | Full access | No | No | No | No | `requireAuth` + `requireRole(["admin"])` |
| User management | Full access | Scoped roadmap | No | No | No | `requireRole(["admin"])` currently |
| Homepage/platform fonts | Full access | No | No | No | No | Admin-only content routes |
| Taxonomy/path management | Full access | Staff editing where allowed | Staff editing where allowed | No | No | `requireRole(["admin","teacher","supervisor"])` with route-level ownership checks |
| Lessons/topics/library | Full access | Owned/school-scoped | Owned/assigned | Read allowed only | Read allowed only | Staff mutation routes plus ownership helpers |
| Courses/packages | Full access | Owned/school-scoped | Owned/assigned | Read allowed only | Read allowed only | Staff mutation routes plus ownership helpers |
| Access codes | Full access | School-scoped management | No | No | Redeem only | Admin/supervisor routes; redeem uses `requireAuth` |
| Payment settings | Full access | No | No | No | No | `requireRole(["admin"])` |
| Payment requests | Review all | No | No | No | Create/view own | Admin review route; list route scopes non-admin to own requests |
| Payment webhooks | Gateway only | No | No | No | No | HMAC signature, no user token required |
| Quiz/question authoring | Full access | Owned/school-scoped | Owned/assigned | No | No | `requireRole(["admin","teacher","supervisor"])` |
| Quiz submission | Can submit if allowed | Can submit if allowed | Can submit if allowed | Can submit if allowed | Can submit if allowed | `requireAuth` + server-side access/scoring |
| Quiz results | All/scoped | School/group scoped | Managed scope | Linked students | Own only | Dedicated scoped endpoints and role filtering |
| Notifications admin | Full access | No | No | No | No | `requireRole(["admin"])` |
| Operations/audit logs | Full access | No | No | No | No | `requireRole(["admin"])` |
| Backups/restore | Full access | No | No | No | No | `requireRole(["admin"])` |

## Phase 6/7 Hardening Delivered

- `requireRole` now validates the current MongoDB user before allowing a role-protected route.
- Disabled accounts and users whose roles changed are rejected on role-protected APIs even if they still hold an old JWT.
- Direct browser button hiding is not treated as security; backend role middleware remains the source of truth.
- Distributed rate limiting is Redis-ready through `rate-limit-redis`.
- Socket.IO is Redis-adapter ready through `@socket.io/redis-adapter`.

## Important Remaining Work

- Add fine-grained supervisor/teacher scoping tests with real fixtures.
- Expand ownership checks in every staff mutation route and keep route-specific helpers near the data model.
- Move auth from localStorage fallback to full refresh-token rotation in a later approved phase.
