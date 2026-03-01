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
import concurrent.futures

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
    """L.TO — Post Loblaw 4:1 stock split position mismatch"""
    live = prices["L.TO"]
    pre_split_qty = random.choice([500, 750, 1000, 1200])
    post_split_qty = pre_split_qty * 4
    street_qty = post_split_qty - random.randint(50, 200)
    mv_int = round(post_split_qty * live, 2)
    mv_str = round(street_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    split_date = str(today - timedelta(days=random.randint(1, 2)))
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
        "Break Age (days)": random.randint(0, 2), "Bond Key": "",
        "DESC": f"Post 4-for-1 stock split (effective {split_date}). IBOR correctly reflects {post_split_qty:,} "
                f"post-split shares but CDS depot shows {street_qty:,}. {post_split_qty - street_qty:,} share "
                f"discrepancy suggests incomplete split processing at depository level."
    }


def _scenario_weston_split(prices, today, t1, t2):
    """WN.TO — George Weston 3:1 split residual break"""
    live = prices["WN.TO"]
    pre_qty = random.choice([300, 500, 800])
    post_qty = pre_qty * 3
    street_qty = post_qty - random.randint(10, 50)
    mv_int = round(post_qty * live, 2)
    mv_str = round(street_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    split_date = str(today - timedelta(days=random.randint(1, 2)))
    return {
        "Ticker": "WN.TO", "Security Name": "George Weston Ltd.",
        "CUSIP": "961148509", "ISIN": "CA9611485090",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": post_qty, "Street Qty": street_qty,
        "Qty Diff": post_qty - street_qty,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Stock Split", "Counterparty": "RBC IS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 3000 else "WITHIN",
        "Break Age (days)": random.randint(0, 2), "Bond Key": "",
        "DESC": f"Post 3-for-1 stock split (effective {split_date}). IBOR shows {post_qty:,} post-split "
                f"shares; RBC IS records only {street_qty:,}. {post_qty - street_qty:,} share gap "
                f"likely from fractional share truncation at sub-custodian level."
    }


def _scenario_nflx_split(prices, today, t1, t2):
    """NFLX — Netflix 10:1 stock split fractional share break"""
    live = prices["NFLX"]
    pre_qty = random.choice([100, 200, 500])
    post_qty = pre_qty * 10
    fractional_drop = random.randint(1, 5)
    street_qty = post_qty - fractional_drop
    mv_int = round(post_qty * live, 2)
    mv_str = round(street_qty * live, 2)
    mv_diff = round(mv_int - mv_str, 2)
    split_date = str(today - timedelta(days=random.randint(0, 1)))
    return {
        "Ticker": "NFLX", "Security Name": "Netflix Inc.",
        "CUSIP": "64110L106", "ISIN": "US64110L1061",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": post_qty, "Street Qty": street_qty,
        "Qty Diff": fractional_drop,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Stock Split", "Counterparty": "DTC",
        "Tolerance Flag": "WITHIN",
        "Break Age (days)": random.randint(0, 1), "Bond Key": "",
        "DESC": f"Netflix 10-for-1 stock split (effective {split_date}). {fractional_drop} fractional share(s) "
                f"dropped by DTC during split processing. IBOR shows {post_qty:,} shares; DTC confirms "
                f"{street_qty:,}. ${mv_diff:,.2f} impact — cash-in-lieu expected within T+3."
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
    ex_date = str(today - timedelta(days=random.randint(0, 1)))
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
        "Break Age (days)": random.randint(0, 1), "Bond Key": "",
        "DESC": f"BMO quarterly dividend (${div_per_share}/share, ex-date {ex_date}). "
                f"CDS pricing reflects ex-dividend price but IBOR has not yet applied the ${div_total:,.2f} "
                f"dividend receivable adjustment on {qty:,} shares."
    }


def _scenario_na_dividend(prices, today, t1, t2):
    """NA.TO — National Bank dividend timing break"""
    live = prices["NA.TO"]
    qty = random.choice([5000, 8000, 12000])
    div = 1.24
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div), 2)
    mv_diff = round(mv_int - mv_str, 2)
    ex_date = str(today - timedelta(days=random.randint(0, 1)))
    return {
        "Ticker": "NA.TO", "Security Name": "National Bank of Canada",
        "CUSIP": "633067101", "ISIN": "CA6330671034",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": round(live - div, 2),
        "Price Diff %": f"{round(div / live * 100, 2)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Corporate Action - Dividend", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 5000 else "WITHIN",
        "Break Age (days)": random.randint(0, 1), "Bond Key": "",
        "DESC": f"National Bank ${div}/share dividend. Ex-date pricing mismatch ({ex_date}) — "
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
    # Timing differences: both sides agree on qty & price, only settlement date differs
    # Small accrual-based MV diff from DvP timing
    accrual = round(random.uniform(50, 2500), 2)
    mv_str = round(mv_int - accrual, 2)
    mv_diff = round(accrual, 2)
    settle_int = str(today)
    settle_str = str(today + timedelta(days=1))
    return {
        "Ticker": "AAPL", "Security Name": "Apple Inc.",
        "CUSIP": "037833100", "ISIN": "US0378331005",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": settle_int, "Trade Date": str(t1),
        "Break Type": "Timing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "WITHIN",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"Settlement date mismatch — internal books show {settle_int}, "
                f"DTC confirms {settle_str}. T+1 rule applied. "
                f"Quantities ({qty:,} shares) and pricing (${live:.2f}) reconcile clean. "
                f"Minor accrual diff of ${accrual:,.2f} from DvP timing."
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
    ex_date = str(today - timedelta(days=random.randint(0, 1)))
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
        "Break Age (days)": random.randint(0, 1), "Bond Key": "",
        "DESC": f"Royal Bank ${div}/share dividend ex-date mismatch ({ex_date}). CDS shows "
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
    merger_date = str(today - timedelta(days=random.randint(1, 2)))
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
        "Break Age (days)": random.randint(1, 2), "Bond Key": "",
        "DESC": f"Legacy KCS shares still reflecting in CDS position (merger effective {merger_date}). "
                f"IBOR updated to CPKC ({qty:,} shares) but CDS depot shows {legacy_qty:,}. "
                f"{abs(qty - legacy_qty):,} share discrepancy from merger exchange ratio rounding."
    }


def _scenario_hd_dividend(prices, today, t1, t2):
    """HD — Home Depot dividend increase break"""
    live = prices["HD"]
    qty = random.choice([1000, 2000, 3000])
    div = 2.30
    mv_int = round(qty * live, 2)
    mv_str = round(qty * (live - div), 2)
    mv_diff = round(mv_int - mv_str, 2)
    ex_date = str(today - timedelta(days=random.randint(0, 1)))
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
        "Break Age (days)": random.randint(0, 1), "Bond Key": "",
        "DESC": f"Home Depot increased quarterly dividend to ${div}/share (ex-date {ex_date}). "
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
    """TD.TO — Settlement date mismatch timing break"""
    live = prices["TD.TO"]
    qty = random.choice([15000, 20000, 25000])
    mv_int = round(qty * live, 2)
    # Timing difference: quantities and prices match, only settlement date differs
    accrual = round(random.uniform(100, 2200), 2)
    mv_str = round(mv_int - accrual, 2)
    mv_diff = round(accrual, 2)
    settle_int = str(today)
    settle_str = str(today + timedelta(days=1))
    return {
        "Ticker": "TD.TO", "Security Name": "Toronto-Dominion Bank",
        "CUSIP": "891160509", "ISIN": "CA8911605092",
        "Instrument Type": "Equity", "Currency": "CAD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": settle_int, "Trade Date": str(t2),
        "Break Type": "Timing Difference", "Counterparty": "CDS",
        "Tolerance Flag": "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"Settlement date mismatch — internal books show {settle_int}, "
                f"CDS confirms {settle_str}. T+1 rule applied. "
                f"Quantities ({qty:,} shares) and pricing (${live:.2f}) reconcile clean. "
                f"Minor settlement date rounding diff of ${accrual:,.2f}."
    }


def _scenario_goog_settlement(prices, today, t1, t2):
    """GOOG — Cross-border settlement timing"""
    live = prices["GOOG"]
    qty = random.choice([1000, 2000, 3000])
    mv_int = round(qty * live, 2)
    # Timing difference: both sides agree, only settlement date differs
    accrual = round(random.uniform(200, 2500), 2)
    mv_str = round(mv_int - accrual, 2)
    mv_diff = round(accrual, 2)
    settle_int = str(today)
    settle_str = str(today + timedelta(days=1))
    return {
        "Ticker": "GOOG", "Security Name": "Alphabet Inc. Class C",
        "CUSIP": "02079K107", "ISIN": "US02079K1079",
        "Instrument Type": "Equity", "Currency": "USD",
        "Internal Qty": qty, "Street Qty": qty, "Qty Diff": 0,
        "Internal Price": live, "Street Price": live, "Price Diff %": "0.00%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": settle_int, "Trade Date": str(t1),
        "Break Type": "Timing Difference", "Counterparty": "DTC",
        "Tolerance Flag": "WITHIN",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"Settlement date mismatch — internal books show {settle_int}, "
                f"DTC confirms {settle_str}. Cross-border T+1 rule applied. "
                f"Quantities ({qty:,} shares) and pricing (${live:.2f}) reconcile clean. "
                f"Minor FX conversion accrual diff of ${accrual:,.2f}."
    }


# ── FIXED INCOME SCENARIOS ──

def _scenario_ust_10y(prices, today, t1, t2):
    """US Treasury 10Y — Clean vs dirty price accrued interest break"""
    face = random.choice([5_000_000, 10_000_000, 25_000_000])
    coupon = 4.25
    clean = round(random.uniform(97.5, 102.0), 6)
    days_accrued = random.randint(30, 90)
    accrued_interest = round(face * (coupon / 100) * (days_accrued / 365), 2)
    dirty = round(clean + (coupon / 100) * (days_accrued / 365) * 100, 6)
    mv_int = round(face * dirty / 100, 2)
    mv_str = round(face * clean / 100, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "912810TW2", "Security Name": "US Treasury 4.25% 02/15/2034",
        "CUSIP": "912810TW2", "ISIN": "US912810TW26",
        "Instrument Type": "Fixed Income", "Currency": "USD",
        "Internal Qty": face, "Street Qty": face, "Qty Diff": 0,
        "Internal Price": dirty, "Street Price": clean,
        "Price Diff %": f"{round((dirty - clean) / clean * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "Fed Wire",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 50000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "UST-10Y-2034",
        "DESC": f"IBOR pricing at dirty price ({dirty:.4f}) includes ${accrued_interest:,.2f} accrued interest "
                f"({days_accrued} days, {coupon}% coupon). Fedwire clearing at clean price ({clean:.4f}). "
                f"${abs(mv_diff):,.2f} variance on ${face:,.0f} face value. Standard T+1 settlement."
    }


def _scenario_canada_govt_bond(prices, today, t1, t2):
    """Canada Govt Bond 3.5% — Yield curve reprice break"""
    face = random.choice([2_000_000, 5_000_000, 10_000_000])
    int_price = round(random.uniform(98.0, 101.0), 6)
    street_price = round(int_price - random.uniform(0.15, 0.45), 6)
    mv_int = round(face * int_price / 100, 2)
    mv_str = round(face * street_price / 100, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "CAN 3.5 06/26", "Security Name": "Canada Govt Bond 3.5% Jun 2026",
        "CUSIP": "135087P44", "ISIN": "CA135087P443",
        "Instrument Type": "Fixed Income", "Currency": "CAD",
        "Internal Qty": face, "Street Qty": face, "Qty Diff": 0,
        "Internal Price": int_price, "Street Price": street_price,
        "Price Diff %": f"{round((int_price - street_price) / street_price * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "CDS",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 25000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "CAN-3.5-2026",
        "DESC": f"Canadian government bond pricing divergence. IBOR mark ({int_price:.4f}) vs CDS settlement "
                f"price ({street_price:.4f}). Likely BoC rate decision impact on yield curve not yet reflected "
                f"in vendor feed. ${abs(mv_diff):,.2f} variance on ${face:,.0f} face."
    }


# ── FX SCENARIOS ──

def _scenario_usdcad_spot(prices, today, t1, t2):
    """USD/CAD — Spot FX rate cutoff timing break"""
    notional_usd = random.choice([2_000_000, 5_000_000, 10_000_000])
    int_rate = round(random.uniform(1.3520, 1.3620), 4)
    street_rate = round(int_rate - random.uniform(0.0020, 0.0060), 4)
    mv_int = round(notional_usd * int_rate, 2)
    mv_str = round(notional_usd * street_rate, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "USD/CAD", "Security Name": "USD/CAD Spot",
        "CUSIP": "", "ISIN": "",
        "Instrument Type": "FX", "Currency": "CAD",
        "Internal Qty": notional_usd, "Street Qty": notional_usd, "Qty Diff": 0,
        "Internal Price": int_rate, "Street Price": street_rate,
        "Price Diff %": f"{round((int_rate - street_rate) / street_rate * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today + timedelta(days=2)), "Trade Date": str(today),
        "Break Type": "FX Rate Difference", "Counterparty": "CLS Bank",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 10000 else "WITHIN",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"USD/CAD spot trade. IBOR rate ({int_rate}) taken at 16:00 WMR London fix vs "
                f"CLS Bank settlement rate ({street_rate}) at 12:00 noon fix. "
                f"${abs(mv_diff):,.2f} variance on ${notional_usd:,.0f} notional. T+2 settlement."
    }


def _scenario_eurusd_forward(prices, today, t1, t2):
    """EUR/USD — 3-month FX forward mark-to-market break"""
    notional_eur = random.choice([3_000_000, 7_000_000, 15_000_000])
    fwd_rate = round(random.uniform(1.0820, 1.0920), 4)
    mtm_rate = round(fwd_rate + random.uniform(0.0015, 0.0045), 4)
    mv_int = round(notional_eur * mtm_rate, 2)
    mv_str = round(notional_eur * fwd_rate, 2)
    mv_diff = round(mv_int - mv_str, 2)
    maturity = today + timedelta(days=90)
    return {
        "Ticker": "EUR/USD 3M", "Security Name": "EUR/USD 3-Month Forward",
        "CUSIP": "", "ISIN": "",
        "Instrument Type": "FX", "Currency": "USD",
        "Internal Qty": notional_eur, "Street Qty": notional_eur, "Qty Diff": 0,
        "Internal Price": mtm_rate, "Street Price": fwd_rate,
        "Price Diff %": f"{round((mtm_rate - fwd_rate) / fwd_rate * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(maturity), "Trade Date": str(today),
        "Break Type": "FX Rate Difference", "Counterparty": "Deutsche Bank",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 20000 else "WITHIN",
        "Break Age (days)": 0, "Bond Key": "",
        "DESC": f"EUR/USD 3-month forward contract (maturity {maturity}). IBOR MTM rate ({mtm_rate}) "
                f"vs counterparty valuation ({fwd_rate}). Forward points divergence likely due to "
                f"ECB rate differential update. ${abs(mv_diff):,.2f} on €{notional_eur:,.0f} notional."
    }


# ── DERIVATIVE SCENARIOS ──

def _scenario_sp500_future(prices, today, t1, t2):
    """ES — S&P 500 E-mini future margin/variation break"""
    contracts = random.choice([10, 25, 50, 100])
    multiplier = 50  # ES contract multiplier
    int_price = round(random.uniform(5950, 6100), 2)
    street_price = round(int_price - random.uniform(5, 20), 2)
    notional = contracts * multiplier
    mv_int = round(notional * int_price, 2)
    mv_str = round(notional * street_price, 2)
    mv_diff = round(mv_int - mv_str, 2)
    return {
        "Ticker": "ESH26", "Security Name": "S&P 500 E-mini Future Mar 2026",
        "CUSIP": "", "ISIN": "",
        "Instrument Type": "Derivative", "Currency": "USD",
        "Internal Qty": contracts, "Street Qty": contracts, "Qty Diff": 0,
        "Internal Price": int_price, "Street Price": street_price,
        "Price Diff %": f"{round((int_price - street_price) / street_price * 100, 3)}%",
        "MV Internal ($)": mv_int, "MV Street ($)": mv_str, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(t1),
        "Break Type": "Pricing Difference", "Counterparty": "CME Clearing",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 25000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"S&P 500 E-mini futures ({contracts} contracts × $50 multiplier). IBOR settlement "
                f"price ({int_price:.2f}) vs CME daily settlement ({street_price:.2f}). Variation margin "
                f"discrepancy of ${abs(mv_diff):,.2f}. CME final settlement published at 16:00 CT."
    }


def _scenario_irs_mtm(prices, today, t1, t2):
    """IRS — Interest rate swap mark-to-market valuation break"""
    notional = random.choice([10_000_000, 25_000_000, 50_000_000])
    fixed_rate = round(random.uniform(3.80, 4.30), 4)
    int_mtm = round(random.uniform(-150000, 150000), 2)
    street_mtm = round(int_mtm + random.uniform(-25000, -5000), 2)
    mv_diff = round(int_mtm - street_mtm, 2)
    return {
        "Ticker": "IRS-5Y-USD", "Security Name": f"USD 5Y IRS {fixed_rate}% vs SOFR",
        "CUSIP": "", "ISIN": "",
        "Instrument Type": "Derivative", "Currency": "USD",
        "Internal Qty": notional, "Street Qty": notional, "Qty Diff": 0,
        "Internal Price": round(int_mtm / notional * 100, 6),
        "Street Price": round(street_mtm / notional * 100, 6),
        "Price Diff %": f"{round(mv_diff / abs(notional) * 100, 3)}%",
        "MV Internal ($)": int_mtm, "MV Street ($)": street_mtm, "MV Diff ($)": mv_diff,
        "Settlement Date": str(today), "Trade Date": str(today - timedelta(days=365)),
        "Break Type": "Pricing Difference", "Counterparty": "LCH Clearnet",
        "Tolerance Flag": "BREACH" if abs(mv_diff) > 15000 else "WITHIN",
        "Break Age (days)": 1, "Bond Key": "",
        "DESC": f"5-year USD interest rate swap ({fixed_rate}% fixed vs SOFR float) on "
                f"${notional:,.0f} notional. IBOR MTM (${int_mtm:,.2f}) vs LCH valuation "
                f"(${street_mtm:,.2f}). Curve input divergence — IBOR using SOFR term rate vs "
                f"LCH using overnight compounded SOFR. ${abs(mv_diff):,.2f} variance."
    }


# ─────────────────────────────────────────
# SCENARIO POOL — tagged by instrument type for guaranteed diversity
# ─────────────────────────────────────────

SCENARIOS_BY_TYPE = {
    "Equity": [
        _scenario_shop_pricing, _scenario_cnr_qty,
        _scenario_nvda_pricing, _scenario_tsla_pricing, _scenario_meta_pricing,
        _scenario_aapl_settlement, _scenario_td_settlement, _scenario_goog_settlement,
    ],
    "Corporate Action": [
        _scenario_loblaw_split, _scenario_weston_split, _scenario_nflx_split,
        _scenario_bmo_dividend, _scenario_na_dividend, _scenario_ry_dividend,
        _scenario_cp_merger, _scenario_hd_dividend, _scenario_panw_acq,
    ],
    "ETF": [_scenario_xiu_nav, _scenario_vfv_rebalance],
    "FX": [_scenario_enb_fx, _scenario_usdcad_spot, _scenario_eurusd_forward],
    "Fixed Income": [_scenario_ust_10y, _scenario_canada_govt_bond],
    "Derivative": [_scenario_sp500_future, _scenario_irs_mtm],
}

ALL_SCENARIOS = [fn for fns in SCENARIOS_BY_TYPE.values() for fn in fns]


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

    # Fetch all live prices concurrently
    prices = {}
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_ticker = {executor.submit(fetch_live_price, ticker): ticker for ticker in FALLBACK_PRICES}
        for future in concurrent.futures.as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            try:
                price, source = future.result()
                prices[ticker] = price
            except Exception:
                prices[ticker] = FALLBACK_PRICES[ticker]

    # Guarantee at least 1 of each type
    guaranteed = []
    for type_name, type_scenarios in SCENARIOS_BY_TYPE.items():
        guaranteed.append(random.choice(type_scenarios))

    # Fill remaining slots with random picks (avoiding duplicates)
    remaining_pool = [s for s in ALL_SCENARIOS if s not in guaranteed]
    extra_count = random.randint(4, min(8, len(remaining_pool)))
    extras = random.sample(remaining_pool, extra_count)
    selected_scenarios = guaranteed + extras

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
    print(f"   Types: {', '.join(set(b.get('Instrument Type','?') for b in breaks))}")
    return str(output_path)


if __name__ == "__main__":
    generate_sample_breaks()

