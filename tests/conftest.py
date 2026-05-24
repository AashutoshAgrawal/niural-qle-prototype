"""Pytest fixtures — in-memory SQLite DB per test, isolated from the demo DB."""
import os
import sys

# Make the parent dir importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import db as db_module
from db import Base


@pytest.fixture
def session(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    s = TestSession()

    # Patch the global engine so seed.py and carriers.py use the test DB
    monkeypatch.setattr(db_module, "engine", engine)

    # Fresh Noyo mock per test
    from layers import carriers
    monkeypatch.setattr(carriers, "noyo", carriers.MockNoyoClient())

    yield s
    s.close()
