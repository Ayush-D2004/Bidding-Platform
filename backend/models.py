from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from enum import Enum


# --- Enums ---
class SkillType(str, Enum):
    BATTING = "batting"
    BOWLING = "bowling"
    ALLROUNDER = "allrounder"


class AuctionStatus(str, Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"


class EventType(str, Enum):
    AUCTION_STARTED = "AUCTION_STARTED"
    BID_PLACED = "BID_PLACED"
    BID_ACCEPTED = "BID_ACCEPTED"
    BID_REJECTED = "BID_REJECTED"
    AUCTION_CLOSED = "AUCTION_CLOSED"


class Role(str, Enum):
    AUCTIONEER = "AUCTIONEER"
    TEAM_MANAGER = "TEAM_MANAGER"


class Verdict(str, Enum):
    UNDERVALUED = "UNDERVALUED"
    FAIR_VALUE = "FAIR_VALUE"
    OVERVALUED = "OVERVALUED"


class Recommendation(str, Enum):
    ACCEPT = "ACCEPT"
    HOLD = "HOLD"
    REJECT = "REJECT"


# --- Auth Models ---
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    team_id: Optional[str] = None
    username: str


class TokenData(BaseModel):
    sub: str
    role: str
    team_id: Optional[str] = None


# --- Player Models ---
class Player(BaseModel):
    id: str
    name: str
    skill_type: str
    bat_strength: int
    bowl_strength: int
    base_price: int
    status: Optional[str] = "AVAILABLE"
    acquired_by: Optional[str] = None
    sale_price: Optional[int] = None


# --- Team Models ---
class Team(BaseModel):
    id: str
    name: str
    budget: int


class RosterPlayer(BaseModel):
    player_id: str
    player_name: str
    skill_type: str
    price_paid: int
    assigned_at: str


class TeamRoster(BaseModel):
    team: Team
    players: List[RosterPlayer]
    remaining_budget: int
    total_spent: int


# --- Auction Models ---
class AuctionState(BaseModel):
    auction_id: str
    player_id: str
    player: Optional[Player] = None
    status: str
    current_bid: int
    current_bidder: Optional[str] = None
    started_at: Optional[str] = None
    bid_history: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []


class StartAuctionRequest(BaseModel):
    player_id: str


class AuctionEvent(BaseModel):
    id: int
    sequence: int
    auction_id: str
    event_type: str
    payload: str
    occurred_at: str
    actor_id: str


# --- Valuation Models ---
class ValuationResult(BaseModel):
    fair_value: int
    spread_pct: float
    base_price: int
    current_bid: int
    demand_component: int
    skill_bonus: int


# --- Copilot Models ---
class CopilotAnalysis(BaseModel):
    verdict: str
    confidence: float
    reasoning: str
    recommendation: str


# --- WebSocket Message Models ---
class WSMessage(BaseModel):
    type: str
    data: Optional[Dict[str, Any]] = None


class PlaceBidMessage(BaseModel):
    type: str = "PLACE_BID"
    amount: int


class AcceptBidMessage(BaseModel):
    type: str = "ACCEPT_BID"


class RejectBidMessage(BaseModel):
    type: str = "REJECT_BID"
    reason: Optional[str] = ""


class RequestCopilotMessage(BaseModel):
    type: str = "REQUEST_COPILOT"
