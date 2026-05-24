"""Layer 1 acceptance criteria — PRD §9.1 (AC-1 through AC-4)."""
from datetime import datetime, timedelta

from layers import intake


def test_ac1_wedding_invitation_rejected_at_intake():
    """AC-1: A clearly invalid document (wedding invitation for marriage event)
    is rejected at intake with a message identifying the expected doc type."""
    result = intake.run_intake(
        event_type="marriage",
        event_date=datetime(2026, 4, 1),
        filename="wedding_invitation.pdf",
    )
    assert result.routing == "reject"
    assert "invitation" in result.notes.lower()
    assert "marriage certificate" in result.notes.lower()


def test_ac2_date_discrepancy_flagged_for_benops_review():
    """AC-2: When a valid doc has extractable fields, the system flags
    date discrepancies > 7 days for BenOps review."""
    result = intake.run_intake(
        event_type="marriage",
        event_date=datetime(2026, 4, 1),
        filename="marriage_cert_datemismatch.pdf",
    )
    assert result.routing == "benops_review"
    assert "days off" in result.notes


def test_ac3_blurry_document_specific_quality_error():
    """AC-3: A document too blurry to process returns a specific quality
    error to the employee."""
    result = intake.run_intake(
        event_type="marriage",
        event_date=datetime(2026, 4, 1),
        filename="marriage_cert_blurry.jpg",
    )
    assert result.quality_issue == "blurry"
    assert result.routing == "reject"
    assert "blurry" in result.notes.lower() or "clearer" in result.notes.lower()


def test_ac4_precision_and_recall_on_sample_set():
    """AC-4: ≥90% precision (valid docs not wrongly rejected) and ≥85% recall
    (invalid docs caught) on a sample set.

    For the prototype, our sample set is small but deterministic — the heuristic
    is correct for every input we use here. The real model would run against a
    PII-redacted historical corpus.
    """
    valid_samples = [
        ("marriage", "marriage_certificate.pdf"),
        ("marriage", "marriage_cert.pdf"),
        ("birth_adoption", "birth_certificate.pdf"),
        ("birth_adoption", "adoption_papers.pdf"),
        ("divorce", "divorce_decree.pdf"),
        ("death_of_dependent", "death_certificate.pdf"),
        ("loss_of_other_coverage", "loss_of_coverage_letter.pdf"),
    ]
    invalid_samples = [
        ("marriage", "wedding_invitation.pdf"),     # wrong doc type
        ("marriage", "wedding_invite.png"),         # wrong doc type
        ("birth_adoption", "marriage_cert_blurry.jpg"),  # blurry
        ("marriage", "marriage_cert_cropped.pdf"),  # cropped
    ]
    correct_valid = 0
    for event_type, filename in valid_samples:
        result = intake.run_intake(event_type, datetime(2026, 4, 1), filename)
        if result.routing in {"auto_approve", "benops_review"}:
            correct_valid += 1
    precision = correct_valid / len(valid_samples)

    caught_invalid = 0
    for event_type, filename in invalid_samples:
        result = intake.run_intake(event_type, datetime(2026, 4, 1), filename)
        if result.routing == "reject":
            caught_invalid += 1
    recall = caught_invalid / len(invalid_samples)

    assert precision >= 0.90, f"precision {precision} below 0.90"
    assert recall >= 0.85, f"recall {recall} below 0.85"


def test_routing_threshold_boundaries():
    """PRD §7.2 — verify the routing boundaries at 90 and 70 exactly."""
    assert intake.route_by_confidence(0.95) == "auto_approve"
    assert intake.route_by_confidence(0.90) == "auto_approve"
    assert intake.route_by_confidence(0.89) == "benops_review"
    assert intake.route_by_confidence(0.70) == "benops_review"
    assert intake.route_by_confidence(0.69) == "reject"
