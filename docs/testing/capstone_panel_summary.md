# FEASIFY CAPSTONE PANEL BRIEFING & DEFENSE SUMMARY
**Document ID:** FEASIFY-DOC-PANEL  
**Date:** November 10, 2026  
**Audience:** Academic Defense Panel, Technical Evaluators, Capstone Advisers  

---

## 1. Project At A Glance
* **Project Name:** Feasify (Web-Based Capstone Proposal & Feasibility Management System)
* **Author / Team:** Feasify Capstone Development Team
* **Objective:** Streamline the submission, financial calculation, AI evaluation, and faculty review of student feasibility studies.
* **Core Technology Stack:** React 19, TypeScript, Tailwind CSS 4, Vite 7, Node.js v22, Express 5, Firebase Cloud Platform, Leaflet OpenStreetMap, and Google Gemini AI.

---

## 2. Key Testing Findings & Empirical Metrics

```
+------------------------------------+---------------------------------------+
| Quality Metric                     | Empirical Finding                     |
+------------------------------------+---------------------------------------+
| Total Modules Audited              | 14 Modules                            |
| Total Test Scenarios Executed      | 67 Scenarios (42 Functional + 25 Auto)|
| Total Automated Assertions Passed  | 105 Assertions                        |
| Test Pass Rate                     | 89.6% (60 Passed / 67 Executed)       |
| Production Build Status            | PASSED (Vite built client in 50.32s)  |
| Local Endpoint Latency (Baseline)  | 4.0 milliseconds                      |
| Concurrency Target Tested          | 50 Simultaneous Virtual Users         |
| Overall Capstone Readiness Verdict | CONDITIONALLY READY FOR DEMONSTRATION |
+------------------------------------+---------------------------------------+
```

---

## 3. Verified System Strengths

1. **Strict Maximum 3-Proposal Rule Enforced in UI & Backend:**
   * Groups cannot submit a 4th proposal. The system locks creation upon reaching three proposals and accurately retains all existing records upon page reload.
2. **Mathematically Rigorous Financial Projections:**
   * The fundamental balance sheet accounting equation ($\text{Assets} = \text{Liabilities} + \text{Equity}$) holds across all five projected operational years with zero mathematical discrepancies.
3. **Philippine Commercial Trademark Protection:**
   * Automated verification flags student queries against famous Philippine brand trademarks (e.g., Goldilocks, Cocopan, Mega Sardines, Red Ribbon, 7-Eleven) to prevent intellectual property violations.
4. **Zero Commercial API Billing Dependencies for Maps:**
   * Uses Leaflet and OpenStreetMap tiles with embedded Philippine landmarks, eliminating Google Cloud billing overhead and quota failure risks.

---

## 4. Key Limitations Disclosed for Defense Transparency

1. **Security Vulnerability: Plaintext Passwords in Firestore (`SEC-01`):**
   * *Status:* Identified in `ChairpersonModule.tsx` during Excel roster imports.
   * *Mitigation for Defense:* Safe for demo with mock test accounts; must be removed before production deployment.
2. **Security Vulnerability: Unauthenticated Proposal Approval API (`SEC-02`):**
   * *Status:* Backend `PUT /api/proposals/:id/status` endpoint lacks token validation.
   * *Mitigation for Defense:* In demonstration on a local or closed WiFi network, demonstrate faculty approvals via the legitimate Adviser UI.
3. **Student Username Edit Error (`FEASIFY-BUG-002`):**
   * *Status:* A missing variable declaration in `Settings.tsx` prevents student username updates.
   * *Mitigation for Defense:* Avoid demonstrating student username changes in Settings until the two-line state declaration fix is applied.

---

## 5. Recommendation for Panel Members
The testing team confirms that Feasify is **Conditionally Ready for Capstone Demonstration**. The functional core is robust, well-architected, and fully aligned with academic requirements.
