"""
app.py — BreakOS
AI-Native Reconciliation Break Investigator
Built for Wealthsimple AI Builder application by Akshat Aneja

Run: streamlit run app.py
"""

import streamlit as st
import pandas as pd
import json
import time
import re
import os
import html as html_module
from datetime import date, datetime
from io import BytesIO
from dotenv import load_dotenv

from data_sources import (
    fetch_all_data_for_break,
    get_live_price,
    get_corporate_actions,
    get_settlement_info,
    compute_accrued_interest,
)
from analyzer import analyze_break_streaming, get_quick_triage

# Load .env for API key
load_dotenv()


def safe_escape(text: str) -> str:
    """Escape text for safe insertion into st.markdown HTML blocks.
    Handles HTML entities AND Streamlit markdown specials ($ for LaTeX)."""
    s = html_module.escape(text)
    s = s.replace("$", "&#36;")
    return s


# ── BREAK TYPE MATCH LOGIC ──
BREAK_TYPE_KEYWORDS = {
    "Pricing Difference": ["pricing", "vendor", "feed", "price", "stale", "fx", "rate", "valuation"],
    "Quantity Mismatch": ["quantity", "qty", "shortfall", "partial", "fill", "split", "exercise", "assignment"],
    "Timing Difference": ["timing", "settlement", "late", "booking", "t+1", "date", "field"],
    "Corporate Action": ["dividend", "split", "corporate", "distribution", "ex-div", "stock split"],
    "Accrued Interest": ["accrued", "interest", "day count", "coupon", "act/360", "convention"],
}

def does_ai_match_flagged(likely_cause: str, break_type: str) -> bool:
    """Check if AI's likely_cause relates to the analyst's flagged Break Type."""
    keywords = BREAK_TYPE_KEYWORDS.get(break_type, [])
    cause_lower = likely_cause.lower()
    return any(kw in cause_lower for kw in keywords)


# ─────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────
st.set_page_config(
    page_title="BreakOS — AI Recon Investigator",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)


# ─────────────────────────────────────────
# SESSION STATE INIT
# ─────────────────────────────────────────
if "breaks_df" not in st.session_state:
    st.session_state.breaks_df = None
if "triage_results" not in st.session_state:
    st.session_state.triage_results = {}
if "selected_break_idx" not in st.session_state:
    st.session_state.selected_break_idx = 0
if "analysis_results" not in st.session_state:
    st.session_state.analysis_results = {}
if "api_key" not in st.session_state:
    st.session_state.api_key = ""
if "triage_done" not in st.session_state:
    st.session_state.triage_done = False
if "escalation_decisions" not in st.session_state:
    st.session_state.escalation_decisions = {}
if "audit_log" not in st.session_state:
    st.session_state.audit_log = []
if "theme" not in st.session_state:
    st.session_state.theme = "dark"

# Auto-load API key from .env
env_key = os.getenv("ANTHROPIC_API_KEY", "")
if env_key and not st.session_state.api_key:
    st.session_state.api_key = env_key


def log_audit(event: str, status: str = "completed"):
    """Append an entry to the audit log."""
    st.session_state.audit_log.append({
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "event": event,
        "status": status
    })


# ─────────────────────────────────────────
# THEME CSS VARIABLES
# ─────────────────────────────────────────
if st.session_state.theme == "dark":
    theme_vars = """
    :root {
        --bg: #0A0A12;
        --bg-alt: #0F0F1A;
        --surface: #12121E;
        --surface-2: #1A1A2E;
        --surface-glass: rgba(18,18,30,0.6);
        --border: rgba(99,102,241,0.12);
        --border-hover: rgba(99,102,241,0.3);
        --accent: #6366F1;
        --accent-bright: #818CF8;
        --accent-dim: rgba(99,102,241,0.1);
        --accent-border: rgba(99,102,241,0.25);
        --accent-surface: rgba(99,102,241,0.06);
        --accent-glow: rgba(99,102,241,0.15);
        --cyan: #06B6D4;
        --cyan-dim: rgba(6,182,212,0.1);
        --text: #F1F5F9;
        --text-secondary: #CBD5E1;
        --text-dim: #94A3B8;
        --text-muted: #64748B;
        --text-faint: #334155;
        --red: #EF4444;
        --red-dim: rgba(239,68,68,0.12);
        --red-border: rgba(239,68,68,0.25);
        --red-surface: rgba(239,68,68,0.06);
        --red-glow: rgba(239,68,68,0.15);
        --amber: #F59E0B;
        --amber-dim: rgba(245,158,11,0.12);
        --amber-border: rgba(245,158,11,0.25);
        --blue: #3B82F6;
        --blue-dim: rgba(59,130,246,0.12);
        --blue-border: rgba(59,130,246,0.2);
        --green: #10B981;
        --green-dim: rgba(16,185,129,0.12);
        --bar-track: #1E1E32;
        --gradient-start: #6366F1;
        --gradient-end: #06B6D4;
    }
    """
else:
    theme_vars = """
    :root {
        --bg: #F8FAFC;
        --bg-alt: #F1F5F9;
        --surface: #FFFFFF;
        --surface-2: #F1F5F9;
        --surface-glass: rgba(255,255,255,0.7);
        --border: rgba(99,102,241,0.15);
        --border-hover: rgba(99,102,241,0.35);
        --accent: #4F46E5;
        --accent-bright: #6366F1;
        --accent-dim: rgba(79,70,229,0.08);
        --accent-border: rgba(79,70,229,0.2);
        --accent-surface: rgba(79,70,229,0.05);
        --accent-glow: rgba(79,70,229,0.1);
        --cyan: #0891B2;
        --cyan-dim: rgba(8,145,178,0.08);
        --text: #0F172A;
        --text-secondary: #334155;
        --text-dim: #64748B;
        --text-muted: #94A3B8;
        --text-faint: #CBD5E1;
        --red: #DC2626;
        --red-dim: rgba(220,38,38,0.08);
        --red-border: rgba(220,38,38,0.2);
        --red-surface: rgba(220,38,38,0.04);
        --red-glow: rgba(220,38,38,0.1);
        --amber: #D97706;
        --amber-dim: rgba(217,119,6,0.08);
        --amber-border: rgba(217,119,6,0.2);
        --blue: #2563EB;
        --blue-dim: rgba(37,99,235,0.08);
        --blue-border: rgba(37,99,235,0.15);
        --green: #059669;
        --green-dim: rgba(5,150,105,0.08);
        --bar-track: #E2E8F0;
        --gradient-start: #4F46E5;
        --gradient-end: #0891B2;
    }
    """


# ─────────────────────────────────────────
# STYLING
# ─────────────────────────────────────────
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

{theme_vars}

/* ── Animations ── */
@keyframes pulse {{
    0%, 100% {{ opacity: 1; }}
    50% {{ opacity: 0.5; }}
}}
@keyframes shimmer {{
    0% {{ background-position: -200% 0; }}
    100% {{ background-position: 200% 0; }}
}}
@keyframes fadeIn {{
    from {{ opacity: 0; transform: translateY(8px); }}
    to {{ opacity: 1; transform: translateY(0); }}
}}
@keyframes slideUp {{
    from {{ opacity: 0; transform: translateY(16px); }}
    to {{ opacity: 1; transform: translateY(0); }}
}}
@keyframes fillBar {{
    from {{ width: 0%; }}
}}
@keyframes gradientShift {{
    0% {{ background-position: 0% 50%; }}
    50% {{ background-position: 100% 50%; }}
    100% {{ background-position: 0% 50%; }}
}}
@keyframes glowPulse {{
    0%, 100% {{ box-shadow: 0 0 8px var(--red-glow); }}
    50% {{ box-shadow: 0 0 20px var(--red-glow), 0 0 40px rgba(239,68,68,0.05); }}
}}

/* ── Base ── */
html, body, [class*="css"] {{
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    background-color: var(--bg) !important;
    color: var(--text) !important;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}}
[data-testid="stMain"],
[data-testid="stAppViewContainer"],
.stApp {{
    background-color: var(--bg) !important;
    background-image: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.05) 0%, transparent 60%);
}}
[data-testid="stSidebar"] > div {{
    background: linear-gradient(180deg, var(--bg-alt) 0%, var(--bg) 100%) !important;
}}

/* Hide Streamlit default chrome */
#MainMenu {{visibility: hidden;}}
footer {{visibility: hidden;}}
header {{visibility: hidden;}}
.stDeployButton {{ display: none !important; }}

/* ── Main container ── */
.main .block-container {{
    padding-top: 1.5rem;
    padding-bottom: 2rem;
    max-width: 1440px;
}}

/* ── Sidebar ── */
[data-testid="stSidebar"] {{
    background: linear-gradient(180deg, var(--bg-alt) 0%, var(--bg) 100%);
    border-right: 1px solid var(--border);
}}
[data-testid="stSidebar"] .stMarkdown {{
    color: var(--text-dim);
}}
[data-testid="stSidebar"] [data-testid="stTextInput"] input {{
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 8px !important;
    color: var(--text) !important;
    font-family: 'JetBrains Mono', monospace !important;
    font-size: 12px !important;
    transition: border-color 0.2s ease !important;
}}
[data-testid="stSidebar"] [data-testid="stTextInput"] input:focus {{
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-dim) !important;
}}

/* ── Severity badges ── */
.badge {{
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    font-family: 'Inter', sans-serif;
    text-transform: uppercase;
}}
.badge-high {{
    background: var(--red-dim);
    color: var(--red);
    border: 1px solid var(--red-border);
    box-shadow: 0 0 12px var(--red-glow);
    animation: glowPulse 3s ease-in-out infinite;
}}
.badge-medium {{
    background: var(--amber-dim);
    color: var(--amber);
    border: 1px solid var(--amber-border);
}}
.badge-low {{
    background: var(--blue-dim);
    color: var(--blue);
    border: 1px solid var(--blue-border);
}}

/* ── Analysis output ── */
.analysis-output {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    line-height: 1.8;
    color: var(--text-secondary);
    max-height: 520px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    animation: fadeIn 0.4s ease-out;
}}
.analysis-output::-webkit-scrollbar {{
    width: 6px;
}}
.analysis-output::-webkit-scrollbar-track {{
    background: transparent;
}}
.analysis-output::-webkit-scrollbar-thumb {{
    background: var(--text-faint);
    border-radius: 3px;
}}

/* ── Human gate ── */
.human-gate {{
    background: var(--red-surface);
    border: 1px solid var(--red-border);
    border-left: 4px solid var(--red);
    border-radius: 12px;
    padding: 24px 28px;
    margin-top: 20px;
    animation: fadeIn 0.5s ease-out;
    box-shadow: 0 0 30px var(--red-glow);
}}
.gate-title {{
    color: var(--red);
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
}}
.gate-subtitle {{
    color: var(--text-dim);
    font-size: 12px;
    margin-bottom: 16px;
    font-family: 'Inter', sans-serif;
}}

/* ── Data source chips ── */
.source-chip {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--accent-dim);
    border: 1px solid var(--accent-border);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 500;
    margin-right: 6px;
    margin-bottom: 6px;
    transition: all 0.2s ease;
}}
.source-chip:hover {{
    background: var(--accent-surface);
    border-color: var(--accent);
}}
.source-chip-sim {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--amber-dim);
    border: 1px solid var(--amber-border);
    color: var(--amber);
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 500;
    margin-right: 6px;
    margin-bottom: 6px;
}}

/* ── Buttons ── */
.stButton button {{
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent-bright, var(--accent)) 100%) !important;
    border: none !important;
    color: white !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    border-radius: 10px !important;
    padding: 8px 20px !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 2px 8px var(--accent-glow) !important;
    letter-spacing: 0.01em !important;
}}
.stButton button:hover {{
    transform: translateY(-1px) !important;
    box-shadow: 0 6px 20px var(--accent-glow), 0 0 40px rgba(99,102,241,0.1) !important;
    filter: brightness(1.1) !important;
}}
.stButton button:active {{
    transform: translateY(0) !important;
}}

/* ── Header bar ── */
.topbar {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 16px 0;
    border-bottom: 2px solid transparent;
    border-image: linear-gradient(90deg, var(--gradient-start), var(--gradient-end), transparent) 1;
    margin-bottom: 20px;
}}
.logo-text {{
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
    font-family: 'Inter', sans-serif;
}}
.logo-text span {{
    background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}}

/* ── Audit log ── */
.audit-log {{
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    max-height: 200px;
    overflow-y: auto;
    backdrop-filter: blur(8px);
}}

/* ── Divider ── */
hr {{
    border: none;
    border-top: 1px solid var(--border);
    margin: 16px 0;
}}

/* ── Step status ── */
.step-loading {{
    color: var(--amber);
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}}
.step-done {{
    color: var(--green, var(--accent));
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    padding: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
    animation: fadeIn 0.3s ease-out;
}}

/* ── Metadata pills ── */
.pill {{
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
    margin-right: 6px;
    margin-bottom: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-dim);
    font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
}}
.pill:hover {{
    border-color: var(--border-hover);
    background: var(--surface-2);
}}
.pill-breach {{
    color: var(--red);
    border-color: var(--red-border);
    background: var(--red-dim);
    font-weight: 600;
}}

/* ── Scrollbar ── */
::-webkit-scrollbar {{
    width: 6px;
    height: 6px;
}}
::-webkit-scrollbar-track {{
    background: transparent;
}}
::-webkit-scrollbar-thumb {{
    background: var(--text-faint);
    border-radius: 3px;
}}
::-webkit-scrollbar-thumb:hover {{
    background: var(--text-muted);
}}

/* ── Checkbox styling ── */
[data-testid="stCheckbox"] label {{
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    color: var(--text-secondary) !important;
}}

/* ── Expander ── */
[data-testid="stExpander"] {{
    border: 1px solid var(--border) !important;
    border-radius: 12px !important;
    background: var(--surface) !important;
}}
[data-testid="stExpander"] summary {{
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    color: var(--text-dim) !important;
}}

/* ── File uploader ── */
[data-testid="stFileUploader"] {{
    border-radius: 12px !important;
}}
[data-testid="stFileUploader"] section {{
    border: 2px dashed var(--border) !important;
    border-radius: 12px !important;
    background: var(--surface) !important;
    transition: border-color 0.2s ease !important;
    padding: 20px !important;
}}
[data-testid="stFileUploader"] section:hover {{
    border-color: var(--accent) !important;
}}

/* ── Text area ── */
textarea {{
    background: var(--surface) !important;
    border: 1px solid var(--border) !important;
    border-radius: 10px !important;
    color: var(--text) !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 13px !important;
    transition: border-color 0.2s ease !important;
}}
textarea:focus {{
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-dim) !important;
}}

/* ── Alert/status messages ── */
[data-testid="stAlert"] {{
    border-radius: 12px !important;
    font-family: 'Inter', sans-serif !important;
    border: none !important;
}}
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────
with st.sidebar:
    st.markdown(f"""
    <div style="padding: 8px 0 16px 0;">
        <div style="font-size:20px;font-weight:700;letter-spacing:-0.03em;font-family:'Inter',sans-serif;">
            Break<span style="background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">OS</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.12em;margin-top:4px;font-family:'Inter',sans-serif;font-weight:500;">
            AI Recon Investigator
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown(f'<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:8px;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">API Configuration</div>', unsafe_allow_html=True)
    api_key_input = st.text_input(
        "Anthropic API Key",
        type="password",
        placeholder="sk-ant-...",
        value=st.session_state.api_key,
        help="Auto-loads from .env if present. Used only for local Claude API calls."
    )
    if api_key_input:
        st.session_state.api_key = api_key_input

    if st.session_state.api_key:
        if env_key and st.session_state.api_key == env_key:
            st.markdown(f'<div style="font-size:11px;color:var(--accent);display:flex;align-items:center;gap:6px;font-family:\'Inter\',sans-serif;font-weight:500;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent-glow);"></span> Loaded from .env</div>', unsafe_allow_html=True)
        else:
            st.markdown(f'<div style="font-size:11px;color:var(--accent);display:flex;align-items:center;gap:6px;font-family:\'Inter\',sans-serif;font-weight:500;">✓ Key set</div>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown(f'<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:8px;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Upload Break Report</div>', unsafe_allow_html=True)

    uploaded_file = st.file_uploader(
        "Drop .xlsx break report",
        type=["xlsx"],
        help="Upload your morning break report exported from Excel/Google Sheets"
    )

    if uploaded_file:
        try:
            df = pd.read_excel(uploaded_file, sheet_name="Break Report")
            st.session_state.breaks_df = df
            st.session_state.triage_done = False
            st.session_state.triage_results = {}
            st.session_state.analysis_results = {}
            st.session_state.escalation_decisions = {}
            log_audit(f"Break report uploaded — {len(df)} breaks")
            st.success(f"✓ {len(df)} breaks loaded")
        except Exception as e:
            st.error(f"Error reading file: {e}")

    # Load sample file button
    st.markdown("---")
    if st.button("Load Sample Break Report", use_container_width=True):
        try:
            df = pd.read_excel("sample_breaks.xlsx", sheet_name="Break Report")
            st.session_state.breaks_df = df
            st.session_state.triage_done = False
            st.session_state.triage_results = {}
            st.session_state.analysis_results = {}
            st.session_state.escalation_decisions = {}
            log_audit(f"Sample break report loaded — {len(df)} breaks")
            st.success(f"✓ Sample loaded: {len(df)} breaks")
        except Exception as e:
            st.error(f"sample_breaks.xlsx not found. Run: python generate_sample.py")

    st.markdown("---")

    # Data sources legend
    st.markdown(f'<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:10px;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Data Sources</div>', unsafe_allow_html=True)
    st.markdown(f"""
    <div style="font-size:11px;font-family:'Inter',sans-serif;line-height:2;color:var(--text-dim);">
        <span class="source-chip">LIVE</span> Yahoo Finance<br>
        <span class="source-chip">LIVE</span> SEC EDGAR 8-K (US only)<br>
        <span class="source-chip">LIVE</span> rateslib (FI accruals)<br>
        <span class="source-chip-sim">SIM</span> CDS position data<br>
        <span class="source-chip-sim">SIM</span> DTC position data<br>
        <div style="margin-top:8px;font-size:10px;color:var(--text-muted);font-style:italic;line-height:1.5;">
        Simulated sources reflect real settlement rules. In production: CDS participant portal + DTCC Smart Source.
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Before/After time savings
    st.markdown("---")
    st.markdown(f'<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:10px;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Time Savings</div>', unsafe_allow_html=True)
    st.markdown(f"""
    <div style="font-size:10px;font-family:'Inter',sans-serif;color:var(--text-dim);">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px;">
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center;transition:all 0.2s ease;">
                <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:500;">Without BreakOS</div>
                <div style="font-size:20px;font-weight:700;color:var(--red);margin-top:4px;">~67 min</div>
                <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">per break</div>
            </div>
            <div style="background:var(--surface);border:1px solid var(--accent-border);border-radius:10px;padding:12px;text-align:center;box-shadow:0 0 20px var(--accent-glow);transition:all 0.2s ease;">
                <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:500;">With BreakOS</div>
                <div style="font-size:20px;font-weight:700;color:var(--accent);margin-top:4px;">~3 min</div>
                <div style="font-size:9px;color:var(--text-muted);margin-top:2px;">per break</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")
    st.markdown(f"""
    <div style="font-size:10px;color:var(--text-muted);line-height:1.7;font-family:'Inter',sans-serif;">
    Built by Akshat Aneja<br>
    Wealthsimple AI Builder Application<br>
    <div style="width:100%;height:1px;background:linear-gradient(90deg,var(--gradient-start),var(--gradient-end),transparent);margin:8px 0;"></div>
    Former: Fund Oversight Analyst<br>
    Scotiabank Asset Management<br>
    <span style="color:var(--accent);">CSC® Certified</span>
    </div>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────
# MAIN CONTENT
# ─────────────────────────────────────────

# Header with theme toggle
col_header, col_toggle = st.columns([12, 1])
with col_toggle:
    toggle_label = "☀️" if st.session_state.theme == "dark" else "🌙"
    if st.button(toggle_label, key="theme_toggle"):
        st.session_state.theme = "light" if st.session_state.theme == "dark" else "dark"
        st.rerun()

with col_header:
    st.markdown(f"""
    <div class="topbar">
        <div>
            <div class="logo-text">Break<span>OS</span> <span style="font-weight:400;font-size:16px;color:var(--text-dim);font-family:'Inter',sans-serif;">— AI Reconciliation Investigator</span></div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-family:'Inter',sans-serif;font-weight:400;letter-spacing:0.02em;">
                Brokerage Operations · IBOR vs Street-Side · CDS / DTC / RBC IS
            </div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);text-align:right;font-family:'Inter',sans-serif;">
            {date.today().strftime("%A, %B %d %Y")}<br>
            <span style="color:var(--accent);display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-weight:500;"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent-glow);animation:pulse 2s ease-in-out infinite;"></span> AI Engine Active</span>
        </div>
    </div>
    """, unsafe_allow_html=True)


# ── NO FILE LOADED STATE ──
if st.session_state.breaks_df is None:
    st.markdown(f"""
    <div style="text-align:center;padding:100px 40px;position:relative;">
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;background:radial-gradient(circle,var(--accent-glow) 0%,transparent 70%);opacity:0.3;pointer-events:none;"></div>
        <div style="font-size:48px;margin-bottom:20px;filter:drop-shadow(0 0 20px var(--accent-glow));">⚡</div>
        <div style="font-size:28px;font-weight:700;margin-bottom:12px;font-family:'Inter',sans-serif;letter-spacing:-0.03em;">
            <span style="background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Upload</span> your morning break report
        </div>
        <div style="font-size:14px;color:var(--text-muted);max-width:520px;margin:0 auto;font-family:'Inter',sans-serif;line-height:1.8;">
            Export your reconciliation break report from Excel as .xlsx and upload it in the sidebar.
            BreakOS will investigate each break automatically using live market data and Claude AI.
            <br><br>
            Or click <strong style="background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">"Load Sample Break Report"</strong> in the sidebar to see a demo with 9 realistic breaks.
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.stop()


# ── BREAKS LOADED ──
df = st.session_state.breaks_df
breaks_list = df.to_dict("records")

# ── SUMMARY METRICS — compact inline strip ──
high_count = sum(1 for t in st.session_state.triage_results.values() if t.get("severity") == "HIGH")
med_count = sum(1 for t in st.session_state.triage_results.values() if t.get("severity") == "MEDIUM")
if not st.session_state.triage_done:
    high_count = sum(1 for b in breaks_list if b.get("Break Type") in ["Pricing Difference", "Quantity Mismatch", "Corporate Action"])
    med_count = sum(1 for b in breaks_list if b.get("Break Type") in ["Timing Difference", "Accrued Interest"])
total_triaged = len(st.session_state.triage_results)

st.markdown(
    f'<div style="display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--border);margin-bottom:16px;font-family:\'Inter\',sans-serif;flex-wrap:wrap;">'
    f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px 16px;display:flex;align-items:center;gap:8px;">'
    f'<span style="font-size:20px;font-weight:700;color:var(--text);">{len(breaks_list)}</span>'
    f'<span style="font-size:11px;color:var(--text-dim);font-weight:500;">breaks</span></div>'
    f'<div style="background:var(--red-dim);border:1px solid var(--red-border);border-radius:10px;padding:6px 16px;display:flex;align-items:center;gap:8px;">'
    f'<span style="font-size:20px;font-weight:700;color:var(--red);">{high_count}</span>'
    f'<span style="font-size:11px;color:var(--red);font-weight:500;">HIGH</span></div>'
    f'<div style="background:var(--amber-dim);border:1px solid var(--amber-border);border-radius:10px;padding:6px 16px;display:flex;align-items:center;gap:8px;">'
    f'<span style="font-size:20px;font-weight:700;color:var(--amber);">{med_count}</span>'
    f'<span style="font-size:11px;color:var(--amber);font-weight:500;">MEDIUM</span></div>'
    f'<div style="background:var(--accent-dim);border:1px solid var(--accent-border);border-radius:10px;padding:6px 16px;display:flex;align-items:center;gap:8px;">'
    f'<span style="font-size:11px;color:var(--accent);font-weight:600;">{total_triaged}/{len(breaks_list)} triaged</span></div>'
    f'</div>',
    unsafe_allow_html=True,
)


# ── TRIAGE BUTTON — compact single line ──
if not st.session_state.triage_done:
    col_status, col_btn = st.columns([4, 1])
    with col_status:
        st.markdown(
            f'<div style="font-size:11px;color:var(--text-dim);padding:4px 0;">'
            f'Report loaded. Run triage to classify all breaks.'
            f'</div>',
            unsafe_allow_html=True,
        )
    with col_btn:
        if st.button("Run Quick Triage", use_container_width=True):
            if not st.session_state.api_key:
                st.error("Enter your Anthropic API key in the sidebar first.")
            else:
                with st.spinner("AI triaging all breaks..."):
                    result = get_quick_triage(breaks_list, st.session_state.api_key)
                    if result["error"]:
                        st.error(f"Triage failed: {result['error']}")
                    else:
                        for t in result["triages"]:
                            idx_t = t["index"] - 1
                            st.session_state.triage_results[idx_t] = t
                        st.session_state.triage_done = True
                        log_audit(f"Quick triage completed — {len(result['triages'])} breaks classified")
                        st.rerun()


# ── TWO COLUMN LAYOUT: BREAK LIST + DEEP DIVE ──
col_list, col_detail = st.columns([1, 2.5], gap="medium")


# ── LEFT: BREAK LIST ──
with col_list:
    st.markdown(f'<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;font-weight:600;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Break Queue · {len(breaks_list)} items</div>', unsafe_allow_html=True)

    for i, b in enumerate(breaks_list):
        triage = st.session_state.triage_results.get(i, {})
        severity = triage.get("severity", "—")
        likely_cause = triage.get("likely_cause", "")
        confidence = triage.get("confidence", 0)
        route_to = triage.get("route_to", "—")

        is_selected = (i == st.session_state.selected_break_idx)
        analysis_done = i in st.session_state.analysis_results

        ticker_display = b.get("Ticker", "?")
        trade_ref = b.get("Trade Ref ID", "")
        short_ref = trade_ref.split("-")[-1] if trade_ref else ""
        break_type = b.get("Break Type", "?")
        currency = b.get("Currency", "")
        counterparty = b.get("Counterparty", "")
        instrument = b.get("Instrument Type", "?")

        # Left border color by severity
        if is_selected:
            left_border = "var(--accent)"
            border_glow = "box-shadow:0 0 15px var(--accent-glow),-2px 0 10px var(--accent-glow);"
        elif severity == "HIGH":
            left_border = "var(--red)"
            border_glow = "box-shadow:0 0 10px var(--red-glow);"
        elif severity == "MEDIUM":
            left_border = "var(--amber)"
            border_glow = ""
        elif severity == "LOW":
            left_border = "var(--blue)"
            border_glow = ""
        else:
            left_border = "var(--border)"
            border_glow = ""

        bg_color = "var(--accent-surface)" if is_selected else "var(--surface)"
        selected_border = f"border-color:var(--accent-border);" if is_selected else ""

        # ── 3-STATE CARD RENDERING ──
        if not triage:
            # STATE 1: Pre-triage
            line1 = f'<span style="font-weight:600;font-size:13px;color:var(--text);font-family:\'Inter\',sans-serif;">● {ticker_display}</span> <span style="font-size:10px;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;">#{short_ref}</span>'
            line2 = f'<span style="font-size:11px;color:var(--text-dim);font-family:\'Inter\',sans-serif;">{instrument} · {currency} · {counterparty}</span>'
            line3 = f'<span style="font-size:10px;color:var(--text-muted);font-family:\'Inter\',sans-serif;font-style:italic;">Awaiting triage</span>'
        elif not analysis_done:
            # STATE 2: Post-triage, not investigated
            sev_dot = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🔵"}.get(severity, "⚪")
            line1 = f'<span style="font-weight:600;font-size:13px;color:var(--text);font-family:\'Inter\',sans-serif;">{sev_dot} {ticker_display}</span> <span style="font-size:10px;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;">#{short_ref}</span>'
            line2 = f'<span style="font-size:11px;color:var(--amber);font-family:\'Inter\',sans-serif;font-weight:500;">{likely_cause} {confidence}%</span>'
            line3 = f'<span style="font-size:10px;color:var(--text-muted);font-family:\'Inter\',sans-serif;">→ {route_to}</span>'
        else:
            # STATE 3: Investigated
            escalation = st.session_state.escalation_decisions.get(i, {})
            esc_label = f"Escalated: {escalation.get('route', route_to)}" if escalation.get("action") == "escalate" else f"→ {route_to}"
            line1 = f'<span style="font-weight:600;font-size:13px;color:var(--accent);font-family:\'Inter\',sans-serif;">✓ {ticker_display}</span> <span style="font-size:10px;color:var(--text-muted);font-family:\'JetBrains Mono\',monospace;">#{short_ref}</span>'
            line2 = f'<span style="font-size:11px;color:var(--accent);font-family:\'Inter\',sans-serif;font-weight:500;">{likely_cause} {confidence}%</span>'
            line3 = f'<span style="font-size:10px;color:var(--text-muted);font-family:\'Inter\',sans-serif;">{esc_label}</span>'

        card_html = (
            f'<div style="height:74px;background:{bg_color};border:1px solid var(--border);border-left:3px solid {left_border};'
            f'border-radius:10px;padding:10px 14px;margin-bottom:6px;font-family:\'Inter\',sans-serif;'
            f'display:flex;flex-direction:column;justify-content:center;overflow:hidden;cursor:pointer;'
            f'transition:all 0.2s cubic-bezier(0.4,0,0.2,1);{border_glow}{selected_border}">'
            f'<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{line1}</div>'
            f'<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px;">{line2}</div>'
            f'<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px;">{line3}</div>'
            f'</div>'
        )

        st.markdown(card_html, unsafe_allow_html=True)

        # Button: only "Investigate →" on selected, otherwise "Select"
        if is_selected:
            pass  # No button needed — card is already selected, investigate in detail panel
        else:
            if st.button(f"Select", key=f"sel_{i}", use_container_width=True):
                st.session_state.selected_break_idx = i
                st.rerun()


# ── RIGHT: DEEP DIVE ──
with col_detail:
    idx = st.session_state.selected_break_idx
    if idx >= len(breaks_list):
        idx = 0
        st.session_state.selected_break_idx = 0
    selected = breaks_list[idx]
    triage = st.session_state.triage_results.get(idx, {})

    # ── TOP ROW — Identity line ──
    sec_name = selected.get("Security Name", "?")
    ticker = selected.get("Ticker", "?")
    trade_ref = selected.get("Trade Ref ID", "—")
    break_age = selected.get("Break Age (days)", "—")

    st.markdown(
        f'<div style="font-size:16px;color:var(--text);margin-bottom:12px;font-weight:600;font-family:\'Inter\',sans-serif;letter-spacing:-0.02em;">'
        f'{sec_name} '
        f'<span style="color:var(--text-faint);font-weight:400;">·</span> '
        f'<span style="color:var(--text-dim);font-weight:400;">{ticker}</span> '
        f'<span style="color:var(--text-faint);font-weight:400;">·</span> '
        f'<span style="color:var(--accent);font-size:12px;font-family:\'JetBrains Mono\',monospace;font-weight:500;">{trade_ref}</span> '
        f'<span style="color:var(--text-faint);font-weight:400;">·</span> '
        f'<span style="font-size:12px;color:var(--text-dim);font-weight:400;">{break_age}d old</span>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── SECOND ROW — Key numbers ──
    iq = selected.get("Internal Qty")
    sq = selected.get("Street Qty")
    qty_diff = selected.get("Qty Diff", 0)
    mv_diff_val = selected.get("MV Diff ($)")

    iq_str = f"{iq:,.0f}" if isinstance(iq, (int, float)) and pd.notna(iq) else "—"
    sq_str = f"{sq:,.0f}" if isinstance(sq, (int, float)) and pd.notna(sq) else "—"

    if isinstance(qty_diff, (int, float)) and pd.notna(qty_diff) and qty_diff != 0:
        qd_color = "var(--red)"
        qd_str = f"{qty_diff:+,.0f}"
    else:
        qd_color = "var(--text-dim)"
        qd_str = "0"

    if isinstance(mv_diff_val, (int, float)) and pd.notna(mv_diff_val):
        mv_color = "var(--red)" if abs(mv_diff_val) > 5000 else "var(--accent)"
        mv_str = f"&#36;{mv_diff_val:+,.2f}"
    else:
        mv_color = "var(--text-dim)"
        mv_str = "—"

    tol = selected.get("Tolerance Flag", "—")
    tol_html = f'<span class="pill pill-breach">{tol}</span>' if tol == "BREACH" else f'<span class="pill">{tol}</span>'

    st.markdown(
        f'<div style="display:flex;gap:16px;align-items:stretch;margin-bottom:14px;flex-wrap:wrap;">'
        f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;flex:1;min-width:80px;">'
        f'<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-family:\'Inter\',sans-serif;font-weight:500;">Int Qty</div>'
        f'<div style="font-size:18px;font-weight:600;color:var(--text);font-family:\'JetBrains Mono\',monospace;margin-top:4px;">{iq_str}</div></div>'
        f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;flex:1;min-width:80px;">'
        f'<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-family:\'Inter\',sans-serif;font-weight:500;">Str Qty</div>'
        f'<div style="font-size:18px;font-weight:600;color:var(--text);font-family:\'JetBrains Mono\',monospace;margin-top:4px;">{sq_str}</div></div>'
        f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;flex:1;min-width:80px;">'
        f'<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-family:\'Inter\',sans-serif;font-weight:500;">Qty Diff</div>'
        f'<div style="font-size:18px;font-weight:700;color:{qd_color};font-family:\'JetBrains Mono\',monospace;margin-top:4px;">{qd_str}</div></div>'
        f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 16px;flex:1;min-width:100px;">'
        f'<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-family:\'Inter\',sans-serif;font-weight:500;">MV Diff</div>'
        f'<div style="font-size:18px;font-weight:700;color:{mv_color};font-family:\'JetBrains Mono\',monospace;margin-top:4px;">{mv_str}</div></div>'
        f'<div style="display:flex;align-items:center;padding-bottom:2px;">{tol_html}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── THIRD ROW — Metadata pills ──
    instrument = selected.get("Instrument Type", "—")
    currency = selected.get("Currency", "—")
    counterparty = selected.get("Counterparty", "—")
    flagged_type = selected.get("Break Type", "—")
    price_diff = selected.get("Price Diff %", "—")
    price_diff_str = f"{price_diff}" if price_diff != "—" else "—"

    st.markdown(
        f'<div style="margin-bottom:10px;">'
        f'<span class="pill">{instrument}</span>'
        f'<span class="pill">{currency}</span>'
        f'<span class="pill">{counterparty}</span>'
        f'<span class="pill">{price_diff_str}%</span>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # ── BREAK TYPE LABEL — Flagged vs AI ──
    if triage:
        ai_class = triage.get("likely_cause", "—")
        match = does_ai_match_flagged(ai_class, flagged_type)
        indicator = '<span style="color:var(--accent);">✓</span>' if match else '<span style="color:var(--amber);">△</span>'
        st.markdown(
            f'<div style="margin-bottom:12px;">'
            f'<div style="font-size:13px;font-weight:600;color:var(--accent);font-family:\'Inter\',sans-serif;">{indicator} AI: {ai_class} <span style="font-weight:400;color:var(--text-dim);">({triage.get("confidence", 0)}%)</span></div>'
            f'<div style="font-size:11px;color:var(--text-muted);margin-top:3px;font-family:\'Inter\',sans-serif;">Flagged: {flagged_type}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            f'<div style="margin-bottom:12px;">'
            f'<div style="font-size:13px;color:var(--text-dim);font-family:\'Inter\',sans-serif;">Flagged: {flagged_type}</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

    # ── DESC box ──
    if selected.get("DESC"):
        desc_val = safe_escape(str(selected.get('DESC', '')))
        st.markdown(
            f'<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px;'
            f'font-size:12px;color:var(--text-dim);font-family:\'Inter\',sans-serif;border-left:3px solid var(--accent);'
            f'max-height:60px;overflow:hidden;">'
            f'<strong style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;">DESC</strong><br>'
            f'{desc_val}'
            f'</div>',
            unsafe_allow_html=True,
        )
        with st.expander("Show full description"):
            st.markdown(f'<div style="font-size:12px;color:var(--text-dim);font-family:\'Inter\',sans-serif;line-height:1.7;">{desc_val}</div>', unsafe_allow_html=True)

    # ── Triage quick assessment ──
    if triage:
        sev = triage.get("severity", "—")
        sev_class = {"HIGH": "badge-high", "MEDIUM": "badge-medium", "LOW": "badge-low"}.get(sev, "badge-low")
        st.markdown(
            f'<div style="background:var(--accent-surface);border:1px solid var(--accent-border);'
            f'border-radius:10px;padding:10px 16px;margin-bottom:14px;display:flex;gap:14px;align-items:center;animation:fadeIn 0.3s ease-out;">'
            f'<span class="badge {sev_class}">{sev}</span>'
            f'<span style="font-size:12px;color:var(--text-secondary);font-family:\'Inter\',sans-serif;">'
            f'<strong>AI:</strong> {triage.get("likely_cause", "—")} · '
            f'{triage.get("confidence", "—")}% · '
            f'Route: <strong style="color:var(--accent);">{triage.get("route_to", "—")}</strong>'
            f'</span>'
            f'</div>',
            unsafe_allow_html=True,
        )

    st.markdown("---")

    # ── INVESTIGATE BUTTON ──
    col_btn1, col_btn2 = st.columns([2, 1])
    with col_btn1:
        run_btn = st.button(
            f"Investigate Break — {selected.get('Ticker', '?')}",
            use_container_width=True,
            type="primary"
        )
    with col_btn2:
        clear_btn = st.button("Clear Analysis", use_container_width=True)
        if clear_btn:
            if idx in st.session_state.analysis_results:
                del st.session_state.analysis_results[idx]
            st.rerun()

    # ── RUN INVESTIGATION ──
    if run_btn:
        if not st.session_state.api_key:
            st.error("Enter your Anthropic API key in the sidebar first.")
        else:
            ticker = selected.get("Ticker", "?")
            instrument_type = selected.get("Instrument Type", "Equity")
            currency = selected.get("Currency", "CAD")
            break_type = selected.get("Break Type", "")
            trade_date = selected.get("Trade Date", str(date.today()))

            context = {
                "break_row": selected,
                "live_price": None,
                "corporate_actions": None,
                "settlement_info": None,
                "fixed_income_accrual": None,
                "data_sources_used": []
            }

            # ── SEQUENTIAL LOADING STEPS ──

            # Step 1: Live price
            if instrument_type in ["Equity", "ETF"] and ticker:
                step1 = st.empty()
                step1.markdown(f'<div class="step-loading">⟳ Fetching {ticker} live price from Yahoo Finance...</div>', unsafe_allow_html=True)
                price_data = get_live_price(ticker)
                context["live_price"] = price_data
                if not price_data.get("error"):
                    context["data_sources_used"].append("Yahoo Finance (live price)")
                    step1.markdown(
                        f'<div class="step-done">✓ Live price: &#36;{price_data["live_price"]:.2f} {currency} as of {price_data.get("timestamp", "now")}</div>',
                        unsafe_allow_html=True,
                    )
                else:
                    step1.markdown(
                        f'<div class="step-loading">⚠ Live price unavailable — using prior close. Confidence reduced.</div>',
                        unsafe_allow_html=True,
                    )

            # Step 2: Corporate actions
            if break_type in ["Corporate Action", "Pricing Difference", "Quantity Mismatch"]:
                step2 = st.empty()
                step2.markdown(f'<div class="step-loading">⟳ Checking corporate action history...</div>', unsafe_allow_html=True)
                ca_data = get_corporate_actions(ticker, instrument_type)
                context["corporate_actions"] = ca_data
                if not ca_data.get("error"):
                    context["data_sources_used"].append(ca_data.get("source", "Yahoo Finance (corporate actions)"))
                    actions = ca_data.get("recent_corporate_actions") or []
                    edgar_8k = ca_data.get("sec_edgar_8k", [])
                    if actions:
                        step2.markdown(
                            f'<div class="step-done">✓ {len(actions)} corporate action(s) found (yfinance{" + SEC EDGAR" if edgar_8k else ""})</div>',
                            unsafe_allow_html=True,
                        )
                    else:
                        step2.markdown(
                            f'<div class="step-done">✓ No corporate action found in last 90 days (yfinance{" + SEC EDGAR" if edgar_8k else ""})</div>',
                            unsafe_allow_html=True,
                        )
                else:
                    step2.markdown(
                        f'<div class="step-loading">⚠ Corporate action check limited — {ca_data.get("error", "")}</div>',
                        unsafe_allow_html=True,
                    )

            # Step 3: Settlement logic
            step3 = st.empty()
            step3.markdown(f'<div class="step-loading">⟳ Computing settlement logic...</div>', unsafe_allow_html=True)
            settlement_data = get_settlement_info(ticker, instrument_type, currency, str(trade_date))
            context["settlement_info"] = settlement_data
            context["data_sources_used"].append(f"{settlement_data['depository']} settlement rules (simulated)")
            step3.markdown(
                f'<div class="step-done">✓ Expected settlement: {settlement_data["expected_settlement_date"]} via {settlement_data["depository"]} ({settlement_data["settlement_rule"]})</div>',
                unsafe_allow_html=True,
            )

            # Step 4: Fixed income accrual (conditional)
            if instrument_type == "Fixed Income":
                step4 = st.empty()
                bond_key = selected.get("Bond Key", "SHOP 4.75 2031")
                step4.markdown(f'<div class="step-loading">⟳ Computing accrued interest (Act/360 via rateslib)...</div>', unsafe_allow_html=True)
                internal_qty = selected.get("Internal Qty", 1)
                face_value_held = float(internal_qty) * 1000
                accrual_data = compute_accrued_interest(bond_key, date.today(), face_value_held)
                context["fixed_income_accrual"] = accrual_data
                if not accrual_data.get("error"):
                    context["data_sources_used"].append(f"Accrued interest — {accrual_data.get('computation_method', 'Act/360')}")
                    step4.markdown(
                        f'<div class="step-done">✓ Computed accrual: &#36;{accrual_data["total_accrued_interest"]:,.2f} USD '
                        f'({accrual_data["days_accrued"]} days since {accrual_data["last_coupon_date"]}) '
                        f'via {accrual_data["computation_method"]}</div>',
                        unsafe_allow_html=True,
                    )

            # Show data source chips
            sources_used = context.get("data_sources_used", [])
            chips_html = ""
            for s in sources_used:
                if "simulated" in s.lower() or "sim" in s.lower():
                    chips_html += f'<span class="source-chip-sim" title="In production: connects to {s.split("(")[0].strip()} participant portal">SIM · {s.split("(")[0].strip()}</span>'
                else:
                    chips_html += f'<span class="source-chip">LIVE · {s.split("(")[0].strip()}</span>'

            st.markdown(
                f'<div style="margin:8px 0;">'
                f'<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Data Sources Loaded</div>'
                f'{chips_html}'
                f'</div>',
                unsafe_allow_html=True,
            )

            # Step 5: Stream AI analysis
            step5 = st.empty()
            step5.markdown(f'<div class="step-loading">⟳ Streaming AI analysis...</div>', unsafe_allow_html=True)

            st.markdown(f'<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:4px;">AI Analysis — streaming live</div>', unsafe_allow_html=True)
            analysis_container = st.empty()
            full_analysis = ""

            try:
                for chunk in analyze_break_streaming(context, st.session_state.api_key):
                    full_analysis += chunk
                    escaped = safe_escape(full_analysis)
                    analysis_container.markdown(
                        f'<div class="analysis-output">{escaped}▊</div>',
                        unsafe_allow_html=True,
                    )

                # Final render without cursor
                escaped_final = safe_escape(full_analysis)
                analysis_container.markdown(
                    f'<div class="analysis-output">{escaped_final}</div>',
                    unsafe_allow_html=True,
                )

                step5.markdown(f'<div class="step-done">✓ Analysis complete</div>', unsafe_allow_html=True)

                st.session_state.analysis_results[idx] = {
                    "text": full_analysis,
                    "context": context
                }

                # Extract primary hypothesis for audit log
                hyp_match = re.search(r'(?:Primary|Hypothesis):\s*(.+?)\s*[—–\-]\s*(\d+)\s*%', full_analysis)
                if hyp_match:
                    log_audit(f"Analysis completed — {hyp_match.group(1).strip()} ({hyp_match.group(2)}%)")
                else:
                    log_audit(f"Analysis completed for {ticker}")

            except Exception as e:
                st.error(f"Analysis failed: {str(e)}")
                step5.markdown(f'<div class="step-loading">✗ Analysis failed: {str(e)}</div>', unsafe_allow_html=True)

    # ── SHOW CACHED ANALYSIS ──
    elif idx in st.session_state.analysis_results:
        result = st.session_state.analysis_results[idx]
        analysis_text = result["text"]
        context = result["context"]

        # Show data sources
        sources_used = context.get("data_sources_used", [])
        chips_html = ""
        for s in sources_used:
            if "simulated" in s.lower() or "sim" in s.lower():
                chips_html += f'<span class="source-chip-sim">SIM · {s.split("(")[0].strip()}</span>'
            else:
                chips_html += f'<span class="source-chip">LIVE · {s.split("(")[0].strip()}</span>'
        st.markdown(f'<div style="margin-bottom:8px;">{chips_html}</div>', unsafe_allow_html=True)

        st.markdown(
            f'<div class="analysis-output">{safe_escape(analysis_text)}</div>',
            unsafe_allow_html=True,
        )

    # ── CONFIDENCE BARS (after analysis) ──
    if idx in st.session_state.analysis_results:
        analysis_text = st.session_state.analysis_results[idx]["text"]
        pattern = r'(?:Primary|Secondary|Residual|Hypothesis):\s*(.+?)\s*[—–\-]\s*(\d+)\s*%'
        matches = re.findall(pattern, analysis_text)

        if matches:
            colors = ["var(--accent)", "var(--amber)", "var(--text-muted)"]
            st.markdown(
                f'<div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;'
                f'letter-spacing:0.08em;margin-bottom:10px;margin-top:16px;font-family:\'Inter\',sans-serif;font-weight:600;">Confidence Scores</div>',
                unsafe_allow_html=True,
            )

            for i_bar, (name, conf) in enumerate(matches):
                color = colors[min(i_bar, len(colors) - 1)]
                conf_int = int(conf)
                safe_name = html_module.escape(name.strip())
                st.markdown(
                    f'<div style="margin-bottom:8px;">'
                    f'<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:4px;font-family:\'Inter\',sans-serif;">'
                    f'<span>{safe_name}</span>'
                    f'<span style="color:{color};font-weight:700;font-family:\'JetBrains Mono\',monospace;">{conf_int}%</span>'
                    f'</div>'
                    f'<div style="background:var(--bar-track);border-radius:4px;height:6px;overflow:hidden;">'
                    f'<div style="background:{color};height:100%;width:{conf_int}%;border-radius:4px;animation:fillBar 0.8s ease-out;"></div>'
                    f'</div>'
                    f'</div>',
                    unsafe_allow_html=True,
                )

    # ── HUMAN DECISION GATE (shown after analysis) ──
    if idx in st.session_state.analysis_results:
        route = triage.get("route_to", "Settlements Desk") if triage else "Settlements Desk"
        mv_diff_display = selected.get("MV Diff ($)", 0)
        mv_str_display = f"${abs(mv_diff_display):,.2f}" if isinstance(mv_diff_display, (int, float)) else str(mv_diff_display)

        st.markdown(
            '<div class="human-gate">'
            '<div class="gate-title">⚠ HUMAN DECISION REQUIRED</div>'
            '<div class="gate-subtitle">AI has reached its authority boundary</div>'
            '<div style="font-size:13px;color:var(--text-secondary);font-family:\'Inter\',sans-serif;line-height:1.8;margin-bottom:16px;">'
            'BreakOS has completed its investigation and recommended an escalation route. '
            '<strong style="color:var(--red);">The escalation decision is yours.</strong> '
            'AI cannot approve escalations autonomously — a material break affecting client positions '
            'requires documented human accountability under CIRO regulations.'
            '</div>'
            '</div>',
            unsafe_allow_html=True,
        )

        # 4 checkpoint questions
        c1 = st.checkbox("Pattern check: Is this break isolated or part of a broader pattern across your book this morning?", key=f"chk1_{idx}")
        c2 = st.checkbox("Counterparty history: Any known issues with this vendor or counterparty recently?", key=f"chk2_{idx}")
        c3 = st.checkbox("Market context: Does today's market activity explain this deviation?", key=f"chk3_{idx}")
        c4 = st.checkbox(f"Materiality: Does MV Diff of {mv_str_display} exceed your escalation threshold?", key=f"chk4_{idx}")

        # AI recommendation
        st.markdown(
            f'<div style="font-size:12px;color:var(--text-dim);margin:10px 0 14px 0;font-family:\'JetBrains Mono\',monospace;">'
            f'AI Recommendation: Escalate to <strong style="color:var(--accent);">{route}</strong>'
            f'</div>',
            unsafe_allow_html=True,
        )

        decision_key = f"decision_{idx}"
        existing_decision = st.session_state.escalation_decisions.get(idx)

        if existing_decision:
            if existing_decision["action"] == "escalate":
                st.success(f"✓ Escalation approved → {existing_decision.get('route', '')}. Logged {existing_decision.get('time', '')}")
            else:
                st.warning(f"✓ Override — resolved without escalation. Reason: {existing_decision.get('reason', '')}")
        else:
            col_esc, col_ovr = st.columns(2)
            with col_esc:
                if st.button(f"🔴 Approve Escalation → {route}", key=f"approve_{idx}", use_container_width=True):
                    st.session_state.escalation_decisions[idx] = {
                        "action": "escalate",
                        "route": route,
                        "time": datetime.now().strftime("%H:%M:%S")
                    }
                    log_audit(f"Escalation approved → {route} (Analyst: A. Aneja)", "escalation")
                    st.rerun()
            with col_ovr:
                if st.button("Override — Resolve Without Escalation", key=f"override_{idx}", use_container_width=True):
                    st.session_state["show_override_form"] = idx

            # Override form
            if st.session_state.get("show_override_form") == idx:
                reason = st.text_area(
                    "Document your reason (required for audit trail):",
                    key=f"reason_{idx}",
                    height=80,
                    placeholder="Document the basis for overriding the AI recommendation..."
                )
                if st.button("Submit Override", key=f"submit_override_{idx}"):
                    if reason and reason.strip():
                        st.session_state.escalation_decisions[idx] = {
                            "action": "override",
                            "reason": reason.strip(),
                            "time": datetime.now().strftime("%H:%M:%S")
                        }
                        st.session_state["show_override_form"] = None
                        log_audit(f"Override submitted — {reason.strip()[:60]}", "override")
                        st.rerun()
                    else:
                        st.warning("A reason is required for override — this is logged for audit.")

        # Legal line
        st.markdown(f"""
        <div style="font-size:10px;color:var(--text-faint);margin-top:14px;font-family:'Inter',sans-serif;line-height:1.6;">
            By approving, you confirm this escalation is warranted and accept accountability under CIRO Rule 3200.
            This decision is logged with timestamp for audit trail.
        </div>
        """, unsafe_allow_html=True)


# ── AUDIT LOG ──
st.markdown("---")
st.markdown(f'<div style="font-size:12px;font-weight:600;color:var(--text-dim);margin-bottom:10px;font-family:\'Inter\',sans-serif;text-transform:uppercase;letter-spacing:0.06em;">Audit Log</div>', unsafe_allow_html=True)
if st.session_state.audit_log:
    log_html = '<div class="audit-log">'
    for entry in st.session_state.audit_log:
        if entry["status"] == "escalation":
            color = "var(--red)"
        elif entry["status"] == "override":
            color = "var(--amber)"
        else:
            color = "var(--accent)"
        log_html += f'<div style="color:{color};margin-bottom:6px;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-muted);font-size:10px;">[{entry["timestamp"]}]</span> {entry["event"]}</div>'
    log_html += '</div>'
    st.markdown(log_html, unsafe_allow_html=True)
else:
    st.markdown(f"""
    <div style="font-size:12px;color:var(--text-muted);font-family:'Inter',sans-serif;">
        No actions logged yet. Upload a break report to begin.
    </div>
    """, unsafe_allow_html=True)
