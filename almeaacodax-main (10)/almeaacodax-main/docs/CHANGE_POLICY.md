# Code Change Policy

## 🛑 STRICT PROHIBITIONS
1.  **Do NOT delete or rename** any existing file in `src/pages/` or `src/components/` unless authorized by the Architect.
2.  **Do NOT modify** the logic inside `src/pages/*.tsx` (Student Views) to depend directly on the backend yet. They must remain functional via `mockData` until the adapter layer is ready.
3.  **Do NOT** expose `process.env` or API Keys in client-side code.

## ✅ APPROVED PRACTICES
1.  **Additions over Modifications:** Create new folders (`pages/admin`, `pages/teacher`) for new features.
2.  **Service Adapter Pattern:**
    - Create `services/api.ts` (Real Backend).
    - Create `services/adapter.ts` (Interface to switch between `mockData` and `api`).
3.  **Backend First:** Implement logic in the Node.js server first, test via Postman/Curl, then build the UI.
4.  **Types:** Update `types.ts` to reflect the MongoDB schema (add `_id`, `createdAt`, etc.) while keeping backward compatibility with the mock interfaces.
