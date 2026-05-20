# Business Rules and Policies

## Business rules discovered in the code
### Visibility and publishing
- Learners should only see content from active paths.
- Staff can see and manage more content than learners.
- Content can be hidden from platform display with flags like `showOnPlatform`.

### Content approval workflow
Many content entities carry workflow fields:
- `ownerType`
- `ownerId`
- `createdBy`
- `assignedTeacherId`
- `approvalStatus`
- `approvedBy`
- `approvedAt`
- `reviewerNotes`
- `revenueSharePercentage`

This indicates a moderation/review model for teacher-owned or assigned content.

### Educational taxonomy
- Learning is organized by path, level, subject, section, and skill.
- Skills are meant to be the common analytical unit across questions, lessons, quizzes, and reports.

### Quiz rules
Visible quiz modes include:
- regular
- saher
- central

Visible access patterns include:
- free
- paid
- private
- course-only

Quizzes can target:
- specific groups
- specific users
- due dates
- published/unpublished states

### Skill analysis rules
- Skill progress is updated from quiz results and question attempts.
- Question-level skill IDs are a source for remediation analysis.
- The platform is designed to infer student weakness from answer behavior.

### Access and commerce rules
- A course or content item can be part of a package.
- B2B packages can map to schools or groups.
- Access codes can unlock content.
- Payment requests are manually reviewed.
- Approved payments can apply purchases to the user account.

### Study plan rules
- A plan can have a start/end date.
- Study plans can skip completed quizzes.
- Off days can be specified.
- Preferred start time and daily minutes exist.

### Parent/school rules
- School reports can be viewed by admin or supervisor roles.
- Students may be linked to groups, schools, or parent accounts.

## Subscription/payment rules
- Payment settings are centrally stored.
- Manual review is the default pattern visible in the repository.
- Purchased content can update user subscription and enrolled courses.
- There is evidence of both course-level and package-level monetization.

## User access rules
- Roles define what each user can see and edit.
- Staff roles: admin, teacher, supervisor.
- Parent access appears more read-only and child-report focused.
- Development-only bypass exists only for local admin bootstrapping.

## Course enrollment rules
- Courses can be enrolled directly.
- Course/package ownership and visibility are both modeled.
- `User.enrolledCourses` and `User.enrolledPaths` are part of the user profile.

## Exam / quiz rules
- Quiz submission must pass access checks.
- Quiz results store detailed breakdowns.
- Quiz review includes question-by-question analysis and skill analysis.
- Individual question attempts are persisted.

## Certificate rules
- The model suggests certificate support may exist, but the exact issuance rule was not fully confirmed.
- `Course.certificateEnabled` is the clearest evidence.

## Legal / privacy / security assumptions
- AI API keys must not be exposed on the frontend.
- Authentication uses signed tokens and password hashing.
- CORS is restricted to the configured client origin.
- Local admin bypass should never be enabled in production.
- Student data, school data, and payment data should be treated as sensitive.

## Unknown rules that must be confirmed by the product owner
- Whether school packages override all student paywalls
- Whether certificates are auto-issued or manually approved
- Whether live sessions are part of the commercial offering
- Whether all content types can be sold independently
- Whether parents have access to all child activities or only reports
- Whether teacher revenue share is actually paid out or only tracked

