"""JSON API surface for the Next.js frontend (v2).

v2 adds:
  - multi-carrier serialisation (per-line carrier tracks)
  - coverage verification endpoint + status field
  - proactive notifications endpoints (scan / list / convert / dismiss)
  - employee dispute endpoint
  - HR admin action endpoints (resend, approve-late, escalate)
"""
from __future__ import annotations
import csv
import io
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import get_db
from models import (
    Organization, Employee, EmployeeCoverage, Dependent,
    ProactiveNotification, QLE, Document, StateRule,
    CarrierTransaction, TaskCard, AuditLog, QLEDispute,
    EVENT_LABEL, STATUS_LABEL, EVENT_AGING_OFF,
    STATUS_SUBMITTED, STATUS_DOCS_VERIFIED, STATUS_ELECTION_PENDING,
    STATUS_ELECTION_CONFIRMED, STATUS_CARRIER_IN_PROGRESS,
    STATUS_COVERAGE_VERIFYING, STATUS_ACTIVE, STATUS_REJECTED,
    STATUS_BENOPS_REVIEW, STATUS_DISPUTED, STATUS_PROACTIVE_NOTIFIED,
    LINE_LABEL, VERIFY_PENDING, VERIFY_VERIFIED, VERIFY_FAILED,
    record_audit,
)
from layers import intake, rules, carriers, sla, proactive


router = APIRouter(prefix="/api", tags=["api"])


# ---------------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------------

def s_coverage(c: EmployeeCoverage) -> dict:
    return {
        "id": c.id, "line": c.line, "line_label": LINE_LABEL.get(c.line, c.line),
        "carrier": c.carrier, "plan_type": c.plan_type, "active": c.active,
    }


def s_dependent(d: Dependent) -> dict:
    return {
        "id": d.id, "name": d.name, "relationship": d.relationship_to_employee,
        "birthdate": d.birthdate.isoformat() if d.birthdate else None,
        "age": d.age, "is_on_coverage": d.is_on_coverage,
        "unmarried": d.unmarried, "nj_resident": d.nj_resident,
        "ny_resident": d.ny_resident, "no_other_coverage": d.no_other_coverage,
    }


def s_employee(e: Employee) -> dict:
    return {
        "id": e.id, "name": e.name, "email": e.email, "state": e.state,
        "organization_id": e.organization_id,
        "organization": {"id": e.organization.id, "name": e.organization.name} if e.organization else None,
        "coverages": [s_coverage(c) for c in e.coverages],
        "dependents": [s_dependent(d) for d in e.dependents],
        # Compat with v1 frontend keys
        "carrier": e.primary_carrier,
        "plan_type": e.primary_plan,
    }


def s_org(o: Organization, db: Session) -> dict:
    qle_count = db.query(QLE).join(Employee).filter(Employee.organization_id == o.id).count()
    return {
        "id": o.id, "name": o.name,
        "employee_count": len(o.employees), "qle_count": qle_count,
    }


def s_document(d: Document) -> dict:
    return {
        "id": d.id, "filename": d.filename,
        "declared_type": d.declared_type, "classified_type": d.classified_type,
        "confidence": d.confidence, "quality_issue": d.quality_issue,
        "routing_decision": d.routing_decision, "notes": d.notes,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def s_txn(t: CarrierTransaction) -> dict:
    return {
        "id": t.id, "qle_id": t.qle_id, "carrier": t.carrier,
        "coverage_line": t.coverage_line,
        "coverage_line_label": LINE_LABEL.get(t.coverage_line, t.coverage_line),
        "transaction_id": t.transaction_id, "status": t.status,
        "submitted_at": t.submitted_at.isoformat() if t.submitted_at else None,
        "acked_at": t.acked_at.isoformat() if t.acked_at else None,
        "retry_count": t.retry_count, "error": t.error, "payload": t.payload,
        "verification_status": t.verification_status,
        "verified_at": t.verified_at.isoformat() if t.verified_at else None,
        "verification_notes": t.verification_notes,
    }


def s_task(t: TaskCard) -> dict:
    return {
        "id": t.id, "qle_id": t.qle_id, "carrier": t.carrier,
        "coverage_line": t.coverage_line,
        "coverage_line_label": LINE_LABEL.get(t.coverage_line, t.coverage_line),
        "portal_url": t.portal_url, "checklist": t.checklist,
        "prefilled_data": t.prefilled_data, "drafted_email": t.drafted_email,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
        "rescheduled_to": t.rescheduled_to.isoformat() if t.rescheduled_to else None,
        "verification_status": t.verification_status,
        "verification_due": t.verification_due.isoformat() if t.verification_due else None,
        "verified_at": t.verified_at.isoformat() if t.verified_at else None,
        "verification_notes": t.verification_notes,
    }


def s_audit(a: AuditLog) -> dict:
    return {"id": a.id, "action": a.action, "actor": a.actor,
            "details": a.details,
            "timestamp": a.timestamp.isoformat() if a.timestamp else None}


def s_dispute(d: QLEDispute) -> dict:
    return {
        "id": d.id, "qle_id": d.qle_id, "employee_reason": d.employee_reason,
        "status": d.status, "resolution_notes": d.resolution_notes,
        "resolved_by": d.resolved_by,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
    }


def s_qle(q: QLE, include_audit: bool = False) -> dict:
    out = {
        "id": q.id, "employee_id": q.employee_id,
        "employee": s_employee(q.employee) if q.employee else None,
        "event_type": q.event_type,
        "event_type_label": EVENT_LABEL.get(q.event_type, q.event_type),
        "event_date": q.event_date.isoformat() if q.event_date else None,
        "status": q.status, "status_label": STATUS_LABEL.get(q.status, q.status),
        "confidence_score": q.confidence_score, "intake_notes": q.intake_notes,
        "election_deadline": q.election_deadline.isoformat() if q.election_deadline else None,
        "election_selection": q.election_selection,
        "eligible_options": q.eligible_options,
        "flagged_late": q.flagged_late,
        "is_system_triggered": q.is_system_triggered,
        "dependent_info": q.dependent_info,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "sla_health": q.sla_health(),
        "documents": [s_document(d) for d in q.documents],
        "carrier_transactions": [s_txn(t) for t in q.carrier_txns],
        "task_cards": [s_task(t) for t in q.task_cards],
        "disputes": [s_dispute(d) for d in q.disputes],
        "all_lines_verified": q.all_lines_verified(),
    }
    if include_audit:
        out["audit"] = [s_audit(a) for a in q.audit]
    return out


def s_notif(n: ProactiveNotification) -> dict:
    return {
        "id": n.id, "kind": n.kind,
        "trigger_date": n.trigger_date.isoformat() if n.trigger_date else None,
        "event_type": n.event_type,
        "eligible_options": n.eligible_options,
        "state_rule_applied": n.state_rule_applied,
        "acknowledged_at": n.acknowledged_at.isoformat() if n.acknowledged_at else None,
        "converted_qle_id": n.converted_qle_id,
        "employee_id": n.employee_id, "dependent_id": n.dependent_id,
        "dependent": s_dependent(n.dependent) if n.dependent else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def s_rule(r: StateRule) -> dict:
    return {
        "id": r.id, "state": r.state, "event_type": r.event_type,
        "conditions": r.conditions, "eligible_actions": r.eligible_actions,
        "description": r.description, "citation": r.citation, "active": r.active,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Status / seed
# ---------------------------------------------------------------------------

@router.get("/status")
def api_status(db: Session = Depends(get_db)):
    qle_count = db.query(QLE).count()
    return {
        "seeded": qle_count > 0, "qle_count": qle_count,
        "org_count": db.query(Organization).count(),
        "employee_count": db.query(Employee).count(),
    }


@router.post("/seed")
def api_seed(reset: bool = False, db: Session = Depends(get_db)):
    from seed import seed_all
    seed_all(db, reset=reset)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Organisations + employees
# ---------------------------------------------------------------------------

@router.get("/organizations")
def list_orgs(db: Session = Depends(get_db)):
    return [s_org(o, db) for o in db.query(Organization).all()]


@router.get("/organizations/{org_id}")
def get_org(org_id: int, db: Session = Depends(get_db)):
    org = db.query(Organization).get(org_id)
    if not org:
        raise HTTPException(404)
    qles = (db.query(QLE).join(Employee).filter(Employee.organization_id == org_id)
            .order_by(QLE.created_at.desc()).all())
    counts = {"green": 0, "yellow": 0, "red": 0}
    by_status: dict[str, int] = {}
    for q in qles:
        counts[q.sla_health()] += 1
        by_status[q.status] = by_status.get(q.status, 0) + 1
    return {
        **s_org(org, db),
        "employees": [s_employee(e) for e in org.employees],
        "qles": [s_qle(q) for q in qles],
        "sla_counts": counts, "status_counts": by_status,
    }


@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    return [s_employee(e) for e in db.query(Employee).all()]


@router.get("/employees/{employee_id}")
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    e = db.query(Employee).get(employee_id)
    if not e:
        raise HTTPException(404)
    qles = db.query(QLE).filter_by(employee_id=employee_id).order_by(QLE.created_at.desc()).all()
    notifs = (db.query(ProactiveNotification)
              .filter_by(employee_id=employee_id, acknowledged_at=None)
              .order_by(ProactiveNotification.trigger_date).all())
    return {
        **s_employee(e),
        "qles": [s_qle(q) for q in qles],
        "proactive_notifications": [s_notif(n) for n in notifs],
    }


# ---------------------------------------------------------------------------
# QLE submission and lifecycle
# ---------------------------------------------------------------------------

class SubmitQLE(BaseModel):
    event_type: str
    event_date: str
    filename: str = ""
    dependent_info: Optional[dict] = None


@router.post("/employees/{employee_id}/qles")
def submit_qle(employee_id: int, body: SubmitQLE, db: Session = Depends(get_db)):
    employee = db.query(Employee).get(employee_id)
    if not employee:
        raise HTTPException(404)
    try:
        event_dt = datetime.fromisoformat(body.event_date)
    except ValueError:
        raise HTTPException(400, "Invalid event date")
    err = intake.validate_form(body.event_type, event_dt, body.filename, file_size=1024)
    if err:
        raise HTTPException(400, err)

    qle = QLE(
        employee_id=employee_id, event_type=body.event_type, event_date=event_dt,
        election_deadline=event_dt + timedelta(days=30),
        dependent_info=body.dependent_info, status=STATUS_SUBMITTED,
    )
    db.add(qle)
    db.flush()
    record_audit(db, qle.id, "submitted", "employee",
                 f"{employee.name} submitted {body.event_type} for {event_dt.date()}.")

    intake_result = intake.run_intake(body.event_type, event_dt, body.filename)
    doc = Document(
        qle_id=qle.id, filename=body.filename, declared_type=body.event_type,
        classified_type=intake_result.classified_type,
        extracted_date=intake_result.extracted_date,
        confidence=intake_result.confidence,
        quality_issue=intake_result.quality_issue,
        routing_decision=intake_result.routing, notes=intake_result.notes,
    )
    db.add(doc)
    qle.confidence_score = intake_result.confidence
    qle.intake_notes = intake_result.notes
    record_audit(db, qle.id, "intake_complete", "system",
                 f"Confidence {intake_result.confidence:.2f}, routing={intake_result.routing}.")

    if intake_result.routing == "auto_approve":
        _advance_to_election(db, qle)
    elif intake_result.routing == "benops_review":
        qle.status = STATUS_BENOPS_REVIEW
        record_audit(db, qle.id, "queued_for_review", "system", "Medium confidence — BenOps to review.")
    else:
        qle.status = STATUS_REJECTED
        record_audit(db, qle.id, "rejected_at_intake", "system",
                     "Document rejected. Employee notified to resubmit.")
    db.commit()
    return s_qle(qle, include_audit=True)


@router.get("/qles/{qle_id}")
def get_qle(qle_id: int, db: Session = Depends(get_db)):
    q = db.query(QLE).get(qle_id)
    if not q:
        raise HTTPException(404)
    return s_qle(q, include_audit=True)


@router.get("/qles")
def list_qles(db: Session = Depends(get_db)):
    return [s_qle(q) for q in db.query(QLE).order_by(QLE.created_at.desc()).all()]


class Election(BaseModel):
    choice: str


@router.post("/qles/{qle_id}/elect")
def elect(qle_id: int, body: Election, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle or qle.status != STATUS_ELECTION_PENDING:
        raise HTTPException(400, "QLE not in election_pending state")
    qle.election_selection = {"choice": body.choice, "elected_at": datetime.utcnow().isoformat()}
    qle.status = STATUS_ELECTION_CONFIRMED
    record_audit(db, qle.id, "election_confirmed", "employee", f"Employee chose: {body.choice}.")
    carriers.dispatch_election(db, qle)
    db.commit()
    return s_qle(qle, include_audit=True)


class Resubmit(BaseModel):
    filename: str


@router.post("/qles/{qle_id}/resubmit")
def resubmit(qle_id: int, body: Resubmit, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    intake_result = intake.run_intake(qle.event_type, qle.event_date, body.filename)
    doc = Document(
        qle_id=qle.id, filename=body.filename, declared_type=qle.event_type,
        classified_type=intake_result.classified_type,
        confidence=intake_result.confidence,
        quality_issue=intake_result.quality_issue,
        routing_decision=intake_result.routing, notes=intake_result.notes,
    )
    db.add(doc)
    qle.confidence_score = intake_result.confidence
    qle.intake_notes = intake_result.notes
    record_audit(db, qle.id, "resubmitted", "employee",
                 f"New document: {body.filename}. {intake_result.notes}")
    if intake_result.routing == "auto_approve":
        _advance_to_election(db, qle)
    elif intake_result.routing == "benops_review":
        qle.status = STATUS_BENOPS_REVIEW
    else:
        qle.status = STATUS_REJECTED
    db.commit()
    return s_qle(qle, include_audit=True)


# ---------------------------------------------------------------------------
# Disputes (employee → BenOps)
# ---------------------------------------------------------------------------

class FileDispute(BaseModel):
    reason: str


@router.post("/qles/{qle_id}/dispute")
def file_dispute(qle_id: int, body: FileDispute, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    dispute = QLEDispute(qle_id=qle.id, employee_reason=body.reason)
    db.add(dispute)
    qle.status = STATUS_DISPUTED
    record_audit(db, qle.id, "dispute_filed", "employee",
                 f"Employee disputes the rules engine output: {body.reason}")
    db.commit()
    return s_dispute(dispute)


class ResolveDispute(BaseModel):
    actor: str
    upheld: bool  # True = engine was right, False = override the engine
    notes: str = ""
    new_options: Optional[list] = None  # if overriding, the new option set


@router.post("/disputes/{dispute_id}/resolve")
def resolve_dispute(dispute_id: int, body: ResolveDispute, db: Session = Depends(get_db)):
    dispute = db.query(QLEDispute).get(dispute_id)
    if not dispute:
        raise HTTPException(404)
    dispute.resolved_by = f"benops:{body.actor}"
    dispute.resolved_at = datetime.utcnow()
    dispute.resolution_notes = body.notes
    qle = dispute.qle
    if body.upheld:
        dispute.status = "resolved_upheld"
        qle.status = STATUS_ELECTION_PENDING
        record_audit(db, qle.id, "dispute_upheld", dispute.resolved_by,
                     f"Rules engine output confirmed. {body.notes}")
    else:
        dispute.status = "resolved_overridden"
        if body.new_options:
            qle.eligible_options = body.new_options
        qle.status = STATUS_ELECTION_PENDING
        record_audit(db, qle.id, "dispute_overridden", dispute.resolved_by,
                     f"Rules engine overridden. {body.notes}")
    db.commit()
    return s_dispute(dispute)


# ---------------------------------------------------------------------------
# Proactive notifications
# ---------------------------------------------------------------------------

@router.post("/proactive/scan")
def proactive_scan(db: Session = Depends(get_db)):
    return proactive.scan_for_notifications(db)


@router.get("/proactive/all")
def proactive_all(db: Session = Depends(get_db)):
    notifs = (db.query(ProactiveNotification)
              .filter(ProactiveNotification.acknowledged_at == None)  # noqa
              .order_by(ProactiveNotification.trigger_date).all())
    return [s_notif(n) for n in notifs]


@router.post("/proactive/{notif_id}/convert")
def proactive_convert(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(ProactiveNotification).get(notif_id)
    if not notif:
        raise HTTPException(404)
    if notif.converted_qle_id:
        raise HTTPException(400, "Already converted")
    qle = proactive.convert_to_qle(db, notif)
    return s_qle(qle, include_audit=True)


@router.post("/proactive/{notif_id}/dismiss")
def proactive_dismiss(notif_id: int, db: Session = Depends(get_db)):
    notif = db.query(ProactiveNotification).get(notif_id)
    if not notif:
        raise HTTPException(404)
    notif.acknowledged_at = datetime.utcnow()
    db.commit()
    return s_notif(notif)


# ---------------------------------------------------------------------------
# BenOps operations
# ---------------------------------------------------------------------------

@router.get("/benops/queue")
def benops_queue(db: Session = Depends(get_db)):
    review_queue = db.query(QLE).filter_by(status=STATUS_BENOPS_REVIEW).all()
    disputes = db.query(QLEDispute).filter_by(status="open").all()
    escalations = db.query(CarrierTransaction).filter(
        CarrierTransaction.status.in_(["escalated", "drop_detected"])
    ).all()
    tasks = db.query(TaskCard).filter(TaskCard.status != "completed").all()
    # Manual carrier verifications due
    verifications_due = (db.query(TaskCard)
                         .filter(TaskCard.status == "completed",
                                 TaskCard.verification_status == VERIFY_PENDING)
                         .all())
    at_risk = sla.find_at_risk(db)
    return {
        "review_queue": [s_qle(q) for q in review_queue],
        "disputes": [s_dispute(d) for d in disputes],
        "escalations": [s_txn(t) for t in escalations],
        "tasks": [s_task(t) for t in tasks],
        "verifications_due": [s_task(t) for t in verifications_due],
        "at_risk": at_risk,
        "counts": {
            "review": len(review_queue), "disputes": len(disputes),
            "escalations": len(escalations), "tasks": len(tasks),
            "verifications_due": len(verifications_due),
            "at_risk": len(at_risk),
        },
        "all_qles": [s_qle(q) for q in db.query(QLE).order_by(QLE.created_at.desc()).all()],
    }


class ReviewDecision(BaseModel):
    decision: str  # approve/reject
    reviewer: str
    notes: str = ""


@router.post("/benops/review/{qle_id}")
def benops_review(qle_id: int, body: ReviewDecision, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    actor = f"benops:{body.reviewer}"
    if body.decision == "approve":
        record_audit(db, qle.id, "doc_approved", actor, f"Approved by {body.reviewer}. {body.notes}")
        _advance_to_election(db, qle)
    else:
        qle.status = STATUS_REJECTED
        record_audit(db, qle.id, "doc_rejected", actor, f"Rejected by {body.reviewer}. {body.notes}")
    db.commit()
    return s_qle(qle, include_audit=True)


@router.post("/benops/reconcile")
def benops_reconcile_endpoint(db: Session = Depends(get_db)):
    return carriers.reconcile(db)


@router.post("/benops/reminders")
def benops_remind(db: Session = Depends(get_db)):
    return sla.send_reminders(db)


@router.get("/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(TaskCard).get(task_id)
    if not t:
        raise HTTPException(404)
    return {**s_task(t), "qle": s_qle(t.qle, include_audit=True)}


class CompleteTask(BaseModel):
    actor: str
    confirmation_ref: str = ""


@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: int, body: CompleteTask, db: Session = Depends(get_db)):
    card = db.query(TaskCard).get(task_id)
    if not card:
        raise HTTPException(404)
    carriers.complete_task(db, card, actor=body.actor, confirmation_ref=body.confirmation_ref)
    db.commit()
    return s_task(card)


@router.post("/tasks/{task_id}/unavailable")
def task_unavailable(task_id: int, actor: str, db: Session = Depends(get_db)):
    card = db.query(TaskCard).get(task_id)
    if not card:
        raise HTTPException(404)
    carriers.mark_portal_unavailable(db, card, actor=actor)
    db.commit()
    return s_task(card)


class VerifyTask(BaseModel):
    actor: str
    verified: bool
    notes: str = ""


@router.post("/tasks/{task_id}/verify")
def task_verify(task_id: int, body: VerifyTask, db: Session = Depends(get_db)):
    card = db.query(TaskCard).get(task_id)
    if not card:
        raise HTTPException(404)
    carriers.verify_task(db, card, body.actor, body.verified, body.notes)
    carriers.advance_if_all_verified(db, card.qle)
    db.commit()
    return s_task(card)


@router.get("/escalations/{txn_id}")
def get_escalation(txn_id: int, db: Session = Depends(get_db)):
    t = db.query(CarrierTransaction).get(txn_id)
    if not t:
        raise HTTPException(404)
    return {**s_txn(t), "qle": s_qle(t.qle, include_audit=True)}


class ResolveEscalation(BaseModel):
    actor: str
    notes: str = ""


@router.post("/escalations/{txn_id}/resolve")
def resolve_escalation(txn_id: int, body: ResolveEscalation, db: Session = Depends(get_db)):
    txn = db.query(CarrierTransaction).get(txn_id)
    if not txn:
        raise HTTPException(404)
    txn.status = "resolved"
    txn.verification_status = VERIFY_VERIFIED
    txn.verified_at = datetime.utcnow()
    txn.verification_notes = f"Manually resolved by {body.actor}. {body.notes}"
    record_audit(db, txn.qle_id, "escalation_resolved", f"benops:{body.actor}", body.notes)
    carriers.advance_if_all_verified(db, txn.qle)
    db.commit()
    return s_txn(txn)


@router.post("/escalations/{txn_id}/resend")
def resend_escalation(txn_id: int, db: Session = Depends(get_db)):
    """Re-submit a dropped transaction. Used by HR action panel + BenOps."""
    txn = db.query(CarrierTransaction).get(txn_id)
    if not txn:
        raise HTTPException(404)
    new_txn = carriers.noyo.submit(
        txn.payload, f"qle-{txn.qle_id}-{txn.coverage_line}-resend-{datetime.utcnow().timestamp()}",
        simulate_drop=False,  # Resend doesn't drop
    )
    txn.transaction_id = new_txn
    txn.retry_count += 1
    txn.status = "submitted"
    txn.verification_status = VERIFY_PENDING
    record_audit(db, txn.qle_id, "carrier_resubmitted", "system",
                 f"Resent {txn.coverage_line} to {txn.carrier}. New tx={new_txn}.")
    db.commit()
    return s_txn(txn)


# ---------------------------------------------------------------------------
# HR admin actions
# ---------------------------------------------------------------------------

class HrAction(BaseModel):
    actor: str
    notes: str = ""


@router.post("/qles/{qle_id}/hr/escalate")
def hr_escalate(qle_id: int, body: HrAction, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    record_audit(db, qle.id, "hr_escalated", f"hr:{body.actor}",
                 f"HR admin escalated to BenOps. {body.notes}")
    db.commit()
    return {"ok": True}


@router.post("/qles/{qle_id}/hr/approve-late")
def hr_approve_late(qle_id: int, body: HrAction, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    qle.flagged_late = False
    record_audit(db, qle.id, "hr_approved_late", f"hr:{body.actor}",
                 f"HR admin approved late submission. {body.notes}")
    db.commit()
    return {"ok": True}


@router.post("/qles/{qle_id}/hr/resend-carrier")
def hr_resend_carrier(qle_id: int, body: HrAction, db: Session = Depends(get_db)):
    """HR admin resends any failed-verification carrier line for this QLE."""
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    count = 0
    for txn in qle.carrier_txns:
        if txn.verification_status == VERIFY_FAILED:
            new_tx = carriers.noyo.submit(
                txn.payload, f"qle-{qle.id}-{txn.coverage_line}-hr-resend-{datetime.utcnow().timestamp()}",
                simulate_drop=False,
            )
            txn.transaction_id = new_tx
            txn.retry_count += 1
            txn.status = "submitted"
            txn.verification_status = VERIFY_PENDING
            count += 1
    record_audit(db, qle.id, "hr_resent_carrier", f"hr:{body.actor}",
                 f"HR admin resent {count} failed carrier line(s). {body.notes}")
    db.commit()
    return {"ok": True, "resent": count}


# ---------------------------------------------------------------------------
# State rules
# ---------------------------------------------------------------------------

@router.get("/rules")
def list_rules(db: Session = Depends(get_db)):
    return [s_rule(r) for r in db.query(StateRule).order_by(StateRule.state).all()]


class NewRule(BaseModel):
    state: str
    event_type: str
    conditions: dict
    eligible_actions: list
    citation: str = ""
    description: str = ""


@router.post("/rules")
def add_rule(body: NewRule, db: Session = Depends(get_db)):
    rule = StateRule(
        state=body.state.upper(), event_type=body.event_type,
        conditions=body.conditions, eligible_actions=body.eligible_actions,
        citation=body.citation, description=body.description,
    )
    db.add(rule)
    db.commit()
    return s_rule(rule)


@router.post("/rules/{rule_id}/toggle")
def toggle_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(StateRule).get(rule_id)
    if not rule:
        raise HTTPException(404)
    rule.active = not rule.active
    db.commit()
    return s_rule(rule)


# ---------------------------------------------------------------------------
# Audit export
# ---------------------------------------------------------------------------

@router.get("/audit/{qle_id}/export")
def audit_export(qle_id: int, db: Session = Depends(get_db)):
    qle = db.query(QLE).get(qle_id)
    if not qle:
        raise HTTPException(404)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "action", "actor", "details"])
    for a in qle.audit:
        writer.writerow([a.timestamp.isoformat(), a.action, a.actor, a.details])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=qle_{qle_id}_audit.csv"},
    )


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _advance_to_election(db: Session, qle: QLE):
    qle.status = STATUS_DOCS_VERIFIED
    record_audit(db, qle.id, "docs_verified", "system",
                 "Document validated; proceeding to rules engine.")
    rules_result = rules.evaluate(db, qle)
    qle.eligible_options = rules_result["eligible_options"]
    qle.flagged_late = rules_result.get("flagged_late", False)
    state_rule = rules_result.get("state_rule_applied")
    if state_rule:
        record_audit(db, qle.id, "state_rule_applied", "system",
                     f"State rule applied: {state_rule['state']} — {state_rule['citation']}")
    qle.status = STATUS_ELECTION_PENDING
    record_audit(db, qle.id, "election_pending", "system",
                 f"Eligible options computed: {[o['action'] for o in rules_result['eligible_options']]}")
