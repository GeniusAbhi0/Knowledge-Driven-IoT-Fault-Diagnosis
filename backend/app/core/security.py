from datetime import datetime, timedelta, timezone
import bcrypt, jwt
from app.core import config


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def create_token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=config.ACCESS_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "role": role, "typ": "access", "exp": exp}, config.SECRET_KEY, algorithm="HS256")


def create_reset_token(user_id: int, password_hash: str) -> str:
    """Single-use: the "pw" claim (tail of the current hash) stops matching once the password changes."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=config.RESET_TOKEN_MINUTES)
    return jwt.encode({"sub": str(user_id), "typ": "reset", "pw": password_hash[-12:], "exp": exp},
                      config.SECRET_KEY, algorithm="HS256")


def decode_token(token: str, typ: str = "access") -> dict:
    """Decode and verify a JWT; the token type must match so reset tokens can never act as login tokens."""
    payload = jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])
    if payload.get("typ") != typ:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
