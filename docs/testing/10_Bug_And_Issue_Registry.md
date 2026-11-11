# 10. Feasify Bug and Defect Registry

**Document ID:** FEASIFY-DOC-10  
**Audit Target:** Feasify Capstone System  
**Date of Audit:** November 11, 2026  
**Auditor:** Lead QA Orchestrator & Multi-Agent Team  
**Status:** Documented & Pending User Approval for Staged Remediation  

---

## 1. Severity Distribution

| Severity Level | Count | Description |
|---|---|---|
| **Critical** | 0 | Catastrophic database corruption or server crash |
| **High** | 4 | Severe security vulnerability, unauthenticated mutation, or query truncation |
| **Medium** | 3 | Usability conflict, rate limiter warning, or oversized bundle |
| **Low** | 3 | TypeScript compilation warnings or dead code comparisons |
| **Total Bugs Documented** | **10** | Consolidated without duplication |

---

## 2. Comprehensive Bug Records

### FEASIFY-BUG-001: Unauthenticated Proposal Status Mutation (IDOR)
- **Module:** Backend REST API / Proposal Management
- **Severity:** **High** | **Priority:** **P1**
- **Affected Files:** `feasify-backend/index.js` (Line 773)
- **Preconditions:** Express backend server running on port 10000.
- **Steps to Reproduce:**
  1. Send an HTTP PUT request to `http://localhost:10000/api/proposals/target_proposal_id/status`.
  2. Include payload: `{"status": "Approved", "adviserRemarks": "Unauthorized approval"}`.
  3. Omit the `Authorization` header completely.
- **Expected Result:** Server rejects request with `HTTP 401 Unauthorized`.
- **Actual Result:** Server responds with `HTTP 200 OK`, updates Firestore document, and initiates academic exemplar ingestion.
- **Root Cause:** Route was registered without the `verifyToken` middleware.
- **Recommended Fix:** Mount `verifyToken` and validate that `req.user.role` is `"Adviser"` or `"Chairperson"` assigned to that group.
- **Retest Status:** Verified Reproducible.

---

### FEASIFY-BUG-002: Hardcoded Chairperson Email Privilege Escalation
- **Module:** Authentication & RBAC
- **Severity:** **High** | **Priority:** **P1**
- **Affected Files:** `Feasify/src/components/ProtectedRoute.tsx` (Line 31), `feasify-backend/index.js` (Line 97)
- **Preconditions:** Any user registering with email `chairperson@gmail.com`.
- **Steps to Reproduce:**
  1. Inspect `ProtectedRoute.tsx` line 31: `if (user.email?.toLowerCase() === "chairperson@gmail.com") setAuthState({ role: "Chairperson" })`.
  2. Register or log in with that email address.
- **Expected Result:** Role is strictly retrieved from the validated user profile in Firestore.
- **Actual Result:** Hardcoded string equality overrides database role and grants instant administrative permissions.
- **Root Cause:** Hardcoded developer shortcut left in production codebase.
- **Recommended Fix:** Delete the hardcoded email check; evaluate role exclusively via Firestore user document or Firebase Custom Claims.
- **Retest Status:** Verified Reproducible.

---

### FEASIFY-BUG-003: Firestore `in` Query 30-Element Limit Truncation
- **Module:** Adviser Dashboard / Database Querying
- **Severity:** **High** | **Priority:** **P2**
- **Affected Files:** `Feasify/src/AdviserDashboard.tsx` (Lines 327, 335, 365)
- **Preconditions:** Adviser assigned to multiple sections containing $>30$ student groups.
- **Steps to Reproduce:**
  1. Generate 35 student groups across assigned sections.
  2. Open `AdviserDashboard.tsx` and observe proposal loading query `where("groupId", "in", groupIds.slice(0, 30))`.
- **Expected Result:** All 35 teams have their proposals loaded.
- **Actual Result:** Only the first 30 groups are queried; groups 31 to 35 are silently omitted from the dashboard.
- **Root Cause:** Firestore limits `in` queries to 30 items. Slicing with `.slice(0, 30)` clips the remainder.
- **Recommended Fix:** Chunk `groupIds` into 30-element batches, query concurrently, and merge results.
- **Retest Status:** Confirmed via Code Audit.

---

### FEASIFY-BUG-004: Missing Repository `firestore.rules` (Client Write Boundary)
- **Module:** Database & Security Policy
- **Severity:** **High** | **Priority:** **P2**
- **Affected Files:** Repository Root / `firebase.ts`
- **Preconditions:** Direct client Firestore access.
- **Steps to Reproduce:**
  1. Inspect repository for `firestore.rules` or `firebase.json`.
  2. Open browser console and issue `addDoc(collection(db, "proposals"), { ... })`.
- **Expected Result:** A version-controlled `firestore.rules` file enforces schema, proposal quotas, and role checks.
- **Actual Result:** No `firestore.rules` exists in version control; security relies on untracked cloud console settings.
- **Root Cause:** Security rules were not committed to the Git repository.
- **Recommended Fix:** Commit and deploy a hardened `firestore.rules` file with role and proposal count constraints.
- **Retest Status:** Confirmed.

---

### FEASIFY-BUG-005: ESLint 9 Flat Config Plugin Crash
- **Module:** Development Tooling & Static Analysis
- **Severity:** **Medium** | **Priority:** **P3**
- **Affected Files:** `Feasify/eslint.config.cjs` (Line 11)
- **Steps to Reproduce:**
  1. Run `npm run lint --prefix Feasify`.
- **Expected Result:** ESLint executes and reports linting status.
- **Actual Result:** Process crashes with: `TypeError: Cannot read properties of undefined (reading 'recommended') at Feasify/eslint.config.cjs:11:27`.
- **Root Cause:** `reactHooks.configs.flat.recommended` is undefined in installed `eslint-plugin-react-hooks` v5.1.0.
- **Recommended Fix:** Change to `reactHooks.configs.recommended` or proper flat config export.
- **Retest Status:** Verified Reproducible (Exit Code 1).

---

### FEASIFY-BUG-006: Dead Code String Comparison `p.status === "APPROVED"`
- **Module:** Frontend Proposals Logic & Type Safety
- **Severity:** **Low** | **Priority:** **P4**
- **Affected Files:** `Feasify/src/Projects.tsx` (Lines 953, 1011, 2308), `AdviserDashboard.tsx` (Line 1216)
- **Steps to Reproduce:**
  1. Run `tsc --noEmit -p Feasify/tsconfig.app.json`.
- **Expected Result:** Code compiles without type overlap errors.
- **Actual Result:** TypeScript emits `error TS2367: This comparison appears to be unintentional because the types ... and '"APPROVED"' have no overlap.`
- **Root Cause:** Code checks for uppercase `"APPROVED"`, but the database and `ProposalData` union type only contain Title Case `"Approved"`.
- **Recommended Fix:** Remove `"APPROVED"` or normalize comparison with `p.status?.toLowerCase() === "approved"`.
- **Retest Status:** Verified Reproducible via `tsc`.

---

### FEASIFY-BUG-007: Unbounded Real-Time Collection Listeners in Chairperson Service
- **Module:** Database Performance & Scalability
- **Severity:** **High** | **Priority:** **P2**
- **Affected Files:** `Feasify/src/services/chairpersonFeasibilityService.ts` (Lines 534–573)
- **Steps to Reproduce:**
  1. Navigate to `/admin/projects`.
  2. Inspect Firestore network listener frames.
- **Expected Result:** Queries use `limit()` and pagination.
- **Actual Result:** Full `groups`, `proposals`, and `users` collections are streamed to client memory.
- **Root Cause:** Absence of query limits or pagination on administrative snapshot listeners.
- **Recommended Fix:** Introduce cursor-based pagination and Firestore document limits.
- **Retest Status:** Confirmed via Code Audit.

---

### FEASIFY-BUG-008: Proposal Card Status Border Styling Inconsistency
- **Module:** UI/UX & Design System
- **Severity:** **Medium** | **Priority:** **P3**
- **Affected Files:** `Feasify/src/Projects.tsx` (Lines 2696–2700)
- **Steps to Reproduce:**
  1. Open Student Proposals list with mixed status proposals (Approved, Rejected, Revision).
  2. Observe card outer borders.
- **Expected Result:** Consistent neutral borders with subtle pill badges.
- **Actual Result:** Cards render rainbow border indicators (`border-green-400`, `border-red-300`, `border-orange-300`) conflicting with clean academic card guidelines.
- **Root Cause:** Legacy status-based border styling was not refactored during design modernization.
- **Recommended Fix:** Unify outer border to `border-slate-200` and rely on high-contrast internal badges.
- **Retest Status:** Verified in UI Review.

---

### FEASIFY-BUG-009: Oversized Main Frontend Bundle Chunk (3.33 MB)
- **Module:** Frontend Build Performance
- **Severity:** **Medium** | **Priority:** **P3**
- **Affected Files:** `Feasify/vite.config.ts` / `Feasify/src/App.tsx`
- **Steps to Reproduce:**
  1. Run `npm run build --prefix Feasify`.
- **Expected Result:** Production assets bundled in modular chunks $<500$ kB.
- **Actual Result:** Monolithic chunk `dist/assets/index.js` generated at **3,330.32 kB (930 kB gzip)** with Vite warning.
- **Root Cause:** All routes and vendor libraries loaded synchronously in `App.tsx`.
- **Recommended Fix:** Apply `React.lazy()` route splitting and configure `rollupOptions.output.manualChunks`.
- **Retest Status:** Verified in Build Output.

---

### FEASIFY-BUG-010: Express Rate Limit IPv6 Validation Warning
- **Module:** Backend Security & Traffic Control
- **Severity:** **Low** | **Priority:** **P4**
- **Affected Files:** `feasify-backend/index.js` (Lines 119, 127)
- **Steps to Reproduce:**
  1. Initialize backend server.
  2. Observe stdout startup logs.
- **Expected Result:** Rate limiter initializes without warning.
- **Actual Result:** Emits `ERR_ERL_KEY_GEN_IPV6` warning regarding custom `keyGenerator` IPv6 fallback.
- **Root Cause:** Custom keyGenerator references `req.ip` without IPv6 normalization.
- **Recommended Fix:** Normalize IPv6 addresses or leverage `express-rate-limit` built-in IP helper.
- **Retest Status:** Verified Reproducible in Server Logs.
