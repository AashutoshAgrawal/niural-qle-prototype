"""FastAPI backend for the Niural QLE workflow.

This is the JSON API consumed by the Next.js frontend. All business logic
lives in `layers/` and the data model lives in `models.py`.

Deployment notes:
 - CORS origins read from CORS_ORIGINS env var (comma-separated). Falls back
   to localhost dev defaults.
 - Auto-seeds demo data on startup when the database is empty so cold-start
   reviewers never land on an empty app.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import Base, engine, SessionLocal
from models import Organization
from api import router as api_router
from seed import seed_all

Base.metadata.create_all(bind=engine)


def _auto_seed_if_empty() -> None:
    """Seed demo data on cold start if no organisations exist."""
    db = SessionLocal()
    try:
        if db.query(Organization).count() == 0:
            print("→ Empty database detected. Seeding demo data…")
            seed_all(db, reset=False)
            print("→ Seed complete.")
    finally:
        db.close()


_auto_seed_if_empty()


def _origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    extra = [o.strip() for o in raw.split(",") if o.strip()]
    defaults = ["http://localhost:3000", "http://127.0.0.1:3000"]
    return defaults + extra


app = FastAPI(title="Niural QLE Workflow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/")
def health():
    return {"ok": True, "service": "niural-qle-api"}
