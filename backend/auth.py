import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from functools import wraps

from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET", "npl-auction-secret-key-2024-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

# Hardcoded users for demo (role, team_id, password)
USERS: Dict[str, Dict[str, Any]] = {
    "auctioneer": {
        "password": "npl2024",
        "role": "AUCTIONEER",
        "team_id": None,
        "display_name": "Chief Auctioneer",
    },
    "mumbai": {
        "password": "npl2024",
        "role": "TEAM_MANAGER",
        "team_id": "team-1",
        "display_name": "Mumbai Mavericks Manager",
    },
    "delhi": {
        "password": "npl2024",
        "role": "TEAM_MANAGER",
        "team_id": "team-2",
        "display_name": "Delhi Dynamos Manager",
    },
    "pune": {
        "password": "npl2024",
        "role": "TEAM_MANAGER",
        "team_id": "team-3",
        "display_name": "Pune Panthers Manager",
    },
    "chennai": {
        "password": "npl2024",
        "role": "TEAM_MANAGER",
        "team_id": "team-4",
        "display_name": "Chennai Challengers Manager",
    },
}


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Dict[str, Any]:
    """Decode and verify JWT. Returns payload dict or raises HTTPException."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {
            "sub": payload.get("sub"),
            "role": payload.get("role"),
            "team_id": payload.get("team_id"),
        }
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = USERS.get(username)
    if not user:
        return None
    if user["password"] != password:
        return None
    return {
        "sub": username,
        "role": user["role"],
        "team_id": user["team_id"],
        "display_name": user["display_name"],
    }


# HTTP Bearer dependency
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> Dict[str, Any]:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return verify_token(credentials.credentials)


def require_auctioneer(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "AUCTIONEER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Auctioneer role required")
    return user


def require_team_manager(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if user.get("role") != "TEAM_MANAGER":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Team Manager role required")
    return user
