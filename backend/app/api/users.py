from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import ADMIN, get_db
from app.models import User

router = APIRouter(prefix="/api/users", tags=["users"])


class RoleIn(BaseModel):
    role: Literal["admin", "engineer", "viewer"]


def _out(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "created_at": u.created_at}


@router.get("")
def list_users(db: Session = Depends(get_db), _=Depends(ADMIN)):
    return [_out(u) for u in db.scalars(select(User).order_by(User.id))]


@router.patch("/{user_id}/role")
def set_role(user_id: int, body: RoleIn, db: Session = Depends(get_db), me: User = Depends(ADMIN)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == me.id and body.role != "admin":
        raise HTTPException(400, "You cannot remove your own admin role")
    u.role = body.role; db.commit()
    return _out(u)


@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db), me: User = Depends(ADMIN)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == me.id:
        raise HTTPException(400, "You cannot delete your own account")
    db.delete(u); db.commit()
