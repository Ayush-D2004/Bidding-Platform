"""
Tests for auth.py — JWT creation, verification, user authentication.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from datetime import timedelta
from fastapi import HTTPException

from auth import (
    create_access_token,
    verify_token,
    authenticate_user,
    get_current_user,
    USERS,
)


# ── Token creation & verification ────────────────────────────────────────────

def test_create_and_verify_token_auctioneer():
    token = create_access_token({"sub": "auctioneer", "role": "AUCTIONEER", "team_id": None})
    payload = verify_token(token)
    assert payload["sub"] == "auctioneer"
    assert payload["role"] == "AUCTIONEER"
    assert payload["team_id"] is None


def test_create_and_verify_token_team_manager():
    token = create_access_token({"sub": "mumbai", "role": "TEAM_MANAGER", "team_id": "team-1"})
    payload = verify_token(token)
    assert payload["sub"] == "mumbai"
    assert payload["role"] == "TEAM_MANAGER"
    assert payload["team_id"] == "team-1"


def test_expired_token_raises_401():
    token = create_access_token(
        {"sub": "auctioneer", "role": "AUCTIONEER", "team_id": None},
        expires_delta=timedelta(seconds=-1),  # already expired
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_token(token)
    assert exc_info.value.status_code == 401


def test_tampered_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        verify_token("this.is.not.a.valid.jwt")
    assert exc_info.value.status_code == 401


def test_token_missing_sub_raises_401():
    # Token without 'sub' claim
    from jose import jwt
    from auth import SECRET_KEY, ALGORITHM
    bad_token = jwt.encode({"role": "AUCTIONEER"}, SECRET_KEY, algorithm=ALGORITHM)
    with pytest.raises(HTTPException) as exc_info:
        verify_token(bad_token)
    assert exc_info.value.status_code == 401


# ── authenticate_user ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("username", list(USERS.keys()))
def test_authenticate_all_valid_users(username):
    user = authenticate_user(username, "npl2026")
    assert user is not None
    assert user["sub"] == username
    assert "role" in user


def test_authenticate_wrong_password():
    result = authenticate_user("auctioneer", "wrongpass")
    assert result is None


def test_authenticate_unknown_user():
    result = authenticate_user("ghost", "npl2026")
    assert result is None


# ── Role-specific checks ──────────────────────────────────────────────────────

def test_auctioneer_role():
    user = authenticate_user("auctioneer", "npl2026")
    assert user["role"] == "AUCTIONEER"
    assert user["team_id"] is None


@pytest.mark.parametrize("username,expected_team", [
    ("mumbai",  "team-1"),
    ("delhi",   "team-2"),
    ("pune",    "team-3"),
    ("chennai", "team-4"),
])
def test_team_manager_roles(username, expected_team):
    user = authenticate_user(username, "npl2026")
    assert user["role"] == "TEAM_MANAGER"
    assert user["team_id"] == expected_team
