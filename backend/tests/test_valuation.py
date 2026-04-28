"""
Tests for valuation.py — fair value calculation logic.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import math
import pytest
from valuation import calculate_fair_value, SKILL_WEIGHTS, K


BASE = 4_000_000  # 40L


# ── No-bid baseline ───────────────────────────────────────────────────────────

def test_no_bids_returns_at_least_base_price():
    result = calculate_fair_value(BASE, [], "batting")
    assert result["fair_value"] >= BASE


def test_no_bids_skill_bonus_batting():
    result = calculate_fair_value(BASE, [], "batting")
    expected_bonus = int(SKILL_WEIGHTS["batting"] * BASE * 0.3)
    assert result["skill_bonus"] == expected_bonus


def test_no_bids_skill_bonus_allrounder():
    result = calculate_fair_value(BASE, [], "allrounder")
    expected_bonus = int(SKILL_WEIGHTS["allrounder"] * BASE * 0.3)
    assert result["skill_bonus"] == expected_bonus


def test_no_bids_fair_value_rounded_to_500k():
    result = calculate_fair_value(BASE, [], "bowling")
    assert result["fair_value"] % 500_000 == 0


# ── Bid history effect ────────────────────────────────────────────────────────

def test_fair_value_increases_with_bids():
    """With a bid placed some time ago, fair value should be >= no-bid value."""
    from datetime import datetime, timezone, timedelta
    old_ts = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    bids = [{"managerId": "team-1", "amount": 5_000_000, "timestamp": old_ts}]
    fv_with_bids = calculate_fair_value(BASE, bids, "batting")["fair_value"]
    fv_no_bids = calculate_fair_value(BASE, [], "batting")["fair_value"]
    assert fv_with_bids >= fv_no_bids


# ── spread_pct ────────────────────────────────────────────────────────────────

def test_spread_pct_positive_when_fair_above_base():
    result = calculate_fair_value(BASE, [], "allrounder")
    assert result["spread_pct"] >= 0


def test_spread_pct_formula():
    result = calculate_fair_value(BASE, [], "batting")
    expected = round(((result["fair_value"] - BASE) / BASE) * 100, 1)
    assert result["spread_pct"] == expected


# ── Overvalued / Undervalued flags ────────────────────────────────────────────

def test_overvalued_flag_when_bid_far_exceeds_fair_value():
    result = calculate_fair_value(BASE, [], "batting", current_bid=BASE * 10)
    assert result["is_overvalued"] is True


def test_not_overvalued_at_base_price():
    result = calculate_fair_value(BASE, [], "batting", current_bid=BASE)
    assert result["is_overvalued"] is False


def test_undervalued_flag_when_bid_is_very_low():
    """current_bid well below 90% of fair_value → undervalued."""
    result = calculate_fair_value(BASE, [], "batting", current_bid=1)
    assert result["is_undervalued"] is True


def test_not_undervalued_when_bid_near_fair_value():
    result = calculate_fair_value(BASE, [], "batting", current_bid=BASE * 3)
    assert result["is_undervalued"] is False


# ── current_bid fallback ──────────────────────────────────────────────────────

def test_current_bid_uses_explicit_value():
    result = calculate_fair_value(BASE, [], "batting", current_bid=9_000_000)
    assert result["current_bid"] == 9_000_000


def test_current_bid_falls_back_to_last_bid_amount():
    from datetime import datetime, timezone
    bids = [{"managerId": "team-2", "amount": 6_000_000, "timestamp": datetime.now(timezone.utc).isoformat()}]
    result = calculate_fair_value(BASE, bids, "batting")
    assert result["current_bid"] == 6_000_000


def test_current_bid_falls_back_to_base_when_no_bids():
    result = calculate_fair_value(BASE, [], "batting")
    assert result["current_bid"] == BASE


# ── Unknown skill type graceful fallback ─────────────────────────────────────

def test_unknown_skill_type_uses_default_weight():
    result = calculate_fair_value(BASE, [], "wicketkeeper")
    # Default weight = 1.0 (same as bowling)
    expected_bonus = int(1.0 * BASE * 0.3)
    assert result["skill_bonus"] == expected_bonus
