# Product Vision

## Platform idea
The platform is an educational operating system for schools, teachers, parents, and independent students.  
It organizes learning around structured educational content and skill mastery instead of only storing videos or exams.

## The problem it solves
- Many learning systems only store content, but do not connect content to skills, progress, reports, and remediation.
- Schools need controlled access, reporting, and group management.
- Teachers need a workflow to create content and track performance.
- Parents need understandable progress reports.
- Students need a clear learning journey with review and recommendations.

## Main user journeys
### Student journey
1. Log in.
2. Browse paths, courses, and learning content.
3. Watch lessons or open library resources.
4. Take quizzes or exam-like experiences.
5. Receive score, skill analysis, and review details.
6. Save favorites or review-later items.
7. Follow a study plan and recommended remediation.

### Teacher journey
1. Create or manage content.
2. Add lessons, questions, quizzes, and courses.
3. Link content to paths, subjects, sections, and skills.
4. Review content if an approval workflow is active.
5. Monitor skill weaknesses and performance.

### Admin journey
1. Manage taxonomy, content, users, groups, schools, and packages.
2. Approve or review content.
3. Control publishing and visibility.
4. Review payments and access codes.
5. Inspect reports and operational data.

### Parent journey
1. View a child’s learning state.
2. Review quiz results and skill weaknesses.
3. Follow progress and recommendations.

### Supervisor journey
1. Manage a school or supervised group.
2. View reports for students and classes.
3. Import students and assign them to classes/groups.

## Main roles/users
Visible in the repository:
- `student`
- `teacher`
- `admin`
- `supervisor`
- `parent`

## Core modules of the educational platform
- Authentication and user accounts
- Taxonomy: path / level / subject / section / skill
- Courses
- Lessons
- Questions
- Quizzes / exams
- Quiz results and skill analysis
- Student dashboards and reports
- Study plans
- Favorites / review later
- Groups and schools
- B2B packages and access codes
- Manual payments
- Homepage/content management
- AI tutoring / remediation / summaries

## Expected business model visible from the code
Evidence suggests a hybrid education business model:
- direct course/content sales
- packaged access by path, subject, or content type
- school/group distribution
- access codes
- manual payment review
- teacher or content-owner revenue share fields

## Assumptions that need confirmation
- Whether certificates are already operational or only planned.
- Whether live classes are production-ready or only partially implemented.
- Whether schools use one tenant per school or a shared platform with role scoping.
- Whether the business model includes subscriptions, one-time purchases, or both.

