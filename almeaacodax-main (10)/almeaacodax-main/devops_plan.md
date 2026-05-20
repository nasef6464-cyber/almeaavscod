# System Architecture & DevOps Strategy: The Hundred Platform

## 1. Analysis of Requirements
Based on the provided PDF documentation (Al Salem screenshots and feature lists), "The Hundred Platform" (منصة المئة) is a high-end LMS requiring:
- **Core LMS:** Courses, Lessons, Quizzes, Assignments (TutorLMS Pro base).
- **Advanced Analytics:** Skill gap analysis, predictive performance, detailed weakness reports (PDF 1, 3).
- **Gamification:** Badges, Leaderboards, Points, Daily Challenges (PDF 3).
- **AI Integration:** Adaptive testing, AI Chatbot (Gemini), Question Generation (PDF 3).
- **Security:** Exam proctoring (Webcam/Screen monitoring), 2FA.
- **DevOps:** CI/CD via Azure DevOps.

## 2. System Architecture

### Hybrid Headless Architecture
*   **Frontend:** React 18 SPA (The code provided in this project). Hosting: Azure Static Web Apps.
*   **Backend:** WordPress + TutorLMS Pro (Headless Mode). Hosting: Azure App Service (Linux Container).
*   **Database:** Azure Database for MySQL.
*   **AI Layer:** Azure OpenAI / Google Gemini API (via Gateway).
*   **Storage:** Azure Blob Storage (Video content, PDF resources).

### Data Flow
User -> React SPA -> Azure API Management -> WordPress REST API (TutorLMS) -> MySQL
                                          -> Gemini API (AI Features)

## 3. Azure DevOps Strategy

### Project Structure
*   **Project Name:** `TheHundred-LMS`
*   **Repositories:**
    *   `frontend-react`: The SPA code.
    *   `backend-wp-plugin`: Custom WordPress plugin extending TutorLMS.
    *   `iac-terraform`: Infrastructure as Code for Azure resources.

### CI/CD Pipelines (YAML)
1.  **Frontend Pipeline:**
    *   Trigger: Push to `main`.
    *   Steps: `npm install` -> `npm test` -> `npm run build` -> Deploy to Azure Static Web App.
2.  **Backend Pipeline:**
    *   Trigger: Push to `main`.
    *   Steps: PHPUnit Tests -> PHPCS (Code Sniffer) -> Zip Artifact -> Push to WP Engine/Azure App Service via SFTP/Git.

## 4. Backend Development Prompt (For Developer/Copilot)

**Role:** Senior WordPress Developer & AI Specialist
**Task:** Create a custom WordPress plugin named `the-hundred-core`.

**Requirements:**
1.  **TutorLMS Extension:**
    *   Extend `Tutor_Quiz` class to support "Adaptive Difficulty".
    *   Create a REST API endpoint `GET /wp-json/hundred/v1/analytics/student/{id}` that aggregates quiz data to return the "Skill Gap" JSON shown in PDF 3 (Algebra: 20%, Geometry: 50%).
2.  **AI Integration:**
    *   Integrate Google Gemini API.
    *   Hook: `tutor_quiz_question_create`. Use AI to generate 3 distractors for a given question stem.
3.  **Gamification:**
    *   Create DB table `wp_hundred_user_badges`.
    *   Implement logic: On `tutor_complete_lesson`, check criteria -> Award Badge.
4.  **Security:**
    *   Implement a REST endpoint to validate "Exam Session Tokens" for the React frontend's proctoring system.

**Tech Stack:** PHP 8.1, WP REST API, TutorLMS Hooks.
