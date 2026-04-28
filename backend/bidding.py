import asyncio
import json
from typing import Dict, Set, Any

import aiosqlite
from fastapi import WebSocket

from database import get_db
from events import append_event, get_auction_state

# ── In-memory state ─────────────────────────────────────────────────────────
connected_clients: Dict[str, Set[WebSocket]] = {}
auction_locks: Dict[str, asyncio.Lock] = {}

# Cache: auction_id → current state dict
auction_state_cache: Dict[str, Dict[str, Any]] = {}


# ── Lock helpers ─────────────────────────────────────────────────────────────
async def get_lock(auction_id: str) -> asyncio.Lock:
    if auction_id not in auction_locks:
        auction_locks[auction_id] = asyncio.Lock()
    return auction_locks[auction_id]


# ── Broadcast ────────────────────────────────────────────────────────────────
async def broadcast(auction_id: str, message_dict: Dict[str, Any]) -> None:
    if auction_id not in connected_clients:
        return
    dead: Set[WebSocket] = set()
    for ws in list(connected_clients[auction_id]):
        try:
            await ws.send_json(message_dict)
        except Exception:
            dead.add(ws)
    connected_clients[auction_id] -= dead


# ── Place bid ────────────────────────────────────────────────────────────────
async def place_bid(
    auction_id: str,
    manager_id: str,
    amount: int,
    db: aiosqlite.Connection,
) -> Dict[str, Any]:
    lock = await get_lock(auction_id)
    async with lock:
        state = await get_auction_state(auction_id, db)

        if not state:
            return {"success": False, "reason": "AUCTION_NOT_FOUND"}

        if state.get("status") != "ACTIVE":
            return {"success": False, "reason": "AUCTION_NOT_ACTIVE"}

        if state.get("current_bidder") == manager_id:
            return {"success": False, "reason": "ALREADY_HIGHEST_BIDDER"}

        if amount <= state.get("current_bid", 0):
            return {"success": False, "reason": "BID_TOO_LOW"}

        # Validate team budget
        team_row = await (
            await db.execute("SELECT budget FROM teams WHERE id = ?", (manager_id,))
        ).fetchone()
        
        if not team_row:
            return {"success": False, "reason": "TEAM_NOT_FOUND"}
            
        if amount > team_row["budget"]:
            return {"success": False, "reason": "INSUFFICIENT_BUDGET"}

        # Append event
        await append_event(
            auction_id,
            "BID_PLACED",
            {"managerId": manager_id, "amount": amount},
            manager_id,
            db,
        )

        # Invalidate cache
        auction_state_cache.pop(auction_id, None)

        # Broadcast to all room participants
        await broadcast(
            auction_id,
            {
                "type": "BID_PLACED",
                "managerId": manager_id,
                "amount": amount,
                "auction_id": auction_id,
            },
        )

        return {"success": True, "amount": amount, "managerId": manager_id}


# ── Accept bid ───────────────────────────────────────────────────────────────
async def handle_accept(
    auction_id: str,
    actor_id: str,
    db: aiosqlite.Connection,
) -> Dict[str, Any]:
    lock = await get_lock(auction_id)
    async with lock:
        state = await get_auction_state(auction_id, db)

        if not state or state.get("status") != "ACTIVE":
            return {"success": False, "reason": "AUCTION_NOT_ACTIVE"}

        current_bid = state.get("current_bid", 0)
        current_bidder = state.get("current_bidder")
        player_id = state.get("player_id")

        if not current_bidder:
            return {"success": False, "reason": "NO_BID_TO_ACCEPT"}

        # Find team_id for the manager username
        winning_team_id = current_bidder  # current_bidder IS the team_id in our model

        # Append BID_ACCEPTED event
        await append_event(
            auction_id,
            "BID_ACCEPTED",
            {
                "winner_team": winning_team_id,
                "final_price": current_bid,
                "player_id": player_id,
            },
            actor_id,
            db,
        )

        # Close the auction record
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE auctions SET status='CLOSED', closed_at=?, winner_team=?, final_price=? WHERE id=?",
            (now, winning_team_id, current_bid, auction_id),
        )

        # Deduct budget from winning team
        await db.execute(
            "UPDATE teams SET budget = budget - ? WHERE id = ?",
            (current_bid, winning_team_id),
        )

        # Create roster assignment
        import uuid
        await db.execute(
            """
            INSERT OR REPLACE INTO roster_assignments (id, team_id, player_id, auction_id, price_paid, assigned_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (str(uuid.uuid4()), winning_team_id, player_id, auction_id, current_bid, now),
        )
        await db.commit()

        # Invalidate cache
        auction_state_cache.pop(auction_id, None)

        # Broadcast auction closed
        await broadcast(
            auction_id,
            {
                "type": "AUCTION_CLOSED",
                "winner_team": winning_team_id,
                "final_price": current_bid,
                "player_id": player_id,
                "auction_id": auction_id,
            },
        )

        return {"success": True, "winner_team": winning_team_id, "final_price": current_bid}


# ── Reject bid ───────────────────────────────────────────────────────────────
async def handle_reject(
    auction_id: str,
    actor_id: str,
    reason: str,
    db: aiosqlite.Connection,
) -> Dict[str, Any]:
    lock = await get_lock(auction_id)
    async with lock:
        state = await get_auction_state(auction_id, db)

        if not state or state.get("status") != "ACTIVE":
            return {"success": False, "reason": "AUCTION_NOT_ACTIVE"}

        await append_event(
            auction_id,
            "BID_REJECTED",
            {"reason": reason, "rejected_bid": state.get("current_bid")},
            actor_id,
            db,
        )

        # Invalidate cache
        auction_state_cache.pop(auction_id, None)

        await broadcast(
            auction_id,
            {
                "type": "BID_REJECTED",
                "reason": reason,
                "auction_id": auction_id,
            },
        )

        return {"success": True}
