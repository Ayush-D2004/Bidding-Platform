"""
Integration tests for main.py API endpoints using FastAPI TestClient (HTTPX async).
Tests cover: /auth/login, /players, /auctions/start, /auctions/active,
             /auctions/{id}/events, /teams, /teams/{id}/roster, /health.
"""
import sys, os
from unittest.mock import MagicMock

# ── Stub out google.generativeai before any backend module imports it ─────────
_genai_mock = MagicMock()
sys.modules.setdefault("google", MagicMock())
sys.modules.setdefault("google.generativeai", _genai_mock)
sys.modules.setdefault("google.generativeai.types", MagicMock())

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import uuid
import pytest
import pytest_asyncio
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport

# Patch database.DB_PATH to use an in-memory DB before importing main
import database
import aiosqlite
from tests.conftest import SCHEMA, SEED_PLAYERS, SEED_TEAMS


# ── Fixture: override get_db to return in-memory connection ──────────────────

_db_conn = None  # module-level shared connection for this test session


@pytest_asyncio.fixture(autouse=True)
async def patch_get_db():
    """Override database.get_db() to return an in-memory database.
    
    We wrap the connection so that .close() calls from production code are no-ops,
    keeping the shared in-memory DB alive for the entire test.
    """
    global _db_conn

    conn = await aiosqlite.connect(":memory:")
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    await conn.commit()

    for p in SEED_PLAYERS:
        await conn.execute(
            "INSERT INTO players (id,name,skill_type,bat_strength,bowl_strength,base_price) VALUES(?,?,?,?,?,?)",
            (p["id"], p["name"], p["skill_type"], p["bat_strength"], p["bowl_strength"], p["base_price"]),
        )
    for t in SEED_TEAMS:
        await conn.execute(
            "INSERT INTO teams (id,name,budget) VALUES(?,?,?)",
            (t["id"], t["name"], t["budget"]),
        )
    await conn.commit()

    # Proxy that swallows close() so the shared connection stays alive
    class NonClosingProxy:
        def __init__(self, real_conn):
            self._c = real_conn

        def __getattr__(self, name):
            return getattr(self._c, name)

        async def close(self):
            pass  # intentional no-op

    proxy = NonClosingProxy(conn)

    async def fake_get_db():
        return proxy

    with patch("database.get_db", side_effect=fake_get_db), \
         patch("main.get_db", side_effect=fake_get_db), \
         patch("events.get_db", side_effect=fake_get_db), \
         patch("bidding.get_db", side_effect=fake_get_db):
        yield proxy

    await conn.close()



@pytest_asyncio.fixture
async def client(patch_get_db):
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


def _auth_header(username="auctioneer", password="npl2026"):
    return {"username": username, "password": password}


async def _login(client, username="auctioneer"):
    resp = await client.post("/auth/login", json={"username": username, "password": "npl2026"})
    return resp.json()["access_token"]


# ══════════════════════════════════════════════════════════════════════════════
# /health
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_health_check(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ══════════════════════════════════════════════════════════════════════════════
# /auth/login
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_login_auctioneer_success(client):
    resp = await client.post("/auth/login", json={"username": "auctioneer", "password": "npl2026"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "AUCTIONEER"


@pytest.mark.asyncio
@pytest.mark.parametrize("username,expected_team", [
    ("mumbai", "team-1"), ("delhi", "team-2"),
    ("pune",   "team-3"), ("chennai", "team-4"),
])
async def test_login_team_managers(client, username, expected_team):
    resp = await client.post("/auth/login", json={"username": username, "password": "npl2026"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "TEAM_MANAGER"
    assert data["team_id"] == expected_team


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client):
    resp = await client.post("/auth/login", json={"username": "auctioneer", "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_user_returns_401(client):
    resp = await client.post("/auth/login", json={"username": "ghost", "password": "npl2026"})
    assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# /players
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_get_players_requires_auth(client):
    resp = await client.get("/players")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_players_returns_list(client):
    token = await _login(client)
    resp = await client.get("/players", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "players" in data
    assert len(data["players"]) == len(SEED_PLAYERS)


@pytest.mark.asyncio
async def test_players_have_required_fields(client):
    token = await _login(client)
    resp = await client.get("/players", headers={"Authorization": f"Bearer {token}"})
    for p in resp.json()["players"]:
        for field in ("id", "name", "skill_type", "base_price", "status"):
            assert field in p


@pytest.mark.asyncio
async def test_get_single_player(client):
    token = await _login(client)
    resp = await client.get("/players/p-1", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == "p-1"


@pytest.mark.asyncio
async def test_get_nonexistent_player_returns_404(client):
    token = await _login(client)
    resp = await client.get("/players/p-999", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# /teams
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_get_teams_returns_all_teams(client):
    token = await _login(client)
    resp = await client.get("/teams", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert len(resp.json()["teams"]) == len(SEED_TEAMS)


@pytest.mark.asyncio
async def test_get_roster_empty_initially(client):
    token = await _login(client)
    resp = await client.get("/teams/team-1/roster", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["players"] == []
    assert data["total_spent"] == 0


@pytest.mark.asyncio
async def test_get_roster_nonexistent_team_returns_404(client):
    token = await _login(client)
    resp = await client.get("/teams/team-99/roster", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# /auctions
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_start_auction_requires_auctioneer_role(client):
    token = await _login(client, "mumbai")  # team manager, not auctioneer
    resp = await client.post(
        "/auctions/start",
        json={"player_id": "p-1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_start_auction_success(client):
    token = await _login(client, "auctioneer")
    resp = await client.post(
        "/auctions/start",
        json={"player_id": "p-1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "auction_id" in data
    assert data["state"]["player_id"] == "p-1"
    assert data["state"]["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_start_auction_nonexistent_player_returns_404(client):
    token = await _login(client, "auctioneer")
    resp = await client.post(
        "/auctions/start",
        json={"player_id": "p-999"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_no_active_auction_returns_null(client):
    token = await _login(client)
    resp = await client.get("/auctions/active", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["auction"] is None


@pytest.mark.asyncio
async def test_get_active_auction_after_start(client):
    token = await _login(client, "auctioneer")
    await client.post("/auctions/start", json={"player_id": "p-1"},
                      headers={"Authorization": f"Bearer {token}"})
    resp = await client.get("/auctions/active", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    auction = resp.json()["auction"]
    assert auction is not None
    assert auction["player_id"] == "p-1"
    assert auction["status"] == "ACTIVE"


@pytest.mark.asyncio
async def test_auction_events_endpoint(client):
    token = await _login(client, "auctioneer")
    start_resp = await client.post(
        "/auctions/start", json={"player_id": "p-1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    auction_id = start_resp.json()["auction_id"]
    resp = await client.get(
        f"/auctions/{auction_id}/events",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) >= 1
    assert events[0]["event_type"] == "AUCTION_STARTED"


@pytest.mark.asyncio
async def test_start_auction_for_already_sold_player_returns_400(client, patch_get_db):
    """A player who has a roster_assignment cannot be auctioned again."""
    db = patch_get_db
    now = "2026-01-01T00:00:00+00:00"
    # Manually insert a roster assignment for p-2
    await db.execute(
        "INSERT INTO auctions (id, player_id, status, started_at) VALUES (?,?,'CLOSED',?)",
        ("old-auction", "p-2", now),
    )
    await db.execute(
        "INSERT INTO roster_assignments (id, team_id, player_id, auction_id, price_paid, assigned_at)"
        " VALUES (?,?,?,?,?,?)",
        (str(uuid.uuid4()), "team-2", "p-2", "old-auction", 5_000_000, now),
    )
    await db.commit()

    token = await _login(client, "auctioneer")
    resp = await client.post(
        "/auctions/start", json={"player_id": "p-2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_starting_new_auction_auto_closes_previous(client):
    """Starting a second auction should auto-close the first one."""
    token = await _login(client, "auctioneer")
    r1 = await client.post("/auctions/start", json={"player_id": "p-1"},
                           headers={"Authorization": f"Bearer {token}"})
    r2 = await client.post("/auctions/start", json={"player_id": "p-2"},
                           headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    # Active auction should now be p-2
    resp = await client.get("/auctions/active", headers={"Authorization": f"Bearer {token}"})
    assert resp.json()["auction"]["player_id"] == "p-2"
