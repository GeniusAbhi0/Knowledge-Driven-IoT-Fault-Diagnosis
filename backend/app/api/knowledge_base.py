from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.deps import ADMIN, ANY_USER, get_db
from app.models import FaultRule, KnowledgeBase
from app.schemas import KnowledgeIn

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


def _out(kb: KnowledgeBase) -> dict:
    return {"id": kb.id, "fault_name": kb.fault_name, "description": kb.description, "symptoms": kb.symptoms,
            "causes": kb.causes, "prevention": kb.prevention,
            "rule": ({"id": r.id, "mode": r.mode, "severity": r.severity, "conditions": r.conditions,
                      "actions": r.actions, "enabled": r.enabled} if (r := next(iter(kb.rules), None)) else None)}


def _apply(kb: KnowledgeBase, body: KnowledgeIn) -> None:
    kb.fault_name, kb.description = body.fault_name, body.description
    kb.symptoms, kb.causes, kb.prevention = body.symptoms, body.causes, body.prevention
    rule = kb.rules[0] if kb.rules else FaultRule()
    rule.mode, rule.severity, rule.actions = body.rule.mode, body.rule.severity, body.rule.actions
    rule.conditions = [c.model_dump() for c in body.rule.conditions]
    if not kb.rules:
        kb.rules.append(rule)


def _get(db: Session, kb_id: int) -> KnowledgeBase:
    kb = db.get(KnowledgeBase, kb_id)
    if not kb:
        raise HTTPException(404, "Fault not found")
    return kb


@router.get("")
def search(q: str = "", severity: str | None = None, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    items = [_out(kb) for kb in db.scalars(select(KnowledgeBase).order_by(KnowledgeBase.fault_name))]
    if q:
        items = [i for i in items if q.lower() in (i["fault_name"] + i["description"]).lower()]
    if severity:
        items = [i for i in items if i["rule"] and i["rule"]["severity"] == severity]
    return items


@router.get("/{kb_id}")
def detail(kb_id: int, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    return _out(_get(db, kb_id))


@router.post("", status_code=201)
def create(body: KnowledgeIn, db: Session = Depends(get_db), _=Depends(ADMIN)):
    kb = KnowledgeBase(); _apply(kb, body); db.add(kb)
    try:
        db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "A fault with that name already exists")
    return _out(kb)


@router.put("/{kb_id}")
def update(kb_id: int, body: KnowledgeIn, db: Session = Depends(get_db), _=Depends(ADMIN)):
    kb = _get(db, kb_id); _apply(kb, body)
    try:
        db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(409, "A fault with that name already exists")
    return _out(kb)


@router.delete("/{kb_id}", status_code=204)
def delete(kb_id: int, db: Session = Depends(get_db), _=Depends(ADMIN)):
    db.delete(_get(db, kb_id)); db.commit()
