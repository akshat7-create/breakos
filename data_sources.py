"""
data_sources.py
Live data fetching for BreakOS:
  - yfinance: live equity/ETF prices, corporate actions
  - rateslib: fixed income accrual computation (FixedRateBond)
  - SEC EDGAR: 8-K filings for US-listed companies
  - Simulated: CDS/DTC position data (stated explicitly in UI)
"""

import yfinance as yf
import requests
from datetime import date, datetime, timedelta
import json
import traceback

# ── Try importing rateslib gracefully ──
try:
    from rateslib.instruments import FixedRateBond
    RATESLIB_AVAILABLE = True
except ImportError:
    RATESLIB_AVAILABLE = False


# ─────────────────────────────────────────
# 1. LIVE EQUITY / ETF PRICING (yfinance)
# ─────────────────────────────────────────

def get_live_price(ticker: str) -> dict:
    """
    Fetch live/recent price for a ticker via yfinance.
    Returns dict with price, prev_close, change_pct, timestamp, source.
    """
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info

        price = getattr(info, 'last_price', None)
        prev_close = getattr(info, 'previous_close', None)

        if price is None:
            hist = t.history(period="2d")
            if not hist.empty:
                price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else price

        if price is None:
            return {"error": f"No price data found for {ticker}", "source": "yfinance"}

        change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0.0

        return {
            "ticker": ticker,
            "live_price": round(float(price), 4),
            "prev_close": round(float(prev_close), 4) if prev_close else None,
            "change_pct": round(change_pct, 3),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S EST"),
            "source": "Yahoo Finance (yfinance)",
            "error": None
        }

    except Exception as e:
        return {
            "ticker": ticker,
            "live_price": None,
            "error": str(e),
            "source": "yfinance"
        }


# ─────────────────────────────────────────
# 2. FIXED INCOME ACCRUALS (rateslib)
# ─────────────────────────────────────────

# Publicly available terms for Shopify 2031 Senior Notes
# Source: Shopify Inc. prospectus supplement, filed on SEDAR+
KNOWN_BONDS = {
    "SHOP 4.75 2031": {
        "issuer": "Shopify Inc.",
        "coupon": 4.75,
        "maturity": date(2031, 9, 1),
        "issue_date": date(2021, 9, 9),
        "face_value": 1_000,
        "day_count": "Act/360",
        "frequency": 2,  # semi-annual
        "currency": "USD",
        "isin": "US82509L2087",
        "cusip": "82509L208",
        "source": "SEDAR+ / Shopify Inc. prospectus supplement (Sept 2021)"
    }
}


def compute_accrued_interest(bond_key: str, settlement_date: date, face_value_held: float) -> dict:
    """
    Compute correct accrued interest using rateslib FixedRateBond
    or manual Act/360 fallback if rateslib unavailable.
    """
    if bond_key not in KNOWN_BONDS:
        return {"error": f"Bond '{bond_key}' not in known bonds registry"}

    bond_info = KNOWN_BONDS[bond_key]
    coupon_rate = bond_info["coupon"] / 100
    maturity = bond_info["maturity"]
    issue_date = bond_info["issue_date"]
    frequency = bond_info["frequency"]
    face = bond_info["face_value"]

    # Determine last coupon date (semi-annual: Mar 1 / Sep 1)
    year = settlement_date.year
    coupon_months = sorted([maturity.month, (maturity.month + 6 - 1) % 12 + 1])  # [3, 9]

    last_coupon = None
    for m in sorted(coupon_months, reverse=True):
        candidate = date(year if m <= settlement_date.month else year - 1, m, 1)
        if candidate <= settlement_date:
            last_coupon = candidate
            break
    if last_coupon is None:
        last_coupon = date(year - 1, coupon_months[-1], 1)

    days_accrued = (settlement_date - last_coupon).days
    method = "manual Act/360 fallback"
    accrued_total = None

    # Try rateslib first
    if RATESLIB_AVAILABLE:
        try:
            bond = FixedRateBond(
                effective=datetime(issue_date.year, issue_date.month, issue_date.day),
                termination=datetime(maturity.year, maturity.month, maturity.day),
                frequency="S",
                fixed_rate=bond_info["coupon"],
                currency=bond_info["currency"].lower(),
                calendar="nyc",
                convention="act360",
            )
            accrued_per_100 = bond.accrued(
                settlement=datetime(settlement_date.year, settlement_date.month, settlement_date.day)
            )
            # accrued() returns per 100 par — scale to actual notional
            accrued_total = round(float(accrued_per_100) * (face_value_held / 100), 2)
            method = "rateslib FixedRateBond (Act/360)"
        except Exception:
            pass  # Fall through to manual

    # Manual fallback
    if accrued_total is None:
        period_coupon = (coupon_rate / frequency) * face
        accrued_per_bond = period_coupon * (days_accrued / 180)
        scaling = face_value_held / face
        accrued_total = round(accrued_per_bond * scaling, 2)
        method = "manual Act/360 computation"

    return {
        "bond": bond_key,
        "issuer": bond_info["issuer"],
        "coupon_rate": bond_info["coupon"],
        "maturity": str(maturity),
        "settlement_date": str(settlement_date),
        "last_coupon_date": str(last_coupon),
        "days_accrued": days_accrued,
        "accrued_per_bond": round(accrued_total / (face_value_held / face), 6) if face_value_held else 0,
        "face_value_held": face_value_held,
        "total_accrued_interest": accrued_total,
        "day_count": bond_info["day_count"],
        "computation_method": method,
        "source": bond_info["source"],
        "error": None
    }


# ─────────────────────────────────────────
# 3. CORPORATE ACTIONS
# ─────────────────────────────────────────

def _get_yfinance_actions(ticker: str) -> dict:
    """Get corporate action history from yfinance for any ticker."""
    try:
        t = yf.Ticker(ticker)
        actions = t.actions
        divs = t.dividends

        recent_actions = []
        if not actions.empty:
            last_5 = actions.tail(5)
            for dt_idx, row in last_5.iterrows():
                if row.get('Dividends', 0) > 0:
                    recent_actions.append({
                        "date": str(dt_idx.date()),
                        "type": "Dividend",
                        "amount": round(float(row['Dividends']), 4)
                    })
                if row.get('Stock Splits', 0) not in [0, 1.0]:
                    recent_actions.append({
                        "date": str(dt_idx.date()),
                        "type": "Stock Split",
                        "ratio": float(row['Stock Splits'])
                    })

        # Get ex-dividend date
        ex_div_date = None
        try:
            ticker_info = t.info
            ex_div_ts = ticker_info.get('exDividendDate', None)
            if ex_div_ts:
                ex_div_date = datetime.fromtimestamp(ex_div_ts).strftime('%Y-%m-%d')
        except Exception:
            pass

        return {
            "ticker": ticker,
            "recent_corporate_actions": recent_actions,
            "ex_dividend_date": ex_div_date,
            "source": "Yahoo Finance — corporate actions history",
            "error": None
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "recent_corporate_actions": [],
            "ex_dividend_date": None,
            "error": str(e),
            "source": "yfinance"
        }


def _get_ishares_distributions(ticker: str) -> dict:
    """Get recent distribution/dividend info for ETFs via yfinance."""
    try:
        t = yf.Ticker(ticker)
        divs = t.dividends

        recent_divs = []
        if not divs.empty:
            last_3 = divs.tail(3)
            for dt_idx, amount in last_3.items():
                recent_divs.append({
                    "date": str(dt_idx.date()),
                    "amount": round(float(amount), 6),
                    "type": "Distribution"
                })

        info = t.fast_info
        last_price = getattr(info, 'last_price', None)

        # Get ex-dividend date
        ex_div_date = None
        try:
            ticker_info = t.info
            ex_div_ts = ticker_info.get('exDividendDate', None)
            if ex_div_ts:
                ex_div_date = datetime.fromtimestamp(ex_div_ts).strftime('%Y-%m-%d')
        except Exception:
            pass

        return {
            "ticker": ticker,
            "recent_distributions": recent_divs,
            "recent_corporate_actions": recent_divs,
            "ex_dividend_date": ex_div_date,
            "last_price": round(float(last_price), 4) if last_price else None,
            "source": "Yahoo Finance — dividend/distribution history",
            "error": None
        }

    except Exception as e:
        return {
            "ticker": ticker,
            "recent_distributions": [],
            "recent_corporate_actions": [],
            "ex_dividend_date": None,
            "error": str(e),
            "source": "yfinance (failed)"
        }


# ─────────────────────────────────────────
# 4. SEC EDGAR — 8-K FILINGS (US only)
# ─────────────────────────────────────────

def get_sec_edgar_8k(ticker: str) -> dict:
    """
    Query SEC EDGAR EFTS for recent 8-K filings for a US-listed company.
    Only covers US tickers — state this explicitly in output.
    No API key needed — free and official.
    """
    try:
        headers = {"User-Agent": "BreakOS akshataneja07@gmail.com"}
        end_date = date.today().strftime("%Y-%m-%d")
        start_date = (date.today() - timedelta(days=90)).strftime("%Y-%m-%d")

        url = (
            f"https://efts.sec.gov/LATEST/search-index"
            f"?q=%22{ticker}%22&forms=8-K"
            f"&dateRange=custom&startdt={start_date}&enddt={end_date}"
        )
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        filings = []
        hits = data.get("hits", {}).get("hits", [])
        for hit in hits[:5]:
            src = hit.get("_source", {})
            filings.append({
                "form": src.get("form_type", src.get("form", "8-K")),
                "file_date": src.get("file_date", "Unknown"),
                "display_name": src.get("display_names", [""])[0] if src.get("display_names") else "",
                "description": src.get("display_description", ""),
            })

        total = data.get("hits", {}).get("total", {})
        total_count = total.get("value", 0) if isinstance(total, dict) else total

        return {
            "ticker": ticker,
            "total_filings_90d": total_count,
            "recent_8k_filings": filings,
            "source": "SEC EDGAR EFTS (US-listed companies only)",
            "note": "SEC EDGAR only covers US-listed companies",
            "error": None,
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "total_filings_90d": 0,
            "recent_8k_filings": [],
            "error": str(e),
            "source": "SEC EDGAR (unavailable)"
        }


def get_corporate_actions(ticker: str, instrument_type: str) -> dict:
    """
    Master corporate actions router:
      .TO tickers  -> yfinance only
      US tickers   -> yfinance + SEC EDGAR 8-K
      Fixed income -> note manual verification recommended
    """
    if instrument_type == "Fixed Income":
        return {
            "ticker": ticker,
            "recent_corporate_actions": [],
            "ex_dividend_date": None,
            "note": "Fixed income corporate actions require manual verification via Bloomberg/DTCC",
            "source": "Manual verification recommended",
            "error": None,
        }

    # Canadian tickers (.TO) — yfinance only
    if ".TO" in ticker:
        if instrument_type == "ETF":
            result = _get_ishares_distributions(ticker)
        else:
            result = _get_yfinance_actions(ticker)
        return result

    # US tickers — yfinance + SEC EDGAR
    yf_data = _get_yfinance_actions(ticker)
    edgar_data = get_sec_edgar_8k(ticker)

    yf_data["sec_edgar_8k"] = edgar_data.get("recent_8k_filings", [])
    yf_data["sec_edgar_total_90d"] = edgar_data.get("total_filings_90d", 0)
    if not edgar_data.get("error"):
        yf_data["source"] = yf_data.get("source", "") + " + SEC EDGAR 8-K"
    else:
        yf_data["sec_edgar_note"] = f"SEC EDGAR unavailable: {edgar_data['error']}"

    return yf_data


# ─────────────────────────────────────────
# 5. SETTLEMENT INFO (CDS / DTC rules)
# ─────────────────────────────────────────
# NOTE: In production, these connect to:
#   - CDS Clearing and Depository Services participant portal (Canadian equities)
#   - DTCC Smart Source / DTC participant browser (US equities)
# For this prototype, positions are simulated using realistic settlement logic.

def get_settlement_info(ticker: str, instrument_type: str, currency: str, trade_date: str) -> dict:
    """
    Apply real settlement rules based on instrument type, currency, and trade date.
    """
    try:
        trade_dt = datetime.strptime(trade_date, "%Y-%m-%d").date()
    except Exception:
        trade_dt = date.today()

    # Real settlement rules as of 2024
    if currency == "USD" and instrument_type in ["Equity", "ETF"]:
        settlement_days = 1
        settlement_rule = "T+1 (SEC Rule — effective May 28, 2024)"
        depository = "DTC"
    elif currency == "CAD" and instrument_type in ["Equity", "ETF"]:
        settlement_days = 1
        settlement_rule = "T+1 (CIRO Rule — effective May 27, 2024)"
        depository = "CDS"
    elif instrument_type == "Fixed Income":
        settlement_days = 2
        settlement_rule = "T+2 (standard corporate bond settlement)"
        depository = "DTC" if currency == "USD" else "CDS"
    elif instrument_type == "Option":
        settlement_days = 1
        settlement_rule = "T+1 (options standard)"
        depository = "CDS"
    else:
        settlement_days = 2
        settlement_rule = "T+2 (default)"
        depository = "CDS"

    expected_settlement = trade_dt + timedelta(days=settlement_days)
    # Skip weekends
    while expected_settlement.weekday() >= 5:
        expected_settlement += timedelta(days=1)

    return {
        "ticker": ticker,
        "trade_date": str(trade_dt),
        "expected_settlement_date": str(expected_settlement),
        "settlement_rule": settlement_rule,
        "settlement_days": settlement_days,
        "depository": depository,
        "source": f"Simulated — {depository} settlement rules (T+{settlement_days} post-May 2024)",
        "note": f"In production: connects to {depository} participant portal" +
                (" and DTCC Smart Source" if depository == "DTC" else ""),
        "error": None
    }


# ─────────────────────────────────────────
# 6. MASTER DATA FETCHER
# ─────────────────────────────────────────

def fetch_all_data_for_break(break_row: dict) -> dict:
    """
    Given a break row from the Excel report, fetch all relevant
    external data needed for AI analysis.
    Returns a structured context dict.
    """
    ticker = break_row.get("Ticker", "")
    instrument_type = break_row.get("Instrument Type", "Equity")
    currency = break_row.get("Currency", "CAD")
    break_type = break_row.get("Break Type", "")
    trade_date = break_row.get("Trade Date", str(date.today()))

    context = {
        "break_row": break_row,
        "live_price": None,
        "corporate_actions": None,
        "settlement_info": None,
        "fixed_income_accrual": None,
        "data_sources_used": []
    }

    # Always fetch live price for equities and ETFs
    if instrument_type in ["Equity", "ETF"] and ticker:
        price_data = get_live_price(ticker)
        context["live_price"] = price_data
        if not price_data.get("error"):
            context["data_sources_used"].append("Yahoo Finance (live price)")

    # Fetch corporate actions if relevant
    if break_type in ["Corporate Action", "Pricing Difference", "Quantity Mismatch"]:
        ca_data = get_corporate_actions(ticker, instrument_type)
        context["corporate_actions"] = ca_data
        if not ca_data.get("error"):
            context["data_sources_used"].append(ca_data.get("source", "Yahoo Finance (corporate actions)"))

    # Settlement info
    context["settlement_info"] = get_settlement_info(
        ticker, instrument_type, currency, str(trade_date)
    )
    context["data_sources_used"].append(
        f"{context['settlement_info']['depository']} settlement rules (simulated)"
    )

    # Fixed income accrual
    if instrument_type == "Fixed Income":
        bond_key = break_row.get("Bond Key", "SHOP 4.75 2031")
        internal_qty = break_row.get("Internal Qty", 1)
        face_value_held = float(internal_qty) * 1000  # bonds x $1,000 face
        accrual_data = compute_accrued_interest(
            bond_key, date.today(), face_value_held
        )
        context["fixed_income_accrual"] = accrual_data
        if not accrual_data.get("error"):
            context["data_sources_used"].append(
                f"Accrued interest — {accrual_data.get('computation_method', 'Act/360')}"
            )

    return context
