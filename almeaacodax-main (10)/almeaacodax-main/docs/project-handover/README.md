# Project Handover Index

This folder is the handover package for the next AI coding agent and for the product owner.

Important: read `../NEXT_SESSION_HANDOVER_AR.md` first before using this package, because it contains the latest strict execution contract and the current closed/open batches.
Latest closed batch reports:
- `../BATCH_SUPERVISOR_REPORTS_FINAL_2026-05-14_AR.md`
- `../BATCH_PAYMENT_COUNTRY_PRESETS_2026-05-14_AR.md`
- `../BATCH_PAYMENT_ADMIN_UI_PRESETS_SUMMARY_2026-05-14_AR.md`
- `../BATCH_PAYMENT_REQUESTS_SERVER_PAGINATION_2026-05-14_AR.md`
- `../BATCH_PAYMENT_REQUEST_FILTERS_COUNTRY_METHOD_2026-05-14_AR.md`
- `../BATCH_PAYMENT_REQUESTS_GLOBAL_SUMMARY_RESET_FILTERS_2026-05-14_AR.md`
- `../BATCH_GOOGLE_CALLBACK_COMPAT_ALIAS_2026-05-14_AR.md`

## Recommended reading order
1. `17_STRICT_BATCH_RULE_AR.md` - mandatory current rule: every touched batch must be fully closed, tested, deployed, and documented before moving on
2. `16_CURRENT_WORKING_STATE_AR.md` - Arabic live handover for the current production state and next-agent instructions
3. `00_EXECUTIVE_SUMMARY.md`
4. `01_PRODUCT_VISION.md`
5. `02_TECHNICAL_ARCHITECTURE.md`
6. `03_REPOSITORY_MAP.md`
7. `04_FEATURES_STATUS.md`
8. `05_DATABASE_AND_DATA_MODEL.md`
9. `06_API_AND_BACKEND_CONTRACTS.md`
10. `07_FRONTEND_STRUCTURE.md`
11. `08_BUSINESS_RULES_AND_POLICIES.md`
12. `09_DEVELOPMENT_ROADMAP.md`
13. `10_BACKLOG_FOR_NEXT_AGENT.md`
14. `11_AI_AGENT_CONTEXT.md`
15. `12_HANDOVER_CONTRACT.md`
16. `13_OPEN_QUESTIONS.md`
17. `14_SETUP_AND_RUNBOOK.md`
18. `15_RISK_REGISTER.md`

## How to use this package
- The next AI agent should start with `17_STRICT_BATCH_RULE_AR.md`, then `16_CURRENT_WORKING_STATE_AR.md`, then continue through the older numbered package.
- The product owner should read the executive summary, roadmap, open questions, and risk register first.
- The next AI agent should read the technical architecture, repository map, API contract, database model, and AI agent context first.
- Any claim that was not directly visible in the repository is marked as `Unknown / Needs Confirmation`.

## Scope
This handover package documents the repository as it currently exists, without modifying source code.

## Mandatory Deployment Rule (New)
- After every batch closure, the agent must perform: `commit` + `push` to GitHub.
- Backend changes require Render deploy using the same commit SHA.
- Frontend changes require Vercel deploy using the same commit SHA.
- Batch status cannot be marked `Fully closed` without live production verification after deploy.
- This rule is mandatory for any future/new Codex account working on this repository.
