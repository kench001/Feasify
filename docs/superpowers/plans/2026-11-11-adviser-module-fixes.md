# Feasify Adviser Module Bug Fixes, UI/UX Refinements & Export System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all reported Adviser Module bugs (auto-grouping math, bulletin duplicate feedback, date format standardization, filter tag contrast, AI analysis empty states, group card whitespace, adviser re-analyze removal) and implement the centralized 3-section PDF export modal below Group History.

**Architecture:** 
1. Core business logic (grouping distribution, date formatting, section export) extracted into dedicated, pure TypeScript services in `Feasify/src/utils/` and `Feasify/src/services/`.
2. Backend idempotency and validation endpoints added to `feasify-backend/index.js` for safe feedback creation.
3. React UI components (`AdviserDashboard.tsx`, `ActiveBusinessDetailView.tsx`, `ProposalExportModal.tsx`) updated with resilient state locks, accessible high-contrast filter pills, and compact flex/grid layouts.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Firebase Firestore 12, Node.js Express 5, jsPDF, jspdf-autotable, Lucide Icons.

**Spec:** Master prompt specification for Feasify Adviser Module overhaul.

## Global Constraints

- Never modify database date values merely to change presentation; preserve original timestamps.
- Never fabricate AI Feasibility Analysis results when proposal has not been analyzed.
- Respect configured min/max grouping constraints: reject impossible student distributions mathematically (`ceil(N / M) <= floor(N / m)`).
- Preserve existing application architecture, authentication, and Student module functionality.
- Export selected sections in strict deterministic order: Project Overview -> Financial Input -> AI Feasibility Analysis.

## Review Focus

1. Auto-grouping edge cases with impossible populations (e.g. 5 students with min 3, max 4; 2 students with min 3, max 5) rejecting safely without partial Firestore writes.
2. Rapid double-clicking / keypresses on feedback submission blocked both in UI via ref lock and in backend/Firestore via idempotency deduplication.
3. Proposal date rendering across views and exports adhering to "November 11, 2026" and "November 11, 2026, 2:30 PM" with Asia/Manila timezone consistency.
4. Active Business Details AI tab displaying proper "NOT_ANALYZED" empty state instead of fabricated live-audit verdict when proposal has no AI evaluation.
5. Centralized PDF export producing a single unified document with selected sections, disabling unanalyzed AI analysis export, and sanitizing output filenames.

---

### Task 1: Auto-Grouping Mathematical Feasibility Algorithm

**Files:**
- Create: `Feasify/src/utils/groupDistribution.ts`
- Create: `feasify-backend/tests/groupDistribution.test.js`
- Modify: `Feasify/src/AdviserDashboard.tsx:1009-1135`

**Interfaces:**
- Consumes: `StudentData[]`, `minMembers: number`, `maxMembers: number`
- Produces: `calculateGroupDistribution(studentCount, min, max): { valid: boolean, error?: string, groupSizes?: number[] }`

- [ ] **Step 1: Write test for group distribution algorithm**
Create `feasify-backend/tests/groupDistribution.test.js` testing exact cases from specification:
- 20 students, min 3, max 5 -> 4 groups of 5
- 12 students, min 3, max 4 -> 3 groups of 4
- 10 students, min 3, max 4 -> groups of 3, 3, and 4
- 7 students, min 3, max 4 -> groups of 3 and 4
- 5 students, min 3, max 4 -> invalid / rejected
- 2 students, min 3, max 5 -> invalid / rejected

- [ ] **Step 2: Run test to verify failure**
Run: `node feasify-backend/tests/groupDistribution.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `calculateGroupDistribution` in `Feasify/src/utils/groupDistribution.ts`**
Implement the mathematical feasibility formula:
$G_{min} = \lceil N / M \rceil$, $G_{max} = \lfloor N / m \rfloor$.
If $G_{min} > G_{max}$ or $N < m$, return error:
"Unable to generate groups. The current number of students ({N}) cannot be divided into groups of {min} to {max} members. Please adjust the group size settings."
If valid, calculate sizes for $G = G_{min}$ (or optimal $G$), distributing remainder evenly: base size $q = \lfloor N / G \rfloor$, remainder $r = N \pmod G$.

- [ ] **Step 4: Integrate into `AdviserDashboard.tsx` (`executeAutoGroup`)**
Validate each affected section before any Firestore batch write. If any section fails feasibility, abort and show error modal with human-readable message.

- [ ] **Step 5: Run tests and verify PASS**
Run: `node feasify-backend/tests/groupDistribution.test.js`
Expected: PASS with 100% test assertions satisfied.

---

### Task 2: Duplicate Advisory Bulletin Feedback Prevention & Idempotency

**Files:**
- Modify: `feasify-backend/index.js`
- Modify: `Feasify/src/AdviserDashboard.tsx:1415-1458`
- Modify: `Feasify/src/components/ActiveBusinessDetailView.tsx:2348-2378`
- Test: `feasify-backend/tests/feedbackDeduplication.test.js`

**Interfaces:**
- Consumes: `proposalId: string`, `feedback: { text: string, authorName: string, role: string, idempotencyKey: string }`
- Produces: `POST /api/proposals/:proposalId/feedback` with duplicate suppression

- [ ] **Step 1: Write backend and client-lock test for feedback deduplication**
Test rapid submission with identical idempotencyKey and identical text within debounced window; verify only one record inserted.

- [ ] **Step 2: Implement backend feedback endpoint with idempotency**
Add `POST /api/proposals/:proposalId/feedback` in `feasify-backend/index.js`. Check if proposal's recent feedback contains matching idempotencyKey or matching content within recent 10-second window.

- [ ] **Step 3: Implement synchronous ref lock & button disable in `ActiveBusinessDetailView.tsx` & `AdviserDashboard.tsx`**
Add `isSubmittingRef` to prevent re-entrant calls before React renders. Disable Send button and show loading state. Deduplicate feedback array on display by item `id`.

- [ ] **Step 4: Run test to verify duplicate prevention**
Run: `node feasify-backend/tests/feedbackDeduplication.test.js`
Expected: PASS.

---

### Task 3: Centralized Date Formatting Utility

**Files:**
- Create: `Feasify/src/utils/dateFormatter.ts`
- Modify: `Feasify/src/AdviserDashboard.tsx:114-123`
- Modify: `Feasify/src/components/ActiveBusinessDetailView.tsx:77-98`
- Test: `feasify-backend/tests/dateFormatter.test.js`

**Interfaces:**
- Consumes: Date input (Timestamp | string | number | null)
- Produces:
  - `formatDisplayDate(raw): string` -> e.g., "November 11, 2026"
  - `formatDisplayDateTime(raw): string` -> e.g., "November 11, 2026, 2:30 PM"
  - `formatProposalDate(proposal, includeTime?): string`

- [ ] **Step 1: Write date formatting unit tests**
Test ISO string, Firestore timestamp `{ toMillis: () => ... }`, date-only string `2026-11-11`, null, and invalid inputs.

- [ ] **Step 2: Implement `dateFormatter.ts`**
Format using `en-US` with `timeZone: "Asia/Manila"`, preserving original timestamps in storage without date shifting.

- [ ] **Step 3: Update `AdviserDashboard.tsx` and `ActiveBusinessDetailView.tsx`**
Replace fragmented date formatters with `formatDisplayDate` and `formatDisplayDateTime`.

- [ ] **Step 4: Verify date tests pass**
Run: `node feasify-backend/tests/dateFormatter.test.js`
Expected: PASS.

---

### Task 4: Selected Filter Tag Visibility & UX Polish

**Files:**
- Modify: `Feasify/src/AdviserDashboard.tsx:1792-1801`
- Modify: `Feasify/src/AdviserNotifications.tsx:454-482`

**Interfaces:**
- Consumes: Filter tab states (`activeDashboardTab`, `activeTab`)
- Produces: High-contrast, distinctive active filter tags with active state indicator and visible keyboard focus.

- [ ] **Step 1: Update Dashboard filter tags in `AdviserDashboard.tsx`**
Apply Feasify design system:
- Selected: `bg-[#122244] text-white border border-[#122244] shadow-md font-bold ring-2 ring-[#122244]/20 flex items-center gap-1.5` with gold indicator dot.
- Unselected: `bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent font-medium`.
- Accessible focus rings and responsive overflow.

- [ ] **Step 2: Update Notification filter tabs in `AdviserNotifications.tsx`**
Apply matching high-contrast design for unread/all/read filters.

---

### Task 5: AI Feasibility Analysis State Management & Adviser Role Restrictions

**Files:**
- Modify: `Feasify/src/components/ActiveBusinessDetailView.tsx:2040-2130`
- Modify: `Feasify/src/AdviserDashboard.tsx:2280-2292`
- Modify: `feasify-backend/index.js`

**Interfaces:**
- Consumes: `proposal.aiAnalysis`, `userRole`
- Produces: Analysis states (`NOT_ANALYZED`, `PENDING`, `COMPLETED`, `FAILED`). Omission of Re-analyze and old Export PDF in Adviser view.

- [ ] **Step 1: Implement analysis lifecycle check in `ActiveBusinessDetailView.tsx`**
If proposal has no valid completed `aiAnalysis`:
Display "No AI Feasibility Analysis Available" empty state banner.
Never display Feasibility Verdict, score, or recommendations.
Handle `PENDING` and `FAILED` states explicitly.

- [ ] **Step 2: Remove Re-Analyze and old Export PDF from Adviser view**
Omit `onReanalyze` and `onExportAnalysis` in `AdviserDashboard.tsx` for `ActiveBusinessDetailView`. In `ActiveBusinessDetailView.tsx`, ensure buttons are not rendered when absent.

- [ ] **Step 3: Backend role authorization guard**
Guard `/api/ai-analyze-feasibility` so advisers cannot trigger re-analysis directly.

---

### Task 6: Group Card Whitespace & Layout Refinement

**Files:**
- Modify: `Feasify/src/AdviserDashboard.tsx:1805-2070`

**Interfaces:**
- Consumes: Group card data
- Produces: Compact, balanced card layout without excessive whitespace or fixed height voids.

- [ ] **Step 1: Refactor skeleton cards to dynamic flexible height**
Remove hardcoded `h-[450px]` from skeleton loader.

- [ ] **Step 2: Refactor activated vs non-activated proposal section**
Provide balanced layout when business is activated, ensuring consistent vertical rhythm, aligned footer buttons, and no awkward empty voids.

---

### Task 7: Centralized Multi-Section PDF Export Below Group History

**Files:**
- Create: `Feasify/src/services/proposalSectionExportService.ts`
- Create: `Feasify/src/components/ProposalExportModal.tsx`
- Modify: `Feasify/src/components/ActiveBusinessDetailView.tsx`
- Modify: `Feasify/src/AdviserDashboard.tsx`
- Test: `feasify-backend/tests/proposalExportService.test.js`

**Interfaces:**
- Consumes: `proposal`, `group`, `selectedSections: ('overview' | 'financial' | 'ai')[]`
- Produces: Combined PDF download with filename `FEASIFY_[BusinessName]_[SelectedSections]_[YYYY-MM-DD].pdf`

- [ ] **Step 1: Write export service unit test**
Verify selection logic, section order preservation (1. Project Overview, 2. Financial Input, 3. AI Feasibility Analysis), unanalyzed AI disabling, and filename sanitization.

- [ ] **Step 2: Implement `proposalSectionExportService.ts`**
Generate PDF using `jsPDF` and `jspdf-autotable`. Include project branding, readable Manila dates, currency formatting, and appropriate page breaks.

- [ ] **Step 3: Create `ProposalExportModal.tsx`**
Implement modal with exactly 3 checkboxes:
1. Project Overview
2. Financial Input
3. AI Feasibility Analysis (disabled with warning if not analyzed)
Cancel & Export buttons.

- [ ] **Step 4: Mount Export PDF button below Group History**
Position button immediately below Group History in `ActiveBusinessDetailView.tsx` and in `group-details` view. Connect to `ProposalExportModal`.

---

### Task 8: Full QA Verification, End-to-End Build & Test Suite

**Files:**
- Create: `feasify-backend/tests/adviserModuleRegression.test.js`
- Test all components and endpoints

- [ ] **Step 1: Run complete backend test suite**
Run: `npm test --prefix feasify-backend`

- [ ] **Step 2: Run frontend production build**
Run: `npm run build --prefix Feasify`

- [ ] **Step 3: Generate documentation artifacts**
Create `bug_fix_report.md`, `test_report.md`, and `walkthrough.md`.
