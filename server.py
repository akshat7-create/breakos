"""
server.py — BreakOS FastAPI Backend
Wraps existing analyzer.py, data_sources.py, and generate_sample.py
in a REST API for the React frontend.

Run:
  source .venv/bin/activate
  uvicorn server:app --reload --port 8000
"""

import os
import json
import uuid
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from data_sources import fetch_all_data_for_break
from analyzer import analyze_break_streaming, get_quick_triage, generate_investigation_summary
from generate_sample import generate_sample_breaks

load_dotenv()

# ─── App ───────────────────────────────────────────────

app = FastAPI(title="BreakOS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── In-memory session store ──────────────────────────

session = {
    "breaks": [],           # List of break dicts
    "triage_results": {},   # break_id -> triage dict
    "analysis_results": {}, # break_id -> analysis text
    "decisions": {},        # break_id -> decision dict
    "api_status": "active",
}

# ─── Persistent audit log ─────────────────────────────
AUDIT_LOG_FILE = Path(__file__).parent / "audit_log.json"

def _load_audit_log() -> list:
    """Load audit log from disk, auto-delete entries older than 30 days."""
    if not AUDIT_LOG_FILE.exists():
        return []
    try:
        with open(AUDIT_LOG_FILE, "r") as f:
            entries = json.load(f)
        cutoff = (datetime.now() - timedelta(days=30)).isoformat()
        entries = [e for e in entries if e.get("timestamp", "") > cutoff]
        return entries
    except Exception:
        return []

def _save_audit_log(entries: list):
    """Save audit log to disk."""
    try:
        with open(AUDIT_LOG_FILE, "w") as f:
            json.dump(entries, f, indent=2, default=str)
    except Exception as e:
        print(f"Warning: failed to save audit log: {e}")

def _append_audit(entry: dict):
    """Append an audit entry and persist to disk."""
    entries = _load_audit_log()
    entries.append(entry)
    _save_audit_log(entries)

# Load on startup
_load_audit_log()


def get_api_key() -> str:
    key = os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set in .env")
    return key


# ─── Models ────────────────────────────────────────────

class DecisionRequest(BaseModel):
    break_id: str
    decision_type: str  # "escalate" or "override"
    reason: str
    analyst: str = "Akshat Aneja"


# ─── Helpers ───────────────────────────────────────────

def parse_xlsx_to_breaks(file_path: str) -> list:
    """Parse an xlsx or csv break report into a list of break dicts with IDs."""
    try:
        if file_path.lower().endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path, sheet_name=0)
    except Exception as e:
        raise ValueError("The provided file could not be read or is corrupted.")

    if df.empty:
        raise ValueError("The uploaded file contains no data.")

    # Strict schema validation: Ensure all required columns exist
    # These match the exact fields expected by the frontend's Data Pipeline and Break Queue
    exact_required_cols = {
        'Trade Date', 'Settlement Date', 'Currency', 'Security Name', 'Ticker', 'Instrument Type',
        'Trade Ref ID', 'Counterparty', 'Internal Qty', 'Street Qty',
        'MV Internal ($)', 'MV Street ($)', 'MV Diff ($)'
    }
    
    missing_cols = exact_required_cols - set(df.columns)
    if missing_cols:
        raise ValueError(f"Invalid or irrelevant file. Missing critical dataset columns: {', '.join(missing_cols)}")

    # Data integrity: Ensure critical numeric/date fields aren't completely blank/malformed for all rows
    if df['Trade Ref ID'].isnull().all():
        raise ValueError("Invalid dataset: All 'Trade Ref ID' values are missing.")
    if df['Ticker'].isnull().all():
         raise ValueError("Invalid dataset: All 'Ticker' values are missing.")

    breaks = []
    for i, row in df.iterrows():
        break_dict = row.to_dict()
        # Clean NaN values
        for k, v in break_dict.items():
            if pd.isna(v):
                break_dict[k] = None
        break_dict["id"] = str(i)
        break_dict["status"] = "pre-triage"
        breaks.append(break_dict)
    return breaks


def break_to_frontend(b: dict) -> dict:
    """Transform a break dict into a frontend-friendly shape."""
    triage = session["triage_results"].get(b["id"], {})
    analysis = session["analysis_results"].get(b["id"])
    decision = session["decisions"].get(b["id"])

    return {
        "id": b["id"],
        "ticker": b.get("Ticker", "???"),
        "refId": b.get("Trade Ref ID", "N/A"),
        "instrument": b.get("Security Name", "Unknown"),
        "instrumentType": b.get("Instrument Type", "Equity"),
        "currency": b.get("Currency", "CAD"),
        "counterparty": b.get("Counterparty", "Unknown"),
        "severity": triage.get("severity", "MEDIUM"),
        "status": b.get("status", "pre-triage"),
        "aiAssessment": triage.get("likely_cause"),
        "confidence": triage.get("confidence"),
        "route": triage.get("route_to"),
        "flag": triage.get("flag"),
        "mvDiff": b.get("MV Diff ($)", 0),
        "mvInternal": b.get("MV Internal ($)", 0),
        "mvStreet": b.get("MV Street ($)", 0),
        "internalPrice": b.get("Internal Price"),
        "streetPrice": b.get("Street Price"),
        "priceDiff": b.get("Price Diff %"),
        "internalQty": b.get("Internal Qty"),
        "streetQty": b.get("Street Qty"),
        "qtyDiff": b.get("Qty Diff"),
        "tradeDate": b.get("Trade Date"),
        "settlementDate": b.get("Settlement Date"),
        "transactionType": b.get("Transaction Type", "N/A"),
        "breakType": b.get("Break Type"),
        "toleranceFlag": b.get("Tolerance Flag"),
        "age": b.get("Break Age (days)", 0),
        "desc": b.get("DESC", ""),
        "cusip": b.get("CUSIP"),
        "isin": b.get("ISIN"),
        "bondKey": b.get("Bond Key"),
        "analysisText": analysis,
        "decision": decision,
    }


# ─── Routes ────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "api_status": session["api_status"]}


@app.get("/api/breaks")
def get_breaks():
    """Return all breaks in the current session."""
    return {
        "breaks": [break_to_frontend(b) for b in session["breaks"]],
        "total": len(session["breaks"]),
    }


@app.get("/api/sample")
def load_sample():
    """Generate and load sample break report with randomized data."""
    import random as _rng
    try:
        # Reset random seed for different data each time
        _rng.seed()
        output_path = generate_sample_breaks()
        all_breaks = parse_xlsx_to_breaks(output_path)

        # Randomly select a subset (5-9 breaks) for variety
        num_breaks = _rng.randint(5, min(9, len(all_breaks)))
        selected_indices = sorted(_rng.sample(range(len(all_breaks)), num_breaks))
        selected_breaks = [all_breaks[i] for i in selected_indices]
        # Re-index IDs
        for idx, b in enumerate(selected_breaks):
            b["id"] = str(idx)

        session["breaks"] = selected_breaks
        session["triage_results"] = {}
        session["analysis_results"] = {}
        session["decisions"] = {}

        _append_audit({
            "id": str(uuid.uuid4()),
            "type": "system",
            "action": f"Sample break report loaded ({len(selected_breaks)} breaks)",
            "timestamp": datetime.now().isoformat(),
            "breakCount": len(selected_breaks),
        })

        return {
            "breaks": [break_to_frontend(b) for b in session["breaks"]],
            "total": len(session["breaks"]),
            "message": f"Loaded {len(session['breaks'])} breaks from sample report",
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload an xlsx or csv break report."""
    filename = file.filename.lower()
    if not filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="File must be .xlsx, .xls, or .csv. Please upload a structured spreadsheet.")

    # Save temporarily
    ext = filename.split('.')[-1]
    tmp_path = f"/tmp/breakos_upload_{uuid.uuid4().hex}.{ext}"
    try:
        contents = await file.read()
        with open(tmp_path, "wb") as f:
            f.write(contents)

        try:
            parsed_breaks = parse_xlsx_to_breaks(tmp_path)
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))

        session["breaks"] = parsed_breaks
        session["triage_results"] = {}
        session["analysis_results"] = {}
        session["decisions"] = {}

        _append_audit({
            "id": str(uuid.uuid4()),
            "type": "upload",
            "action": f"Uploaded {file.filename}",
            "timestamp": datetime.now().isoformat(),
            "breakCount": len(session["breaks"]),
        })

        return {
            "breaks": [break_to_frontend(b) for b in session["breaks"]],
            "total": len(session["breaks"]),
            "message": f"Loaded {len(session['breaks'])} breaks from {file.filename}",
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@app.post("/api/triage")
def run_triage():
    """Run AI quick triage on all pre-triage breaks."""
    if not session["breaks"]:
        raise HTTPException(status_code=400, detail="No breaks loaded")

    api_key = get_api_key()

    try:
        result = get_quick_triage(session["breaks"], api_key)

        if result.get("error"):
            raise HTTPException(status_code=500, detail=f"Triage error: {result['error']}")

        for i, triage_item in enumerate(result.get("triages", [])):
            idx = triage_item.get("index", i + 1) - 1  # 1-based to 0-based
            if 0 <= idx < len(session["breaks"]):
                break_row = session["breaks"][idx]
                break_id = break_row["id"]
                
                # Deterministic severity calculation
                mv_diff_val = break_row.get("MV Diff ($)")
                mv_diff = abs(float(mv_diff_val)) if mv_diff_val is not None else 0
                tol_flag = break_row.get("Tolerance Flag", "")
                
                if mv_diff >= 10000 or (tol_flag == "BREACH" and mv_diff >= 5000):
                    triage_item["severity"] = "HIGH"
                elif 2000 <= mv_diff < 10000:
                    triage_item["severity"] = "MEDIUM"
                else:
                    triage_item["severity"] = "LOW"
                    
                session["triage_results"][break_id] = triage_item
                session["breaks"][idx]["status"] = "triaged"

        _append_audit({
            "id": str(uuid.uuid4()),
            "type": "triage",
            "action": f"Quick triage completed for {len(result.get('triages', []))} breaks",
            "timestamp": datetime.now().isoformat(),
        })

        return {
            "breaks": [break_to_frontend(b) for b in session["breaks"]],
            "triaged": len(result.get("triages", [])),
            "message": "Triage complete",
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


class SynthesizeRequest(BaseModel):
    totalBreaks: int
    totalMV: float
    signals: list
    historyMatches: list

@app.post("/api/synthesize")
def synthesize_patterns(req: SynthesizeRequest):
    """Generate a morning briefing paragraph from patterns and history."""
    api_key = get_api_key()
    client = anthropic.Anthropic(api_key=api_key)

    signals_text = "\\n".join([f"- {s['label']}" for s in req.signals])
    
    history_text = []
    if req.historyMatches:
        for m in req.historyMatches:
            fp_name = m['fingerprint']
            count = m['totalOccurrences']
            days_ago = m['occurrences'][0]['daysAgo']
            res = m['occurrences'][0].get('resolution')
            res_str = f", resolved by: {res}" if res else ""
            history_text.append(f"The {fp_name} pattern has come up {count} times in the past 30 days, most recently {days_ago} days ago{res_str}.")
    else:
        history_text.append("No prior occurrences found in the past 30 days.")

    prompt = f"""You are a senior reconciliation analyst at a Canadian broker-dealer. You brief the morning ops team on break patterns.

Today's session: {req.totalBreaks} breaks, ${req.totalMV:,.2f} total exposure.

Today's signals:
{signals_text}

Historical context:
{' '.join(history_text)}

Please read the signals and historical context, then write a short, clear 2-3 sentence summary.
Format your response exactly like this:
ISSUE: [1 clear sentence describing what the pattern or recurring issue is based on the signals and history]
RECOMMENDED RESOLUTION: [1 clear sentence describing what the analyst should do to resolve this, drawing from historical resolutions if available]"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=250,
            messages=[{"role": "user", "content": prompt}]
        )
        return {"insight": response.content[0].text.strip(), "error": None}
    except Exception as e:
        traceback.print_exc()
        return {"insight": "Systemic pattern analysis temporarily unavailable.", "error": str(e)}


@app.get("/api/investigate/{break_id}")
def investigate_break(break_id: str):
    """Stream AI analysis for a single break using SSE."""
    # Find the break
    break_row = None
    for b in session["breaks"]:
        if b["id"] == break_id:
            break_row = b
            break

    if not break_row:
        raise HTTPException(status_code=404, detail=f"Break {break_id} not found")

    api_key = get_api_key()

    def make_event(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    def generate():
        import time
        try:
            # Step 1: Fetch data context
            ticker = break_row.get("Ticker", "")
            yield make_event({"type": "step", "step": "fetching", "label": f"Fetching {ticker} live price..."})

            context = fetch_all_data_for_break(break_row)

            yield make_event({"type": "step_done", "step": "fetching", "result": "Price fetched"})

            # Step 2: Corporate actions
            yield make_event({"type": "step", "step": "corporate_actions", "label": "Checking corporate action history..."})
            time.sleep(0.3)
            yield make_event({"type": "step_done", "step": "corporate_actions", "result": "History checked"})

            # Step 3: Settlement logic
            yield make_event({"type": "step", "step": "settlement", "label": "Computing settlement logic..."})
            time.sleep(0.2)
            yield make_event({"type": "step_done", "step": "settlement", "result": "Settlement verified"})

            # Step 4: AI analysis
            yield make_event({"type": "step", "step": "ai", "label": "Sending context to AI..."})

            full_text = ""
            for chunk in analyze_break_streaming(context, api_key):
                full_text += chunk
                yield make_event({"type": "text", "chunk": chunk})

            yield make_event({"type": "step_done", "step": "ai", "result": "Analysis complete"})

            # Store the result
            session["analysis_results"][break_id] = full_text
            break_row["status"] = "investigated"

            # Extract data sources
            sources = context.get("data_sources_used", [])
            yield make_event({"type": "sources", "sources": sources})

            # Generate authentic AI summary
            yield make_event({"type": "step", "step": "summary", "label": "Generating investigation summary..."})
            try:
                summary_json = generate_investigation_summary(full_text, break_row, sources, api_key)
                yield make_event({"type": "summary", "summary": summary_json})
            except Exception as e:
                print(f"Summary generation failed: {e}")
                yield make_event({"type": "summary", "summary": "[]"})
            yield make_event({"type": "step_done", "step": "summary", "result": "Summary ready"})

            yield make_event({"type": "complete"})

            _append_audit({
                "id": str(uuid.uuid4()),
                "type": "investigation",
                "action": f"AI investigation completed for {ticker}",
                "timestamp": datetime.now().isoformat(),
                "breakId": break_id,
            })

        except Exception as e:
            traceback.print_exc()
            yield make_event({"type": "error", "message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/decision")
def submit_decision(req: DecisionRequest):
    """Log a human escalation or override decision."""
    # Validate break exists
    break_exists = any(b["id"] == req.break_id for b in session["breaks"])
    if not break_exists:
        raise HTTPException(status_code=404, detail=f"Break {req.break_id} not found")

    decision = {
        "type": req.decision_type,
        "reason": req.reason,
        "analyst": req.analyst,
        "timestamp": datetime.now().isoformat(),
    }

    session["decisions"][req.break_id] = decision

    _append_audit({
        "id": str(uuid.uuid4()),
        "type": req.decision_type,
        "action": f"{req.analyst} {'approved escalation' if req.decision_type == 'escalate' else 'overrode AI recommendation'} for break {req.break_id}",
        "timestamp": datetime.now().isoformat(),
        "breakId": req.break_id,
        "reason": req.reason,
    })

    return {"status": "ok", "decision": decision}


@app.get("/api/audit")
def get_audit_log():
    """Return the audit log."""
    return {"entries": _load_audit_log()}


@app.get("/api/break/{break_id}")
def get_single_break(break_id: str):
    """Get a single break by ID with full detail."""
    for b in session["breaks"]:
        if b["id"] == break_id:
            return break_to_frontend(b)
    raise HTTPException(status_code=404, detail=f"Break {break_id} not found")
