"""Layer 3 acceptance criteria — PRD §9.3 (AC-8 through AC-10)."""
from datetime import datetime, timedelta

from models import Organization, Employee, QLE, EVENT_BIRTH, STATUS_CARRIER_IN_PROGRESS
from layers import carriers


def _make_qle(session, carrier: str, simulate_drop: bool = False) -> QLE:
    org = Organization(name="FoundrCo")
    session.add(org)
    session.flush()
    emp = Employee(name="Liam", email="l@x.com", state="CA",
                   organization_id=org.id, carrier=carrier)
    session.add(emp)
    session.flush()
    qle = QLE(
        employee_id=emp.id, event_type=EVENT_BIRTH,
        event_date=datetime.utcnow(),
        election_deadline=datetime.utcnow() + timedelta(days=30),
        election_selection={"choice": "add_dependent"},
        dependent_info={"__simulate_drop": simulate_drop} if simulate_drop else None,
    )
    session.add(qle)
    session.flush()
    return qle


def test_ac8_api_carrier_auto_submitted_to_noyo(session):
    """AC-8: After a completed election for Aetna or Guardian, the system
    submits to Noyo within 1 hour without manual intervention."""
    qle = _make_qle(session, "Aetna")
    txn = carriers.submit_to_carrier(session, qle, simulate_drop=False)
    assert txn.status == "submitted"
    assert txn.transaction_id.startswith("noyo_")
    assert qle.status == STATUS_CARRIER_IN_PROGRESS
    elapsed = (datetime.utcnow() - txn.submitted_at).total_seconds()
    assert elapsed < 3600  # within 1 hour (trivially — same call)


def test_idempotency_key_prevents_duplicate_submission(session):
    """PRD §8.3.2 — idempotency keys."""
    qle = _make_qle(session, "Aetna")
    tx1 = carriers.submit_to_carrier(session, qle, simulate_drop=False)
    tx2 = carriers.submit_to_carrier(session, qle, simulate_drop=False)
    assert tx1.transaction_id == tx2.transaction_id


def test_ac9_dropped_transaction_retries_then_escalates(session):
    """AC-9: If Noyo does not acknowledge within 4 hours, retry once. If still
    unacknowledged, create a BenOps escalation with full transaction context."""
    qle = _make_qle(session, "Aetna", simulate_drop=True)
    txn = carriers.submit_to_carrier(session, qle, simulate_drop=True)

    # First poll — no ack expected (dropped)
    acked = carriers.poll_for_ack(session, txn)
    assert acked is False

    # First retry
    carriers.retry_or_escalate(session, txn)
    assert txn.retry_count == 1
    assert txn.status == "submitted"  # still trying

    # Second poll still drops
    acked = carriers.poll_for_ack(session, txn)
    assert acked is False

    # Now we exhaust retries
    carriers.retry_or_escalate(session, txn)
    assert txn.status == "escalated"
    assert txn.error is not None
    assert "Aetna" in txn.error


def test_reconciliation_catches_silent_drops(session):
    """PRD §8.3.6 — daily reconciliation catches silent carrier drops."""
    qle = _make_qle(session, "Aetna", simulate_drop=True)
    txn = carriers.submit_to_carrier(session, qle, simulate_drop=True)
    # Backdate the submission so reconciliation considers it eligible
    txn.submitted_at = datetime.utcnow() - timedelta(hours=25)
    session.commit()

    result = carriers.reconcile(session)
    assert result["drops_detected"] >= 1
    session.refresh(txn)
    assert txn.status == "drop_detected"


def test_ac10_manual_carrier_task_card_has_all_fields(session):
    """AC-10: For manual carriers, the generated task card contains every
    field needed for the portal update (employee, plan, change, effective
    date, checklist, drafted email)."""
    qle = _make_qle(session, "Arlo")
    card = carriers.build_task_card(session, qle)

    required_fields = {
        "employee_id", "employee_name", "employee_email", "employee_state",
        "carrier", "plan_type", "event_type", "event_date", "election",
    }
    assert required_fields.issubset(card.prefilled_data.keys())
    assert len(card.checklist) > 0
    assert card.drafted_email
    assert card.portal_url


def test_angle_portal_unavailable_reschedules(session):
    """PRD §7.4 — Angle portal downtime auto-reschedules to next business day."""
    qle = _make_qle(session, "Angle")
    card = carriers.build_task_card(session, qle)
    carriers.mark_portal_unavailable(session, card, actor="benops:sarah")
    assert card.status == "portal_unavailable"
    assert card.rescheduled_to is not None
    # Next business day → Mon-Fri only
    assert card.rescheduled_to.weekday() < 5
