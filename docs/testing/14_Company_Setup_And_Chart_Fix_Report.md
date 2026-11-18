# Feasify — Company Setup UI & AI Financial Analysis Chart Visibility Report

## 1. Executive Summary

This report documents the root-cause diagnosis, surgical code patches, and verification results for two critical issues in **Feasify**:
1. **Task 1: Duplicate "Finish Setup" Button in Company Setup Modal (`Projects.tsx`)**
2. **Task 2: AI Financial Analysis Chart Missing COGS and Fixed Costs (`FeasibilityAnalysisReport.tsx` & `aiAnalysisHelpers.ts`)**

Both issues have been resolved without altering underlying BMBE / CREATE taxation logic, financial audit formulas, or database schemas. All 15 non-empty chart series combinations were verified programmatically, the full React/TypeScript production build succeeded with 0 errors, and all 48 backend integration tests passed with 0 failures.

---

## 2. Task 1: Duplicate "Finish Setup" Button

### Root Cause Analysis
In `Feasify/src/Projects.tsx`:
- The modal layout contained two consecutive footer JSX blocks (lines 3934–3944 and 3948–3958) rendering identical `handleFinishTeamSetup` action buttons with differing labels (`"Finish Company Setup"` vs `"Finish Setup"`).
- An accidental rogue `</div>{/* end scrollable body */}` tag at line 3946 closed the modal card container early, causing the second footer to be placed outside the card body and leaving mismatched JSX tags.
- The `handleFinishTeamSetup` submission handler lacked a check for `isUploadingLogo`, allowing potential double-click submissions while an image upload was in progress.

### Implemented Fixes
1. **Surgically Removed Duplicate Footer & Rogue Tag**:
   - Removed lines 3934–3947 in `Feasify/src/Projects.tsx`.
   - Preserved exactly **one** unified footer at the bottom of the modal card.
   - Retained consistent CTA label `{userGroup?.isSetup ? "Save Changes" : "Finish Setup"}`.
2. **Double-Submit Guard**:
   - Added early return guard in `handleFinishTeamSetup`: `if (!userGroup || isUploadingLogo) return;`.
   - Disabled button state and spinner icon when `isUploadingLogo` is active.
   - Preserved all DTI & SEC registry checks, company name validation, mission/vision/objective validations, and Firestore sync.
3. **Modal DOM Hierarchy Fixed**:
   - Closed `SECTION: Company Objectives` (`<div>...</div>`).
   - Closed scrollable modal body (`<div className="p-6 overflow-y-auto space-y-7 flex-1 custom-scrollbar">`).
   - Rendered single footer pinned to modal card.
   - Closed modal card and fixed overlay backdrop cleanly.

---

## 3. Task 2: AI Financial Analysis Chart Visibility

### Root Cause Analysis
1. **Data Extraction Fallback in `resolveProposalMonthAndDraft` (`aiAnalysisHelpers.ts`)**:
   - When a proposal object or financial record without a nested `.financialData` property was evaluated (e.g. direct financial records or month drafts), `finData` evaluated to `{}`.
   - This caused `monthlyRecords`, `products`, `variableCost`, and `fixedCosts` to evaluate to zero, making COGS and Fixed Cost bar heights `0` (invisible) while Revenue or Net Profit remained visible or calculated.
2. **Series Key Asymmetry (`"Fixed Cost"` vs `"Fixed Costs"`)**:
   - `PRO_FORMA_SERIES_CONFIG` configured the key as `"Fixed Costs"` (plural).
   - In various interfaces, callers, and test suites, the series was referenced as `"Fixed Cost"` (singular).
   - Reading or toggling `"Fixed Cost"` left `visibleSeries["Fixed Costs"]` undefined or out of sync, preventing `<Bar dataKey="Fixed Costs" ...>` from rendering.
3. **Chart Visibility & State Invariants (`FeasibilityAnalysisReport.tsx`)**:
   - `visibleSeries` state only tracked canonical plural keys, lacking dual-key synchronization.
   - The "at least one series selected" safety guard counted raw object keys instead of canonical financial metrics.
   - In `<ComposedChart>`, `<defs>` only registered `fixedCostsBarGrad-${chartUid}`, lacking `fixedCostBarGrad-${chartUid}`.
   - Tooltip text and swatch rendering used `item.color` directly, which in Recharts evaluates to `url(#...)` gradient strings, producing invalid CSS colors.
4. **Scale Disparity Clamping Bars to Sub-Pixel Slivers (Screenshot Finding)**:
   - When projects exhibit high revenue margins (e.g. Revenue at ₱153M, Net Profit at ₱122M) alongside operating costs (COGS at ₱220K, Fixed Costs at ₱256K), a single linear Y-axis scale of 0 to ₱160M rendered COGS and Fixed Cost bars at $\frac{220,000}{160,000,000} \approx 0.13\%$ height (< 0.5 pixels tall).
   - The bars appeared completely "missing" or flat against the baseline whenever Revenue or Net Profit was selected, but became tall whenever only COGS and Fixed Costs were selected.

### Implemented Fixes
1. **Unified Proposal Fallback in `aiAnalysisHelpers.ts`**:
   - Updated `resolveProposalMonthAndDraft` to accept proposals where financial fields exist directly on `proj`:
     ```ts
     const finData =
       proj?.financialData ||
       proj?.originalProposalFinancials ||
       (proj &&
       (Array.isArray(proj.monthlyRecords) ||
         Array.isArray(proj.products) ||
         proj.sellingPrice !== undefined ||
         proj.monthlySales !== undefined ||
         proj.fixedCosts !== undefined)
         ? proj
         : {}) ||
       {};
     ```
   - Added dual-key support (`"Fixed Cost"?: number;`) in `ProFormaChartPoint` interface.
   - Included both `"Fixed Costs": fixed` and `"Fixed Cost": fixed` in `buildProFormaProjection`.
2. **Robust Multi-Series Visibility State in `FeasibilityAnalysisReport.tsx`**:
   - Initialized `visibleSeries` with both keys enabled: `Revenue: true, COGS: true, "Fixed Costs": true, "Fixed Cost": true, "Net Profit": true`.
   - Added `normalizeSeriesKey` and `isSeriesVisible` helpers to resolve `"Fixed Cost"` and `"Fixed Costs"` interchangeably.
   - Updated `toggleSeries` to synchronize both keys and enforce the `activeCount <= 1` rule strictly against the 4 canonical metrics (`Revenue`, `COGS`, `Fixed Costs`, `Net Profit`).
   - Added alias gradient definition `fixedCostBarGrad-${chartUid}` in `<defs>`.
   - Replaced direct `visibleSeries[...]` checks with `isSeriesVisible(...)` across all `<Bar>` and `<Area>` elements.
   - Fixed tooltip swatches and labels in `ProFormaCustomTooltip` to resolve `config?.color || item.color` and look up dual keys properly.
3. **Adaptive Dual Y-Axis & Minimum Bar Visibility (`FeasibilityAnalysisReport.tsx`)**:
   - Added automated detection of scale disparity (`scaleRatio >= 5` between income and expense series).
   - When scale disparity is detected, an auxiliary right Y-axis (`expenseAxis`) renders with amber scale indicators and currency formatting, providing proportional, visible, and tall bars for COGS and Fixed Costs.
   - When scale disparity is small (< 5x) or only one category is selected, the chart gracefully uses the single unified left axis.
   - Added `minPointSize={6}` to all `<Bar>` elements ensuring non-zero values never collapse to sub-pixel or invisible lines.
   - Added visual indicator badge: `"Dual Axis (Costs on Right)"`.

---

## 4. Verification & Automated Test Results

### A. 15 Nonempty Series Combinations Test
All 15 combinations of the 4 financial series were tested with full SVG rendering:

| # | Selected Series Combination | Bars Expected / Rendered | Areas Expected / Rendered | Status |
|---|---|:---:|:---:|:---:|
| 1 | Revenue | 1 (5 rects) | 0 | **PASS** |
| 2 | COGS | 1 (5 rects) | 0 | **PASS** |
| 3 | Revenue + COGS | 2 (10 rects) | 0 | **PASS** |
| 4 | Fixed Costs (Fixed Cost) | 1 (5 rects) | 0 | **PASS** |
| 5 | Revenue + Fixed Costs | 2 (10 rects) | 0 | **PASS** |
| 6 | COGS + Fixed Costs | 2 (10 rects) | 0 | **PASS** |
| 7 | **Scenario B**: Revenue + COGS + Fixed Costs | 3 (15 rects) | 0 | **PASS** |
| 8 | Net Profit | 0 | 1 | **PASS** |
| 9 | Revenue + Net Profit | 1 (5 rects) | 1 | **PASS** |
| 10 | COGS + Net Profit | 1 (5 rects) | 1 | **PASS** |
| 11 | Revenue + COGS + Net Profit | 2 (10 rects) | 1 | **PASS** |
| 12 | Fixed Costs + Net Profit | 1 (5 rects) | 1 | **PASS** |
| 13 | Revenue + Fixed Costs + Net Profit | 2 (10 rects) | 1 | **PASS** |
| 14 | **Scenario C**: Net Profit + COGS + Fixed Costs | 2 (10 rects) | 1 | **PASS** |
| 15 | **Scenario A**: All 4 Selected (Rev + COGS + FC + NP) | 3 (15 rects) | 1 | **PASS** |

Both Grouped Bars and Stacked Costs modes render all active series without dropping COGS or Fixed Costs.

### B. Production Build Verification
- Command: `npm run build --prefix Feasify`
- Result: **0 Errors**. 2,775 modules transformed, production bundle built cleanly in `dist/`.

### C. Backend Regression & Math Integrity Test Suite
- Command: `npm test --prefix feasify-backend`
- Result: **48 passed, 0 failed**:
  - DTI & SEC Provider Verification: 19 passed
  - Cache, VerificationLogger & NameChecker Service: 11 passed
  - Backend API Endpoints: 8 passed
  - Final Defense Mathematical Audit (BMBE 3% vs CREATE 20%, Accounting Equation $Assets = Liabilities + Equity$, Break-Even CMR): 10 passed

---

## 5. Summary of Modified Files

1. `Feasify/src/Projects.tsx`:
   - Eliminated redundant footer JSX block and rogue closing `</div>`.
   - Unified single "Finish Setup" button.
   - Added `isUploadingLogo` guard against double submissions.
2. `Feasify/src/components/FeasibilityAnalysisReport.tsx`:
   - Normalized singular `"Fixed Cost"` and plural `"Fixed Costs"`.
   - Updated `visibleSeries`, `toggleSeries`, and `showAllSeries` state management.
   - Added `isSeriesVisible` abstraction for chart rendering and badge indicators.
   - Added `fixedCostBarGrad-${chartUid}` alias def.
   - Fixed `ProFormaCustomTooltip` color fallback and key resolution.
3. `Feasify/src/utils/aiAnalysisHelpers.ts`:
   - Expanded `resolveProposalMonthAndDraft` fallback for proposals with root-level financial fields.
   - Added dual-key `"Fixed Cost"` to `ProFormaChartPoint` interface and `buildProFormaProjection`.
