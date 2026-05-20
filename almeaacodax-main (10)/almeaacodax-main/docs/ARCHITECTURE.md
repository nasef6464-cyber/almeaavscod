# System Architecture

## Overview
The Hundred Platform is a Hybrid LMS using a React SPA frontend and a Node.js/Express backend, backed by MongoDB. It supports Multi-tenancy (Schools/Groups) and Role-Based Access Control (RBAC).

## High-Level Diagram

```mermaid
graph TD
    Client[React SPA (Vercel)]
    LB[Load Balancer / API Gateway]
    Server[Node.js Express Server (Render)]
    DB[(MongoDB Atlas)]
    AI[AI Providers: Gemini / OpenRouter / Qwen / DeepSeek / OpenAI / Local]

    Client -- REST/JSON --> Server
    Server -- Mongoose --> DB
    Server -- Proxy --> AI
    Client -- MockData (Legacy/Fallback) --> Client
```

## Tech Stack

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS
- **State:** React Context + Hooks
- **Routing:** React Router DOM
- **HTTP Client:** Native Fetch (wrapped in services)

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MongoDB (Mongoose ORM)
- **Validation:** Zod
- **Auth:** JWT (Access + Refresh Tokens)

## Integration Points
1.  **AI Layer:** All AI requests (Chat, Question Gen, Student Advisor, Admin Assistant) go to `POST /api/ai/*`. The backend holds all provider keys and can fail over through `AI_PROVIDER_ORDER` before using the safe internal fallback.
2.  **Legacy Support:** The `pages/` directory (Student View) currently uses `services/mockData.ts`. We will create `services/api.ts` and `services/adapter.ts` to switch data sources without rewriting UI.
