"""
Tests for bidding.py — place_bid, handle_accept, handle_reject.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone

from events import append_event, get_auction_state
from bidding import place_bid, handle_accept, handle_reject


# ── helpers ───────────────────────────────────────────────────────────────────

async def _create_active_auction(db, player_id="p-1") -> str:
    auction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO auctions (id, player_id, status, started_at) VALUES (?,?,'ACTIVE',?)",
        (auction_id, player_id, now),
    )
    await db.commit()
    await append_event(
        auction_id, "AUCTION_STARTED",
        {"player_id": player_id, "player_name": "Test Player", "base_price": 4_000_000},
        "auctioneer", db,
    )
    return auction_id


# ══════════════════════════════════════════════════════════════════════════════
# place_bid
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_place_bid_success(db):
    auction_id = await _create_active_auction(db)
    result = await place_bid(auction_id, "team-1", 5_000_000, db)
    assert result["success"] is True
    assert result["amount"] == 5_000_000
    assert result["managerId"] == "team-1"


@pytest.mark.asyncio
async def test_place_bid_updates_state(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    state = await get_auction_state(auction_id, db)
    assert state["current_bid"] == 5_000_000
    assert state["current_bidder"] == "team-1"


@pytest.mark.asyncio
async def test_place_bid_requires_higher_amount(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    result = await place_bid(auction_id, "team-2", 4_000_000, db)  # lower than current
    assert result["success"] is False
    assert result["reason"] == "BID_TOO_LOW"


@pytest.mark.asyncio
async def test_place_bid_equal_amount_rejected(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    result = await place_bid(auction_id, "team-2", 5_000_000, db)  # equal, not higher
    assert result["success"] is False
    assert result["reason"] == "BID_TOO_LOW"


@pytest.mark.asyncio
async def test_place_bid_rejects_own_rebid(db):
    """Team cannot bid on top of their own leading bid."""
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    result = await place_bid(auction_id, "team-1", 6_000_000, db)
    assert result["success"] is False
    assert result["reason"] == "ALREADY_HIGHEST_BIDDER"


@pytest.mark.asyncio
async def test_place_bid_on_closed_auction_fails(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    result = await place_bid(auction_id, "team-2", 7_000_000, db)
    assert result["success"] is False
    assert result["reason"] == "AUCTION_NOT_ACTIVE"


@pytest.mark.asyncio
async def test_place_bid_on_nonexistent_auction(db):
    result = await place_bid("nonexistent-auction-id", "team-1", 5_000_000, db)
    assert result["success"] is False
    assert result["reason"] == "AUCTION_NOT_FOUND"


@pytest.mark.asyncio
async def test_place_bid_insufficient_budget(db):
    """Bid exceeding team budget is rejected."""
    auction_id = await _create_active_auction(db)
    result = await place_bid(auction_id, "team-1", 999_000_000, db)  # way over 50M budget
    assert result["success"] is False
    assert result["reason"] == "INSUFFICIENT_BUDGET"


@pytest.mark.asyncio
async def test_place_bid_unknown_team(db):
    auction_id = await _create_active_auction(db)
    result = await place_bid(auction_id, "team-ghost", 5_000_000, db)
    assert result["success"] is False
    assert result["reason"] == "TEAM_NOT_FOUND"


@pytest.mark.asyncio
async def test_bid_history_tracks_multiple_teams(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await place_bid(auction_id, "team-2", 6_000_000, db)
    await place_bid(auction_id, "team-3", 7_000_000, db)
    state = await get_auction_state(auction_id, db)
    assert len(state["bid_history"]) == 3
    assert state["bid_history"][-1]["managerId"] == "team-3"


# ══════════════════════════════════════════════════════════════════════════════
# handle_accept
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_handle_accept_success(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    result = await handle_accept(auction_id, "auctioneer", db)
    assert result["success"] is True
    assert result["winner_team"] == "team-1"
    assert result["final_price"] == 5_000_000


@pytest.mark.asyncio
async def test_handle_accept_closes_auction(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    state = await get_auction_state(auction_id, db)
    assert state["status"] == "CLOSED"


@pytest.mark.asyncio
async def test_handle_accept_deducts_budget(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    row = await (await db.execute("SELECT budget FROM teams WHERE id='team-1'")).fetchone()
    assert row["budget"] == 50_000_000 - 5_000_000


@pytest.mark.asyncio
async def test_handle_accept_creates_roster_assignment(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    row = await (
        await db.execute("SELECT * FROM roster_assignments WHERE player_id='p-1'")
    ).fetchone()
    assert row is not None
    assert row["team_id"] == "team-1"
    assert row["price_paid"] == 5_000_000


@pytest.mark.asyncio
async def test_handle_accept_fails_with_no_bid(db):
    auction_id = await _create_active_auction(db)
    result = await handle_accept(auction_id, "auctioneer", db)
    assert result["success"] is False
    assert result["reason"] == "NO_BID_TO_ACCEPT"


@pytest.mark.asyncio
async def test_handle_accept_fails_on_closed_auction(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    result = await handle_accept(auction_id, "auctioneer", db)  # double-accept
    assert result["success"] is False
    assert result["reason"] == "AUCTION_NOT_ACTIVE"


# ══════════════════════════════════════════════════════════════════════════════
# handle_reject
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_handle_reject_success(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    result = await handle_reject(auction_id, "auctioneer", "too low", db)
    assert result["success"] is True


@pytest.mark.asyncio
async def test_handle_reject_rolls_back_state(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await place_bid(auction_id, "team-2", 6_000_000, db)
    await handle_reject(auction_id, "auctioneer", "suspicious", db)
    state = await get_auction_state(auction_id, db)
    assert state["current_bid"] == 5_000_000
    assert state["current_bidder"] == "team-1"


@pytest.mark.asyncio
async def test_handle_reject_fails_on_closed_auction(db):
    auction_id = await _create_active_auction(db)
    await place_bid(auction_id, "team-1", 5_000_000, db)
    await handle_accept(auction_id, "auctioneer", db)
    result = await handle_reject(auction_id, "auctioneer", "late reject", db)
    assert result["success"] is False
    assert result["reason"] == "AUCTION_NOT_ACTIVE"


# ══════════════════════════════════════════════════════════════════════════════
# full auction lifecycle
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_full_auction_lifecycle(db):
    """
    Full happy-path: start → bid1 → bid2 → reject bid2 → bid3 → accept
    """
    auction_id = await _create_active_auction(db)

    # Two teams bid, then reject, then another team wins
    r1 = await place_bid(auction_id, "team-1", 5_000_000, db)
    assert r1["success"] is True

    r2 = await place_bid(auction_id, "team-2", 6_000_000, db)
    assert r2["success"] is True

    rej = await handle_reject(auction_id, "auctioneer", "too fast", db)
    assert rej["success"] is True

    # After reject, team-1 is the highest bidder; team-3 can now bid
    r3 = await place_bid(auction_id, "team-3", 7_000_000, db)
    assert r3["success"] is True

    acc = await handle_accept(auction_id, "auctioneer", db)
    assert acc["success"] is True
    assert acc["winner_team"] == "team-3"
    assert acc["final_price"] == 7_000_000

    state = await get_auction_state(auction_id, db)
    assert state["status"] == "CLOSED"
    assert state["winner_team"] == "team-3"
