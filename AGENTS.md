# Feasify Workspace Orchestration Rules

When developing, debugging, or modifying features in this repository, always organize and delegate work across specialized subagents for each affected layer (see `.agents/plugins/feasify-dev-team/` for full definitions):

- **`frontend-developer`** (`Feasify/src/`): React 19, TypeScript, Tailwind UI, Student/Adviser/Chairperson portals, and `src/translations/dictionary.ts`.
- **`backend-developer`** (`feasify-backend/`): Express 5 APIs, Socket.IO, Gemini endpoints, and backend services.
- **`database-engineer`**: Firestore queries, schemas, real-time `onSnapshot` listeners, `firebase.ts`, `auditLogger.ts`, `notificationService.ts`, and `feasify-backend/data/*.json`.
- **`ai-financial-engineer`**: Financial math, BMBE tax logic, product costing, AI scoring/rubrics (`AI_Analysis.tsx`, `AdviserAIRules.tsx`, `feasibilityAudit.ts`), and PDF/CSV financial exports.
- **`qa-tester`**: `npm run build --prefix Feasify`, TypeScript/lint checks, backend tests (`feasify-backend/tests/`), and edge-case verification (do not invoke `browser` subagent unless explicitly requested; manual browser testing is handled by the user).
- **`security-architect`**: Read-only review of RBAC (`App.tsx` `ProtectedRoute`), auth/env safety, and cross-module contracts.

## Execution Rules

1. For any task touching a layer, invoke the corresponding subagent (`invoke_subagent`). If the subagent type is not already mounted in the session, define it first via `define_subagent` using its agent spec in `.agents/plugins/feasify-dev-team/agents/<name>.md`.
2. Run independent layer subagents in parallel when their edited files do not overlap; serialize or coordinate edits if two layers touch the same file.
3. Always run **`qa-tester`** after edits to verify the build and relevant checks before reporting completion. Use **`security-architect`** for auth, database rule/query, or cross-layer changes.

