# Open Questions

## Business questions
- What is the final commercial model: one-time purchase, subscription, school licensing, or a mix?
- Which content types are sold independently and which are bundled?
- Should teacher-created content generate revenue share automatically or only track it?
- Is the platform meant primarily for schools, private students, or both equally?

## Technical questions
- What is the final production deployment target?
- Is MongoDB Atlas the only production database, or is local Mongo only for development?
- What is the official file storage provider, if any?
- Are legacy Firebase files still only fallback code, or do they need to be removed later?

## Design questions
- Should the results page be simplified for younger learners and parents?
- Should quizzes, results, and learning plans use separate simplified views per age group?
- Should mobile layout be treated as first-class or as a responsive adaptation only?

## Payment / subscription questions
- Is payment manual review the permanent workflow or just a temporary stage?
- Are school packages supposed to override all student paywalls?
- Do access codes expire, limit use count, or both?
- Are there different package tiers by path, subject, or content type?

## Deployment questions
- Will frontend and backend be deployed on separate hosts?
- What are the allowed production origins for CORS?
- Who owns production secrets and deployment approvals?

## Legal / privacy questions
- What student data can parents see?
- What data can teachers see for other teachers’ classes or groups?
- Are there regional privacy rules that must be documented?
- Are payment receipts and uploaded files subject to retention rules?

## Content / education questions
- Is the canonical hierarchy definitely `path -> subject -> section -> skill`, or are there exceptions?
- Are “foundation topics” in the learning area actually skills, or a separate concept?
- Which content should be public, free, locked, or package-only?
- Are certificates required for all courses or only some?
- Should assignments be a first-class module or remain embedded inside lessons/quizzes?
- Should live sessions be integrated with Zoom, Google Meet, Teams, or another provider?

