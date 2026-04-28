"""
Tests for events.py — append_event, get_auction_events, get_auction_state.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone

from events import append_event, get_auction_events, get_auction_state


# ── helpers ───────────────────────────────────────────────────────────────────

async def _create_auction(db, player_id="p-1") -> str:
    auction_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO auctions (id, player_id, status, started_at) VALUES (?,?,'ACTIVE',?)",
        (auction_id, player_id, now),
    )
    await db.commit()
    return auction_id


# ── append_event ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_append_event_returns_sequence_number(db):
    auction_id = await _create_auction(db)
    seq = await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    assert seq == 1


@pytest.mark.asyncio
async def test_append_multiple_events_increments_sequence(db):
    auction_id = await _create_auction(db)
    s1 = await append_event(auction_id, "AUCTION_STARTED", {}, "auctioneer", db)
    s2 = await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    s3 = await append_event(auction_id, "BID_PLACED", {"managerId": "team-2", "amount": 6_000_000}, "team-2", db)
    assert s1 == 1 and s2 == 2 and s3 == 3


@pytest.mark.asyncio
async def test_sequences_are_per_auction(db):
    a1 = await _create_auction(db, "p-1")
    a2 = await _create_auction(db, "p-2")
    await append_event(a1, "AUCTION_STARTED", {}, "auctioneer", db)
    await append_event(a1, "BID_PLACED", {}, "team-1", db)
    seq = await append_event(a2, "AUCTION_STARTED", {}, "auctioneer", db)
    # a2 has its own sequence starting from 1
    assert seq == 1


# ── get_auction_events ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_auction_events_returns_ordered_list(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)

    events = await get_auction_events(auction_id, db)
    assert len(events) == 2
    assert events[0]["event_type"] == "AUCTION_STARTED"
    assert events[1]["event_type"] == "BID_PLACED"
    assert events[0]["sequence"] < events[1]["sequence"]


@pytest.mark.asyncio
async def test_get_auction_events_payload_deserialised(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-2", "amount": 7_000_000}, "team-2", db)
    events = await get_auction_events(auction_id, db)
    assert isinstance(events[0]["payload"], dict)
    assert events[0]["payload"]["amount"] == 7_000_000


@pytest.mark.asyncio
async def test_get_auction_events_empty_for_unknown_auction(db):
    events = await get_auction_events("nonexistent-id", db)
    assert events == []


# ── get_auction_state ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_state_returns_empty_dict_for_unknown_auction(db):
    state = await get_auction_state("no-such-id", db)
    assert state == {}


@pytest.mark.asyncio
async def test_state_after_auction_started(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    state = await get_auction_state(auction_id, db)
    assert state["status"] == "ACTIVE"
    assert state["current_bid"] == 4_000_000
    assert state["current_bidder"] is None
    assert state["bid_history"] == []


@pytest.mark.asyncio
async def test_state_after_bid_placed(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    state = await get_auction_state(auction_id, db)
    assert state["current_bid"] == 5_000_000
    assert state["current_bidder"] == "team-1"
    assert len(state["bid_history"]) == 1


@pytest.mark.asyncio
async def test_state_after_multiple_bids(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-2", "amount": 6_000_000}, "team-2", db)
    state = await get_auction_state(auction_id, db)
    assert state["current_bid"] == 6_000_000
    assert state["current_bidder"] == "team-2"
    assert len(state["bid_history"]) == 2


@pytest.mark.asyncio
async def test_state_bid_rejected_rolls_back_to_previous_bid(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-2", "amount": 6_000_000}, "team-2", db)
    await append_event(auction_id, "BID_REJECTED", {"reason": "too high"}, "auctioneer", db)

    state = await get_auction_state(auction_id, db)
    # Should roll back to team-1's bid
    assert state["current_bid"] == 5_000_000
    assert state["current_bidder"] == "team-1"
    assert len(state["bid_history"]) == 1


@pytest.mark.asyncio
async def test_state_bid_rejected_from_single_bid_resets_to_base(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    await append_event(auction_id, "BID_REJECTED", {"reason": "auctioneer veto"}, "auctioneer", db)

    state = await get_auction_state(auction_id, db)
    assert state["current_bidder"] is None
    assert state["bid_history"] == []


@pytest.mark.asyncio
async def test_state_after_bid_accepted(db):
    auction_id = await _create_auction(db)
    await append_event(auction_id, "AUCTION_STARTED", {"base_price": 4_000_000}, "auctioneer", db)
    await append_event(auction_id, "BID_PLACED", {"managerId": "team-1", "amount": 5_000_000}, "team-1", db)
    await append_event(auction_id, "BID_ACCEPTED",
                       {"winner_team": "team-1", "final_price": 5_000_000, "player_id": "p-1"},
                       "auctioneer", db)

    state = await get_auction_state(auction_id, db)
    assert state["status"] == "CLOSED"
    assert state["winner_team"] == "team-1"
    assert state["final_price"] == 5_000_000
