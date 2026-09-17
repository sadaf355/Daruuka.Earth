"""Seed synthetic environmental time-series data and evaluate every site.

Run from the backend/ directory with DATABASE_URL configured:

    python scripts/seed_metrics.py

Idempotent: sites that already have a metric history are left untouched.
"""

from app.core.database import SessionLocal
from app.models.site import Site
from app.services.intelligence import ensure_synthetic_metrics, evaluate_site


def main() -> None:
    with SessionLocal() as db:
        sites = db.query(Site).all()
        for site in sites:
            ensure_synthetic_metrics(db, site.id, 180)
            evaluate_site(db, site.id, force=True)
        db.commit()
        print(f"Seeded/evaluated {len(sites)} site(s).")


if __name__ == "__main__":
    main()
