import logging

import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, get_db
from app.core import config
from app.core.security import create_reset_token, create_token, decode_token, hash_password, verify_password
from app.models import User
from app.schemas import ForgotIn, LoginIn, RegisterIn, ResetIn

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("iot.auth")


def _user_out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role}


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    first = db.scalar(select(func.count(User.id))) == 0  # first account bootstraps as admin
    user = User(email=email, name=body.name, password_hash=hash_password(body.password),
                role="admin" if first else "viewer")
    db.add(user); db.commit()
    return _user_out(user)


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return {"access_token": create_token(user.id, user.role), "token_type": "bearer", "user": _user_out(user)}


@router.get("/me")
def me(user: User = Depends(ANY_USER)):
    return _user_out(user)


@router.post("/forgot-password", status_code=202)
def forgot_password(body: ForgotIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user:  # No SMTP transport is bundled: the reset link is logged for the operator (dev/demo).
        log.info("PASSWORD RESET for %s: %s/reset-password?token=%s", user.email, config.FRONTEND_URL, create_reset_token(user.id, user.password_hash))
    return {"detail": "If that email is registered, a reset link has been issued."}  # same reply either way


@router.post("/reset-password")
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.token, typ="reset")
        user = db.get(User, int(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        user = None
    if not user or payload.get("pw") != user.password_hash[-12:]:
        raise HTTPException(400, "Reset link is invalid or has expired")
    user.password_hash = hash_password(body.new_password); db.commit()
    return {"detail": "Password updated"}
