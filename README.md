# NPL Bidding Platform

> **Nagpur Premier League** — Real-time cricket player auction with AI-powered copilot

## Tech Stack

| Layer      | Technology                                                  |
| ---------- | ----------------------------------------------------------- |
| Backend    | Python 3.11 · FastAPI · WebSockets · aiosqlite (SQLite)     |
| AI Copilot | Google Gemini 2.5 Flash (rule-based fallback if key absent) |
| Frontend   | React 18 · Vite · Tailwind CSS · Zustand · Recharts · D3.js |
| Auth       | JWT (python-jose) · 5 hardcoded demo users                  |
| Real-time  | Native WebSocket broadcast (no Redis)                       |

---

## ⚡ Single-Command Startup

### Terminal 1 — Backend

```bash
cd backend
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
# The database (npl_auction.db) initializes and seeds automatically on first run
uvicorn main.app --reload --port 8000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## 🧪 Testing

The project includes a comprehensive test suite (89+ tests) covering auth, valuation, events, bidding logic, and API integration.

```bash
cd backend
# Activate your venv first
python -m pytest tests/ -v
```

---

## Environment Variables

Create `backend/.env` (or export in your shell):

```env
GEMINI_API_KEY=your_gemini_api_key_here   # optional — falls back to rule-based analysis
JWT_SECRET=npl-auction-secret-key-2026    # change in production
```

The app runs fine **without** a Gemini API key — the copilot uses deterministic rule-based analysis as a fallback.

---

## Demo Users

| Username     | Password    | Role                        |
| ------------ | ----------- | --------------------------- |
| `auctioneer` | `npl2026`    | Chief Auctioneer            |
| `mumbai`     | `npl2026`    | Mumbai Mavericks Manager    |
| `delhi`      | `npl2026`    | Delhi Dynamos Manager       |
| `pune`       | `npl2026`    | Pune Panthers Manager       |
| `chennai`    | `npl2026`    | Chennai Challengers Manager |

---

## Features

### Auctioneer View

- Start auctions for any of 15 seeded players
- Accept or reject bids with optional reason
- **AI Copilot** (Gemini) — instant UNDERVALUED / FAIR_VALUE / OVERVALUED verdict with confidence score
- **Bid Velocity Chart** — 60-second sliding window Area + Line chart (Recharts)
- Immutable event log (event-sourced audit trail)

### Manager View

- **Quick-bid buttons** (+₹5L / +₹10L / +₹20L / +₹50L) + custom amount
- **Valuation Spread** bar — Base Price → Fair Value → Current Bid with overpay warning
- **Budget Tracker** — colour-coded bar (green → amber → red) with rival team budgets
- **Team Synergy Graph** — D3 force-directed graph; edge thickness = skill complementarity; dashed nodes = missing roles
- **Roster Tab** — Real-time tracking of acquired players and per-player valuation stats.

### Validation & Logic

- **Self-Bidding Protection** — Prevents teams from bidding against their own active leading bid.
- **Dynamic Player Pool** — Sold players are automatically filtered out from the auction initiation list to prevent duplicate auctions.
- **Concurrent Safety** — Per-auction `asyncio.Lock` ensures bid processing is atomic and race-condition free.
- **Event-Sourced State** — All auction states are derived by replaying the immutable `auction_events` log.

### System

- Event sourcing: all state derived by replaying `auction_events` — never mutated
- Per-auction `asyncio.Lock` — race-condition-free bidding for concurrent managers
- Auto-reconnecting WebSocket with exponential backoff in the frontend
- CORS-open for local development

---

## API Reference

| Method | Endpoint                  | Auth       | Description                    |
| ------ | ------------------------- | ---------- | ------------------------------ |
| POST   | `/auth/login`             | —          | Get JWT token                  |
| GET    | `/players`                | Any        | List all players with status   |
| GET    | `/players/{id}`           | Any        | Single player details          |
| POST   | `/auctions/start`         | Auctioneer | Start auction for a player     |
| GET    | `/auctions/active`        | Any        | Current active auction state   |
| GET    | `/auctions/{id}/events`   | Any        | Full event log (audit trail)   |
| GET    | `/teams`                  | Any        | All teams + budgets            |
| GET    | `/teams/{id}/roster`      | Any        | Team roster + remaining budget |
| GET    | `/teams/{id}/valuation`   | Any        | Fair value for active player   |
| WS     | `/ws/{auction_id}?token=` | Any        | Real-time auction room         |

### WebSocket Message Types

**Client → Server:**

- `{"type":"PLACE_BID","amount":4500000}` — (Manager) place a bid
- `{"type":"ACCEPT_BID"}` — (Auctioneer) accept current highest bid
- `{"type":"REJECT_BID","reason":"Too low"}` — (Auctioneer) reject bid
- `{"type":"REQUEST_COPILOT"}` — (Auctioneer) trigger AI analysis
- `{"type":"PING"}` — keepalive

**Server → Client:**

- `AUCTION_STATE_SYNC` — full state on connect
- `AUCTION_STARTED` — new auction opened
- `BID_PLACED` — new bid broadcast to all
- `AUCTION_CLOSED` — winner + final price
- `BID_REJECTED` — rejection broadcast
- `COPILOT_RESULT` — AI analysis result
- `BID_RESULT` — success/failure (includes error codes like `ALREADY_HIGHEST_BIDDER`, `INSUFFICIENT_BUDGET`, etc.)
