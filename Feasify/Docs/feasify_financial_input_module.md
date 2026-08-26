# FeasiFy: Financial Input Module & User-Friendly Balance Sheet

This document outlines the proposed financial inputs for an accepted business within the FeasiFy platform. Once a business proposal is approved and active, this module serves as a dynamic workspace where users can input, manipulate, and track comprehensive financial data for their ongoing business. 

The terminology and structure are designed to be user-friendly while strictly aligning with standard feasibility study formats (e.g., the Mr. Cabbage Partnership framework).

---

## 1. Initial Capital & Sources of Financing
Users define how the business is funded. The system will automatically compute totals as inputs are adjusted.
* **Cash Invested:** Direct cash contributions from partners or owners.
* **Property Invested:** Non-cash assets contributed to the business (e.g., Cooking Machineries, Logistics Services).
* **Total Initial Capital:** The automatically computed sum of all cash and property contributions.

## 2. Start-Up Cost (Project Cost)
This section captures the initial expenses required to establish the business before it begins generating consistent revenue. Users can add or modify these fields:
* **Rent (Advance and Deposit)**
* **Trainings and Programs Costs**
* **Advertising Expense**
* **Salaries Expense** (e.g., equivalent to initial 2 months of operations)
* **Capital Investment / Equipment:** Furniture, fixtures, and store tools.
* **Total Project Cost:** Automatically calculated based on the above inputs.

## 3. Ongoing Financial Inputs (Statement of Financial Performance)
For ongoing operations, users can manipulate these fields to project and track monthly or annual performance. The system will instantly compute the resulting profit.
* **Revenues:**
  * **Sales:** Projected gross sales based on the product mix.
  * **Net Sales:** Automatically computed after factoring in any discounts or returns.
* **Cost of Sales:** Direct costs of producing the goods sold.
* **Gross Profit:** `Net Sales - Cost of Sales`
* **Operating Expenses:**
  * **General Administrative Expenses:** Supplies, Utilities, Permits, and Licenses.
  * **Selling Expenses:** Marketing, delivery, and promotional costs.
* **Net Income:** `Gross Profit - Operating Expenses`

---

## 4. User-Friendly Balance Sheet (Statement of Financial Position)
Designed to be highly intuitive, this section provides a real-time snapshot of the business's financial health. When users update their operational inputs or ongoing expenses, this balance sheet automatically adjusts.

### ASSETS (What the Business Owns)
**Current Assets:**
* **Cash on Hand:** Cash readily available at the store (e.g., allocated as 15% of total cash).
* **Cash in Bank:** Funds stored securely in bank accounts (e.g., allocated as 85% of total cash).
* **Inventory:** Value of materials available for use (e.g., ending inventory estimated at 15% of total inventory).
* **Cash Flow from Operations:** Net cash generated from regular business activities.

**Non-Current Assets:**
* **Property, Plant, and Equipment (Net):** The value of long-term assets, automatically adjusted for depreciation.

### LIABILITIES & EQUITY (How the Business is Funded)
**Current Liabilities:**
* **Accounts Payable:** Short-term obligations to suppliers.
* **Utilities Payable:** Accrued, unpaid utility bills.

**Owner’s Equity:**
* **Initial Capital:** The starting investment defined in Section 1.
* **Add: Net Income / (Loss):** Pulled directly and dynamically from the ongoing financial performance module.
* **Ending, Capital:** The automatically computed net worth of the business (`Assets - Liabilities`).

---

## 5. Automated Financial Ratios & Metrics
To provide immediate feedback on the business's ongoing viability, the AI engine calculates these key performance indicators in real-time:
* **Payback Period:** Automatically calculated and displayed in years, months, and days based on the Net Investment and Annual Net Cash Inflow.
* **Liquidity Ratios:** 
  * **Current Ratio:** Measures the ability to pay short-term obligations (`Current Assets / Current Liabilities`).
* **Activity Ratios:** 
  * **Inventory Turnover:** Measures how efficiently inventory is managed (`Cost of Sales / Average Inventory`).
  * **Average Age of Inventory:** `360 Days / Inventory Turnover`.
  * **Current Asset Turnover:** `Net Sales / Current Assets`.