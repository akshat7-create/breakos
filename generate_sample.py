"""
generate_sample.py
Generates realistic, randomized sample break reports with current market events.

Uses a pool of 20+ real break scenarios based on verified 2025-2026 corporate
actions (splits, dividends, M&A, FX, settlement). Each call produces a unique
subset with live prices from Yahoo Finance.
"""

import random
import pandas as pd
import yfinance as yf
from datetime import date, timedelta, datetime
from pathlib import Path

# ─────────────────────────────────────────
# LIVE PRICE FETCHER
# ─────────────────────────────────────────
FALLBACK_PRICES = {
    "SHOP.TO": 156.40, "CNR.TO": 168.50, "AAPL": 227.30, "XIU.TO": 37.60,
    "VFV.TO": 125.80, "NVDA": 134.50, "MSFT": 424.60, "AMZN": 228.80,
    "RY.TO": 172.90, "TD.TO": 78.50, "BMO.TO": 127.40, "NA.TO": 133.20,
    "L.TO": 195.50, "WN.TO": 72.80, "NFLX": 1050.20, "TSLA": 357.90,
    "META": 695.40, "GOOG": 192.50, "JPM": 268.40, "GS": 620.30,
    "ENB.TO": 63.40, "SU.TO": 48.70, "CP.TO": 105.80, "BN.TO": 83.20,
    "PANW": 198.50, "NOW": 220.30, "HD": 408.50, "DE": 462.80,
}


def fetch_live_price(ticker: str) -> tuple:
    """Fetch live price via yfinance. Falls back to hardcoded if unavailable."""
    try:
        data = yf.Ticker(ticker).history(period="1d")
        if not data.empty:
            price = float(data["Close"].iloc[-1])
            return price, "yfinance live"
    except Exception:
        pass
    return FALLBACK_PRICES.get(ticker, 100.0), "fallback"


# ─────────────────────────────────────────
# TRADE REF ID GENERATOR
# ─────────────────────────────────────────
_ref_counter = 0

def next_trade_ref(trade_date: date) -> str:
    global _ref_counter
    _ref_counter += 1
    return f"BRK-{trade_date.strftime('%Y%m%d')}-{_ref_counter:04d}"


# ─────────────────────────────────────────
# BREAK SCENARIO POOL
#
# Each scenario is a function that takes (prices, today, t1, t2)
# and returns a break dict. This lets us create diverse, realistic
# breaks drawing from verified 2025-2026 corporate actions.
# ─────────────────────────────────────────

def _scenario_shop_pricing(prices, today, t1, t2):
    """SHOP.TO — Vendor feed stale pricing vs CDS EOD"""
    live = prices["SHOP.TO"]
    lag = random.uniform(0.015, 0.035)
    ip = round(live * (1 - lag), 2)
    qty = random.choice([2000, 3000, 5000, 8000])
    mv_int = round(qty * ip, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    pdiff = f"{round((ip - live) / live * 100, 2)}%"
    return {
        "Ticker": "SHOP.TO", "Security Name": "Shopify Inc.",
        "CUSIP": "82509L107", "ISIN": "CA82509L1076",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": ip, "Street Price": live, "Price Diff %": pdiff,
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 5000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Internal pricing (${ip:.2f}) vs CDS end-of-day price (${live:.2f}) mismatch. "
                f"Vendor feed last updated 16:00 EST prior session. Price deviation of {pdiff} on "
                f"{qty:,} shares results in ${abs(mv_diff):,.2f} MV discrepancy."
    }


def _scenario_cnr_qty(prices, today, t1, t2):
    """CNR.TO — Settlement quantity shortfall at CDS"""
    live = prices["CNR.TO"]
    shortfall = random.randint(100, 500)
    iq = random.choice([8000, 10000, 12000, 15000])
    sq = iq - shortfall
    mv_int = round(iq * live, 2)
    mv_str = round(sq * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "CNR.TO", "Security Name": "Canadian National Railway Co.",
        "CUSIP": "136375102", "ISIN": "CA1363751027",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": iq, "Street Qty": sq, "Qty Diff": shortfall,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Quantity Mismatch", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 10000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Partial fill booking discrepancy. IBOR shows {iq:,} shares but CDS settlement confirms "
                f"only {sq:,} shares delivered. {shortfall:,} share shortfall (${mv_diff:,.2f} MV impact). "
                f"Likely partial fill on block trade not yet reconciled."
    }


def _scenario_loblaw_split(prices, today, t1, t2):
    """L.TO — Post Loblaw 4:1 stock split position mismatch (Aug 2025)"""
    live = prices["L.TO"]
    pre_split_qty = random.choice([500, 750, 1000, 1200])
    post_split_qty = pre_split_qty * 4
    street_qty = post_split_qty - random.randint(50, 200)
    mv_int = round(post_split_qty * live, 2)
    mv_str = round(street_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "L.TO", "Security Name": "Loblaw Companies Ltd.",
        "CUSIP": "539481101", "ISIN": "CA5394811015",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": post_split_qty, "Street Qty": street_qty,
        "Qty Diff": post_split_qty - street_qty,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Stock Split", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": random.randint(1, 3), "Bond Key": "",
        "DESC": f"Post 4-for-1 stock split (completed Aug 2025). IBOR correctly reflects {post_split_qty:,} "
                f"post-split shares but CDS depot shows {street_qty:,}. {post_split_qty - street_qty:,} share "
                f"discrepancy suggests incomplete split processing at depository level."
    }


def _scenario_weston_split(prices, today, t1, t2):
    """WN.TO — George Weston 3:1 split residual break (Aug 2025)"""
    live = prices["WN.TO"]
    pre_qty = random.choice([300, 500, 800])
    post_qty = pre_qty * 3
    old_price = live * 3
    mv_int = round(post_qty * live, 2)
    mv_str = round(pre_qty * old_price, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "WN.TO", "Security Name": "George Weston Ltd.",
        "CUSIP": "961148509", "ISIN": "CA9611485090",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": post_qty, "Street Qty": pre_qty,
        "Qty Diff": post_qty - pre_qty,
        "Internal Price": live, "Street Price": old_price, "Price Diff %": "-66.7%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t2),
        "Break Type": "Corporate Action - Stock Split", "Counterparty": "RBC IS",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": random.randint(1, 5), "Bond Key": "",
        "DESC": f"George Weston 3-for-1 split (completed Aug 2025). RBC Investor Services still "
                f"reflecting pre-split position of {pre_qty:,} shares at ${old_price:.2f}. "
                f"IBOR correctly updated to {post_qty:,} shares at ${live:.2f}."
    }


def _scenario_nflx_split(prices, today, t1, t2):
    """NFLX — Netflix 10:1 stock split fractional share break (Nov 2025)"""
    live = prices["NFLX"]
    pre_qty = random.choice([50, 100, 150, 200])
    post_qty = pre_qty * 10
    frac = random.randint(1, 9)
    street_qty = post_qty - frac
    mv_int = round(post_qty * live, 2)
    mv_str = round(street_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "NFLX", "Security Name": "Netflix Inc.",
        "CUSIP": "64110L106", "ISIN": "US64110L1061",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": post_qty, "Street Qty": street_qty,
        "Qty Diff": frac,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Stock Split", "Counterparty": "DTC",
        "Tolerance Flag": "WITHIN" if abs(mv_diff) < 2000 else "BREACH",
        "Break Age (days)": random.randint(1, 3), "Bond Key": "",
        "DESC": f"Netflix 10-for-1 split (Nov 2025). {frac} fractional share(s) pending cash-in-lieu "
                f"processing at DTC. IBOR shows {post_qty:,} whole shares; DTC reports {street_qty:,}."
    }


def _scenario_bmo_dividend(prices, today, t1, t2):
    """BMO.TO — Q1 2026 dividend ex-date adjustment break"""
    live = prices["BMO.TO"]
    qty = random.choice([3000, 5000, 8000, 10000])
    div_per_share = 1.55
    div_total = round(qty * div_per_share, 2)
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div_per_share), 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "BMO.TO", "Security Name": "Bank of Montreal",
        "CUSIP": "063671101", "ISIN": "CA0636711016",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": round(live - div_per_share, 2),
        "Price Diff %": f"{round(div_per_share / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Dividend", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 5000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"BMO Q1 2026 quarterly dividend (${div_per_share}/share, ex-date Feb 2026). "
                f"CDS pricing reflects ex-dividend price but IBOR has not yet applied the ${div_total:,.2f} "
                f"dividend receivable adjustment on {qty:,} shares."
    }


def _scenario_na_dividend(prices, today, t1, t2):
    """NA.TO — National Bank Q1 2026 dividend timing break"""
    live = prices["NA.TO"]
    qty = random.choice([2000, 4000, 6000])
    div = 1.24
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div), 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "NA.TO", "Security Name": "National Bank of Canada",
        "CUSIP": "633067103", "ISIN": "CA6330671034",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": round(live - div, 2),
        "Price Diff %": f"{round(div / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Dividend", "Counterparty": "CDS",
        "Tolerance Flag": "WITHIN" if abs(mv_diff) < 5000 else "BREACH",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"National Bank $1.24/share Q1 2026 dividend. Ex-date pricing mismatch — "
                f"street reflects post-ex price while IBOR values at cum-dividend level."
    }


def _scenario_nvda_pricing(prices, today, t1, t2):
    """NVDA — High-volatility pricing gap on GPU earnings"""
    live = prices["NVDA"]
    gap = random.uniform(0.02, 0.05)
    ip = round(live * (1 + gap) if random.random() > 0.5 else live * (1 - gap), 2)
    qty = random.choice([500, 1000, 2000, 3000])
    mv_int = round(qty * ip, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    pdiff = f"{round((ip - live) / live * 100, 2)}%"
    return {
        "Ticker": "NVDA", "Security Name": "NVIDIA Corporation",
        "CUSIP": "67066G104", "ISIN": "US67066G1040",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": ip, "Street Price": live, "Price Diff %": pdiff,
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 10000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"NVDA pricing gap of {pdiff} between internal mark (${ip:.2f}) and DTC valuation "
                f"(${live:.2f}). Likely caused by after-hours earnings move not reflected in "
                f"vendor EOD snap. Notional impact: ${abs(mv_diff):,.2f} on {qty:,} shares."
    }


def _scenario_aapl_settlement(prices, today, t1, t2):
    """AAPL — T+1 settlement timing difference at DTC"""
    live = prices["AAPL"]
    qty = random.choice([2500, 5000, 7500])
    mv_int = round(qty * live, 2)
    mv_str = 0
    mv_diff = mv_int
    return {
        "Ticker": "AAPL", "Security Name": "Apple Inc.",
        "CUSIP": "037833100", "ISIN": "US0378331005",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": 0, "Qty Diff": qty,
        "Internal Price": live, "Street Price": None, "Price Diff %": None,
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Timing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"Position ({qty:,} shares, ${mv_int:,.2f} MV) appears in IBOR but not yet in DTC "
                f"participant account. Trade booked same-day at ${live:.2f}. T+1 settlement "
                f"(SEC Rule, effective May 28, 2024) — DTC confirmation expected by EOD."
    }


def _scenario_xiu_nav(prices, today, t1, t2):
    """XIU.TO — ETF NAV vs market price divergence"""
    live = prices["XIU.TO"]
    nav_diff = random.uniform(0.05, 0.15)
    nav = round(live + nav_diff if random.random() > 0.5 else live - nav_diff, 4)
    qty = random.choice([50000, 75000, 100000])
    mv_int = round(qty * nav, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "XIU.TO", "Security Name": "iShares S&P/TSX 60 Index ETF",
        "CUSIP": "46434G103", "ISIN": "CA46434G1037",
        "Instrument Type": "ETF", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": nav, "Street Price": live,
        "Price Diff %": f"{round((nav - live) / live * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "CDS",
        "Tolerance Flag": "WITHIN" if abs(mv_diff) < 5000 else "BREACH",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"XIU.TO NAV (${nav:.4f}) vs market close (${live:.4f}) divergence. "
                f"ETF creation/redemption mechanism should converge by next NAV strike. "
                f"Monitoring for persistent premium/discount."
    }


def _scenario_enb_fx(prices, today, t1, t2):
    """ENB.TO — FX rate cut-off timing on USD sub-account"""
    live = prices["ENB.TO"]
    fx_diff = random.uniform(0.003, 0.008)
    internal_fx = round(1.3550 + fx_diff, 4)
    street_fx = 1.3550
    qty = random.choice([10000, 15000, 20000])
    mv_int = round(qty * live * internal_fx, 2)
    mv_str = round(qty * live * street_fx, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "ENB.TO", "Security Name": "Enbridge Inc.",
        "CUSIP": "29250N105", "ISIN": "CA29250N1050",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": round(live * internal_fx, 2),
        "Street Price": round(live * street_fx, 2),
        "Price Diff %": f"{round(fx_diff / street_fx * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "FX Rate Difference", "Counterparty": "RBC IS",
        "Tolerance Flag": "WITHIN" if abs(mv_diff) < 5000 else "BREACH",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"FX rate cut-off timing. IBOR used CAD/USD {internal_fx} (16:00 WMR fix) "
                f"vs RBC IS {street_fx} (noon fix). Rate gap of {fx_diff:.4f} on {qty:,} ENB shares "
                f"creates ${abs(mv_diff):,.2f} MV variance."
    }


def _scenario_tsla_pricing(prices, today, t1, t2):
    """TSLA — After-hours pricing gap"""
    live = prices["TSLA"]
    gap = random.uniform(0.03, 0.07)
    ip = round(live * (1 - gap), 2)
    qty = random.choice([500, 1000, 1500])
    mv_int = round(qty * ip, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "TSLA", "Security Name": "Tesla Inc.",
        "CUSIP": "88160R101", "ISIN": "US88160R1014",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": ip, "Street Price": live,
        "Price Diff %": f"{round((ip - live) / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Tesla pricing discrepancy of {round(gap * 100, 1)}%. Internal mark (${ip:.2f}) "
                f"vs DTC valuation (${live:.2f}). Post-market volatility on delivery numbers "
                f"not captured in EOD vendor snap. Impact: ${abs(mv_diff):,.2f}."
    }


def _scenario_vfv_rebalance(prices, today, t1, t2):
    """VFV.TO — S&P 500 ETF rebalance share creation"""
    live = prices["VFV.TO"]
    creation = random.randint(5000, 15000)
    iq = random.choice([200000, 300000, 500000])
    sq = iq - creation
    mv_int = round(iq * live, 2)
    mv_str = round(sq * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "VFV.TO", "Security Name": "Vanguard S&P 500 Index ETF",
        "CUSIP": "92206C102", "ISIN": "CA92206C1023",
        "Instrument Type": "ETF", "Currency": "CAD",
        "Internal Qty": iq, "Street Qty": sq, "Qty Diff": creation,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Quantity Mismatch", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 20000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"ETF creation unit pending settlement. {creation:,} new shares created via AP "
                f"(authorized participant) basket delivery. CDS depot not yet reflecting "
                f"creation units. Expected to settle T+2."
    }


def _scenario_meta_pricing(prices, today, t1, t2):
    """META — Pre/post-market earnings pricing gap"""
    live = prices["META"]
    gap = random.uniform(0.02, 0.04)
    ip = round(live * (1 + gap), 2)
    qty = random.choice([300, 500, 800])
    mv_int = round(qty * ip, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "META", "Security Name": "Meta Platforms Inc.",
        "CUSIP": "30303M102", "ISIN": "US30303M1027",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": ip, "Street Price": live,
        "Price Diff %": f"+{round(gap * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 5000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"META pre-market pricing captured at ${ip:.2f} vs DTC EOD snap at ${live:.2f}. "
                f"Earnings-driven volatility. {qty:,} shares, ${abs(mv_diff):,.2f} variance. "
                f"Internal system captured extended-hours pricing."
    }


def _scenario_ry_dividend(prices, today, t1, t2):
    """RY.TO — Royal Bank dividend accrual break"""
    live = prices["RY.TO"]
    qty = random.choice([5000, 8000, 12000])
    div = 1.44
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div), 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "RY.TO", "Security Name": "Royal Bank of Canada",
        "CUSIP": "780087102", "ISIN": "CA7800871021",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": round(live - div, 2),
        "Price Diff %": f"{round(div / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Dividend", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 10000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Royal Bank $1.44/share Q1 2026 dividend ex-date mismatch. CDS shows "
                f"post-ex price; IBOR at cum-dividend. ${abs(mv_diff):,.2f} variance on "
                f"{qty:,} shares pending dividend receivable booking."
    }


def _scenario_cp_merger(prices, today, t1, t2):
    """CP.TO — CPKC merger integration position discrepancy"""
    live = prices["CP.TO"]
    qty = random.choice([3000, 5000, 7000])
    legacy_qty = qty + random.randint(50, 200)
    mv_int = round(qty * live, 2)
    mv_str = round(legacy_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "CP.TO", "Security Name": "Canadian Pacific Kansas City Ltd.",
        "CUSIP": "13646K108", "ISIN": "CA13646K1084",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": legacy_qty,
        "Qty Diff": qty - legacy_qty,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t2),
        "Break Type": "Corporate Action - Merger", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": random.randint(2, 5), "Bond Key": "",
        "DESC": f"Legacy KCS shares still reflecting in CDS position. IBOR updated to CPKC "
                f"({qty:,} shares) but CDS depot shows {legacy_qty:,}. {abs(qty - legacy_qty):,} "
                f"share discrepancy from merger exchange ratio rounding."
    }


def _scenario_hd_dividend(prices, today, t1, t2):
    """HD — Home Depot Q1 2026 dividend increase break"""
    live = prices["HD"]
    qty = random.choice([1000, 2000, 3000])
    div = 2.30
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div), 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "HD", "Security Name": "The Home Depot Inc.",
        "CUSIP": "437076102", "ISIN": "US4370761029",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": round(live - div, 2),
        "Price Diff %": f"{round(div / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Dividend", "Counterparty": "DTC",
        "Tolerance Flag": "WITHIN" if abs(mv_diff) < 5000 else "BREACH",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Home Depot increased quarterly dividend to $2.30/share (1.3% raise, Feb 2026). "
                f"DTC reflecting ex-dividend price; IBOR at cum-dividend. "
                f"${abs(mv_diff):,.2f} variance pending accrual."
    }


def _scenario_panw_acq(prices, today, t1, t2):
    """PANW — Palo Alto Networks acquisition integration"""
    live = prices["PANW"]
    qty = random.choice([500, 1000, 2000])
    ip = round(live * 1.015, 2)
    mv_int = round(qty * ip, 2)
    mv_str = round(qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "PANW", "Security Name": "Palo Alto Networks Inc.",
        "CUSIP": "697435105", "ISIN": "US6974351057",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": ip, "Street Price": live,
        "Price Diff %": f"+1.5%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 5000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Internal mark reflects premium from PANW's $25B CyberArk acquisition (closed 2025). "
                f"Synergy premium adjustment of 1.5% not reflected in DTC valuation. "
                f"${abs(mv_diff):,.2f} on {qty:,} shares."
    }


def _scenario_td_settlement(prices, today, t1, t2):
    """TD.TO — Late settlement on block trade"""
    live = prices["TD.TO"]
    qty = random.choice([15000, 20000, 25000])
    mv_int = round(qty * live, 2)
    partial = random.randint(5000, 10000)
    mv_str = round(partial * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "TD.TO", "Security Name": "Toronto-Dominion Bank",
        "CUSIP": "891160509", "ISIN": "CA8911605092",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": partial, "Qty Diff": qty - partial,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t2),
        "Break Type": "Timing Difference", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": 2, "Bond Key": "",
        "DESC": f"Block trade of {qty:,} TD shares partially settled. CDS confirms {partial:,} shares "
                f"delivered; {qty - partial:,} pending. ${abs(mv_diff):,.2f} MV at risk. "
                f"Counterparty may be short on borrow. Escalate to settlements desk."
    }


def _scenario_goog_settlement(prices, today, t1, t2):
    """GOOG — Cross-border settlement timing"""
    live = prices["GOOG"]
    qty = random.choice([1000, 2000, 3000])
    mv_int = round(qty * live, 2)
    mv_str = 0
    mv_diff = mv_int
    return {
        "Ticker": "GOOG", "Security Name": "Alphabet Inc. Class C",
        "CUSIP": "02079K107", "ISIN": "US02079K1079",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": 0, "Qty Diff": qty,
        "Internal Price": live, "Street Price": None, "Price Diff %": None,
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Timing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "BREACH",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"Cross-border purchase of {qty:,} GOOG shares (${mv_int:,.2f}) booked in IBOR "
                f"but awaiting DTC settlement. FX conversion delay from CAD funding account. "
                f"Expected DTC confirmation within T+1."
    }


# All scenarios
ALL_SCENARIOS = [
    _scenario_shop_pricing,
    _scenario_cnr_qty,
    _scenario_loblaw_split,
    _scenario_weston_split,
    _scenario_nflx_split,
    _scenario_bmo_dividend,
    _scenario_na_dividend,
    _scenario_nvda_pricing,
    _scenario_aapl_settlement,
    _scenario_xiu_nav,
    _scenario_enb_fx,
    _scenario_tsla_pricing,
    _scenario_vfv_rebalance,
    _scenario_meta_pricing,
    _scenario_ry_dividend,
    _scenario_cp_merger,
    _scenario_hd_dividend,
    _scenario_panw_acq,
    _scenario_td_settlement,
    _scenario_goog_settlement,
]


# ─────────────────────────────────────────
# MAIN GENERATOR
# ─────────────────────────────────────────

def generate_sample_breaks():
    global _ref_counter
    _ref_counter = 0

    today = date.today()
    t1 = today - timedelta(days=1)
    t2 = today - timedelta(days=2)

    print("Fetching live prices from Yahoo Finance...")

    # Fetch all live prices up front
    prices = {}
    for ticker in FALLBACK_PRICES:
        price, source = fetch_live_price(ticker)
        prices[ticker] = price
        print(f"  {ticker}: ${price:.2f} ({source})")

    # Randomly select 7-12 scenarios
    num_scenarios = random.randint(7, min(12, len(ALL_SCENARIOS)))
    selected_scenarios = random.sample(ALL_SCENARIOS, num_scenarios)

    breaks = []
    for scenario_fn in selected_scenarios:
        try:
            brk = scenario_fn(prices, today, t1, t2)
            brk["Trade Ref ID"] = next_trade_ref(t1)
            # Add randomized realistic Transaction Types (Ops terminology)
            txn_choices = [
                "Receive vs Payment (RVP)",
                "Deliver vs Payment (DVP)",
                "Open Buy",
                "Close Sell",
                "Short Sell",
                "Cover Buy",
                "Receive Free (FOP)",
                "Deliver Free (FOP)",
                "System Journal"
            ]
            brk["Transaction Type"] = random.choice(txn_choices)
                
            breaks.append(brk)
        except Exception as e:
            print(f"  Warning: scenario {scenario_fn.__name__} failed: {e}")

    random.shuffle(breaks)

    # Write to Excel
    df = pd.DataFrame(breaks)
    output_path = Path(__file__).parent / "sample_breaks.xlsx"
    df.to_excel(output_path, index=False, sheet_name="Breaks")
    print(f"\n✅ Generated {len(breaks)} breaks → {output_path}")
    return str(output_path)


if __name__ == "__main__":
    generate_sample_breaks()
