"""SQLAlchemy models for the QLE workflow.

v2 — multi-carrier, dependents, proactive notifications, disputes,
coverage verification. Every QLE fans out to one CarrierTransaction or
TaskCard *per coverage line* (medical / dental / vision). A QLE is only
"active" when every line is verified active on the carrier's claims side,
not merely acknowledged by Noyo.
"""
from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON, Boolean
)
from sqlalchemy.orm import relationship
from db import Base


# ---------------------------------------------------------------------------
# Status constants — v2 inserts coverage_verifying between carrier_in_progress
# and active, and adds disputed / proactive_notified.
# ---------------------------------------------------------------------------
STATUS_SUBMITTED = "submitted"
STATUS_DOCS_VERIFIED = "documents_verified"
STATUS_ELECTION_PENDING = "election_pending"
STATUS_ELECTION_CONFIRMED = "election_confirmed"
STATUS_CARRIER_IN_PROGRESS = "carrier_in_progress"
STATUS_COVERAGE_VERIFYING = "coverage_verifying"   # NEW
STATUS_ACTIVE = "active"
STATUS_REJECTED = "rejected"
STATUS_BENOPS_REVIEW = "benops_review"
STATUS_DISPUTED = "disputed"                       # NEW
STATUS_PROACTIVE_NOTIFIED = "proactive_notified"   # NEW — for aging-off w/ no employee action yet

STATUS_ORDER = [
    STATUS_SUBMITTED,
    STATUS_DOCS_VERIFIED,
    STATUS_ELECTION_PENDING,
    STATUS_ELECTION_CONFIRMED,
    STATUS_CARRIER_IN_PROGRESS,
    STATUS_COVERAGE_VERIFYING,
    STATUS_ACTIVE,
]

STATUS_LABEL = {
    STATUS_SUBMITTED: "Submitted",
    STATUS_DOCS_VERIFIED: "Documents verified",
    STATUS_ELECTION_PENDING: "Election pending",
    STATUS_ELECTION_CONFIRMED: "Election confirmed",
    STATUS_CARRIER_IN_PROGRESS: "Carrier update in progress",
    STATUS_COVERAGE_VERIFYING: "Verifying coverage",
    STATUS_ACTIVE: "Coverage active",
    STATUS_REJECTED: "Rejected — resubmit needed",
    STATUS_BENOPS_REVIEW: "Under review",
    STATUS_DISPUTED: "Under dispute",
    STATUS_PROACTIVE_NOTIFIED: "Upcoming — action needed",
}

# Event types — six MVP types from PRD §4.1
EVENT_MARRIAGE = "marriage"
EVENT_DIVORCE = "divorce"
EVENT_BIRTH = "birth_adoption"
EVENT_DEATH = "death_of_dependent"
EVENT_AGING_OFF = "dependent_aging_off"
EVENT_LOSS_COVERAGE = "loss_of_other_coverage"

EVENT_LABEL = {
    EVENT_MARRIAGE: "Marriage",
    EVENT_DIVORCE: "Divorce",
    EVENT_BIRTH: "Birth / Adoption",
    EVENT_DEATH: "Death of dependent",
    EVENT_AGING_OFF: "Dependent aging off",
    EVENT_LOSS_COVERAGE: "Loss of other coverage",
}

EXPECTED_DOC = {
    EVENT_MARRIAGE: "marriage certificate",
    EVENT_DIVORCE: "divorce decree",
    EVENT_BIRTH: "birth certificate or adoption papers",
    EVENT_DEATH: "death certificate",
    EVENT_AGING_OFF: "system-triggered (no document required)",
    EVENT_LOSS_COVERAGE: "letter of coverage loss from prior carrier",
}

# Coverage lines (medical/dental/vision)
LINE_MEDICAL = "medical"
LINE_DENTAL = "dental"
LINE_VISION = "vision"
LINE_LABEL = {
    LINE_MEDICAL: "Medical",
    LINE_DENTAL: "Dental",
    LINE_VISION: "Vision",
}

# Verification status on a single carrier transaction
VERIFY_PENDING = "pending"
VERIFY_VERIFIED = "verified"
VERIFY_FAILED = "failed"

# Which event types affect which coverage lines.
# Birth/marriage/loss-of-coverage typically affect all lines.
# Divorce removes spouse from all lines.
# Death/aging-off remove dependent from all lines.
EVENT_AFFECTS_LINES: dict[str, set[str]] = {
    EVENT_MARRIAGE: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
    EVENT_DIVORCE: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
    EVENT_BIRTH: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
    EVENT_DEATH: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
    EVENT_AGING_OFF: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
    EVENT_LOSS_COVERAGE: {LINE_MEDICAL, LINE_DENTAL, LINE_VISION},
}


# ---------------------------------------------------------------------------
# Core entities
# ---------------------------------------------------------------------------

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    employees = relationship("Employee", back_populates="organization")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    state = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"))
    organization = relationship("Organization", back_populates="employees")

    # v2: multi-carrier — Employee no longer has a single carrier.
    coverages = relationship("EmployeeCoverage", back_populates="employee", cascade="all, delete-orphan")
    dependents = relationship("Dependent", back_populates="employee", cascade="all, delete-orphan")
    qles = relationship("QLE", back_populates="employee")
    proactive_notifications = relationship("ProactiveNotification", back_populates="employee")

    @property
    def primary_carrier(self) -> str:
        """Convenience — the medical carrier, for display."""
        for c in self.coverages:
            if c.line == LINE_MEDICAL and c.active:
                return c.carrier
        return self.coverages[0].carrier if self.coverages else "—"

    @property
    def primary_plan(self) -> str:
        for c in self.coverages:
            if c.line == LINE_MEDICAL and c.active:
                return c.plan_type
        return ""


class EmployeeCoverage(Base):
    """One row per (employee, line) — medical/dental/vision can each be a different carrier.

    Real Niural employees typically have medical on Aetna, dental on Guardian
    or Arlo, vision on Angle, etc. A single QLE event has to update all of them.
    """
    __tablename__ = "employee_coverages"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    line = Column(String, nullable=False)         # medical | dental | vision
    carrier = Column(String, nullable=False)
    plan_type = Column(String, default="PPO")
    active = Column(Boolean, default=True)
    employee = relationship("Employee", back_populates="coverages")


class Dependent(Base):
    """Spouse/child/etc. We need a real entity so the proactive aging-off
    scanner can find dependents approaching 26 *before* the event occurs."""
    __tablename__ = "dependents"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    name = Column(String, nullable=False)
    relationship_to_employee = Column(String, nullable=False)  # spouse | child | domestic_partner
    birthdate = Column(DateTime, nullable=True)
    unmarried = Column(Boolean, default=True)
    nj_resident = Column(Boolean, default=False)
    ny_resident = Column(Boolean, default=False)
    no_other_coverage = Column(Boolean, default=True)
    disabled = Column(Boolean, default=False)
    veteran = Column(Boolean, default=False)
    is_on_coverage = Column(Boolean, default=True)
    employee = relationship("Employee", back_populates="dependents")

    @property
    def age(self) -> int | None:
        if not self.birthdate:
            return None
        today = datetime.utcnow().date()
        bd = self.birthdate.date()
        return today.year - bd.year - ((today.month, today.day) < (bd.month, bd.day))

    def conditions_dict(self) -> dict:
        return {
            "age": self.age,
            "unmarried": self.unmarried,
            "nj_resident": self.nj_resident,
            "ny_resident": self.ny_resident,
            "no_other_coverage": self.no_other_coverage,
            "disabled_dependent": self.disabled,
            "veteran": self.veteran,
        }


class ProactiveNotification(Base):
    """Phase 0 — a proactive heads-up to the employee that an aging-off
    event is coming up in N days. The employee can act on it (preview
    options, choose continuation) before the dependent's birthday arrives,
    rather than learning about it through a denied claim.
    """
    __tablename__ = "proactive_notifications"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    dependent_id = Column(Integer, ForeignKey("dependents.id"))
    kind = Column(String, nullable=False)  # "aging_off_60d" | "aging_off_30d"
    trigger_date = Column(DateTime, nullable=False)  # when the event will occur
    event_type = Column(String, nullable=False)
    eligible_options = Column(JSON, nullable=True)
    state_rule_applied = Column(JSON, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    converted_qle_id = Column(Integer, ForeignKey("qles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    employee = relationship("Employee", back_populates="proactive_notifications")
    dependent = relationship("Dependent")


class QLE(Base):
    __tablename__ = "qles"
    id = Column(Integer, primary_key=True)
    employee_id = Column(Integer, ForeignKey("employees.id"))
    event_type = Column(String, nullable=False)
    event_date = Column(DateTime, nullable=False)
    status = Column(String, default=STATUS_SUBMITTED)
    confidence_score = Column(Float, nullable=True)
    intake_notes = Column(Text, nullable=True)
    election_deadline = Column(DateTime, nullable=False)
    election_selection = Column(JSON, nullable=True)
    eligible_options = Column(JSON, nullable=True)
    flagged_late = Column(Boolean, default=False)
    is_system_triggered = Column(Boolean, default=False)  # bypassed doc validation
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    dependent_info = Column(JSON, nullable=True)
    dependent_id = Column(Integer, ForeignKey("dependents.id"), nullable=True)
    # Marker so the seed/demo can reproduce Marcus's silent drop scenario
    simulate_carrier_drop = Column(Boolean, default=False)

    employee = relationship("Employee", back_populates="qles")
    dependent = relationship("Dependent")
    documents = relationship("Document", back_populates="qle")
    carrier_txns = relationship("CarrierTransaction", back_populates="qle")
    task_cards = relationship("TaskCard", back_populates="qle")
    audit = relationship("AuditLog", back_populates="qle", order_by="AuditLog.timestamp")
    disputes = relationship("QLEDispute", back_populates="qle")

    def sla_deadline(self):
        return self.created_at + timedelta(days=3)

    def sla_health(self):
        if self.status == STATUS_ACTIVE:
            return "green"
        now = datetime.utcnow()
        deadline = self.sla_deadline()
        if now > deadline:
            return "red"
        remaining = (deadline - now).total_seconds()
        total = (deadline - self.created_at).total_seconds()
        if total > 0 and remaining / total < 0.33:
            return "yellow"
        return "green"

    def all_lines_verified(self) -> bool:
        """v2 — only true when every carrier track is verified active."""
        for t in self.carrier_txns:
            if t.verification_status != VERIFY_VERIFIED:
                return False
        for t in self.task_cards:
            if t.verification_status != VERIFY_VERIFIED:
                return False
        return bool(self.carrier_txns or self.task_cards)


class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True)
    qle_id = Column(Integer, ForeignKey("qles.id"))
    filename = Column(String, nullable=False)
    declared_type = Column(String, nullable=False)
    classified_type = Column(String, nullable=True)
    extracted_date = Column(DateTime, nullable=True)
    extracted_names = Column(JSON, nullable=True)
    confidence = Column(Float, default=0.0)
    quality_issue = Column(String, nullable=True)
    routing_decision = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    qle = relationship("QLE", back_populates="documents")


class StateRule(Base):
    __tablename__ = "state_rules"
    id = Column(Integer, primary_key=True)
    state = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    conditions = Column(JSON, nullable=False)
    eligible_actions = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    citation = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CarrierTransaction(Base):
    """API path (Aetna/Guardian via Noyo). One row PER coverage line —
    a single birth event fans out into separate transactions for
    medical, dental, vision."""
    __tablename__ = "carrier_transactions"
    id = Column(Integer, primary_key=True)
    qle_id = Column(Integer, ForeignKey("qles.id"))
    carrier = Column(String, nullable=False)
    coverage_line = Column(String, nullable=False, default=LINE_MEDICAL)  # NEW
    transaction_id = Column(String, nullable=True)
    payload = Column(JSON, nullable=False)
    status = Column(String, default="submitted")
    submitted_at = Column(DateTime, default=datetime.utcnow)
    acked_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    # v2: Noyo ack != coverage active. Track verification separately.
    verification_status = Column(String, default=VERIFY_PENDING)  # pending/verified/failed
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    qle = relationship("QLE", back_populates="carrier_txns")


class TaskCard(Base):
    __tablename__ = "task_cards"
    id = Column(Integer, primary_key=True)
    qle_id = Column(Integer, ForeignKey("qles.id"))
    carrier = Column(String, nullable=False)
    coverage_line = Column(String, nullable=False, default=LINE_MEDICAL)  # NEW
    portal_url = Column(String, nullable=False)
    checklist = Column(JSON, nullable=False)
    prefilled_data = Column(JSON, nullable=False)
    drafted_email = Column(Text, nullable=False)
    status = Column(String, default="open")  # open / portal_unavailable / completed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    rescheduled_to = Column(DateTime, nullable=True)
    # 48-72h follow-up verification by BenOps
    verification_status = Column(String, default=VERIFY_PENDING)
    verification_due = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    qle = relationship("QLE", back_populates="task_cards")


class QLEDispute(Base):
    """Employee disagrees with rules engine output and asks for a human
    to re-examine. Creates a BenOps task; BenOps can override."""
    __tablename__ = "qle_disputes"
    id = Column(Integer, primary_key=True)
    qle_id = Column(Integer, ForeignKey("qles.id"))
    employee_reason = Column(Text, nullable=False)
    status = Column(String, default="open")  # open / resolved_upheld / resolved_overridden
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    qle = relationship("QLE", back_populates="disputes")


class AuditLog(Base):
    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True)
    qle_id = Column(Integer, ForeignKey("qles.id"))
    action = Column(String, nullable=False)
    actor = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    qle = relationship("QLE", back_populates="audit")


def record_audit(db, qle_id: int, action: str, actor: str, details: str = ""):
    entry = AuditLog(qle_id=qle_id, action=action, actor=actor, details=details)
    db.add(entry)
    db.flush()
    return entry
