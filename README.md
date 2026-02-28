# BreakOS — AI-Native Reconciliation Break Investigator

Built for the Wealthsimple AI Builder application by Akshat Aneja.

---

## What This Is

BreakOS is an AI-native tool that sits at the end of a broker-dealer's existing reconciliation workflow.

**The analyst does their recon exactly as they do today.** When breaks are identified, instead of spending 45–90 minutes per break manually cross-referencing data sources, writing up findings, and figuring out who to notify — they upload the break report to BreakOS. The AI investigates each break automatically, fetches live market data, computes what needs to be computed, and hands back a confidence-scored diagnosis with a specific escalation route. The analyst makes one decision: approve the escalation, or override with a documented reason.

**What the human can now do that they couldn't before:**
Handle a full morning break queue in under 30 minutes instead of a full day. The cognitive load of investigation is offloaded — the analyst's job becomes judgment and accountability, not research.

**What AI is responsible for:**
- Fetching and interpreting live market data (Yahoo Finance, rateslib)
- Classifying break type and likely root cause
- Generating confidence-scored hypotheses with explicit reasoning
- Drafting communications to counterparties and internal teams
- Recommending escalation routing (Settlements, Corp Actions, Trade Desk, etc.)

**Where AI must stop:**
The escalation decision. A material break affecting client positions requires documented human accountability under CIRO rules. The AI cannot and should not approve its own escalation recommendations — that decision carries regulatory weight and requires judgment about context the AI doesn't have: relationship history with counterparties, whether this break is part of a broader pattern, current market conditions, and operational priorities.

**What breaks first at scale:**
Confident wrong answers. At 200+ breaks per day, an AI that assigns 85% confidence to an incorrect root cause will be trusted — and the analyst won't catch it. The mitigation is the human gate: no escalation fires without analyst sign-off. But the deeper fix is the confidence scoring design — hypotheses must show their evidence, not just a number, so the analyst can see what would flip the AI's conclusion.

---

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Generate the sample break report
python generate_sample.py

# 3. Run the app
streamlit run app.py
```

---

## Demo Script (3 minutes)

### Act 1 — The Problem (30 sec)
*"This is BreakOS. I built this based on 8 months doing NAV oversight and fund reconciliation at Scotiabank — where I ran daily recons across 100+ funds, and complex breaks took 45 to 90 minutes each to investigate manually. At Wealthsimple's scale, reconciling thousands of trades daily across CDS, DTC, and third-party fund admins, that's not sustainable. This doesn't replace the recon process — it replaces the investigation that happens after breaks are found."*

### Act 2 — Upload and Triage (45 sec)
*"The analyst finishes their morning recon in Excel — exactly as they do today — exports the break report, and drops it here."*

[Upload sample_breaks.xlsx]

*"Nine breaks across Canadian equities, US equities, ETFs, a fixed income position, and an option. Hit Quick Triage — AI classifies severity and escalation routing for all nine simultaneously."*

[Click Run Quick Triage]

*"In about 10 seconds, every break has a severity rating, a likely cause, a confidence score, and a specific team to route to. Not a generic label — 'Settlements Desk', 'Corp Actions Team', 'Derivatives Desk'. That's the morning queue, triaged."*

### Act 3 — Deep Dive (60 sec)
*"Now click into the SHOP.TO pricing difference — the highest severity break."*

[Select SHOP.TO break]

*"Hit Investigate. Watch what happens — the system fetches the live Yahoo Finance price in real time, checks corporate action history, applies settlement rules, and sends all of that as context to Claude. The analysis streams back live."*

[Click Investigate, let it stream]

*"The AI has classified this, identified the most likely root cause — stale vendor feed, not a genuine price move — shown its reasoning, and drafted a communication ready to send to the pricing vendor and trade desk. That took 90 seconds. Manually, this is a 45-minute job."*

### Act 4 — The Gate (30 sec)
*"Here's the critical design decision — the human gate. The AI recommends escalation to the Pricing Team. But it cannot approve that itself. A break affecting $X in client positions requires documented human sign-off under CIRO rules. The analyst sees the AI's full reasoning, makes the call, and the decision is logged for audit. That accountability cannot be automated — and it shouldn't be."*

[Click Approve Escalation]

*"Done. Total time: under 4 minutes for a break that used to take an hour."*

---

## Data Sources

| Source | What It Provides | Status |
|--------|-----------------|--------|
| Yahoo Finance (yfinance) | Live equity/ETF prices, corporate action history | Live |
| rateslib | Fixed income accrued interest (Act/360) | Live computation |
| CDS settlement rules | Canadian equity settlement logic (T+1, May 2024) | Applied to simulated positions |
| DTC settlement rules | US equity settlement logic (T+1, May 2024) | Applied to simulated positions |
| CDS participant portal | Actual Canadian depository positions | Simulated — requires institutional access |
| DTCC Smart Source | Actual US depository positions | Simulated — requires institutional access |

---

## Architecture Notes

The system is intentionally designed to layer on top of existing workflows, not replace them:

```
Existing recon process (Excel/Google Sheets)
           ↓
     Export break report (.xlsx)
           ↓
     BreakOS ingests and parses
           ↓
     Quick triage: all breaks → severity + routing
           ↓
     Deep dive: selected break → live data + AI analysis + draft comms
           ↓
     Human decision gate: analyst approves or overrides escalation
           ↓
     Audit log: decision + reasoning recorded
```

In production, the Excel export step is replaced by a live Google Sheets or internal system API connection — zero friction for the analyst.
