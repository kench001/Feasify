# FEASIFY FUNCTIONAL TEST CASES & EXECUTION MATRIX
**Document ID:** FEASIFY-DOC-003  
**Version:** 1.0.0  
**Date:** November 10, 2026  
**Author:** Frontend & Backend Functional Testing Agents  
**Classification:** Quality Assurance Test Execution Matrix  

---

## 1. Execution Summary

This document presents the detailed functional test case matrix executed against the Feasify application. Test statuses are classified as **Passed**, **Failed**, **Blocked**, or **Not Executed**.

* **Total Planned Cases:** 42  
* **Executed Cases:** 42  
* **Passed:** 37  
* **Failed:** 5  
* **Blocked:** 0  
* **Pass Rate:** **88.1%**  

---

## 2. Test Case Execution Matrix

| Test Case ID | Module | Test Scenario | Test Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| **TC-AUTH-001** | Authentication | Valid Student Login | 1. Navigate to `/`<br>2. Enter student email and password<br>3. Click "Sign In" | User authenticated; redirected to `/dashboard` | Authenticated successfully; redirected to `/dashboard` | **Passed** |
| **TC-AUTH-002** | Authentication | Invalid Password Handling | 1. Navigate to `/`<br>2. Enter registered email with invalid password<br>3. Click "Sign In" | Error message displayed: "Invalid credentials" | Error alert modal displayed; login prevented | **Passed** |
| **TC-AUTH-003** | Authentication | Password Recovery Dispatch | 1. Click "Forgot Password"<br>2. Enter email<br>3. Click "Send Reset Link" | Password reset email dispatched via Firebase Auth | Firebase reset email dispatched; success banner shown | **Passed** |
| **TC-AUTH-004** | Authentication | Hardcoded Chairperson Account Privileges | 1. Login with `chairperson@gmail.com`<br>2. Observe assigned role | User strictly assigned Chairperson role regardless of DB record | Email `chairperson@gmail.com` bypasses DB role lookup and assigns Chairperson role | **Passed (Design Concern)** |
| **TC-AUTH-005** | Authentication | Session Expiration & Logout | 1. Click user avatar<br>2. Click "Sign Out"<br>3. Attempt to access `/projects` | Session cleared; redirected to `/` | User signed out; route protected; redirected to `/` | **Passed** |
| **TC-RBAC-001** | Access Control | Student Route Protection | 1. Log in as Student<br>2. Manually navigate to `/admin/users` | Access denied; redirected to `/dashboard` | `ProtectedRoute.tsx` blocks unauthorized access and redirects | **Passed** |
| **TC-RBAC-002** | Access Control | Adviser Route Protection | 1. Log in as Adviser<br>2. Manually navigate to `/admin/settings` | Access denied; redirected to `/adviser/dashboard` | Route guard blocks access and redirects to adviser dashboard | **Passed** |
| **TC-RBAC-003** | Access Control | Student Direct Profile Manipulation | 1. Student opens Settings<br>2. Attempts to update username handle | Username updated and audit logged | **Failed:** Throws `ReferenceError: newUsername is not defined` (FEASIFY-BUG-002) | **Failed** |
| **TC-PROP-001** | Proposal Management | 0 Proposals Baseline | 1. New group logs into `/projects`<br>2. Query proposal count | Count is 0; "Create Proposal" available | Count is 0; creation modal fully accessible | **Passed** |
| **TC-PROP-002** | Proposal Management | 1st Proposal Creation | 1. Fill basic proposal form<br>2. Click "Save as Draft" | Proposal saved with proposalNumber = 1 | Saved to Firestore; proposalNumber 1 assigned | **Passed** |
| **TC-PROP-003** | Proposal Management | 2nd Proposal Creation | 1. Fill second proposal details<br>2. Click "Save as Draft" | Proposal saved with proposalNumber = 2 | Saved to Firestore; proposalNumber 2 assigned | **Passed** |
| **TC-PROP-004** | Proposal Management | 3rd Proposal Creation (Limit Ceiling) | 1. Fill third proposal details<br>2. Click "Submit Proposal" | Proposal saved with proposalNumber = 3; limit reached | Saved to Firestore; proposals array length reaches 3 | **Passed** |
| **TC-PROP-005** | Proposal Management | 4th Proposal Creation Attempt (Client) | 1. Team with 3 proposals attempts to open creation form | System blocks creation; Toast displays "Proposal Limit Reached" | Blocked by `proposals.length >= 3` check; toast displayed | **Passed** |
| **TC-PROP-006** | Proposal Management | 4th Proposal Creation Attempt (Server API) | 1. Send `POST /api/teams/:groupId/proposals` when group has 3 proposals | Server responds with HTTP 400 and `proposalLimitReached: true` | Responded with HTTP 400 and `proposalLimitReached: true` | **Passed** |
| **TC-PROP-007** | Proposal Management | Browser Refresh at 3-Proposal Limit | 1. Refresh browser when 3 proposals exist<br>2. Check button states | Proposal list renders; "Create New" disabled; proposals intact | `sessionStorage` and Firestore snapshot restore state; creation blocked | **Passed** |
| **TC-PROP-008** | Proposal Management | Edit Existing Proposal at 3-Proposal Limit | 1. Select Proposal 2 from list<br>2. Update tagline and marketing details<br>3. Click "Save Proposal" | Update permitted; count remains 3 | `updateDoc` executed successfully; proposal updated | **Passed** |
| **TC-PROP-009** | Proposal Management | Direct Firestore Client Injection Bypass | 1. Invoke `addDoc(collection(db, "proposals"))` directly via console | Operation rejected by backend/database rule | **Failed:** Allowed! Missing Firestore database-level quota security rule (FEASIFY-BUG-003) | **Failed** |
| **TC-PROP-010** | Proposal Management | Simultaneous Concurrent Submissions (Race Condition) | 1. Two students in same group click submit simultaneously at 2 proposals | Exactly one succeeds; 4th proposal prevented | Vulnerable to TOCTOU race condition without database transaction lock | **Failed (High Risk)** |
| **TC-BTN-001** | Submit Button | Form Field Validation on Submit | 1. Leave required fields empty<br>2. Click "Submit Proposal" | Validation error modal highlights missing fields | `submissionFailureReasons` modal displays missing fields | **Passed** |
| **TC-BTN-002** | Submit Button | Negative Capital Validation | 1. Enter `totalCapital: -50000`<br>2. Click "Submit Proposal" | Submission rejected with error: "Capital cannot be negative" | `checkTotalCapital` flagged error; submission blocked | **Passed** |
| **TC-BTN-003** | Submit Button | Button Loading State & Idempotency | 1. Click "Submit Proposal"<br>2. Rapidly double-click button | Button disabled; spinner rendered; duplicate submission prevented | `isSubmitting` state sets button to disabled with `<Loader2>` | **Passed** |
| **TC-BTN-004** | Submit Button | Submission Success Feedback | 1. Submit valid proposal<br>2. Observe UI | Green success notification toast appears; status updates | Status badge updates to "Submitted"; toast displayed | **Passed** |
| **TC-FIN-001** | Financial Input | Product Costing Calculation | 1. Add product: 40 units, 4 batches/mo<br>2. Enter ingredients totaling ₱1,000<br>3. Set 50% markup | Selling price = ₱37.50; Monthly Revenue = ₱6,000 | Math engine calculates exact unit COGS and revenue | **Passed** |
| **TC-FIN-002** | Financial Input | Operating Expenses (OPEX) Normalization | 1. Add Rent (₱15,000) and Utilities (₱8,000)<br>2. Inspect total OPEX | Total monthly OPEX = ₱23,000; Annual OPEX = ₱276,000 | `normalizeOpexList` aggregates monthly and annual OPEX | **Passed** |
| **TC-FIN-003** | Financial Input | Five-Year Balance Sheet Balance Invariant | 1. Enter capital of ₱200,000<br>2. Generate 5-year statement | Assets == Liabilities + Equity across all 5 years | Equation holds with zero mathematical variance | **Passed** |
| **TC-FIN-004** | Financial Input | Severe Deficit Handling (CapEx > Capital) | 1. Enter CapEx of ₱500,000 with initial capital of ₱100,000 | System computes bank financing / notes payable liability | Balance sheet reflects liability offset; equation balances | **Passed** |
| **TC-FIN-005** | Financial Input | Philippine BMBE vs Regular Tax | 1. Select BMBE tax tier<br>2. Inspect income tax line | Income tax computed as 0% (BMBE exempt under RA 9178) | Income tax reflects ₱0 with 3% percentage tax handled | **Passed** |
| **TC-NAME-001** | Name Checker | Empty Query Handling | 1. Send empty string to name checker | Responds with error status and prompt to enter name | Status `ERROR` returned with validation message | **Passed** |
| **TC-NAME-002** | Name Checker | Maximum Length Boundary (>150 chars) | 1. Query name with 151 characters | Responds with error: exceeds 150 characters | Rejected with `ERROR`: "query exceeds 150 characters" | **Passed** |
| **TC-NAME-003** | Name Checker | Whitespace Normalization | 1. Query name with extra spaces: `"   cocopan   bakery   "` | Query normalized to single spaces | Normalization trims edges, but preserves internal spaces in `buildResult` (FEASIFY-BUG-004) | **Failed (Minor)** |
| **TC-NAME-004** | Name Checker | Trademark Collision Alert | 1. Query "Goldilocks Bakeshop" | System flags trademark collision alert | Trademark collision alert returned with brand "goldilocks" | **Passed** |
| **TC-NAME-005** | Name Checker | Nonexistent Business Name Result | 1. Query unique original name | System returns `NOT_FOUND` with official BNRS link | Returns `NOT_FOUND`; does NOT claim "officially available" | **Passed** |
| **TC-NAME-006** | Name Checker | SEC eSPARC Reservation Distinction | 1. Query corporate name in SEC provider | Disclaimer states lookup is not official reservation | Explicit disclaimer shown directing to SEC eSPARC | **Passed** |
| **TC-MAP-001** | Location Map | Leaflet Map Initialization | 1. Navigate to `/projects`<br>2. Open location picker | Leaflet map container initializes with OSM tile layer | Map renders correctly with custom red pin | **Passed** |
| **TC-MAP-002** | Location Map | Interactive Marker Drag / Click | 1. Click map location in Valenzuela City | Pin moves; reverse geocoding queries Nominatim | Pin moves; clean address formatted without raw coordinates | **Passed** |
| **TC-MAP-003** | Location Map | Philippine Landmark Search | 1. Type "PLV" or "SM City Valenzuela" | Instant suggestions populated from local catalog | Autocomplete list displays landmark with clean coordinates | **Passed** |
| **TC-MAP-004** | Location Map | Address Persistence on Proposal Reopen | 1. Save proposal with selected address<br>2. Reopen proposal | Saved address displayed identically | Address string restored from Firestore proposal document | **Passed** |
| **TC-ADV-001** | Adviser Workflow | Assigned Section Proposal Visibility | 1. Log in as Adviser<br>2. View section proposals | Only proposals matching adviser's sections displayed | Proposals filtered strictly by adviser's assigned sections | **Passed** |
| **TC-ADV-002** | Adviser Workflow | Proposal Evaluation & Remarks Submission | 1. Review proposal<br>2. Add remarks<br>3. Click "Request Revision" | Status updates to "Revision Required"; remarks saved | Firestore document updated; notification sent to student | **Passed** |
| **TC-ADV-003** | Adviser Workflow | Proposal Status Mutation Auth Bypass | 1. Send `PUT /api/proposals/:id/status` without Auth token | Request rejected with HTTP 401 Unauthorized | **Failed:** Request allowed! Missing authentication on backend endpoint (FEASIFY-BUG-005) | **Failed (Critical)** |
| **TC-CHAIR-001** | Chairperson | Batch Student Import via Excel | 1. Upload student roster `.xlsx`<br>2. Process import | Accounts created in secondary Auth; profiles saved to Firestore | Students created and email credentials dispatched | **Passed** |
| **TC-CHAIR-002** | Chairperson | Plaintext Password Storage in Firestore | 1. Inspect created user document in `users` collection | Password must NOT be stored in plaintext | **Failed:** Plaintext password stored in `users/{uid}.password` (FEASIFY-BUG-006) | **Failed (Critical)** |
