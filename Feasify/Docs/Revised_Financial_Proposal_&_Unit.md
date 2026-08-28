# Revised Financial Proposal & Unit Costing 

**Total Capital Overview**
* **Total Capital Hero Card:** A prominent card at the top displaying the total capital amount. This value is directly pulled from the "Total Capital" field inputted by the user in the business proposal.

---

## 1. Product Costing & Yield (Batch / Production Model)
This section now supports multiple products with automated ingredient cost calculations. Each product will have its own summary outputs.

* **Product Management:** Includes an `+ Add Product` button to create multiple product profiles.
* **Product Details:** Fields for "Product Name" and "Batch Quantity Yield (Units)".
* **Ingredient List:** An `+ Add Ingredient` button allowing users to list individual ingredients and input their respective prices.
* **Auto-Calculation:** The system automatically calculates the Total Batch Cost by summing the prices of all inputted ingredients.
* **Computed Unit Cost (COGS):** The system calculates the unit cost using the formula: Total Batch Cost / Batch Quantity Yield.

### Dynamic Summary Cards (Per Product)
The following metric cards will display unique outputs for *each* added product, replacing the old global summary format:
* **Unit Cost (COGS):** Calculated Unit Cost. 
* **Target Price:** Computed base price plus the mark-up.
* **Revenue:** Calculated as Selling Price × Quantity[cite: 5]. (Replaces "Monthly Rev").
* **Gross Profit:** Calculated as Revenue - Total Cost[cite: 5]. (Replaces "Gross Margin").
* *(Note: "Est. Net Profit" card has been removed)*

---

## 2. Mark-Up Strategy & Target Selling Price
* **Mark-Up Percentage (%):** User input for desired mark-up.
* **Computed Base Price:** Auto-calculates Unit Cost + Mark-up amount.
* **Final / Target Selling Price:** User input allowing for psychological pricing adjustments (e.g., overriding ₱89.06 to ₱89.00).

---

## 3. Startup Equipment & Assets Breakdown (CapEx)
*(Note: "Sales Volume & Monthly Operating Expenses (OpEx)" has been removed. This section has been renumbered from 4 to 3).*

* **UI Layout:** Formatted as a dynamic table based on your reference design.
* **Table Columns:** 
  * `Item / Asset name` (Placeholder text: *e.g. Machine or Rent similar*)
  * `QTY` (Quantity)
  * `UNIT PRICE`
  * `TOTAL`
* **Item Management:** Includes an `+ Add Item` button and a delete icon (trash bin) for each row.
* **Total Calculation:** The bottom right displays the auto-calculated sum labeled as **Total**.
* **Financing Options:** Includes the toggle/checkbox section for **"Is startup capital borrowed / loaned?"** at the bottom of the card.