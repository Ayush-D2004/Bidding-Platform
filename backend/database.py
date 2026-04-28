import aiosqlite
import os
import json
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "npl_auction.db")

SCHEMA = """
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
    {"id": "p-1",  "name": "Virat Kumar",     "skill_type": "batting",    "bat_strength": 92, "bowl_strength": 30, "base_price": 4000000},
    {"id": "p-2",  "name": "Rohit Singh",      "skill_type": "batting",    "bat_strength": 88, "bowl_strength": 25, "base_price": 3500000},
    {"id": "p-3",  "name": "Bumrah Patel",     "skill_type": "bowling",    "bat_strength": 22, "bowl_strength": 95, "base_price": 4500000},
    {"id": "p-4",  "name": "Ashwin Reddy",     "skill_type": "bowling",    "bat_strength": 35, "bowl_strength": 88, "base_price": 3000000},
    {"id": "p-5",  "name": "Hardik Mehta",     "skill_type": "allrounder", "bat_strength": 85, "bowl_strength": 82, "base_price": 5000000},
    {"id": "p-6",  "name": "Jadeja Sharma",    "skill_type": "allrounder", "bat_strength": 82, "bowl_strength": 80, "base_price": 3800000},
    {"id": "p-7",  "name": "Suryakumar Das",   "skill_type": "batting",    "bat_strength": 90, "bowl_strength": 20, "base_price": 4200000},
    {"id": "p-8",  "name": "Mohammed Ali",     "skill_type": "bowling",    "bat_strength": 20, "bowl_strength": 91, "base_price": 4000000},
    {"id": "p-9",  "name": "Rishabh Nair",     "skill_type": "batting",    "bat_strength": 86, "bowl_strength": 15, "base_price": 3200000},
    {"id": "p-10", "name": "Ravindra Pillai",  "skill_type": "allrounder", "bat_strength": 78, "bowl_strength": 75, "base_price": 2800000},
    {"id": "p-11", "name": "Shami Gupta",      "skill_type": "bowling",    "bat_strength": 18, "bowl_strength": 89, "base_price": 3600000},
    {"id": "p-12", "name": "KL Iyer",          "skill_type": "batting",    "bat_strength": 84, "bowl_strength": 12, "base_price": 3000000},
    {"id": "p-13", "name": "Deepak Chauhan",   "skill_type": "allrounder", "bat_strength": 80, "bowl_strength": 78, "base_price": 3400000},
    {"id": "p-14", "name": "Yuzvendra Singh",  "skill_type": "bowling",    "bat_strength": 28, "bowl_strength": 87, "base_price": 3300000},
    {"id": "p-15", "name": "Shreyas Kumar",    "skill_type": "batting",    "bat_strength": 83, "bowl_strength": 22, "base_price": 2900000},
]

SEED_TEAMS = [
    {"id": "team-1", "name": "Mumbai Mavericks",  "budget": 50000000},
    {"id": "team-2", "name": "Delhi Dynamos",     "budget": 50000000},
    {"id": "team-3", "name": "Pune Panthers",     "budget": 50000000},
    {"id": "team-4", "name": "Chennai Challengers","budget": 50000000},
]


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.executescript(SCHEMA)
        await db.commit()

        # Seed players
        existing = await (await db.execute("SELECT COUNT(*) FROM players")).fetchone()
        if existing[0] == 0:
            for p in SEED_PLAYERS:
                await db.execute(
                    "INSERT OR IGNORE INTO players (id, name, skill_type, bat_strength, bowl_strength, base_price) VALUES (?,?,?,?,?,?)",
                    (p["id"], p["name"], p["skill_type"], p["bat_strength"], p["bowl_strength"], p["base_price"])
                )

        # Seed teams
        existing_teams = await (await db.execute("SELECT COUNT(*) FROM teams")).fetchone()
        if existing_teams[0] == 0:
            for t in SEED_TEAMS:
                await db.execute(
                    "INSERT OR IGNORE INTO teams (id, name, budget) VALUES (?,?,?)",
                    (t["id"], t["name"], t["budget"])
                )

        await db.commit()
    print(f"[DB] Initialized at {DB_PATH}")
