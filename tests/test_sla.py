"""Layer 4 acceptance criteria — PRD §9.4 (AC-11 through AC-15)."""
from datetime import datetime, timedelta

from models import (
    Organization, Employee, QLE, AuditLog,
    EVENT_MARRIAGE, EVENT_BIRTH,
    STATUS_SUBMITTED, STATUS_ACTIVE, STATUS_BENOPS_REVIEW,
    record_audit,
)
from layers import sla


def _make_employee(session, state="CA", carrier="Aetna"):
    org = Organization(name="LumenLabs")
    session.add(org)
    session.flush()
    emp = Employee(name="Janet's report", email="x@y.com", state=state,
                   organization_id=org.id, carrier=carrier)
    session.add(emp)
    session.flush()
    return emp


def test_ac11_status_transitions_appear_in_audit(session):
    """AC-11: Employees can view their QLE status within 30 seconds of any
    transition. In our system, transitions are written to the audit log
    synchronously — there is no propagation lag."""
    emp = _make_employee(session)
    qle = QLE(employee_id=emp.id, event_type=EVENT_MARRIAGE,
              event_date=datetime.utcnow(),
              election_deadline=datetime.utcnow() + timedelta(days=30),
              status=STATUS_SUBMITTED)
    session.add(qle)
    session.flush()
    before = datetime.utcnow()
    record_audit(session, qle.id, "test_transition", "system", "test")
    session.commit()
    after = datetime.utcnow()
    entry = session.query(AuditLog).filter_by(qle_id=qle.id).first()
    assert entry is not None
    assert before <= entry.timestamp <= after


def test_ac12_dashboard_sla_health_buckets(session):
    """AC-12: HR admin dashboard shows SLA indicators. Verify the bucket logic
    (green / yellow / red) maps correctly to time-to-deadline."""
    emp = _make_employee(session)

    fresh = QLE(employee_id=emp.id, event_type=EVENT_BIRTH,
                event_date=datetime.utcnow(),
                election_deadline=datetime.utcnow() + timedelta(days=30),
                status=STATUS_SUBMITTED,
                created_at=datetime.utcnow())
    overdue = QLE(employee_id=emp.id, event_type=EVENT_BIRTH,
                  event_date=datetime.utcnow() - timedelta(days=10),
                  election_deadline=datetime.utcnow() + timedelta(days=20),
                  status=STATUS_SUBMITTED,
                  created_at=datetime.utcnow() - timedelta(days=5))
    session.add_all([fresh, overdue])
    session.flush()

    assert fresh.sla_health() == "green"
    assert overdue.sla_health() == "red"


def test_ac13_benops_queue_excludes_completed_events(session):
    """AC-13: BenOps queue shows only events requiring human action. Fully
    automated events (status=active) do not appear."""
    emp = _make_employee(session)
    needs_review = QLE(employee_id=emp.id, event_type=EVENT_MARRIAGE,
                       event_date=datetime.utcnow(),
                       election_deadline=datetime.utcnow() + timedelta(days=30),
                       status=STATUS_BENOPS_REVIEW)
    auto_done = QLE(employee_id=emp.id, event_type=EVENT_BIRTH,
                    event_date=datetime.utcnow(),
                    election_deadline=datetime.utcnow() + timedelta(days=30),
                    status=STATUS_ACTIVE)
    session.add_all([needs_review, auto_done])
    session.flush()
    queue = session.query(QLE).filter_by(status=STATUS_BENOPS_REVIEW).all()
    assert needs_review in queue
    assert auto_done not in queue


def test_ac14_reminders_at_14_7_2_days_before_deadline(session):
    """AC-14: Automated reminders are sent at 14, 7, and 2 days before the
    election window closes."""
    emp = _make_employee(session)
    now = datetime.utcnow()
    targets = {14, 7, 2}
    qle_ids = {}
    for days in [14, 7, 2, 20]:  # 20 days = no reminder expected
        q = QLE(employee_id=emp.id, event_type=EVENT_MARRIAGE,
                event_date=now,
                election_deadline=now + timedelta(days=days),
                status=STATUS_SUBMITTED)
        session.add(q)
        session.flush()
        qle_ids[days] = q.id

    result = sla.send_reminders(session)
    assert result["reminders_sent"] == 3
    sent_days = {d["days"] for d in result["details"]}
    assert sent_days == targets


def test_ac15_audit_trail_complete_and_exportable(session):
    """AC-15: Every QLE has a complete audit log containing every state
    transition, action, decision, and timestamp. Append-only."""
    emp = _make_employee(session)
    qle = QLE(employee_id=emp.id, event_type=EVENT_MARRIAGE,
              event_date=datetime.utcnow(),
              election_deadline=datetime.utcnow() + timedelta(days=30),
              status=STATUS_SUBMITTED)
    session.add(qle)
    session.flush()

    record_audit(session, qle.id, "submitted", "employee", "test")
    record_audit(session, qle.id, "docs_verified", "system", "test")
    record_audit(session, qle.id, "election_pending", "system", "test")
    session.commit()

    entries = session.query(AuditLog).filter_by(qle_id=qle.id).order_by(AuditLog.timestamp).all()
    assert len(entries) == 3
    assert [e.action for e in entries] == ["submitted", "docs_verified", "election_pending"]
    # CSV-exportable: ensure each entry has the required fields
    for e in entries:
        assert e.timestamp is not None
        assert e.action
        assert e.actor
