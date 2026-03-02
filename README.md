<div align="center">

<h1>BreakOS</h1>

<img src="https://readme-typing-svg.demolab.com?font=Geist+Mono&size=18&duration=3000&pause=1200&color=6E9EF7&center=true&vCenter=true&width=560&lines=AI+investigates+your+breaks.;Human+judgment+makes+the+call.;Triage+a+morning+queue+in+minutes%2C+not+hours." alt="Typing SVG" />

<br/>

[![Live Demo](https://img.shields.io/badge/Live%20Demo-breakos.vercel.app-6E9EF7?style=for-the-badge&logo=vercel&logoColor=white)](https://breakos.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Claude](https://img.shields.io/badge/Claude-3.5%20Sonnet-CC785C?style=for-the-badge&logo=anthropic&logoColor=white)](https://anthropic.com)

</div>

---

## The Problem

In middle and back-office operations, reconciling thousands of trades daily across depositories (DTC, CDS) and third-party fund administrators generates hundreds of **breaks** — mismatches between your books and the street. Identifying them is automated. **Investigating them isn't.**

A single complex break can take an analyst 45–90 minutes to investigate: cross-referencing vendor data, checking corporate actions, computing accruals, drafting emails, routing to the right desk. Multiply that across a morning queue of 30, 50, or 100 breaks.

> BreakOS doesn't replace your recon process. It replaces the grueling investigation that happens *after* breaks are found.

---

## How It Works

The analyst does their recon exactly as they do today. When breaks surface, they upload the report to BreakOS. From there:

```
 Upload Break Report
         │
         ▼
 ┌───────────────────┐
 │   Quick Triage    │  ← AI classifies all breaks by type & severity in ~10s
 │  (Batch Claude)   │
 └────────┬──────────┘
          │
          ▼
 ┌───────────────────┐    Live Market Data (Yahoo Finance)
 │  AI Investigation │ ←  Corporate Actions & EDGAR Filings
 │  (Streaming LLM)  │    Bond Accruals (rateslib)
 └────────┬──────────┘    Settlement Rules (DTC / CDS)
          │
          ▼
 ┌───────────────────┐
 │   Human Gate  🔒  │  ← Analyst reviews full reasoning, approves or overrides
 │  (Audit Logged)   │
 └───────────────────┘
          │
          ▼
 Escalation routed to the right desk. Decision permanently logged.
```

### The Human Gate

BreakOS is built around the principle that **the AI cannot approve its own escalation recommendations.** A material break affecting client positions requires documented human accountability under regulatory rules. The analyst reviews the AI's complete reasoning chain, makes the judgment call (approve or override), and the decision is immutably logged for audit.

The cognitive load of investigation is offloaded. The analyst's job becomes **judgment and accountability** — not research.

---

## Features

| Feature | Description |
|---|---|
| **Break Queue** | Filterable, sortable list of all breaks with severity indicators and MV exposure |
| **Quick Triage** | One-click batch AI classification of all breaks by type and severity |
| **AI Investigation** | Streaming deep-dive: live data enrichment → root cause classification → confidence-scored hypotheses → draft comms |
| **Human Gate** | Review panel where analysts approve or override AI recommendations — with full audit trail |
| **Overview Dashboard** | MV exposure, severity ring chart, break type analysis, aging buckets, and investigation progress |
| **Audit Log** | Immutable record of every decision, timestamp, analyst note, and routing action |
| **Dark / Light Mode** | Full theme support |
| **File Upload or Sample Data** | Accepts `.xlsx` / `.csv` break reports, or generate realistic synthetic data instantly |

---

## Demo

**→ [breakos.vercel.app](https://breakos.vercel.app)**

1. Click **"Generate Sample Data"** to load a realistic set of randomized breaks across pricing, quantity, timing, corp action, and accrual types
2. Click **"Run Quick Triage"** to batch-classify all breaks by severity and type
3. Select any break from the queue to launch a full AI investigation
4. Review the AI's reasoning in the Human Gate and approve or override


---

## Data Sources

| Source | What It Provides | How BreakOS Uses It |
|--------|-----------------|---------------------|
| **Yahoo Finance (`yfinance`)** | Live prices, historical closes, volumes | Calculates precise dollar-value differences on pricing breaks; identifies stale vendor prices |
| **Corporate Actions (Yahoo)** | Ex-dates, dividends, stock splits | Detects if a quantity or MV break is actually an unbooked dividend or pending split |
| **SEC EDGAR** | 8-K filings, merger announcements | Provides deterministic proof for complex corp actions causing security mismatches |
| **`rateslib`** | Fixed income analytics | Computes Act/360 and 30/360 accrued interest for bond breaks |
| **Settlement Rules** | CDS (Canada) & DTC (US) cycles | Flags T+1 timing differences — breaks that aren't really breaks yet |
| **Counterparty Intelligence** | Simulated custodian behavior | Models typical patterns (RBC IS late sweeps, State Street batch delays) for AI confidence scoring |

---

## Tech Stack

**Frontend**
- React 19 + TypeScript
- Tailwind CSS
- Framer Motion
- Zustand
- Vite

**Backend**
- FastAPI (Python)
- Anthropic Claude 3.5 Sonnet
- `yfinance`, `rateslib`, `pandas`

---

## Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- An `ANTHROPIC_API_KEY`

### 1. Backend

```bash
# Clone and navigate
git clone https://github.com/your-username/breakos.git
cd breakos

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start the FastAPI server
uvicorn server:app --reload --port 8000
```

### 2. Frontend

```bash
cd breakos-frontend

npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 3. Quick Start

- Click **"Generate Sample Data"** to load randomized, realistic breaks
- Click **"Run Quick Triage"** to classify the queue
- Select a break and click **"Investigate"** to run the full AI analysis

---
