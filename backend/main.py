import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import aiosqlite
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.middleware.cors import CORSMiddleware

from database import get_db, init_db
from models import LoginRequest, LoginResponse, StartAuctionRequest
from auth import (
    authenticate_user,
    create_access_token,
    verify_token,
    get_current_user,
    require_auctioneer,
)
from events import append_event, get_auction_state, get_auction_events
from bidding import (
    connected_clients,
    broadcast,
    place_bid,
    handle_accept,
    handle_reject,
)
from valuation import calculate_fair_value
from copilot import get_copilot_analysis

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NPL Auction Platform",
    description="National Premier League Cricket Auction API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    print("[Server] NPL Auction Platform started.")


# ── Auth ──────────────────────────────────────────────────────────────────────
@app.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user["sub"], "role": user["role"], "team_id": user["team_id"]})
    return LoginResponse(
        access_token=token,
        role=user["role"],
        team_id=user["team_id"],
        username=user["sub"],
    )


# ── Players ───────────────────────────────────────────────────────────────────
@app.get("/players")
async def list_players(user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        rows = await (
            await db.execute("SELECT * FROM players")
        ).fetchall()

        players = []
        for row in rows:
            p = dict(row)
            # Check if player is sold
            assignment = await (
                await db.execute(
                    "SELECT team_id, price_paid FROM roster_assignments WHERE player_id = ?",
                    (p["id"],),
                )
            ).fetchone()

            if assignment:
                p["status"] = "SOLD"
                p["acquired_by"] = assignment["team_id"]
                p["sale_price"] = assignment["price_paid"]
            else:
                # Check if player is in active auction
                active_auction = await (
                    await db.execute(
                        "SELECT id FROM auctions WHERE player_id = ? AND status = 'ACTIVE'",
                        (p["id"],),
                    )
                ).fetchone()
                p["status"] = "ON_AUCTION" if active_auction else "AVAILABLE"
                p["acquired_by"] = None
                p["sale_price"] = None

            players.append(p)
        return {"players": players}
    finally:
        await db.close()


@app.get("/players/{player_id}")
async def get_player(player_id: str, user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        row = await (
            await db.execute("SELECT * FROM players WHERE id = ?", (player_id,))
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Player not found")
        p = dict(row)
        assignment = await (
            await db.execute(
                "SELECT team_id, price_paid FROM roster_assignments WHERE player_id = ?",
                (p["id"],),
            )
        ).fetchone()
        if assignment:
            p["status"] = "SOLD"
            p["acquired_by"] = assignment["team_id"]
            p["sale_price"] = assignment["price_paid"]
        else:
            p["status"] = "AVAILABLE"
            p["acquired_by"] = None
            p["sale_price"] = None
        return p
    finally:
        await db.close()


# ── Auctions ──────────────────────────────────────────────────────────────────
@app.post("/auctions/start")
async def start_auction(
    req: StartAuctionRequest,
    user: Dict = Depends(require_auctioneer),
):
    db = await get_db()
    try:
        # Ensure player exists
        player_row = await (
            await db.execute("SELECT * FROM players WHERE id = ?", (req.player_id,))
        ).fetchone()
        if not player_row:
            raise HTTPException(status_code=404, detail="Player not found")

        # Ensure player not already sold
        assignment = await (
            await db.execute(
                "SELECT id FROM roster_assignments WHERE player_id = ?", (req.player_id,)
            )
        ).fetchone()
        if assignment:
            raise HTTPException(status_code=400, detail="Player already sold")

        # Close any existing active auction
        await db.execute(
            "UPDATE auctions SET status='CLOSED', closed_at=? WHERE status='ACTIVE'",
            (datetime.now(timezone.utc).isoformat(),),
        )

        # Create new auction
        auction_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "INSERT INTO auctions (id, player_id, status, started_at) VALUES (?, ?, 'ACTIVE', ?)",
            (auction_id, req.player_id, now),
        )
        await db.commit()

        # Append AUCTION_STARTED event
        player = dict(player_row)
        await append_event(
            auction_id,
            "AUCTION_STARTED",
            {
                "player_id": req.player_id,
                "player_name": player["name"],
                "base_price": player["base_price"],
            },
            user["sub"],
            db,
        )

        state = await get_auction_state(auction_id, db)

        # Broadcast to all connected clients across all rooms
        msg = {"type": "AUCTION_STARTED", "auction_id": auction_id, "player": player, "state": state}
        for aid in list(connected_clients.keys()):
            await broadcast(aid, msg)

        return {"auction_id": auction_id, "state": state}
    finally:
        await db.close()


@app.get("/auctions/active")
async def get_active_auction(user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        row = await (
            await db.execute(
                "SELECT id, player_id FROM auctions WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1"
            )
        ).fetchone()
        if not row:
            return {"auction": None}

        auction_id = row["id"]
        state = await get_auction_state(auction_id, db)

        # Enrich with player info
        player_row = await (
            await db.execute("SELECT * FROM players WHERE id = ?", (state["player_id"],))
        ).fetchone()
        if player_row:
            state["player"] = dict(player_row)

        # Compute valuation
        player = state.get("player") or {}
        val = calculate_fair_value(
            player.get("base_price", 0),
            state.get("bid_history", []),
            player.get("skill_type", "batting"),
            state.get("current_bid"),
        )
        state["valuation"] = val

        return {"auction": state}
    finally:
        await db.close()


@app.get("/auctions/{auction_id}/events")
async def get_events(auction_id: str, user: Dict = Depends(get_current_user)):
    events = await get_auction_events(auction_id)
    return {"events": events}


# ── Teams ─────────────────────────────────────────────────────────────────────
@app.get("/teams")
async def list_teams(user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        rows = await (await db.execute("SELECT * FROM teams")).fetchall()
        return {"teams": [dict(r) for r in rows]}
    finally:
        await db.close()


@app.get("/teams/{team_id}/roster")
async def get_roster(team_id: str, user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        team_row = await (
            await db.execute("SELECT * FROM teams WHERE id = ?", (team_id,))
        ).fetchone()
        if not team_row:
            raise HTTPException(status_code=404, detail="Team not found")

        assignments = await (
            await db.execute(
                """
                SELECT ra.player_id, ra.price_paid, ra.assigned_at,
                       p.name as player_name, p.skill_type, p.bat_strength, p.bowl_strength, p.base_price
                FROM roster_assignments ra
                JOIN players p ON ra.player_id = p.id
                WHERE ra.team_id = ?
                ORDER BY ra.assigned_at DESC
                """,
                (team_id,),
            )
        ).fetchall()

        players = [dict(a) for a in assignments]
        total_spent = sum(p["price_paid"] for p in players)
        remaining_budget = dict(team_row)["budget"]

        return {
            "team": dict(team_row),
            "players": players,
            "remaining_budget": remaining_budget,
            "total_spent": total_spent,
        }
    finally:
        await db.close()


@app.get("/teams/{team_id}/valuation")
async def get_team_valuation(team_id: str, user: Dict = Depends(get_current_user)):
    db = await get_db()
    try:
        # Get active auction
        row = await (
            await db.execute("SELECT id, player_id FROM auctions WHERE status='ACTIVE' LIMIT 1")
        ).fetchone()
        if not row:
            return {"valuation": None, "reason": "No active auction"}

        auction_id = row["id"]
        state = await get_auction_state(auction_id, db)
        player_row = await (
            await db.execute("SELECT * FROM players WHERE id = ?", (state["player_id"],))
        ).fetchone()
        player = dict(player_row) if player_row else {}

        val = calculate_fair_value(
            player.get("base_price", 0),
            state.get("bid_history", []),
            player.get("skill_type", "batting"),
            state.get("current_bid"),
        )
        return {"valuation": val, "player": player, "current_bid": state.get("current_bid")}
    finally:
        await db.close()


# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/{auction_id}")
async def auction_ws(
    websocket: WebSocket,
    auction_id: str,
    token: str = Query(...),
):
    # Authenticate
    try:
        user = verify_token(token)
    except HTTPException:
        await websocket.close(code=4001)
        return

    await websocket.accept()

    # Register in room
    connected_clients.setdefault(auction_id, set()).add(websocket)

    db = await get_db()
    try:
        # Send current state on connect
        state = await get_auction_state(auction_id, db)
        if state:
            player_row = await (
                await db.execute("SELECT * FROM players WHERE id = ?", (state.get("player_id", ""),))
            ).fetchone()
            if player_row:
                state["player"] = dict(player_row)
                val = calculate_fair_value(
                    dict(player_row).get("base_price", 0),
                    state.get("bid_history", []),
                    dict(player_row).get("skill_type", "batting"),
                    state.get("current_bid"),
                )
                state["valuation"] = val

        await websocket.send_json({"type": "AUCTION_STATE_SYNC", "state": state})

        # Message loop
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            if msg_type == "PLACE_BID":
                if user.get("role") != "TEAM_MANAGER":
                    await websocket.send_json({"type": "ERROR", "reason": "Not a team manager"})
                    continue
                team_id = user.get("team_id")
                result = await place_bid(auction_id, team_id, msg.get("amount", 0), db)
                await websocket.send_json({"type": "BID_RESULT", **result})

            elif msg_type == "ACCEPT_BID":
                if user.get("role") != "AUCTIONEER":
                    await websocket.send_json({"type": "ERROR", "reason": "Not an auctioneer"})
                    continue
                result = await handle_accept(auction_id, user["sub"], db)
                await websocket.send_json({"type": "ACCEPT_RESULT", **result})

            elif msg_type == "REJECT_BID":
                if user.get("role") != "AUCTIONEER":
                    await websocket.send_json({"type": "ERROR", "reason": "Not an auctioneer"})
                    continue
                result = await handle_reject(auction_id, user["sub"], msg.get("reason", ""), db)
                await websocket.send_json({"type": "REJECT_RESULT", **result})

            elif msg_type == "REQUEST_COPILOT":
                try:
                    state = await get_auction_state(auction_id, db)
                    player_row = await (
                        await db.execute("SELECT * FROM players WHERE id = ?", (state.get("player_id", ""),))
                    ).fetchone()
                    player = dict(player_row) if player_row else {}
                    val = calculate_fair_value(
                        player.get("base_price", 0),
                        state.get("bid_history", []),
                        player.get("skill_type", "batting"),
                        state.get("current_bid"),
                    )
                    analysis = await get_copilot_analysis(
                        player,
                        state.get("current_bid", 0),
                        val["fair_value"],
                    )
                    await websocket.send_json({"type": "COPILOT_RESULT", **analysis})
                except Exception as e:
                    await websocket.send_json({"type": "ERROR", "reason": f"Copilot error: {str(e)}"})

            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected from auction {auction_id}")
    except Exception as e:
        print(f"[WS] Error in auction {auction_id}: {e}")
    finally:
        connected_clients.get(auction_id, set()).discard(websocket)
        await db.close()


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "NPL Auction Platform"}
