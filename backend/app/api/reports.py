import csv, io
from datetime import datetime
from xml.sax.saxutils import escape
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session
from app.api.deps import ANY_USER, get_db
from app.api.diagnosis import fault_query
from app.models import Device, Diagnosis, KnowledgeBase

router = APIRouter(prefix="/api/reports", tags=["reports"])
STYLES = getSampleStyleSheet()
MAX_ROWS = 5000


def _safe(v) -> str:
    """Neutralise spreadsheet formula injection in exported text cells."""
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


def _records(db: Session, **filters) -> list[tuple[Diagnosis, str]]:
    names = {d.id: d.name for d in db.query(Device)}
    return [(f, names.get(f.device_id, "?")) for f in db.scalars(fault_query(**filters).limit(MAX_ROWS))]


def _table(rows: list[list], widths=None) -> Table:
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                           ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTSIZE", (0, 0), (-1, -1), 8),
                           ("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def _pdf(story: list) -> Response:
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, title="Fault Diagnosis Report").build(story)
    return Response(buf.getvalue(), media_type="application/pdf")


def _p(text: str, style="BodyText") -> Paragraph:
    return Paragraph(escape(text), STYLES[style])


@router.get("/faults.csv")
def faults_csv(device_id: int | None = None, severity: str | None = None, status: str | None = None,
               date_from: datetime | None = None, date_to: datetime | None = None,
               db: Session = Depends(get_db), _=Depends(ANY_USER)):
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["id", "device", "fault", "severity", "confidence", "status", "detected_at", "summary", "resolution_notes"])
    for f, dev in _records(db, device_id=device_id, severity=severity, status=status, date_from=date_from, date_to=date_to):
        w.writerow([f.id, _safe(dev), _safe(f.fault_name), f.severity, f.confidence, f.status,
                    f.detected_at.isoformat(), _safe(f.summary), _safe(f.resolution_notes)])
    return Response(out.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="fault-report.csv"'})


@router.get("/faults.pdf")
def faults_pdf(device_id: int | None = None, severity: str | None = None, status: str | None = None,
               date_from: datetime | None = None, date_to: datetime | None = None,
               db: Session = Depends(get_db), _=Depends(ANY_USER)):
    recs = _records(db, device_id=device_id, severity=severity, status=status, date_from=date_from, date_to=date_to)
    rows = [["ID", "Device", "Fault", "Severity", "Conf.", "Status", "Detected"]] + [
        [f.id, dev, f.fault_name, f.severity, f"{f.confidence}%", f.status, f.detected_at.strftime("%Y-%m-%d %H:%M")]
        for f, dev in recs]
    story = [_p("Fault Diagnosis Report", "Title"), _p(f"{len(recs)} record(s)"), Spacer(1, 8)]
    story.append(_table([[Paragraph(escape(str(c)), STYLES["BodyText"]) if i else c for c in r]
                         for i, r in enumerate(rows)]) if recs else _p("No faults match the selected filters."))
    return _pdf(story)


@router.get("/diagnosis/{diagnosis_id}.pdf")
def diagnosis_pdf(diagnosis_id: int, db: Session = Depends(get_db), _=Depends(ANY_USER)):
    f = db.get(Diagnosis, diagnosis_id)
    if not f:
        raise HTTPException(404, "Fault record not found")
    dev, kb = db.get(Device, f.device_id), (db.get(KnowledgeBase, f.kb_id) if f.kb_id else None)
    rule = kb.rules[0] if kb and kb.rules else None
    story = [_p(f"Diagnosis Report: {f.fault_name}", "Title"),
             _p(f"Device: {dev.name} ({dev.type}), location: {dev.location or 'n/a'}"),
             _p(f"Severity: {f.severity.upper()}   Confidence: {f.confidence}%   Status: {f.status}"),
             _p(f"Detected: {f.detected_at:%Y-%m-%d %H:%M:%S} UTC"), _p(f.summary), Spacer(1, 8),
             _p("Sensor readings", "Heading2"),
             _table([["Sensor", "Value"]] + [[k, f"{v:g}"] for k, v in f.readings.items()]),
             _p("Evidence", "Heading2"),
             _table([["Sensor", "Value", "Rule", "Explanation"]] + [
                 [e.sensor_kind, f"{e.value:g}", f"{e.op} {e.threshold:g}", Paragraph(escape(e.explanation), STYLES["BodyText"])]
                 for e in f.evidence], [70, 50, 60, 300])]
    for title, items in (("Possible causes", kb.causes if kb else []), ("Recommended actions", rule.actions if rule else []),
                         ("Preventive measures", kb.prevention if kb else [])):
        if items:
            story += [_p(title, "Heading2")] + [_p(f"{i}. {t}") for i, t in enumerate(items, 1)]
    if f.resolution_notes:
        story += [_p("Resolution notes", "Heading2"), _p(f.resolution_notes)]
    return _pdf(story)
