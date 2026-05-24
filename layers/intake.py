"""Layer 1 — Smart intake (PRD §6 / §8.1).

A real implementation would use AWS Textract or Google Document AI to OCR the
uploaded document, classify the type, extract key fields, and check image
quality. For the prototype we use a filename heuristic so the demo is
deterministic: this lets us reproduce the exact failure modes (wedding
invitation submitted as marriage proof, blurry photo, date mismatch,
valid certificate) without needing real OCR infrastructure.

Confidence thresholds and routing follow PRD §7.2.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

# PRD §7.2 — launch with conservative thresholds. Spec calls out possibly 95/80
# instead of 90/70 to start; we use 90/70 to make the demo's medium-confidence
# bucket reachable.
HIGH_CONFIDENCE = 0.90
LOW_CONFIDENCE = 0.70

# PRD §8.1.4 — date discrepancy tolerance
DATE_TOLERANCE_DAYS = 7

ACCEPTED_FILE_TYPES = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # PRD §8.1.1


@dataclass
class IntakeResult:
    confidence: float
    classified_type: Optional[str]
    extracted_date: Optional[datetime]
    extracted_names: list
    quality_issue: Optional[str]
    routing: str  # "auto_approve" | "benops_review" | "reject"
    notes: str


# Map QLE event types to the keywords we'd expect to find in a valid document.
DOC_KEYWORDS = {
    "marriage": ["marriage_certificate", "marriage_cert", "marriagecert"],
    "divorce": ["divorce_decree", "divorce", "decree"],
    "birth_adoption": ["birth_certificate", "birth_cert", "adoption"],
    "death_of_dependent": ["death_certificate", "death_cert"],
    "loss_of_other_coverage": ["loss_of_coverage", "coverage_loss", "termination_letter"],
}


def validate_form(event_type: str, event_date: Optional[datetime],
                  filename: str, file_size: int) -> Optional[str]:
    """PRD §8.1.1 — basic form validation. Returns an error message or None."""
    if not event_type:
        return "Event type is required."
    if not event_date:
        return "Event date is required."
    # Aging-off events are system-triggered and don't require a document
    if event_type == "dependent_aging_off":
        return None
    if not filename:
        return "A supporting document is required."
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ACCEPTED_FILE_TYPES:
        return f"File type {ext or '(none)'} not accepted. Use PDF, JPG, or PNG."
    if file_size > MAX_FILE_SIZE_BYTES:
        return "File size exceeds 10 MB."
    return None


def run_intake(event_type: str, event_date: datetime, filename: str) -> IntakeResult:
    """Mock OCR + classification.

    Heuristic rules (designed to mirror real failure modes):
      - "invitation" or "invite" in the filename → very low confidence
        (catches the wedding-invitation-as-proof anti-pattern)
      - "blurry" or "lowres" → quality fail, low confidence
      - "datemismatch" → simulate a doc whose date is 14 days off from declared
      - Filename matches the expected keywords for the event → high confidence
      - Anything else → medium confidence, routes to BenOps
    """
    name = filename.lower() if filename else ""
    notes_parts = []

    # Quality check first — PRD §8.1.5
    quality_issue = None
    if "blurry" in name or "lowres" in name:
        quality_issue = "blurry"
        notes_parts.append("Image is too blurry to process.")
        return IntakeResult(
            confidence=0.20,
            classified_type=None,
            extracted_date=None,
            extracted_names=[],
            quality_issue=quality_issue,
            routing="reject",
            notes="The uploaded image is too blurry to process. Please upload a clearer photo or scan.",
        )
    if "cropped" in name:
        quality_issue = "cropped"
        return IntakeResult(
            confidence=0.25,
            classified_type=None,
            extracted_date=None,
            extracted_names=[],
            quality_issue=quality_issue,
            routing="reject",
            notes="The image appears cropped — key fields are cut off. Please upload the full document.",
        )

    # Misclassification: wedding invitation submitted as proof of marriage
    if "invitation" in name or "invite" in name:
        return IntakeResult(
            confidence=0.15,
            classified_type="wedding_invitation",
            extracted_date=None,
            extracted_names=[],
            quality_issue=None,
            routing="reject",
            notes=(
                f"This appears to be a wedding INVITATION, not a marriage certificate. "
                f"Please upload your marriage certificate."
            ),
        )

    # Successful classification path
    keywords = DOC_KEYWORDS.get(event_type, [])
    matches = any(k in name for k in keywords)

    # Date discrepancy simulation
    extracted_date = event_date
    if "datemismatch" in name:
        extracted_date = event_date - timedelta(days=14)
        gap_days = abs((extracted_date - event_date).days)
        notes_parts.append(
            f"Document date appears {gap_days} days off from declared event date "
            f"({extracted_date.date()} vs {event_date.date()})."
        )

    if matches:
        # High confidence path — auto approve unless date discrepancy
        confidence = 0.95
        routing = "auto_approve"
        if extracted_date and abs((extracted_date - event_date).days) > DATE_TOLERANCE_DAYS:
            routing = "benops_review"
            confidence = 0.80
            notes_parts.append(
                f"Routed to BenOps because date discrepancy exceeds {DATE_TOLERANCE_DAYS} days."
            )
    else:
        # Medium confidence — could be the right doc, but we're not sure
        confidence = 0.78
        routing = "benops_review"
        notes_parts.append(
            f"Filename did not match the expected pattern for {event_type}. "
            "Document looks plausible but needs human verification."
        )

    return IntakeResult(
        confidence=confidence,
        classified_type=event_type,
        extracted_date=extracted_date,
        extracted_names=[],
        quality_issue=None,
        routing=routing,
        notes=" ".join(notes_parts) or "Document validated and routed automatically.",
    )


def route_by_confidence(confidence: float) -> str:
    """PRD §7.2 thresholds — exposed so the tests can verify the boundaries."""
    if confidence >= HIGH_CONFIDENCE:
        return "auto_approve"
    if confidence >= LOW_CONFIDENCE:
        return "benops_review"
    return "reject"
