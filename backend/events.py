import json
import aiosqlite
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from database import get_db


async def get_next_sequence(db: aiosqlite.Connection, auction_id: str) -> int:
    row = await (
        await db.execute(
            "SELECT COALESCE(MAX(sequence), 0) FROM auction_events WHERE auction_id = ?",
            (auction_id,),
        )
    ).fetchone()
    return (row[0] or 0) + 1


async def append_event(
    auction_id: str,
    event_type: str,
    payload_dict: Dict[str, Any],
    actor_id: str,
    db: Optional[aiosqlite.Connection] = None,
) -> int:
    """Append an immutable event to the auction event log. Returns new sequence number."""
    own_db = db is None
    if own_db:
        db = await get_db()

    try:
        sequence = await get_next_sequence(db, auction_id)
        occurred_at = datetime.now(timezone.utc).isoformat()
        payload_json = json.dumps(payload_dict)

        await db.execute(
            """
            INSERT INTO auction_events (sequence, auction_id, event_type, payload, occurred_at, actor_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (sequence, auction_id, event_type, payload_json, occurred_at, actor_id),
        )
        await db.commit()
        return sequence
    finally:
        if own_db:
            await db.close()


async def get_auction_events(auction_id: str, db: Optional[aiosqlite.Connection] = None) -> List[Dict]:
    """Fetch all events for an auction in sequence order."""
    own_db = db is None
    if own_db:
        db = await get_db()

    try:
        rows = await (
            await db.execute(
                """
                SELECT id, sequence, auction_id, event_type, payload, occurred_at, actor_id
                FROM auction_events
                WHERE auction_id = ?
                ORDER BY sequence ASC
                """,
                (auction_id,),
            )
        ).fetchall()

        return [
            {
                "id": r["id"],
                "sequence": r["sequence"],
                "auction_id": r["auction_id"],
                "event_type": r["event_type"],
                "payload": json.loads(r["payload"]),
                "occurred_at": r["occurred_at"],
                "actor_id": r["actor_id"],
            }
            for r in rows
        ]
    finally:
        if own_db:
            await db.close()


async def get_auction_state(auction_id: str, db: Optional[aiosqlite.Connection] = None) -> Dict[str, Any]:
    """
    Replay all events for an auction to derive the current state.
    Returns a state dict with keys:
      auction_id, player_id, status, current_bid, current_bidder,
      started_at, bid_history, winner_team, final_price
    """
    own_db = db is None
    if own_db:
        db = await get_db()

    try:
        # Fetch auction base record
        auction_row = await (
            await db.execute(
                "SELECT id, player_id, status, started_at, closed_at, winner_team, final_price FROM auctions WHERE id = ?",
                (auction_id,),
            )
        ).fetchone()

        if not auction_row:
            return {}

        state: Dict[str, Any] = {
            "auction_id": auction_id,
            "player_id": auction_row["player_id"],
            "status": auction_row["status"],
            "current_bid": 0,
            "current_bidder": None,
            "started_at": auction_row["started_at"],
            "closed_at": auction_row["closed_at"],
            "winner_team": auction_row["winner_team"],
            "final_price": auction_row["final_price"],
            "bid_history": [],
            "events": [],
        }

        # Replay events
        events = await get_auction_events(auction_id, db)
        state["events"] = events

        for event in events:
            etype = event["event_type"]
            payload = event["payload"]

            if etype == "AUCTION_STARTED":
                state["status"] = "ACTIVE"
                state["started_at"] = event["occurred_at"]
                state["current_bid"] = payload.get("base_price", 0)

            elif etype == "BID_PLACED":
                bid_entry = {
                    "managerId": payload.get("managerId"),
                    "amount": payload.get("amount"),
                    "timestamp": event["occurred_at"],
                }
                state["current_bid"] = payload.get("amount", state["current_bid"])
                state["current_bidder"] = payload.get("managerId")
                state["bid_history"].append(bid_entry)

            elif etype == "BID_ACCEPTED":
                state["status"] = "CLOSED"
                state["winner_team"] = payload.get("winner_team")
                state["final_price"] = payload.get("final_price")
                state["closed_at"] = event["occurred_at"]

            elif etype == "BID_REJECTED":
                # Rollback to previous bid
                if len(state["bid_history"]) > 1:
                    state["bid_history"].pop()
                    prev = state["bid_history"][-1]
                    state["current_bid"] = prev["amount"]
                    state["current_bidder"] = prev["managerId"]
                else:
                    # Rolled back to base price
                    state["bid_history"] = []
                    state["current_bidder"] = None
                    # current_bid stays as base price (set during AUCTION_STARTED)

            elif etype == "AUCTION_CLOSED":
                state["status"] = "CLOSED"
                state["closed_at"] = event["occurred_at"]

        return state

    finally:
        if own_db:
            await db.close()
