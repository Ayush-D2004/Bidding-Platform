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
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

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

| Username     | Password   | Role                        |
| ------------ | ---------- | --------------------------- |
| `auctioneer` | `npl@2026` | Chief Auctioneer            |
| `mumbai`     | `npl@2026` | Mumbai Mavericks Manager    |
| `delhi`      | `npl@2026` | Delhi Dynamos Manager       |
| `pune`       | `npl@2026` | Pune Panthers Manager       |
| `chennai`    | `npl@2026` | Chennai Challengers Manager |

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
- Roster tab with acquired players and per-player stats

### System

- Event sourcing: all state derived by replaying `auction_events` — never mutated
- Per-auction `asyncio.Lock` — race-condition-free bidding for concurrent managers
- Auto-reconnecting WebSocket with exponential backoff in the frontend
- CORS-open for local development

---

## Project Structure

```
npl-auction/
├── backend/
│   ├── main.py           # FastAPI app, REST + WebSocket endpoints
│   ├── database.py       # aiosqlite setup, schema, seed data
│   ├── models.py         # Pydantic request/response models
│   ├── events.py         # Event sourcing: append + replay
│   ├── bidding.py        # Place bid, accept, reject (asyncio.Lock)
│   ├── valuation.py      # Fair value: Vt = base·e^(k·Δt) + skill bonus
│   ├── copilot.py        # Gemini SDK copilot with fallback
│   ├── auth.py           # JWT creation/verification, RBAC
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── store/auctionStore.js    # Zustand + WebSocket
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── AuctioneerView.jsx
│   │   │   └── ManagerView.jsx
│   │   ├── components/
│   │   │   ├── PlayerCard.jsx
│   │   │   ├── BidVelocityChart.jsx
│   │   │   ├── TeamSynergyGraph.jsx
│   │   │   ├── ValuationSpread.jsx
│   │   │   ├── CopilotPanel.jsx
│   │   │   └── AuctionLog.jsx
│   │   └── hooks/useWebSocket.js
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

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
- `BID_RESULT` — bid success/failure (to bidder only)
