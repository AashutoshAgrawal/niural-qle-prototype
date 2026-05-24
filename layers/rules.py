"""Layer 2 — Rules engine (PRD §6 / §8.2).

The rules engine is intentionally a *lookup table* (PRD §13 assumption #4),
not a general legal-reasoning system. Rows live in the `state_rules` table
and are admin-editable by BenOps through the rules admin page — adding NY
guidance does not require an engineering deployment.

Launch covers NJ, CA, NY, IL for the dependent aging-off scenario. Anything
not in the table defaults to federal COBRA + BenOps flag (PRD §4.3).
"""
from __future__ import annotations
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from models import (
    QLE, Employee, StateRule,
    EVENT_MARRIAGE, EVENT_DIVORCE, EVENT_BIRTH, EVENT_DEATH,
    EVENT_AGING_OFF, EVENT_LOSS_COVERAGE,
)


# Seed data for the state rules table — loaded into the DB by seed.py.
# Each entry maps (state, event_type, conditions) → eligible_actions.
DEFAULT_STATE_RULES = [
    {
        "state": "NJ",
        "event_type": EVENT_AGING_OFF,
        "conditions": {
            "unmarried": True,
            "nj_resident": True,
            "no_other_coverage": True,
            "max_age": 31,
        },
        "eligible_actions": ["federal_cobra", "nj_continuation_to_31"],
        "description": "New Jersey allows unmarried, resident dependents with no other coverage to remain on a parent's plan until age 31.",
        "citation": "N.J.S.A. 17B:27-30.5",
    },
    {
        "state": "NY",
        "event_type": EVENT_AGING_OFF,
        "conditions": {
            "unmarried": True,
            "ny_resident": True,
            "no_employer_coverage": True,
            "max_age": 29,
        },
        "eligible_actions": ["federal_cobra", "ny_young_adult_option_to_29"],
        "description": "New York's Young Adult Option lets unmarried dependents stay until age 29.",
        "citation": "NY Insurance Law § 3216(a)(4)(D)",
    },
    {
        "state": "CA",
        "event_type": EVENT_AGING_OFF,
        "conditions": {
            "disabled_dependent": True,
        },
        "eligible_actions": ["federal_cobra", "cal_cobra_extension"],
        "description": "California provides Cal-COBRA extension for disabled dependents past federal limits.",
        "citation": "Cal. Health & Safety Code § 1373.6",
    },
    {
        "state": "IL",
        "event_type": EVENT_AGING_OFF,
        "conditions": {
            "unmarried": True,
            "veteran": True,
            "max_age": 30,
        },
        "eligible_actions": ["federal_cobra", "il_military_dependent_to_30"],
        "description": "Illinois extends dependent coverage to age 30 for unmarried veteran dependents.",
        "citation": "215 ILCS 5/356z.12",
    },
]


def conditions_match(rule_conditions: dict, dependent_info: dict) -> bool:
    """Check whether the dependent meets the conditions on a rule row.

    Numeric conditions like `max_age` are upper bounds; boolean conditions
    must match exactly. Missing dependent_info keys fail the match — we
    never assume a condition is satisfied without evidence.
    """
    if not dependent_info:
        return False
    for key, expected in rule_conditions.items():
        if key == "max_age":
            age = dependent_info.get("age")
            if age is None or age > expected:
                return False
        else:
            if dependent_info.get(key) != expected:
                return False
    return True


def evaluate(db: Session, qle: QLE) -> dict:
    """Run the rules engine for a QLE.

    Inputs (PRD §8.2): QLE type, plan config, state, dependent info.
    Outputs: eligible options, applicable continuation rules, election deadline.
    """
    employee = qle.employee
    state = employee.state
    event_type = qle.event_type

    # Election deadline = event date + 30 days (PRD §13 assumption #1)
    deadline = qle.event_date + timedelta(days=30)
    is_late = datetime.utcnow() > deadline

    result = {
        "event_type": event_type,
        "state": state,
        "eligible_options": [],
        "election_deadline": deadline.isoformat(),
        "flagged_late": is_late,
        "state_rule_applied": None,
        "notes": [],
    }

    # Default federal options per event type
    if event_type == EVENT_MARRIAGE:
        result["eligible_options"] = [
            {"action": "add_spouse", "label": "Add spouse to your coverage"},
            {"action": "no_change", "label": "Decline — keep current coverage"},
        ]
    elif event_type == EVENT_DIVORCE:
        result["eligible_options"] = [
            {"action": "remove_spouse", "label": "Remove spouse from coverage"},
            {"action": "tier_change", "label": "Change coverage tier (employee-only)"},
        ]
    elif event_type == EVENT_BIRTH:
        result["eligible_options"] = [
            {"action": "add_dependent", "label": "Add child to coverage"},
            {"action": "tier_change", "label": "Change coverage tier (family)"},
        ]
    elif event_type == EVENT_DEATH:
        result["eligible_options"] = [
            {"action": "remove_dependent", "label": "Remove deceased dependent"},
        ]
    elif event_type == EVENT_LOSS_COVERAGE:
        result["eligible_options"] = [
            {"action": "add_dependent", "label": "Add affected dependent to your plan"},
            {"action": "self_enrol", "label": "Enrol self in coverage"},
        ]
    elif event_type == EVENT_AGING_OFF:
        # Always include federal COBRA
        result["eligible_options"] = [
            {
                "action": "federal_cobra",
                "label": "COBRA continuation (federal)",
                "description": "Standard 36-month COBRA continuation. Premiums paid by dependent.",
            },
        ]
        # Layer in state-specific options
        rules = (
            db.query(StateRule)
            .filter_by(state=state, event_type=EVENT_AGING_OFF, active=True)
            .all()
        )
        dep_info = qle.dependent_info or {}
        for rule in rules:
            if conditions_match(rule.conditions, dep_info):
                for action in rule.eligible_actions:
                    if action == "federal_cobra":
                        continue
                    result["eligible_options"].append({
                        "action": action,
                        "label": _action_label(action),
                        "description": rule.description,
                        "citation": rule.citation,
                    })
                result["state_rule_applied"] = {
                    "state": rule.state,
                    "citation": rule.citation,
                    "description": rule.description,
                }
                result["notes"].append(
                    f"State rule applied: {rule.state} — {rule.description}"
                )

        if not result["state_rule_applied"] and state not in {"NJ", "CA", "NY", "IL"}:
            # PRD §8.2 — default to COBRA + flag for BenOps if state is not in table
            result["notes"].append(
                f"No state-specific rule on file for {state}. Defaulting to federal COBRA. "
                "Flagged for BenOps review."
            )

    return result


def _action_label(action: str) -> str:
    return {
        "nj_continuation_to_31": "NJ state continuation (to age 31)",
        "ny_young_adult_option_to_29": "NY Young Adult Option (to age 29)",
        "cal_cobra_extension": "Cal-COBRA extension",
        "il_military_dependent_to_30": "IL military dependent continuation (to age 30)",
    }.get(action, action.replace("_", " ").title())
