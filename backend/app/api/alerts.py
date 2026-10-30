from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, ENGINEER, get_db
from app.models import Alert, Device

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
def list_alerts(response: Response, unread: bool = False, skip: int = 0, limit: int = 30,
                db: Session = Depends(get_db), _=Depends(ANY_USER)):
    q = select(Alert, Device.name).join(Device)
    if unread:
        q = q.where(Alert.is_read.is_(False))
    response.headers["X-Total-Count"] = str(db.scalar(select(func.count()).select_from(q.subquery())))
    rows = db.execute(q.order_by(Alert.created_at.desc(), Alert.id.desc()).offset(max(skip, 0))
                      .limit(min(max(limit, 1), 200))).all()
    return [{"id": a.id, "device_id": a.device_id, "device": n, "diagnosis_id": a.diagnosis_id, "level": a.level,
             "message": a.message, "is_read": a.is_read, "created_at": a.created_at} for a, n in rows]


@router.post("/read-all")
def read_all(db: Session = Depends(get_db), _=Depends(ENGINEER)):
    n = db.execute(update(Alert).where(Alert.is_read.is_(False)).values(is_read=True)).rowcount
    db.commit()
    return {"updated": n}


@router.patch("/{alert_id}/read")
def mark_read(alert_id: int, db: Session = Depends(get_db), _=Depends(ENGINEER)):
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "Alert not found")
    a.is_read = True; db.commit()
    return {"id": a.id, "is_read": True}
