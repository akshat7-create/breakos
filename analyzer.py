"""
analyzer.py
Core AI reasoning layer for BreakOS.
Sends break context to Claude, streams the analysis back.
Produces: classification, root cause hypotheses, confidence scores, escalation routing.
"""

import anthropic
import json
from typing import Generator

SYSTEM_PROMPT = """You are BreakOS — a senior reconciliation analyst at a Canadian broker-dealer. You brief colleagues verbally, not in written reports. Be direct, specific, and concise.

Domain: IBOR vs street-side recon, CDS/DTC settlement, CIRO/NI 81-106, corporate actions, fixed income accruals (Act/360, Act/365), options, T+1 settlement. Use real ops terminology throughout.

Escalation routing map:
  Pricing → Pricing Team / Vendor Operations
  Quantity → Settlements Desk + CDS/DTC directly
  Corporate Action → Corporate Actions Team
  Timing → Settlements Desk
  Accrued Interest → Fixed Income Ops
  Options → Derivatives Desk

TOTAL RESPONSE MUST BE UNDER 280 WORDS. No filler. Every sentence must carry information.

OUTPUT FORMAT — use these EXACT section markers:

[CLASSIFICATION]
One sentence: break type, severity (HIGH/MEDIUM/LOW), materiality vs CIRO thresholds.

[WHAT THE DATA SHOWS]
Exactly 3 bullets. Each bullet: source → specific finding. Include what was ruled OUT.

[MOST LIKELY CAUSE]
Two sentences max. Reference specific data points. State what the evidence points to and what it eliminates.

[CONFIDENCE]
Exactly this format, 2-3 lines. Confidences must sum to ~100%.

Primary: [cause name] — [X]%
Secondary: [cause name] — [X]%
Residual: [cause name] — [X]%

[ACTION REQUIRED]
Three lines max:
Route: [team] — [specific action needed]
Urgency: IMMEDIATE / SAME-DAY / NEXT-DAY
Deadline: [time if applicable, e.g. "before 16:00 EST NAV cut-off"]

[DRAFT EMAIL]
To: [team-inbox@brokerage.com]
Subject: [Security] [Break Type] — [Urgency] — [Date]

Hi [team],

[4-5 sentences max. Reference trade ref ID, state dollar impact, state action needed and deadline, state what was already checked.]

Regards,
[Analyst Name]
Brokerage Operations — Reconciliations

[HUMAN DECISION REQUIRED]
One sentence: what the analyst must decide and why this cannot be automated per CIRO Rule 3200."""


def build_analysis_prompt(context: dict) -> str:
    """Build the analysis prompt from fetched data context."""
    row = context["break_row"]

    prompt_parts = [
        f"RECONCILIATION BREAK — ANALYSIS REQUEST",
        f"",
        f"BREAK DETAILS:",
        f"  Trade Ref ID: {row.get('Trade Ref ID', 'N/A')}",
        f"  Security: {row.get('Security Name', 'N/A')} ({row.get('Ticker', 'N/A')})",
        f"  CUSIP: {row.get('CUSIP', 'N/A')} | ISIN: {row.get('ISIN', 'N/A')}",
        f"  Instrument Type: {row.get('Instrument Type', 'N/A')}",
        f"  Currency: {row.get('Currency', 'N/A')}",
        f"  Counterparty: {row.get('Counterparty', 'N/A')}",
        f"  Break Type (flagged): {row.get('Break Type', 'N/A')}",
        f"  Internal Qty (IBOR): {row.get('Internal Qty', 'N/A')}",
        f"  Street Qty: {row.get('Street Qty', 'N/A')}",
        f"  Qty Difference: {row.get('Qty Diff', 'N/A')}",
        f"  Internal Price: {row.get('Internal Price', 'N/A')}",
        f"  Street Price: {row.get('Street Price', 'N/A')}",
        f"  Price Diff %: {row.get('Price Diff %', 'N/A')}",
    ]

    # MV data if available
    mv_int = row.get('MV Internal ($)')
    mv_str = row.get('MV Street ($)')
    mv_diff = row.get('MV Diff ($)')
    if mv_int is not None:
        prompt_parts.append(f"  MV Internal: ${mv_int:,.2f}" if isinstance(mv_int, (int, float)) else f"  MV Internal: {mv_int}")
    if mv_str is not None:
        prompt_parts.append(f"  MV Street: ${mv_str:,.2f}" if isinstance(mv_str, (int, float)) else f"  MV Street: {mv_str}")
    if mv_diff is not None:
        prompt_parts.append(f"  MV Diff: ${mv_diff:+,.2f}" if isinstance(mv_diff, (int, float)) else f"  MV Diff: {mv_diff}")

    prompt_parts += [
        f"  Tolerance Flag: {row.get('Tolerance Flag', 'N/A')}",
        f"  Break Age (days): {row.get('Break Age (days)', 'N/A')}",
        f"  Settlement Date (internal): {row.get('Settlement Date', 'N/A')}",
        f"  Trade Date: {row.get('Trade Date', 'N/A')}",
        f"  Transaction Type: {row.get('Transaction Type', 'N/A')}",
        f"  Description: {row.get('DESC', 'N/A')}",
        f""
    ]

    # Live price data
    if context.get("live_price") and not context["live_price"].get("error"):
        lp = context["live_price"]
        prompt_parts += [
            f"LIVE MARKET DATA (Yahoo Finance — {lp.get('timestamp', 'N/A')}):",
            f"  Current Market Price: {lp.get('live_price', 'N/A')} {row.get('Currency', '')}",
            f"  Previous Close: {lp.get('prev_close', 'N/A')}",
            f"  Change vs Prev Close: {lp.get('change_pct', 'N/A')}%",
            f""
        ]
    elif context.get("live_price") and context["live_price"].get("error"):
        prompt_parts += [
            f"LIVE MARKET DATA: Error fetching — {context['live_price']['error']}",
            f"  Note: Confidence scores should be reduced ~15% due to unavailable live pricing",
            f""
        ]

    # Corporate actions
    if context.get("corporate_actions"):
        ca = context["corporate_actions"]
        if not ca.get("error"):
            actions = ca.get("recent_corporate_actions") or ca.get("recent_distributions") or []
            ex_div = ca.get("ex_dividend_date", "None found")
            source = ca.get("source", "Yahoo Finance")
            prompt_parts += [
                f"CORPORATE ACTIONS ({source}):",
                f"  Ex-Dividend Date: {ex_div}",
                f"  Recent Actions: {json.dumps(actions, indent=2) if actions else 'None in recent history'}",
            ]

            # SEC EDGAR 8-K data if present
            if ca.get("sec_edgar_8k"):
                prompt_parts.append(f"  SEC EDGAR 8-K filings (last 90 days): {ca.get('sec_edgar_total_90d', 0)} total")
                for filing in ca["sec_edgar_8k"]:
                    prompt_parts.append(f"    - {filing.get('file_date', 'N/A')}: {filing.get('form', '8-K')} — {filing.get('description', 'N/A')}")
            elif ca.get("sec_edgar_note"):
                prompt_parts.append(f"  SEC EDGAR: {ca['sec_edgar_note']}")

            prompt_parts.append(f"")

    # Settlement info
    if context.get("settlement_info"):
        si = context["settlement_info"]
        prompt_parts += [
            f"SETTLEMENT INFORMATION:",
            f"  Expected Settlement: {si.get('expected_settlement_date', 'N/A')}",
            f"  Settlement Rule: {si.get('settlement_rule', 'N/A')}",
            f"  Depository: {si.get('depository', 'N/A')}",
            f"  Note: {si.get('note', '')}",
            f""
        ]

    # Fixed income accrual
    if context.get("fixed_income_accrual") and not context["fixed_income_accrual"].get("error"):
        fi = context["fixed_income_accrual"]
        prompt_parts += [
            f"FIXED INCOME ACCRUAL ({fi.get('computation_method', 'N/A')}):",
            f"  Bond: {fi.get('bond', 'N/A')} | Coupon: {fi.get('coupon_rate', 'N/A')}%",
            f"  Maturity: {fi.get('maturity', 'N/A')}",
            f"  Last Coupon Date: {fi.get('last_coupon_date', 'N/A')}",
            f"  Days Accrued: {fi.get('days_accrued', 'N/A')}",
            f"  Computed Accrued Interest: ${fi.get('total_accrued_interest', 'N/A'):,}" if isinstance(fi.get('total_accrued_interest'), (int, float)) else f"  Computed Accrued Interest: {fi.get('total_accrued_interest', 'N/A')}",
            f"  Day Count: {fi.get('day_count', 'N/A')}",
            f"  Source: {fi.get('source', 'N/A')}",
            f""
        ]

    prompt_parts += [
        f"DATA SOURCES USED: {', '.join(context.get('data_sources_used', []))}",
        f"",
        f"Analyze this break thoroughly. Be specific, show your reasoning, and give me actionable escalation routing with a ready-to-send draft email."
    ]

    return "\n".join(prompt_parts)


def analyze_break_streaming(context: dict, api_key: str) -> Generator[str, None, None]:
    """
    Stream Claude's analysis of a single break.
    Yields text chunks as they arrive.
    """
    client = anthropic.Anthropic(api_key=api_key)
    prompt = build_analysis_prompt(context)

    with client.messages.stream(
        model="claude-sonnet-4-20250514",
        max_tokens=1200,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    ) as stream:
        for text in stream.text_stream:
            yield text


def generate_investigation_summary(full_analysis: str, break_row: dict, data_sources: list, api_key: str) -> str:
    """
    Fast non-streaming call to generate a genuine executive summary
    of the investigation. Returns a JSON array of bullet strings.
    """
    client = anthropic.Anthropic(api_key=api_key)

    ticker = break_row.get("Ticker", "Unknown")
    instrument = break_row.get("Security Name", "Unknown")
    break_type = break_row.get("Break Type", "Reconciliation Break")
    txn_type = break_row.get("Transaction Type", "N/A")
    sources_str = ", ".join(data_sources) if data_sources else "IBOR, DTC/CDS"

    prompt = f"""You just completed an investigation on a break for {ticker} ({instrument}).
Transaction type: {txn_type}
Break type: {break_type}
Data sources checked: {sources_str}

Here is the full analysis you produced:
---
{full_analysis}
---

Now write a concise executive summary as a JSON array of 4-5 short bullet strings. Each bullet should be 1 sentence max. Cover:
1. What you investigated (the specific break, ticker, and what type of issue)
2. What data sources you cross-referenced (be specific — name them)  
3. What you found (the specific root cause — if it's a corporate action, name it; if it's a timing lag, say so clearly)
4. Your confidence level and what was ruled out
5. Your recommended next step (route to which team, urgency)

Return ONLY a valid JSON array of strings, nothing else. Example:
["Investigated HD $16,243 pricing break triggered by merger exchange ratio mismatch between IBOR and CDS.", "Cross-referenced live market data from Yahoo Finance, CDS depository records, and IBOR position files.", "Root cause: corporate action — HD/CPKC merger with 2.884 exchange ratio not yet reflected in IBOR pricing feed.", "85% confidence this is a timing lag; ruled out manual entry error and pricing vendor fault.", "Route to Corporate Actions desk for IBOR price adjustment before 4PM NAV cut-off — urgency: SAME-DAY."]"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"Summary generation error: {e}")
        return '[]'


def get_quick_triage(breaks_list: list, api_key: str) -> dict:
    """
    Fast triage pass: given all breaks, return severity + routing for each.
    Used to populate the dashboard before deep-dive analysis.
    """
    client = anthropic.Anthropic(api_key=api_key)

    breaks_summary = []
    for i, b in enumerate(breaks_list):
        breaks_summary.append(
            f"{i+1}. {b.get('Security Name','?')} ({b.get('Ticker','?')}) | "
            f"{b.get('Instrument Type','?')} | {b.get('Break Type','?')} | "
            f"Price Diff: {b.get('Price Diff %','N/A')} | "
            f"Qty Diff: {b.get('Qty Diff','N/A')} | "
            f"MV Diff: {b.get('MV Diff ($)','N/A')} | "
            f"Tolerance: {b.get('Tolerance Flag','N/A')} | "
            f"Counterparty: {b.get('Counterparty','?')}"
        )

    prompt = f"""You are a senior reconciliation analyst doing morning triage on a break report at a Canadian broker-dealer.

For each break below, respond with a JSON array. Each item must have:
- "index": (1-based number matching the break)
- "severity": "HIGH", "MEDIUM", or "LOW"
- "likely_cause": Short factual observation of the numbers (e.g. "$11,706 MV variance against CDS", "No DTC confirmation yet"). DO NOT GUESS THE ROOT CAUSE. DO NOT MENTION SPLITS OR DIVIDENDS.
- "confidence": integer 0-100
- "route_to": specific team name from this list ONLY:
    Pricing Difference → "Pricing Team / Vendor Operations"
    Quantity Mismatch → "Settlements Desk + CDS/DTC"
    Corporate Action → "Corporate Actions Team"
    Timing Difference → "Settlements Desk"
    Accrued Interest → "Fixed Income Ops"
    Option Qty Mismatch → "Derivatives Desk"
- "flag": "ESCALATE", "INVESTIGATE", or "MONITOR"

BREAKS:
{chr(10).join(breaks_summary)}

Respond with ONLY the JSON array, no other text."""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )

    try:
        text = response.content[0].text.strip()
        # Extract JSON array — handle code fences
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("["):
                    text = part
                    break
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            text = text[start:end + 1]
        return {"triages": json.loads(text), "error": None}
    except Exception as e:
        return {"triages": [], "error": str(e)}
