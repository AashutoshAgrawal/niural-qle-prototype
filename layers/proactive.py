"""Phase 0 — proactive aging-off notifications.

The system knows every dependent's birthdate. Instead of waiting for the
employee to discover the loss of coverage through a denied claim
(Ayush's $8k case, PRD §2.2), we surface a notification 60 days and again
30 days before the dependent turns 26.

When the employee converts the notification into an action, we create
a real QLE with the state-rule-aware eligible options already computed.
"""
from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models import (
    Dependent, Employee, ProactiveNotification, QLE, AuditLog,
    EVENT_AGING_OFF, STATUS_PROACTIVE_NOTIFIED, STATUS_ELECTION_PENDING,
    STATUS_DOCS_VERIFIED, record_audit,
)
from layers import rules as rules_engine


# Federal aging-off age. States may extend; the rules engine handles that.
DEFAULT_AGING_OFF_AGE = 26
NOTIFICATION_WINDOWS_DAYS = [60, 30]


def _aging_off_date(dep: Dependent) -> datetime | None:
    if not dep.birthdate:
        return None
    return dep.birthdate.replace(year=dep.birthdate.year + DEFAULT_AGING_OFF_AGE)


def scan_for_notifications(db: Session) -> dict:
    """Find dependents whose aging-off date is exactly 60 or 30 days out
    and create a notification if we haven't already."""
    created = []
    today = datetime.utcnow().date()

    deps = db.query(Dependent).filter(Dependent.is_on_coverage == True).all()  # noqa: E712
    for dep in deps:
        if dep.relationship_to_employee != "child":
            continue
        target_date = _aging_off_date(dep)
        if not target_date:
            continue
        days_until = (target_date.date() - today).days
        for window in NOTIFICATION_WINDOWS_DAYS:
            if days_until == window:
                kind = f"aging_off_{window}d"
                existing = (
                    db.query(ProactiveNotification)
                    .filter_by(dependent_id=dep.id, kind=kind)
                    .first()
                )
                if existing:
                    continue
                notif = _create_notification(db, dep, kind, target_date)
                created.append({
                    "id": notif.id, "dependent": dep.name, "kind": kind,
                    "trigger_date": target_date.date().isoformat(),
                })

    db.commit()
    return {"created": len(created), "details": created}


def _create_notification(
    db: Session, dep: Dependent, kind: str, target_date: datetime
) -> ProactiveNotification:
    """Compute eligible options up front so the employee can see them
    without us doing more work when they click in."""
    # Construct a synthetic temporary QLE to feed the rules engine
    employee = dep.employee
    temp_qle = QLE(
        employee_id=employee.id,
        event_type=EVENT_AGING_OFF,
        event_date=target_date,
        election_deadline=target_date + timedelta(days=30),
        dependent_info=dep.conditions_dict(),
        dependent_id=dep.id,
    )
    # Attach without committing so evaluate() sees employee.state
    temp_qle.employee = employee
    rules_result = rules_engine.evaluate(db, temp_qle)

    notif = ProactiveNotification(
        employee_id=employee.id,
        dependent_id=dep.id,
        kind=kind,
        trigger_date=target_date,
        event_type=EVENT_AGING_OFF,
        eligible_options=rules_result["eligible_options"],
        state_rule_applied=rules_result.get("state_rule_applied"),
    )
    db.add(notif)
    db.flush()
    return notif


def convert_to_qle(db: Session, notif: ProactiveNotification) -> QLE:
    """Employee or BenOps acts on a proactive notification — create the
    real QLE. Skips intake (no document) and lands in election_pending
    with options already populated."""
    dep = notif.dependent
    employee = notif.employee
    qle = QLE(
        employee_id=employee.id,
        event_type=EVENT_AGING_OFF,
        event_date=notif.trigger_date,
        election_deadline=notif.trigger_date + timedelta(days=30),
        is_system_triggered=True,
        dependent_info=dep.conditions_dict(),
        dependent_id=dep.id,
        eligible_options=notif.eligible_options,
        status=STATUS_ELECTION_PENDING,
        intake_notes="System-triggered aging-off. No document required.",
    )
    db.add(qle)
    db.flush()
    record_audit(db, qle.id, "submitted", "system",
                 f"Auto-created from {notif.kind} proactive notification for {dep.name}.")
    record_audit(db, qle.id, "docs_verified", "system",
                 "No document required (system-triggered).")
    if notif.state_rule_applied:
        record_audit(db, qle.id, "state_rule_applied", "system",
                     f"State rule applied: {notif.state_rule_applied['state']} — "
                     f"{notif.state_rule_applied.get('citation', '')}")
    record_audit(db, qle.id, "election_pending", "system",
                 f"Eligible options: {[o['action'] for o in (notif.eligible_options or [])]}")

    notif.acknowledged_at = datetime.utcnow()
    notif.converted_qle_id = qle.id
    db.commit()
    return qle
