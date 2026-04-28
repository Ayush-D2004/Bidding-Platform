import math
import time
from typing import List, Dict, Any, Optional


SKILL_WEIGHTS = {
    "batting": 1.2,
    "bowling": 1.0,
    "allrounder": 1.5,
}

K = 0.05  # exponential growth rate constant


def calculate_fair_value(
    base_price: int,
    bids: List[Dict[str, Any]],
    skill_type: str,
    current_bid: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Fair value formula:
      Vt = base_price * e^(k * delta_t) + (w * base_price * 0.3)
    where:
      delta_t = time since first bid in minutes
      w       = skill weight from SKILL_WEIGHTS
    Returns dict with fair_value, spread_pct, demand_component, skill_bonus.
    """
    # Compute delta_t (minutes since first bid)
    if bids:
        try:
            # bids may have ISO timestamp string or UNIX float
            first_ts = bids[0].get("timestamp") or bids[0].get("occurred_at")
            if isinstance(first_ts, str):
                from datetime import datetime, timezone
                dt = datetime.fromisoformat(first_ts.replace("Z", "+00:00"))
                delta_t = (datetime.now(timezone.utc) - dt).total_seconds() / 60.0
            else:
                delta_t = (time.time() - float(first_ts)) / 60.0
        except Exception:
            delta_t = 0.0
    else:
        delta_t = 0.0

    w = SKILL_WEIGHTS.get(skill_type, 1.0)

    demand_component = int(base_price * math.exp(K * delta_t))
    skill_bonus = int(w * base_price * 0.3)
    raw_fair_value = demand_component + skill_bonus

    # Round to nearest 500,000
    fair_value = round(raw_fair_value / 500_000) * 500_000
    fair_value = max(fair_value, base_price)  # never below base

    spread_pct = round(((fair_value - base_price) / base_price) * 100, 1)

    bid_amount = current_bid or (bids[-1]["amount"] if bids else base_price)
    overvalued_threshold = fair_value * 1.1

    return {
        "fair_value": fair_value,
        "spread_pct": spread_pct,
        "base_price": base_price,
        "current_bid": bid_amount,
        "demand_component": demand_component,
        "skill_bonus": skill_bonus,
        "is_overvalued": bid_amount > overvalued_threshold,
        "is_undervalued": bid_amount < fair_value * 0.9,
    }
