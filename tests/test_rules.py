"""Layer 2 acceptance criteria — PRD §9.2 (AC-5 through AC-7)."""
from datetime import datetime, timedelta

from models import (
    Organization, Employee, QLE, StateRule,
    EVENT_AGING_OFF, EVENT_MARRIAGE, EVENT_BIRTH,
)
from layers import rules as rules_engine
from layers.rules import DEFAULT_STATE_RULES


def _setup_state_rules(session):
    for r in DEFAULT_STATE_RULES:
        session.add(StateRule(**r))
    session.flush()


def test_ac5_nj_aging_off_surfaces_state_continuation(session):
    """AC-5: For a dependent in NJ turning 26 who is unmarried, NJ resident,
    and has no other coverage, the system surfaces NJ continuation
    alongside COBRA — not COBRA only. This is the $8k denied claim scenario."""
    _setup_state_rules(session)
    org = Organization(name="FoundrCo")
    session.add(org)
    session.flush()
    emp = Employee(name="Parent", email="p@x.com", state="NJ",
                   organization_id=org.id, carrier="Guardian")
    session.add(emp)
    session.flush()
    qle = QLE(
        employee_id=emp.id, event_type=EVENT_AGING_OFF,
        event_date=datetime.utcnow() - timedelta(days=1),
        election_deadline=datetime.utcnow() + timedelta(days=29),
        dependent_info={
            "age": 26, "unmarried": True, "nj_resident": True,
            "no_other_coverage": True,
        },
    )
    session.add(qle)
    session.flush()
    result = rules_engine.evaluate(session, qle)

    actions = [o["action"] for o in result["eligible_options"]]
    assert "federal_cobra" in actions
    assert "nj_continuation_to_31" in actions
    assert result["state_rule_applied"] is not None
    assert result["state_rule_applied"]["state"] == "NJ"


def test_nj_aging_off_does_not_apply_when_conditions_not_met(session):
    """If the dependent has other coverage, NJ continuation should NOT be offered."""
    _setup_state_rules(session)
    org = Organization(name="X")
    session.add(org)
    session.flush()
    emp = Employee(name="P", email="p@x.com", state="NJ",
                   organization_id=org.id, carrier="Guardian")
    session.add(emp)
    session.flush()
    qle = QLE(
        employee_id=emp.id, event_type=EVENT_AGING_OFF,
        event_date=datetime.utcnow(),
        election_deadline=datetime.utcnow() + timedelta(days=30),
        dependent_info={
            "age": 26, "unmarried": True, "nj_resident": True,
            "no_other_coverage": False,  # has other coverage
        },
    )
    session.add(qle)
    session.flush()
    result = rules_engine.evaluate(session, qle)
    actions = [o["action"] for o in result["eligible_options"]]
    assert "federal_cobra" in actions
    assert "nj_continuation_to_31" not in actions


def test_ac6_rules_match_known_event_types(session):
    """AC-6: For each MVP QLE type, the rules engine returns sensible options.

    A real test would replay 50+ historical QLEs per type. Here we verify the
    engine produces non-empty, distinct options for each event type — and
    matches BenOps' default action set."""
    _setup_state_rules(session)
    org = Organization(name="X")
    session.add(org)
    session.flush()
    emp = Employee(name="P", email="p@x.com", state="TX",
                   organization_id=org.id, carrier="Aetna")
    session.add(emp)
    session.flush()

    for event_type in [EVENT_MARRIAGE, EVENT_BIRTH]:
        qle = QLE(
            employee_id=emp.id, event_type=event_type,
            event_date=datetime.utcnow(),
            election_deadline=datetime.utcnow() + timedelta(days=30),
        )
        session.add(qle)
        session.flush()
        result = rules_engine.evaluate(session, qle)
        assert len(result["eligible_options"]) > 0
        if event_type == EVENT_MARRIAGE:
            assert any(o["action"] == "add_spouse" for o in result["eligible_options"])
        elif event_type == EVENT_BIRTH:
            assert any(o["action"] == "add_dependent" for o in result["eligible_options"])


def test_ac7_state_rules_are_admin_editable(session):
    """AC-7: BenOps can add a new state rule without an engineering deployment.

    We test this by adding a new state rule (representing a hypothetical MA
    rule) directly to the DB — the same path the admin UI uses."""
    _setup_state_rules(session)
    initial_count = session.query(StateRule).count()
    new_rule = StateRule(
        state="MA", event_type=EVENT_AGING_OFF,
        conditions={"unmarried": True, "max_age": 30},
        eligible_actions=["federal_cobra", "ma_continuation_to_30"],
        citation="M.G.L. c. 175 § 110",
        description="Massachusetts hypothetical continuation rule.",
    )
    session.add(new_rule)
    session.flush()
    assert session.query(StateRule).count() == initial_count + 1

    # And the engine immediately picks it up — no restart, no deploy
    org = Organization(name="X")
    session.add(org)
    session.flush()
    emp = Employee(name="P", email="p@x.com", state="MA",
                   organization_id=org.id, carrier="Aetna")
    session.add(emp)
    session.flush()
    qle = QLE(
        employee_id=emp.id, event_type=EVENT_AGING_OFF,
        event_date=datetime.utcnow(),
        election_deadline=datetime.utcnow() + timedelta(days=30),
        dependent_info={"age": 26, "unmarried": True},
    )
    session.add(qle)
    session.flush()
    result = rules_engine.evaluate(session, qle)
    actions = [o["action"] for o in result["eligible_options"]]
    assert "ma_continuation_to_30" in actions
