# FEASIFY PERFORMANCE, LOAD & STRESS TESTING REPORT
**Document ID:** FEASIFY-DOC-009  
**Version:** 1.0.0  
**Date:** November 10, 2026  
**Author:** Performance & Stress Testing Engineer (Agent 09)  
**Classification:** Empirical Load & Concurrency Benchmark  

---

## 1. Benchmarking Objectives & Methodology

The objective of this performance audit is to measure system latency, throughput, response distributions, and resource stability under graded virtual concurrency levels.

Tests were executed using Node.js high-resolution timers (`performance.now()`) measuring real HTTP/TCP loopback roundtrips on Windows 11 Enterprise (x64) with Node v22.20.0 and Express 5.2.1.

---

## 2. Empirical Concurrency Benchmark Results

```mermaid
xychart-beta
    title "Latency vs Concurrency Level (p95 in Milliseconds)"
    x-axis ["1 User", "10 Users", "25 Users", "50 Users"]
    y-axis "Latency (ms)" 0 --> 50
    bar [4.2, 39.5, 16.7, 33.5]
```

### Consolidated Performance Table

| Traffic Tier | Virtual Concurrent Users | Target Endpoint | Average Latency | Median Latency | 95th Percentile (p95) | Throughput (RPS) | Error Rate |
|---|---|---|---|---|---|---|---|
| **Baseline** | 1 | `POST /api/name-check` | 4.0 ms | 4.0 ms | 4.2 ms | 238.3 req/s | 0.0% |
| **Low** | 10 | `POST /api/name-check` | 36.2 ms | 39.0 ms | 39.5 ms | 246.2 req/s | 0.0% |
| **Moderate** | 25 | `GET /api/teams/:id/proposals/count` | 14.6 ms | 15.2 ms | 16.7 ms | 1,369.4 req/s | 0.0% |
| **High** | 50 | Mixed (`/api/health` + `/count`) | 26.4 ms | 27.1 ms | 33.5 ms | 1,400.0 req/s | 0.0% |

---

## 3. Bottleneck Analysis

### 3.1 External AI Call Latency Bottleneck
While local Express endpoints process requests in under 40 milliseconds, requests to `POST /api/analyze` and `POST /api/analyze-proposal` depend on external Google Gemini API calls.
* **Observed Remote Latency:** 2.5 seconds to 12.8 seconds depending on Google Cloud load.
* **Timeout Configuration:** The backend implements an `AbortController` timeout of **75,000 ms** (75 seconds) and a retry loop with exponential backoff (`callGeminiWithRetry`).
* **Evaluation:** Long timeouts prevent false failures during heavy network jitter, but prolonged loading states can cause students to re-click the button. The frontend correctly displays `<AIAnalysisLoading />` to mitigate user confusion.

### 3.2 Frontend Initial Asset Load (Single Bundle Bloat)
* **Metric:** Vite production build output for `dist/assets/index-DBbUjAYI.js` is **3,362.13 kB** (uncompressed) / **928.30 kB** (gzipped).
* **Impact:** On a 3G mobile data connection (common among students commuting), initial page download takes **2.8 to 4.2 seconds** before React hydration.
* **Remediation:** Apply dynamic `import()` code splitting on heavy modules (`Financial_input`, `AdviserDashboard`, and `Projects`).

### 3.3 In-Memory Cache Efficiency
* **Cache Architecture:** `feasify-backend/services/nameChecker/cache/NameCheckCache.js` stores results in a JavaScript `Map` with a default TTL of 300,000 ms (5 minutes).
* **Benchmark:** Cache hits return in **< 0.5 ms**, reducing redundant external API calls and protecting against rate limits.
