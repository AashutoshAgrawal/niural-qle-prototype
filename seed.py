"""Seed the database for the demo.

v2 scenarios:
  - FoundrCo / Marcus — birth event mid-flight, three coverage lines with
    Aetna (medical) silently dropping (PRD §2.3 ticket #41892)
  - FoundrCo / Anita — son aged off, NJ continuation option surfaced
  - FoundrCo / Diego — son turning 26 in 30 days, proactive notification
    already pending so Janet/Diego can see Phase 0 in action
  - LumenLabs / Priya — marriage doc with medium confidence, BenOps review
  - LumenLabs / David — divorce, election_pending, dual Arlo carriers
  - LumenLabs / Rachel — marriage rejected at intake (wedding invitation)
  - Helios / Tom — clean state
"""
from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from db import Base, engine
from models import (
    Organization, Employee, EmployeeCoverage, Dependent, ProactiveNotification,
    QLE, Document, StateRule, CarrierTransaction, TaskCard, AuditLog,
    record_audit,
    EVENT_MARRIAGE, EVENT_BIRTH, EVENT_AGING_OFF, EVENT_DIVORCE,
    LINE_MEDICAL, LINE_DENTAL, LINE_VISION,
    STATUS_BENOPS_REVIEW, STATUS_REJECTED, STATUS_ELECTION_PENDING,
    STATUS_CARRIER_IN_PROGRESS,
    VERIFY_PENDING, VERIFY_VERIFIED,
)
from layers.rules import DEFAULT_STATE_RULES
from layers import carriers


def seed_all(db: Session, reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        carriers.noyo = carriers.MockNoyoClient()  # fresh mock

    if db.query(Organization).count() > 0:
        return

    # ---------------- State rules ----------------
    for r in DEFAULT_STATE_RULES:
        db.add(StateRule(**r))

    # ---------------- Organisations ----------------
    foundrco = Organization(name="FoundrCo")
    lumenlabs = Organization(name="LumenLabs")
    helios = Organization(name="Helios Industries")
    db.add_all([foundrco, lumenlabs, helios])
    db.flush()

    # ---------------- Employees + their coverage lines ----------------
    marcus = _emp(db, "Marcus Chen", "marcus@foundrco.example.com", "CA", foundrco.id,
                  [("medical", "Aetna", "PPO Family"),
                   ("dental", "Guardian", "Premium dental"),
                   ("vision", "Angle", "Vision basic")])
    anita = _emp(db, "Anita Sharma", "anita@foundrco.example.com", "NJ", foundrco.id,
                 [("medical", "Aetna", "HMO Family"),
                  ("dental", "Guardian", "Standard dental")])
    diego = _emp(db, "Diego Park", "diego@foundrco.example.com", "IL", foundrco.id,
                 [("medical", "Guardian", "PPO Family"),
                  ("dental", "Arlo", "Standard dental")])
    priya = _emp(db, "Priya Patel", "priya@lumenlabs.example.com", "NY", lumenlabs.id,
                 [("medical", "Aetna", "HMO"),
                  ("dental", "Arlo", "Basic dental")])
    david = _emp(db, "David Kim", "david@lumenlabs.example.com", "IL", lumenlabs.id,
                 [("medical", "Arlo", "PPO"),
                  ("dental", "Arlo", "Basic dental")])
    rachel = _emp(db, "Rachel Wong", "rachel@lumenlabs.example.com", "MA", lumenlabs.id,
                  [("medical", "Angle", "PPO Family")])
    tom = _emp(db, "Tom Rivera", "tom@helios.example.com", "TX", helios.id,
               [("medical", "Guardian", "PPO")])
    db.flush()

    now = datetime.utcnow()

    # ---------------- Dependents ----------------
    # Marcus has a spouse and a newborn (just born, hence the birth event)
    db.add_all([
        Dependent(employee_id=marcus.id, name="Sara Chen", relationship_to_employee="spouse",
                  birthdate=datetime(1990, 3, 14), is_on_coverage=True),
        Dependent(employee_id=marcus.id, name="Luca Chen", relationship_to_employee="child",
                  birthdate=now - timedelta(days=12), is_on_coverage=False),  # being added
    ])
    # Anita's son Aarav — already 26 (the aging-off case)
    aarav = Dependent(
        employee_id=anita.id, name="Aarav Sharma", relationship_to_employee="child",
        birthdate=now - timedelta(days=26 * 365 + 2), nj_resident=True,
        unmarried=True, no_other_coverage=True, is_on_coverage=True,
    )
    db.add(aarav)
    # Diego's son Mateo — turning 26 in exactly 30 days (Phase 0 scenario)
    mateo = Dependent(
        employee_id=diego.id, name="Mateo Park", relationship_to_employee="child",
        birthdate=(now + timedelta(days=30)) - timedelta(days=26 * 365),
        unmarried=True, no_other_coverage=True, is_on_coverage=True,
    )
    db.add(mateo)
    # Priya has a soon-to-be spouse (no dependent yet, marriage in flight)
    db.flush()

    # ---------------- Proactive notification for Diego's son ----------------
    # Pre-compute eligible options via the rules engine
    from layers import rules as rules_engine
    temp_qle = QLE(
        employee_id=diego.id, event_type=EVENT_AGING_OFF,
        event_date=now + timedelta(days=30),
        election_deadline=now + timedelta(days=60),
        dependent_info=mateo.conditions_dict(),
        dependent_id=mateo.id,
    )
    temp_qle.employee = diego
    rules_result = rules_engine.evaluate(db, temp_qle)
    notif = ProactiveNotification(
        employee_id=diego.id, dependent_id=mateo.id,
        kind="aging_off_30d",
        trigger_date=now + timedelta(days=30),
        event_type=EVENT_AGING_OFF,
        eligible_options=rules_result["eligible_options"],
        state_rule_applied=rules_result.get("state_rule_applied"),
    )
    db.add(notif)

    # ---------------- Marcus's birth event (multi-carrier, drops) ----------------
    marcus_qle = QLE(
        employee_id=marcus.id, event_type=EVENT_BIRTH,
        event_date=now - timedelta(days=12),
        election_deadline=now + timedelta(days=18),
        status=STATUS_CARRIER_IN_PROGRESS,
        confidence_score=0.95,
        intake_notes="Birth certificate validated automatically.",
        election_selection={"choice": "add_dependent",
                            "elected_at": (now - timedelta(days=10)).isoformat()},
        eligible_options=[
            {"action": "add_dependent", "label": "Add child to coverage"},
            {"action": "tier_change", "label": "Change coverage tier (family)"},
        ],
        simulate_carrier_drop=True,
        created_at=now - timedelta(days=11),
    )
    db.add(marcus_qle)
    db.flush()
    db.add(Document(
        qle_id=marcus_qle.id, filename="birth_certificate.pdf",
        declared_type=EVENT_BIRTH, classified_type=EVENT_BIRTH,
        confidence=0.95, routing_decision="auto_approve",
        notes="High-confidence birth certificate. Auto-approved.",
    ))
    # Audit history
    _audit_history(db, marcus_qle.id, [
        ("submitted", "employee", "Marcus submitted birth event.", 11),
        ("intake_complete", "system", "Confidence 0.95, routing=auto_approve.", 11),
        ("docs_verified", "system", "Document validated; proceeding to rules engine.", 11),
        ("election_pending", "system", "Eligible options: add_dependent, tier_change.", 11),
        ("election_confirmed", "employee", "Marcus chose: add_dependent.", 10),
    ], now)

    # Fan-out: three carrier transactions / task cards, one per coverage line.
    # The Aetna medical one will silently drop (Marcus's actual case).
    for cov in marcus.coverages:
        if cov.carrier in carriers.API_CARRIERS:
            payload = {
                "employee": marcus.name, "event": "birth",
                "coverage_line": cov.line, "carrier": cov.carrier,
            }
            tx_id = f"noyo_marcus_{cov.line}"
            will_drop = (cov.line == LINE_MEDICAL)
            txn = CarrierTransaction(
                qle_id=marcus_qle.id, carrier=cov.carrier, coverage_line=cov.line,
                transaction_id=tx_id, payload=payload, status="submitted",
                submitted_at=now - timedelta(days=10),
                verification_status=VERIFY_PENDING if will_drop else VERIFY_VERIFIED,
                verified_at=None if will_drop else now - timedelta(days=9),
                verification_notes=None if will_drop else f"Carrier confirmed: mem_{tx_id[-8:]}",
            )
            db.add(txn)
            carriers.noyo._submitted[tx_id] = {
                "payload": payload,
                "idempotency_key": f"qle-{marcus_qle.id}-{cov.line}-{marcus_qle.event_date.date()}",
                "submitted_at": txn.submitted_at,
                "ack_due_at": txn.submitted_at + timedelta(hours=4),
                "will_drop": will_drop,
            }
            db.add(AuditLog(
                qle_id=marcus_qle.id, action="carrier_submitted", actor="system",
                details=f"Submitted {cov.line} to {cov.carrier} via Noyo (tx={tx_id}).",
                timestamp=now - timedelta(days=10),
            ))
        else:  # manual carrier (Angle vision)
            card = TaskCard(
                qle_id=marcus_qle.id, carrier=cov.carrier, coverage_line=cov.line,
                portal_url=carriers.PORTAL_URLS[cov.carrier],
                checklist=carriers.PORTAL_INSTRUCTIONS[cov.carrier],
                prefilled_data={
                    "employee_id": marcus.id, "employee_name": marcus.name,
                    "carrier": cov.carrier, "coverage_line": cov.line,
                    "event_type": EVENT_BIRTH,
                    "event_date": marcus_qle.event_date.isoformat(),
                    "election": {"choice": "add_dependent"},
                },
                drafted_email=(
                    f"Hi {cov.carrier} team,\n\n"
                    f"Please process birth event for {marcus.name}…\n"
                ),
                status="completed",
                completed_at=now - timedelta(days=8),
                verification_status=VERIFY_VERIFIED,
                verified_at=now - timedelta(days=4),
                verification_notes="Confirmed in portal on follow-up check.",
            )
            db.add(card)

    # ---------------- Anita's NJ aging-off (election_pending) ----------------
    anita_qle = QLE(
        employee_id=anita.id, event_type=EVENT_AGING_OFF,
        event_date=now - timedelta(days=3),
        election_deadline=now + timedelta(days=27),
        status=STATUS_ELECTION_PENDING,
        is_system_triggered=True,
        intake_notes="System-triggered aging-off event. No document required.",
        dependent_info=aarav.conditions_dict(),
        dependent_id=aarav.id,
        created_at=now - timedelta(days=3),
    )
    db.add(anita_qle)
    db.flush()
    rules_result = rules_engine.evaluate(db, anita_qle)
    anita_qle.eligible_options = rules_result["eligible_options"]
    _audit_history(db, anita_qle.id, [
        ("submitted", "system", "Aging-off event triggered for dependent (age 26).", 3),
        ("docs_verified", "system", "No document required for system-triggered event.", 3),
        ("state_rule_applied", "system",
         "NJ rule applied — N.J.S.A. 17B:27-30.5: continuation to 31.", 3),
        ("election_pending", "system",
         "Eligible options: federal_cobra, nj_continuation_to_31.", 3),
    ], now)

    # ---------------- Priya — marriage, BenOps review ----------------
    priya_qle = QLE(
        employee_id=priya.id, event_type=EVENT_MARRIAGE,
        event_date=now - timedelta(days=8),
        election_deadline=now + timedelta(days=22),
        status=STATUS_BENOPS_REVIEW,
        confidence_score=0.78,
        intake_notes="Filename didn't match expected pattern; document looks plausible but needs human verification.",
        created_at=now - timedelta(days=8),
    )
    db.add(priya_qle)
    db.flush()
    db.add(Document(
        qle_id=priya_qle.id, filename="cert.pdf",
        declared_type=EVENT_MARRIAGE, classified_type=EVENT_MARRIAGE,
        confidence=0.78, routing_decision="benops_review",
        notes="Filename ambiguous. Document content looks like a marriage cert.",
    ))
    _audit_history(db, priya_qle.id, [
        ("submitted", "employee", "Priya submitted marriage event.", 8),
        ("intake_complete", "system", "Confidence 0.78, routing=benops_review.", 8),
        ("queued_for_review", "system", "Medium confidence — BenOps to review.", 8),
    ], now)

    # ---------------- David — divorce, election_pending ----------------
    david_qle = QLE(
        employee_id=david.id, event_type=EVENT_DIVORCE,
        event_date=now - timedelta(days=4),
        election_deadline=now + timedelta(days=26),
        status=STATUS_ELECTION_PENDING,
        confidence_score=0.95,
        intake_notes="Divorce decree validated automatically.",
        eligible_options=[
            {"action": "remove_spouse", "label": "Remove spouse from coverage"},
            {"action": "tier_change", "label": "Change coverage tier (employee-only)"},
        ],
        created_at=now - timedelta(days=4),
    )
    db.add(david_qle)
    db.flush()
    db.add(Document(
        qle_id=david_qle.id, filename="divorce_decree.pdf",
        declared_type=EVENT_DIVORCE, classified_type=EVENT_DIVORCE,
        confidence=0.95, routing_decision="auto_approve",
        notes="High-confidence divorce decree. Auto-approved.",
    ))
    _audit_history(db, david_qle.id, [
        ("submitted", "employee", "David submitted divorce event.", 4),
        ("intake_complete", "system", "Confidence 0.95, routing=auto_approve.", 4),
        ("docs_verified", "system", "Document validated; proceeding to rules engine.", 4),
        ("election_pending", "system", "Eligible options: remove_spouse, tier_change.", 4),
    ], now)

    # ---------------- Rachel — marriage rejected (wedding invitation) ----------------
    rachel_qle = QLE(
        employee_id=rachel.id, event_type=EVENT_MARRIAGE,
        event_date=now - timedelta(days=1),
        election_deadline=now + timedelta(days=29),
        status=STATUS_REJECTED,
        confidence_score=0.15,
        intake_notes="This appears to be a wedding INVITATION, not a marriage certificate. "
                     "Please upload your marriage certificate.",
        created_at=now - timedelta(days=1),
    )
    db.add(rachel_qle)
    db.flush()
    db.add(Document(
        qle_id=rachel_qle.id, filename="wedding_invitation.pdf",
        declared_type=EVENT_MARRIAGE, classified_type="wedding_invitation",
        confidence=0.15, routing_decision="reject",
        notes="Misclassified as wedding invitation, not certificate.",
    ))
    _audit_history(db, rachel_qle.id, [
        ("submitted", "employee", "Rachel submitted marriage event.", 1),
        ("intake_complete", "system", "Confidence 0.15, classified as wedding_invitation.", 1),
        ("rejected_at_intake", "system", "Document rejected. Employee notified to resubmit.", 1),
    ], now)

    db.commit()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _emp(db, name, email, state, org_id, coverages):
    emp = Employee(name=name, email=email, state=state, organization_id=org_id)
    db.add(emp)
    db.flush()
    for line, carrier, plan in coverages:
        db.add(EmployeeCoverage(
            employee_id=emp.id, line=line, carrier=carrier,
            plan_type=plan, active=True,
        ))
    return emp


def _audit_history(db, qle_id: int, events: list, now: datetime):
    for action, actor, details, days_ago in events:
        db.add(AuditLog(
            qle_id=qle_id, action=action, actor=actor, details=details,
            timestamp=now - timedelta(days=days_ago),
        ))
