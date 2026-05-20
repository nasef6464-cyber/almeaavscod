# Risk Register

| Risk | Area | Severity | Probability | Evidence | Suggested mitigation |
|---|---|---:|---:|---|---|
| Legacy Firebase fallback can conflict with MongoDB | Architecture | High | Medium | `App.tsx`, `services/adapter.ts`, Firebase-related files in root | Keep Mongo as source of truth and document fallback removal plan |
| Missing deployment manifest | Deployment | High | Medium | No clear deployment config was visible | Define and document the production deployment target |
| Secrets could leak into frontend if AI is handled incorrectly | Security / AI | High | Medium | AI gateway exists and must remain server-side | Keep all AI keys in backend env only |
| Manual payment logic can fail or be abused | Payments | High | Medium | `server/src/routes/payment.routes.ts` | Validate review workflow and approvals carefully |
| Access control mistakes can expose paid content | Authorization | High | Medium | package/course/quiz access rules | Test learner vs staff visibility paths thoroughly |
| Quiz skill analysis can become inconsistent | Data integrity | High | Medium | `QuizResult`, `SkillProgress`, `QuestionAttempt` | Ensure one canonical skill source and consistent updates |
| Files/resources may rely on undeclared storage | Media/storage | Medium | Medium | `FileModal`, `CustomVideoPlayer` | Define a real storage strategy and retention policy |
| Some modules may be partially implemented but look complete | Product scope | Medium | High | Multiple pages/managers exist | Mark partial features explicitly in docs and UI |
| Poor test coverage | Quality | High | High | No clear automated test suite visible | Add smoke coverage and basic validation checks |
| No explicit notification service | Notifications | Medium | High | No provider files visible | Confirm whether notifications are needed and choose a provider |
| Model denormalization can drift | Data model | Medium | Medium | Many repeated `pathId/subjectId/sectionId` references | Add update discipline and validation checks |
| Teacher/supervisor reports may expose too much or too little | Privacy / reports | High | Medium | Multiple role-based dashboards and school reports | Define role-scoped report rules clearly |
| AI provider availability may vary | AI / operations | Medium | Medium | Multi-provider abstraction | Document fallback mode and failure behavior |
| Local admin bypass could be misused | Security | High | Low | `DEV_LOCAL_ADMIN_BYPASS` in env | Ensure it is disabled in production |

