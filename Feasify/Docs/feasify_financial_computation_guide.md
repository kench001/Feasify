# FeasiFy: Business Proposal Financial Inputs & Computations

This document serves as a reference guide for developing the **Financial Input Module** of the FeasiFy business feasibility system. It outlines the core financial formulas, required data fields, and sample computations based on actual business proposals (e.g., Spinach Buns, FruZza, Veggie Corner).

---

## 1. Core Objectives & Workflow
When students set up an approved business proposal in FeasiFy, the financial input modules are unlocked[cite: 1]. The system must allow users to input raw financial data and instantly compute key metrics to evaluate feasibility[cite: 1, 2]. 

### Key System Requirements
* **Real-time Computation:** The system automatically calculates and updates summary cards (Total Capital, Monthly Expenses, etc.) as users enter values[cite: 1, 2].
* **Data Fields Required:**
  * Initial Capital / Capital Requirements[cite: 1]
  * Pricing & Sales Volume (Selling Price, Monthly Sales, COGS)[cite: 1]
  * Operational Expenses (OpEx - e.g., Rent, Utilities)[cite: 1]
  * Equipment List (Item, Quantity, Unit Price)[cite: 1]
  * Financing Options (e.g., Borrowed Capital)[cite: 1]

---

## 2. Standard Financial Formulas

The AI and standard computations must utilize the following formulas when predicting profitability and assessing initial financial feasibility:

1. **Unit Cost (₱):** 
   `Unit Cost = Total Cost of Production / Quantity Yield`
2. **Mark-up Amount (₱):** 
   `Mark-up = Unit Cost * Mark-up Percentage`
3. **Target Selling Price (₱):** 
   `Selling Price = Unit Cost + Mark-up` *(Note: Often rounded for psychological pricing)*
4. **Projected Revenue (₱):** 
   `Revenue = Selling Price * Quantity Sold`
5. **Gross Profit (₱):** 
   `Gross Profit = Revenue - Total Cost`

---

## 3. Real-World Business Cases & Sample Data

Use these samples to train the AI on how standard product costing and mark-ups should look within the system.

### Sample A: Spinach Buns
* **Total Cost of Ingredients:** ₱ 485.70
* **Yield (Quantity):** 12 pcs
* **Computation:**
  * `Unit Cost`: ₱ 485.70 / 12 pcs = ₱ 40.48 per bun
  * `Mark-up (120%)`: ₱ 40.48 * 1.20 = ₱ 48.58
  * `Computed Selling Price`: ₱ 40.48 + ₱ 48.58 = ₱ 89.06 (Rounded to **₱ 89.00**)
  * `Revenue (per batch)`: ₱ 89.00 * 12 pcs = ₱ 1,068.00
  * `Gross Profit`: ₱ 1,068.00 - ₱ 485.70 = **₱ 582.30**

### Sample B: Spinach Buns with Eggplant Patty
* **Total Cost of Ingredients:** ₱ 197.00
* **Yield (Quantity):** 8 pcs
* **Computation:**
  * `Unit Cost`: ₱ 197.00 / 8 pcs = ₱ 24.63 per bun
  * `Mark-up (100%)`: ₱ 24.63 * 1.00 = ₱ 24.63
  * `Computed Selling Price`: ₱ 24.63 + ₱ 24.63 = ₱ 49.26 (Rounded to **₱ 49.00**)
  * `Revenue (per batch)`: ₱ 49.00 * 8 pcs = ₱ 392.00
  * `Gross Profit`: ₱ 392.00 - ₱ 197.00 = **₱ 195.00**

### Sample C: FruZza (Premium Saga)
* **Total Cost:** ₱ 1,673.00
* **Yield (Quantity):** 10 pcs
* **Computation:**
  * `Unit Cost`: ₱ 1,673.00 / 10 pcs = ₱ 167.30
  * `Mark-up (100%)`: ₱ 167.30
  * `Selling Price`: ₱ 167.30 + ₱ 167.30 = **₱ 335.00** (Rounded)
  * `Revenue`: ₱ 335.00 * 10 pcs = ₱ 3,350.00
  * `Gross Profit`: ₱ 3,350.00 - ₱ 1,673.00 = **₱ 1,677.00**

### Sample D: Veggie Corner (Veggie Kikiam)
* **Total Cost:** ₱ 115.00
* **Yield (Quantity):** 165 pcs
* **Computation:**
  * `Unit Cost`: ₱ 115.00 / 165 pcs = ₱ 0.69
  * `Mark-up (100%)`: ₱ 0.69
  * `Selling Price`: ₱ 0.69 + ₱ 0.69 = **₱ 1.38**
  * `Revenue`: ₱ 1.38 * 165 pcs = ₱ 227.70
  * `Gross Profit`: ₱ 227.70 - ₱ 115.00 = **₱ 112.70**

---

## 4. Development Implementation Notes

When developing the UI and logic for this component in FeasiFy:
1. **Dynamic Inputs:** Ensure that when a student updates the `Total Cost` or `Quantity Yield`, the `Unit Cost` automatically recalculates in the front-end.
2. **Flexible Mark-up:** The `Mark-up Percentage` should be an adjustable input field so students can test different pricing strategies (e.g., 100% vs 120% markup).
3. **Psychological Pricing Adjustment:** Allow users to override the strictly computed `Selling Price` with a finalized price (e.g., rounding ₱ 89.06 down to ₱ 89.00 to make it appear more affordable). The `Revenue` and `Gross Profit` computations must use this final overridden price.
4. **AI Context:** When the AI assesses this data, it should flag risks such as negative gross margins, unrealistically high mark-ups for the target market, or insufficient yields.