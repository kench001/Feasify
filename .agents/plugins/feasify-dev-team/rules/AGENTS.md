# Feasify Multi-Subagent Development Workflow

When developing, debugging, or refactoring features in Feasify, act as the coordinator and delegate work to specialized subagents for each affected layer instead of doing all layers monolithically in the main turn.

## Specialist Subagent Roster

If any subagent type below is not already listed in your active subagents, register it first with `define_subagent` (using the corresponding prompt in `.agents/plugins/feasify-dev-team/agents/<name>.md`) and then invoke it via `invoke_subagent`:

1. **`frontend-developer`** — `Feasify/src/` React 19, TypeScript, Tailwind CSS, Student/Adviser/Chairperson portals, and `src/translations/dictionary.ts`.
2. **`backend-developer`** — `feasify-backend/` Express 5 REST APIs, Socket.IO, Gemini endpoints, and services (`services/nameChecker/`, `services/dynamicExemplars.js`).
3. **`database-engineer`** — Cloud Firestore collections/queries (`users`, `groups`, `proposals`, `financials`, `notifications`, `auditLogs`, `messages`), `firebase.ts`, `auditLogger.ts`, `notificationService.ts`, `sectionExportService.ts`, and `feasify-backend/data/*.json`.
4. **`qa-tester`** — Build verification (`npm run build --prefix Feasify`), TypeScript & lint checks, backend test scripts (`feasify-backend/tests/`), and edge-case verification. Respects `Feasify/AGENTS.md` (do not launch the `browser` subagent unless explicitly requested by the user; leave live browser testing to the user).
5. **`ai-financial-engineer`** — Financial math, BMBE tax rules, product costing, balance sheet/income projections, `AI_Analysis.tsx`, `AdviserAIRules.tsx`, `feasibilityAudit.ts`, `productCosting.ts`, and PDF/CSV financial exports.
6. **`security-architect`** — Read-only review of RBAC (`ProtectedRoute`, role separation), auth/secret safety, cross-module API/Firestore contracts, and final code quality before handoff.

## Coordination Protocol

1. **Scope & Shard:** Break the request into affected layers (Front-End, Back-End, Database, AI/Financial Math, QA/Testing, Security/Architecture).
2. **Parallelize Independent Layers:** Invoke independent specialist subagents in parallel with clear file ownership, inputs/contracts, and expected outputs. Avoid assigning two write-enabled subagents to edit the exact same file concurrently (or assign isolated `workspace: "share"` if needed).
3. **Verify & Audit:** After implementation edits complete, invoke **`qa-tester`** (for build/type/test verification) and, for auth/cross-layer changes, **`security-architect`** (read-only diff/contract review).
4. **Synthesize:** Summarize verified changes, exact modified files, and command/test results accurately to the user.

