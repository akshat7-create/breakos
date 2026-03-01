# BreakOS — AI-Native Reconciliation Break Investigator

An AI-native operations tool that automates the manual investigation of trade reconciliation breaks.

---

## The Problem
In middle and back-office operations, reconciling thousands of trades daily across depositories (like CDS, DTC) and third-party fund administrators generates hundreds of "breaks" (mismatches). While identifying breaks is automated, **investigating them is highly manual**. A complex reconciliation break can take an analyst 45 to 90 minutes to investigate by cross-referencing vendor data, checking corporate actions, calculating accruals, and drafting emails. 

BreakOS doesn't replace the recon process — it replaces the grueling investigation that happens *after* breaks are found.

## How it Works
**The analyst does their recon exactly as they do today.** When breaks are identified, they upload the break report to BreakOS. 

The AI investigates each break automatically:
1. **Live Data Enrichment**: Fetches live market data, corporate action history, and computes relevant metrics.
2. **AI Classification**: Classifies break type and determines the likely root cause.
3. **Hypothesis Generation**: Creates confidence-scored explanations with explicit reasoning.
4. **Draft Comms**: Drafts communications to counterparties and internal teams.
5. **Smart Routing**: Recommends escalation routing (Settlements, Corp Actions, Trade Desk, etc.).

### The Human Gate
BreakOS embraces the critical nature of operational risk. **The AI cannot and should not approve its own escalation recommendations.** A material break affecting client positions requires documented human accountability under regulatory rules. The analyst reviews the AI's full reasoning, makes the call (approve or override), and the decision is permanently logged for audit.

The cognitive load of investigation is offloaded — the analyst's job becomes judgment and accountability, not research. A morning break queue that took hours can be triaged and investigated in minutes.

---

## Setup & Running Locally

BreakOS consists of a Python FastAPI backend and a React/Vite frontend.

### 1. Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn server:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd breakos-frontend

# Install dependencies
npm install

# Start the Vite dev server
npm run dev
```

### 3. Usage
- Make sure you have your `ANTHROPIC_API_KEY` set in your environment variables.
- Open the frontend app (usually `http://localhost:5173`).
- Click "Generate Sample Data" to load randomized, realistic breaks.
- Click "Run Quick Triage" to simulate the automated morning classification.

---

## Data Sources & Integrations
BreakOS is built to interpret the same data a human analyst would use. It integrates with real-world financial data APIs to contextualize and resolve breaks:

| Data Source | What It Provides | How BreakOS Uses It |
|-------------|------------------|----------------------|
| **Yahoo Finance (`yfinance`)** | Live market prices, historical close prices, trade volumes | To calculate precise Dollar Value (MV) differences on pricing breaks and identify if a stale vendor price is the root cause. |
| **Corporate Actions (via Yahoo)** | Ex-dates, dividends, stock splits | To automatically detect if a quantity or MV break is actually an unbooked dividend or a pending stock split. |
| **SEC EDGAR Filings** | 8-K statements, merger announcements | To provide deterministic proof for complex corporate actions (e.g., acquisitions, ticker changes) that cause security mismatches. |
| **`rateslib`** | Fixed income analytics & accrued interest | To calculate precise Act/360 or 30/360 interest accruals for bond breaks. |
| **Depository Settlement Rules** | CDS (Canada) & DTC (US) logic | Hardcoded logic to simulate T+1 settlement cycles and flag when a "break" is actually just a trade that hasn't settled yet based on the trade date. |
| **Counterparty Intelligence** | Simulated participant data | Mimics typical behavior patterns of major custodians (e.g., RBC IS missing late-day sweeps, State Street batch delays) to inform AI confidence scores. |

---

## Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Framer Motion, Zustand
- **Backend**: FastAPI, Python
- **AI/LLM**: Anthropic Claude 3.5 Sonnet
- **Data Integrations**: Yahoo Finance (`yfinance`) for market data, `rateslib` for fixed income accruals
