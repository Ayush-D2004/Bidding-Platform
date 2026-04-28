"""
Shared pytest fixtures for the NPL Auction Platform test suite.
"""
import asyncio
import uuid
import pytest
import pytest_asyncio
import aiosqlite

# ── Schema (same as database.py, but in-memory) ──────────────────────────────
SCHEMA = """
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    skill_type TEXT NOT NULL,
    bat_strength INTEGER DEFAULT 0,
    bowl_strength INTEGER DEFAULT 0,
    base_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    budget INTEGER DEFAULT 50000000
);

CREATE TABLE IF NOT EXISTS auctions (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    started_at TEXT,
    closed_at TEXT,
    winner_team TEXT,
    final_price INTEGER,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS auction_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sequence INTEGER NOT NULL,
    auction_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    actor_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roster_assignments (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    player_id TEXT UNIQUE NOT NULL,
    auction_id TEXT NOT NULL,
    price_paid INTEGER NOT NULL,
    assigned_at TEXT NOT NULL,
    FOREIGN KEY (team_id) REFERENCES teams(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
);
"""

SEED_PLAYERS = [
    {"id": "p-1", "name": "Virat Kumar",   "skill_type": "batting",    "bat_strength": 92, "bowl_strength": 30, "base_price": 4_000_000},
    {"id": "p-2", "name": "Bumrah Patel",  "skill_type": "bowling",    "bat_strength": 22, "bowl_strength": 95, "base_price": 4_500_000},
    {"id": "p-3", "name": "Hardik Mehta",  "skill_type": "allrounder", "bat_strength": 85, "bowl_strength": 82, "base_price": 5_000_000},
]

SEED_TEAMS = [
    {"id": "team-1", "name": "Mumbai Mavericks",    "budget": 50_000_000},
    {"id": "team-2", "name": "Delhi Dynamos",        "budget": 50_000_000},
    {"id": "team-3", "name": "Pune Panthers",        "budget": 50_000_000},
    {"id": "team-4", "name": "Chennai Challengers",  "budget": 50_000_000},
]


@pytest_asyncio.fixture
async def db():
    """In-memory SQLite database seeded with test data."""
    conn = await aiosqlite.connect(":memory:")
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    await conn.commit()

    for p in SEED_PLAYERS:
        await conn.execute(
            "INSERT INTO players (id, name, skill_type, bat_strength, bowl_strength, base_price) VALUES (?,?,?,?,?,?)",
            (p["id"], p["name"], p["skill_type"], p["bat_strength"], p["bowl_strength"], p["base_price"]),
        )
    for t in SEED_TEAMS:
        await conn.execute(
            "INSERT INTO teams (id, name, budget) VALUES (?,?,?)",
            (t["id"], t["name"], t["budget"]),
        )
    await conn.commit()
    yield conn
    await conn.close()


@pytest_asyncio.fixture
async def active_auction(db):
    """Create and start an active auction for player p-1, returns (auction_id, db)."""
    auction_id = str(uuid.uuid4())
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    await db.execute(
        "INSERT INTO auctions (id, player_id, status, started_at) VALUES (?, ?, 'ACTIVE', ?)",
        (auction_id, "p-1", now),
    )

    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from events import append_event
    await append_event(
        auction_id, "AUCTION_STARTED",
        {"player_id": "p-1", "player_name": "Virat Kumar", "base_price": 4_000_000},
        "auctioneer", db,
    )
    return auction_id, db
