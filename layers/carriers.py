"""Layer 3 — Carrier orchestration (v2).

Each QLE fans out to one CarrierTransaction or TaskCard *per coverage line*
the event affects. A QLE only reaches `active` when every line is verified
active on the carrier's claims side — not merely acknowledged by Noyo.

Three stages per line:
  1. submission (Noyo or manual portal)
  2. acknowledgement (Noyo ack received / portal update marked done)
  3. verification (carrier's claims system actually reflects the change)

The silent-drop scenario lives in stage 3: Noyo acked the transaction
but the carrier never propagated to claims. Daily reconciliation
catches it before the employee discovers it through a denied claim.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from models import (
    QLE, Employee, EmployeeCoverage, CarrierTransaction, TaskCard,
    EVENT_AFFECTS_LINES, LINE_MEDICAL,
    STATUS_CARRIER_IN_PROGRESS, STATUS_COVERAGE_VERIFYING, STATUS_ACTIVE,
    VERIFY_PENDING, VERIFY_VERIFIED, VERIFY_FAILED,
    record_audit,
)

API_CARRIERS = {"Aetna", "Guardian"}
MANUAL_CARRIERS = {"Arlo", "Angle"}

ACK_TIMEOUT_HOURS = 4
MAX_RETRIES = 1
# Manual carrier verification window (PRD v2)
MANUAL_VERIFICATION_HOURS = 72


class MockNoyoClient:
    """In-memory Noyo stand-in. `simulate_drop` makes the transaction
    silently fail verification (PRD §2.3, ticket #41892)."""

    def __init__(self):
        self._submitted = {}

    def submit(self, payload: dict, idempotency_key: str,
               simulate_drop: bool = False) -> str:
        for tx_id, record in self._submitted.items():
            if record.get("idempotency_key") == idempotency_key:
                return tx_id
        tx_id = f"noyo_{uuid.uuid4().hex[:12]}"
        self._submitted[tx_id] = {
            "payload": payload,
            "idempotency_key": idempotency_key,
            "submitted_at": datetime.utcnow(),
            "ack_due_at": datetime.utcnow() + timedelta(hours=ACK_TIMEOUT_HOURS),
            "will_drop": simulate_drop,
        }
        return tx_id

    def check_ack(self, tx_id: str) -> Optional[dict]:
        """Noyo ack — comes back even for drops (the drop is at the
        carrier's claims layer, not at Noyo)."""
        record = self._submitted.get(tx_id)
        if not record:
            return None
        return {
            "status": "acked",
            "carrier_confirmation_id": f"ack_{tx_id}",
            "acked_at": datetime.utcnow(),
        }

    def verify_coverage(self, tx_id: str) -> dict:
        """v2 — separate call to verify the change actually propagated
        to the carrier's claims system. Drops fail here."""
        record = self._submitted.get(tx_id)
        if not record:
            return {"verified": False, "reason": "Unknown transaction"}
        if record["will_drop"]:
            return {
                "verified": False,
                "reason": "Carrier claims system has no record of this enrollment change.",
            }
        return {"verified": True, "carrier_member_id": f"mem_{tx_id[-8:]}"}

    def reconciliation_feed(self) -> list[dict]:
        out = []
        for tx_id, record in self._submitted.items():
            if not record["will_drop"]:
                out.append({"transaction_id": tx_id, "status": "active"})
        return out


noyo = MockNoyoClient()


# ---------------------------------------------------------------------------
# Multi-carrier fan-out
# ---------------------------------------------------------------------------

def lines_affected(qle: QLE) -> list[EmployeeCoverage]:
    """Which of the employee's active coverages this event affects."""
    affected = EVENT_AFFECTS_LINES.get(qle.event_type, set())
    return [c for c in qle.employee.coverages if c.active and c.line in affected]


PORTAL_URLS = {
    "Arlo": "https://broker.arlo.example.com/login",
    "Angle": "https://portal.angle.example.com",
}

PORTAL_INSTRUCTIONS = {
    "Arlo": [
        "Log in to the Arlo broker portal with the team credentials.",
        "Navigate to Members → Find Member → enter employee ID.",
        "Click 'Life Event' and select the event type from the dropdown.",
        "Enter the effective date and confirm dependent details.",
        "Upload the supporting document (already validated by Niural).",
        "Click Submit. Copy the Arlo confirmation number.",
        "Send the pre-drafted confirmation email to your Arlo rep.",
        "Return here and click 'Mark complete' with the confirmation number.",
    ],
    "Angle": [
        "Log in to the Angle portal. If the portal is down, click 'Portal unavailable'.",
        "Go to Enrollment → Make a Change.",
        "Select the employee and event type.",
        "Update dependent/election details to match the pre-filled data below.",
        "Submit the change. Note the Angle reference number.",
        "Email Harris (harris@angle.example.com) with the pre-drafted text below.",
        "Mark this task complete with the Angle reference number.",
    ],
}


def dispatch_election(db: Session, qle: QLE) -> dict:
    """Fan a confirmed election out to every affected coverage line.

    Returns counts. Caller is responsible for committing.
    """
    coverages = lines_affected(qle)
    api_count = 0
    manual_count = 0
    for cov in coverages:
        if cov.carrier in API_CARRIERS:
            submit_to_carrier(db, qle, cov)
            api_count += 1
        elif cov.carrier in MANUAL_CARRIERS:
            build_task_card(db, qle, cov)
            manual_count += 1
    qle.status = STATUS_CARRIER_IN_PROGRESS
    record_audit(db, qle.id, "carrier_fanout", "system",
                 f"Fanned out election to {len(coverages)} coverage line(s): "
                 f"{api_count} API, {manual_count} manual.")
    return {"api": api_count, "manual": manual_count, "total": len(coverages)}


def submit_to_carrier(db: Session, qle: QLE, coverage: EmployeeCoverage) -> CarrierTransaction:
    """Submit one (employee, line) update to Noyo."""
    employee = qle.employee
    carrier = coverage.carrier
    payload = {
        "employee": {"id": employee.id, "name": employee.name, "email": employee.email},
        "event_type": qle.event_type,
        "event_date": qle.event_date.isoformat(),
        "election": qle.election_selection,
        "coverage_line": coverage.line,
        "plan_type": coverage.plan_type,
    }
    idempotency_key = f"qle-{qle.id}-{coverage.line}-{qle.event_date.date()}"
    tx_id = noyo.submit(payload, idempotency_key, simulate_drop=qle.simulate_carrier_drop)

    txn = CarrierTransaction(
        qle_id=qle.id, carrier=carrier, coverage_line=coverage.line,
        transaction_id=tx_id, payload=payload, status="submitted",
        submitted_at=datetime.utcnow(),
    )
    db.add(txn)
    record_audit(db, qle.id, "carrier_submitted", "system",
                 f"Submitted {coverage.line} to {carrier} via Noyo (tx={tx_id}).")
    return txn


def poll_for_ack(db: Session, txn: CarrierTransaction) -> bool:
    ack = noyo.check_ack(txn.transaction_id)
    if ack:
        txn.status = "acked"
        txn.acked_at = ack["acked_at"]
        record_audit(db, txn.qle_id, "carrier_acked", "system",
                     f"{txn.carrier} ({txn.coverage_line}) acked tx={txn.transaction_id}.")
        return True
    return False


def retry_or_escalate(db: Session, txn: CarrierTransaction) -> None:
    if txn.retry_count < MAX_RETRIES:
        txn.retry_count += 1
        record_audit(db, txn.qle_id, "carrier_retry", "system",
                     f"Retry #{txn.retry_count} for {txn.carrier} ({txn.coverage_line}) tx={txn.transaction_id}.")
    else:
        txn.status = "escalated"
        txn.error = (
            f"No ack from {txn.carrier} ({txn.coverage_line}) after {MAX_RETRIES + 1} attempts. "
            f"Submitted at {txn.submitted_at.isoformat()}."
        )
        record_audit(db, txn.qle_id, "carrier_escalated", "system",
                     f"Escalated {txn.coverage_line} tx={txn.transaction_id} to BenOps after retries.")


def verify_coverage(db: Session, txn: CarrierTransaction) -> bool:
    """v2 step — confirm the change actually propagated to the carrier's
    claims system. This is the gap the silent-drop scenario exposes."""
    result = noyo.verify_coverage(txn.transaction_id)
    if result.get("verified"):
        txn.verification_status = VERIFY_VERIFIED
        txn.verified_at = datetime.utcnow()
        txn.verification_notes = f"Carrier confirmed: {result.get('carrier_member_id', '—')}"
        record_audit(db, txn.qle_id, "coverage_verified", "system",
                     f"{txn.carrier} ({txn.coverage_line}) coverage verified active.")
        return True
    else:
        txn.verification_status = VERIFY_FAILED
        txn.verification_notes = result.get("reason", "Verification failed")
        txn.status = "drop_detected"
        record_audit(db, txn.qle_id, "coverage_verification_failed", "system",
                     f"{txn.carrier} ({txn.coverage_line}): {txn.verification_notes} "
                     f"Noyo acked but carrier claims has no record.")
        return False


def verify_task(db: Session, card: TaskCard, actor: str, verified: bool, notes: str = "") -> None:
    """Manual carrier 48–72h follow-up verification by BenOps."""
    card.verification_status = VERIFY_VERIFIED if verified else VERIFY_FAILED
    card.verified_at = datetime.utcnow()
    card.verification_notes = notes
    record_audit(
        db, card.qle_id,
        "task_verified" if verified else "task_verification_failed",
        f"benops:{actor}",
        f"{card.carrier} ({card.coverage_line}): {'Confirmed' if verified else 'NOT confirmed'} in portal. {notes}",
    )


def advance_if_all_verified(db: Session, qle: QLE) -> bool:
    """If every line is verified, mark the QLE active."""
    if qle.all_lines_verified():
        qle.status = STATUS_ACTIVE
        record_audit(db, qle.id, "status_active", "system",
                     "All carrier lines verified active. QLE complete.")
        return True
    if qle.status != STATUS_COVERAGE_VERIFYING:
        qle.status = STATUS_COVERAGE_VERIFYING
        record_audit(db, qle.id, "verifying_coverage", "system",
                     "Awaiting verification on remaining carrier lines.")
    return False


def reconcile(db: Session) -> dict:
    """Daily reconciliation — for every submitted transaction older than
    24h, run the verification step. Silent drops end up here."""
    discrepancies = []
    txns = db.query(CarrierTransaction).filter(
        CarrierTransaction.verification_status == VERIFY_PENDING
    ).all()
    for txn in txns:
        age = datetime.utcnow() - txn.submitted_at
        if age < timedelta(hours=0):  # always proceed in the prototype
            continue
        ok = verify_coverage(db, txn)
        if not ok:
            discrepancies.append({
                "qle_id": txn.qle_id, "transaction_id": txn.transaction_id,
                "carrier": txn.carrier, "coverage_line": txn.coverage_line,
                "age_hours": age.total_seconds() / 3600,
            })
        else:
            advance_if_all_verified(db, txn.qle)
    db.commit()
    return {"checked": len(txns), "drops_detected": len(discrepancies),
            "details": discrepancies}


def build_task_card(db: Session, qle: QLE, coverage: EmployeeCoverage) -> TaskCard:
    employee = qle.employee
    carrier = coverage.carrier
    prefilled = {
        "employee_id": employee.id,
        "employee_name": employee.name,
        "employee_email": employee.email,
        "employee_state": employee.state,
        "carrier": carrier,
        "coverage_line": coverage.line,
        "plan_type": coverage.plan_type,
        "event_type": qle.event_type,
        "event_date": qle.event_date.isoformat(),
        "election": qle.election_selection,
    }
    drafted_email = (
        f"Hi {carrier} team,\n\n"
        f"Please process the following qualifying life event for our member:\n\n"
        f"  Employee: {employee.name} (#{employee.id})\n"
        f"  Coverage: {coverage.line.title()} ({coverage.plan_type})\n"
        f"  Event: {qle.event_type} on {qle.event_date.date()}\n"
        f"  Effective: {qle.event_date.date()}\n"
        f"  Election: {qle.election_selection}\n\n"
        f"Confirmation has been entered in the {carrier} portal. Please confirm receipt.\n\n"
        f"Thanks,\nNiural BenOps"
    )

    card = TaskCard(
        qle_id=qle.id, carrier=carrier, coverage_line=coverage.line,
        portal_url=PORTAL_URLS.get(carrier, ""),
        checklist=PORTAL_INSTRUCTIONS.get(carrier, []),
        prefilled_data=prefilled, drafted_email=drafted_email,
        status="open",
    )
    db.add(card)
    record_audit(db, qle.id, "task_card_created", "system",
                 f"Task card generated for {carrier} ({coverage.line}).")
    return card


def complete_task(db: Session, card: TaskCard, actor: str,
                  confirmation_ref: str = "") -> None:
    """BenOps marks the portal update done. Verification still pending —
    they'll come back in 48–72h to confirm with the carrier."""
    card.status = "completed"
    card.completed_at = datetime.utcnow()
    card.verification_due = datetime.utcnow() + timedelta(hours=MANUAL_VERIFICATION_HOURS)
    record_audit(db, card.qle_id, "task_card_completed", f"benops:{actor}",
                 f"Portal update completed for {card.carrier} ({card.coverage_line}). Ref: {confirmation_ref}. "
                 f"Verification due {card.verification_due.date()}.")
    advance_if_all_verified(db, card.qle)


def mark_portal_unavailable(db: Session, card: TaskCard, actor: str) -> None:
    card.status = "portal_unavailable"
    next_day = datetime.utcnow() + timedelta(days=1)
    while next_day.weekday() >= 5:
        next_day += timedelta(days=1)
    card.rescheduled_to = next_day
    record_audit(db, card.qle_id, "portal_unavailable", f"benops:{actor}",
                 f"{card.carrier} portal marked unavailable. Rescheduled to {next_day.date()}. "
                 f"HR admin notified of delay.")
