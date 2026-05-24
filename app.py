"""FastAPI backend for the Niural QLE workflow.

This is the JSON API consumed by the Next.js frontend at port 3000. All
business logic lives in `layers/` and the data model lives in `models.py`.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import Base, engine
from api import router as api_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Niural QLE Workflow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


@app.get("/")
def health():
    return {"ok": True, "service": "niural-qle-api"}
