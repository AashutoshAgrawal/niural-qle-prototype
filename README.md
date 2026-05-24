# Niural QLE Automation — Prototype

A working prototype of the QLE (Qualifying Life Event) workflow described in the
PRD. All four layers are implemented with **mocked external services** (Noyo,
OCR, carrier portals). This is a demo, not a production system.

## What's in it

- **Layer 1 — Smart intake**: mock OCR + confidence routing (≥90 / 70-89 / <70)
- **Layer 2 — Rules engine**: admin-editable state-rule table (NJ, CA, NY, IL)
- **Layer 3 — Carrier orchestration**: mock Noyo client (submit/poll/retry/reconcile) + task cards for Arlo/Angle
- **Layer 4 — Visibility & SLA**: three dashboards, status tracker, audit log, SLA timers

## Quick start

```bash
cd ~/Documents/niural
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

Then open http://localhost:8000

The home page links to each persona. Click **Seed PRD scenarios** on the home
page to load:
- **Marcus at FoundrCo** — birth event, Noyo silent drop (Section 2.3 evidence)
- **Ayush's son** — NJ aging off, qualifies for state continuation (Section 2.2)
- **Janet at LumenLabs** — three pending QLEs (Section 2.4 evidence)

## Personas

- `/employee` — submit a QLE and track status (six-stage tracker)
- `/hr-admin/{org_id}` — dashboard of all org QLEs with SLA colour indicators
- `/benops` — prioritised queue showing only events that need a human

## Running tests

```bash
pytest tests/
```

Tests map 1:1 to the acceptance criteria AC-1 through AC-15 in PRD §9.

## What's mocked

| Real system | Mocked as |
|---|---|
| Noyo API | `layers/carriers.py` — deterministic submit/ack with configurable drop |
| OCR / Document AI | `layers/intake.py` — filename-based heuristic with confidence |
| Carrier portals (Arlo/Angle) | task cards in BenOps queue |
| Auth | none — personas chosen from home page |
| Email / notifications | logged to console + audit log |

## What's NOT in scope for this prototype

Per PRD §3.2: COBRA admin, fraud detection, Arlo/Angle API integration,
retroactive QLE processing, decision support. Plus: real auth, real PII handling,
real legal review of state rules.
