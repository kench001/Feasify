# 03. Feasify Functional Test Case Matrix

**Document ID:** FEASIFY-DOC-03  
**Scope:** Functional Verification across Student, Adviser, and Chairperson Portals  
**Execution Date:** November 11, 2026  
**Status:** Completed & Verified  

---

## 1. Test Case Format & Status Definitions

- **Passed:** Expected behavior matched actual observed behavior.
- **Failed:** Defect observed; deviates from expected requirements.
- **Blocked:** Precondition unmet or blocked by upstream issue.
- **Not Executed:** Safely bypassed due to environment boundaries.

---

## 2. Test Case Execution Matrix

### 2.1 Authentication & Account Management

| Test Case ID | Module | Test Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-AUTH-01** | Auth | User Registration | 1. Enter email, password, names.<br/>2. Click "Create Account". | Creates user in Firebase Auth and writes profile to `users` collection. | User registered; profile created in `users` with `createdAt`. | **Passed** |
| **TC-AUTH-02** | Auth | Login Valid Credentials | 1. Enter valid student email & password.<br/>2. Click "Sign In". | Authenticates successfully and redirects to `/dashboard`. | Authenticated; redirected to `/dashboard`. | **Passed** |
| **TC-AUTH-03** | Auth | Login Invalid Credentials | 1. Enter valid email with incorrect password.<br/>2. Click "Sign In". | Displays error message: "Invalid email or password." | Error toast/alert displayed; authentication denied. | **Passed** |
| **TC-AUTH-04** | Auth | Session Persistence | 1. Log in.<br/>2. Refresh browser page. | Session maintained via Firebase Auth IndexedDB persistence. | User remains authenticated without re-login prompt. | **Passed** |
| **TC-AUTH-05** | Auth | Password Reset Request | 1. Click "Forgot Password".<br/>2. Enter registered email and submit. | Sends password reset email with action code URL. | `sendPasswordResetEmail` called with configured action URL. | **Passed** |
| **TC-AUTH-06** | Auth | User Sign Out | 1. Open user dropdown.<br/>2. Click "Sign Out". | Signs out user, clears local session, redirects to `/`. | `signOutUser` invoked; session terminated; redirected to `/`. | **Passed** |

---

### 2.2 Role-Based Access Control (RBAC)

| Test Case ID | Module | Test Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-RBAC-01** | RBAC | Student Access to Projects | 1. Log in as Student.<br/>2. Navigate to `/projects`. | Page rendered successfully; proposals loaded. | Rendered `Projects.tsx` view with student controls. | **Passed** |
| **TC-RBAC-02** | RBAC | Student Restricted from Admin | 1. Log in as Student.<br/>2. Force URL navigation to `/admin/users`. | `ProtectedRoute` blocks student and redirects to `/dashboard`. | Blocked by `ProtectedRoute`; redirected to `/dashboard`. | **Passed** |
| **TC-RBAC-03** | RBAC | Student Restricted from Adviser | 1. Log in as Student.<br/>2. Force URL navigation to `/adviser/dashboard`. | `ProtectedRoute` blocks student and redirects to `/dashboard`. | Blocked by `ProtectedRoute`; redirected to `/dashboard`. | **Passed** |
| **TC-RBAC-04** | RBAC | Adviser Access to Dashboard | 1. Log in as Adviser.<br/>2. Navigate to `/adviser/dashboard`. | Displays assigned student sections and proposal queue. | Displays assigned section tabs, filter controls, and proposals. | **Passed** |
| **TC-RBAC-05** | RBAC | Adviser Restricted from Chairperson | 1. Log in as Adviser.<br/>2. Force URL navigation to `/admin/users`. | `ProtectedRoute` blocks adviser and redirects to `/adviser/dashboard`. | Blocked; redirected to `/adviser/dashboard`. | **Passed** |
| **TC-RBAC-06** | RBAC | Chairperson Elevated Access | 1. Log in as Chairperson.<br/>2. Navigate across `/admin/*` and `/adviser/*`. | Full access granted to both admin and adviser modules. | Permitted by `ProtectedRoute` (`allowedRoles: ["Chairperson"]`). | **Passed** |
| **TC-RBAC-07** | RBAC | Hardcoded Chairperson Email Bypass | 1. Inspect `ProtectedRoute.tsx` L31 and `index.js` L97.<br/>2. Test login with `chairperson@gmail.com`. | Role is assigned strictly from Firestore profile record. | **VULNERABILITY FOUND:** Hardcoded email grants instant Chairperson role without DB check. | **Failed** |

---

### 2.3 Capstone Proposal Management & 3-Proposal Limit (10 Scenarios)

| Test Case ID | Module | Test Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-PROP-01** | Proposal | Limit Scenario 1: Zero Proposals | 1. New group created.<br/>2. Query `/api/teams/:id/proposals/count`. | Count = 0, Max = 3, Allowed = true. | Count = 0, Max = 3, Allowed = true (`HTTP 200`). | **Passed** |
| **TC-PROP-02** | Proposal | Limit Scenario 2: One Proposal | 1. Submit Proposal 1.<br/>2. Query proposal count. | Count = 1, Max = 3, Allowed = true. | Proposal 1 created (`proposalNumber: 1`); Count = 1. | **Passed** |
| **TC-PROP-03** | Proposal | Limit Scenario 3: Two Proposals | 1. Submit Proposal 2.<br/>2. Query proposal count. | Count = 2, Max = 3, Allowed = true. | Proposal 2 created (`proposalNumber: 2`); Count = 2. | **Passed** |
| **TC-PROP-04** | Proposal | Limit Scenario 4: Three Proposals | 1. Submit Proposal 3.<br/>2. Query proposal count. | Count = 3, Max = 3, Allowed = false. | Proposal 3 created (`proposalNumber: 3`); Count = 3, `allowed: false`. | **Passed** |
| **TC-PROP-05** | Proposal | Limit Scenario 5: Attempt Fourth Proposal | 1. With 3 proposals on file, attempt to submit Proposal 4. | Client blocks form; backend rejects with `HTTP 400` ("Maximum of 3 proposals reached"). | Blocked on client modal; backend returns `HTTP 400` rejection. | **Passed** |
| **TC-PROP-06** | Proposal | Limit Scenario 6: Browser Refresh Persistence | 1. At 3 proposals, refresh page.<br/>2. Attempt to add new proposal. | State persists from database; Add button disabled or modal displayed. | Count persists as 3; allowed remains false; creation blocked. | **Passed** |
| **TC-PROP-07** | Proposal | Limit Scenario 7: Direct API Manipulation Bypass | 1. Send direct `POST /api/proposals` payload with group ID having 3 proposals. | Backend rejects with `HTTP 400` and `proposalLimitReached: true`. | Rejected with `HTTP 400` and `proposalLimitReached: true`. | **Passed** |
| **TC-PROP-08** | Proposal | Limit Scenario 8: Simultaneous Concurrent Submissions | 1. Fire 5 concurrent creation requests for the same group ID. | Exactly 3 succeed (`HTTP 201`); remaining 2 rejected (`HTTP 400`). | Exactly 3 created; 2 rejected with `HTTP 400`. Race condition safely handled. | **Passed** |
| **TC-PROP-09** | Proposal | Limit Scenario 9: Edit Existing Proposal at Limit | 1. With 3 proposals on file, edit and save changes to Proposal 2. | Editing existing proposal succeeds; does not increment total count. | Existing proposal updated (`HTTP 200`); total count remains 3. | **Passed** |
| **TC-PROP-10** | Proposal | Limit Scenario 10: Status Counting Rules | 1. Check whether Drafts, Under Review, and Rejected proposals count toward limit. | All proposals belonging to team count toward the 3-proposal cap. | All proposals for `groupId` count toward the 3-proposal limit. | **Passed** |
| **TC-PROP-11** | Proposal | Direct Client Firestore Bypass Risk | 1. Inspect `Projects.tsx` L1793.<br/>2. Check if client can bypass backend via direct Firestore write. | All creation requests must pass through backend validation. | **VULNERABILITY FOUND:** Client writes directly to Firestore via `addDoc`, bypassing backend if Firestore rules are permissive. | **Failed** |

---

### 2.4 Proposal Submission Button & Form Validation

| Test Case ID | Module | Test Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-FORM-01** | Submission | Incomplete Form Submission | 1. Leave required fields blank (e.g., Target Market, Location).<br/>2. Click "Submit to Adviser". | Submission blocked; modal displays exact missing field labels. | Blocked; `SubmissionFailureModal` lists missing fields with bullet points. | **Passed** |
| **TC-FORM-02** | Submission | Negative Capital Validation | 1. Enter `-50000` in Total Capital.<br/>2. Attempt to save or submit. | Blocked with toast: "Total capital cannot be negative." | Blocked; capital validation catches negative number and alerts user. | **Passed** |
| **TC-FORM-03** | Submission | Non-Leader Submission Check | 1. Log in as a team member (not leader).<br/>2. Attempt to add or submit proposal. | Blocked with toast: "Only the team leader is capable of adding a new proposal." | Action blocked; alert displayed informing user of leader requirement. | **Passed** |
| **TC-FORM-04** | Submission | Loading State & Double-Click Protection | 1. Fill form and click "Submit to Adviser". | Button shows spinner (`isSubmitting: true`); disables double-clicks. | Spinner rendered; button disabled during async transaction. | **Passed** |

---

### 2.5 Adviser & Chairperson Evaluation Workflows

| Test Case ID | Module | Test Scenario | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-ADV-01** | Adviser | Proposal Review View | 1. Log in as Adviser.<br/>2. Click on a submitted student proposal. | Full proposal details, financials, and remarks input load. | Details modal renders all sections and financial summary. | **Passed** |
| **TC-ADV-02** | Adviser | Approve Proposal | 1. Enter remarks.<br/>2. Click "Approve Proposal". | Status updates to "Approved"; student group status updates; notif sent. | Status changed to "Approved"; proposal marked active for group. | **Passed** |
| **TC-ADV-03** | Adviser | Request Revision | 1. Enter remarks explaining required changes.<br/>2. Click "Request Revision". | Status updates to "Revision Required"; remarks logged in history. | Status changed to "Revision Required"; student notified to revise. | **Passed** |
| **TC-ADV-04** | Adviser | Reject Proposal | 1. Enter justification.<br/>2. Click "Reject Proposal". | Status updates to "Rejected"; proposal disabled from active setup. | Status changed to "Rejected"; feedback history recorded. | **Passed** |
| **TC-ADV-05** | API | Unauthenticated Status Endpoint Vulnerability | 1. Issue `PUT /api/proposals/:id/status` without Authorization header. | Endpoint rejects request with `HTTP 401 Unauthorized`. | **VULNERABILITY FOUND:** Request succeeds with `HTTP 200`; missing `verifyToken` middleware. | **Failed** |
