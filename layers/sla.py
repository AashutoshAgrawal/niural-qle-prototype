"""Layer 4 — SLA timers, escalation, reminders (PRD §8.4 table).

In production these would be jobs run by a scheduler. For the prototype we
expose them as functions the admin can fire from the dashboard to simulate
the passage of time.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models import QLE, record_audit, STATUS_ACTIVE


# PRD §8.4 SLA table
SLA = {
    "doc_validation_auto": timedelta(minutes=5),
    "doc_review_manual": timedelta(hours=4),
    "doc_review_escalate": timedelta(hours=3),  # escalate at 3h, finish by 4h
    "carrier_api_submit": timedelta(hours=1),
    "carrier_api_ack": timedelta(hours=4),
    "carrier_manual_submit": timedelta(days=1),
    "end_to_end": timedelta(days=3),
    "end_to_end_at_risk": timedelta(days=2),
}

# PRD §7.1 — election reminders at 14d, 7d, 2d before close
REMINDER_DAYS = [14, 7, 2]


def send_reminders(db: Session) -> dict:
    """Find QLEs whose deadline crosses 14/7/2 days from now and log reminders.

    A real system would also send email/push. We log to the audit trail.
    """
    sent = []
    now = datetime.utcnow()
    qles = db.query(QLE).filter(QLE.status != STATUS_ACTIVE).all()
    for qle in qles:
        # Compare on calendar-day basis so submillisecond drift between
        # "deadline = now + 14 days" and the later send_reminders call
        # doesn't cause us to miss a threshold.
        days_remaining = (qle.election_deadline.date() - now.date()).days
        for threshold in REMINDER_DAYS:
            if days_remaining == threshold:
                record_audit(db, qle.id, "reminder_sent", "system",
                             f"Election reminder sent: {threshold} days remaining.")
                sent.append({"qle_id": qle.id, "days": threshold,
                             "to": qle.employee.email})
    db.commit()
    return {"reminders_sent": len(sent), "details": sent}


def find_at_risk(db: Session) -> list[dict]:
    """Find QLEs flagged as at-risk (end-to-end > 2 days, not yet active)."""
    now = datetime.utcnow()
    threshold = now - SLA["end_to_end_at_risk"]
    at_risk = []
    qles = db.query(QLE).filter(
        QLE.created_at <= threshold,
        QLE.status != STATUS_ACTIVE,
    ).all()
    for qle in qles:
        age_hours = (now - qle.created_at).total_seconds() / 3600
        at_risk.append({
            "qle_id": qle.id,
            "employee": qle.employee.name,
            "event_type": qle.event_type,
            "status": qle.status,
            "age_hours": age_hours,
            "health": qle.sla_health(),
        })
    return at_risk
