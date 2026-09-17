"""Background scheduler for the autonomous monitoring agent.

Trade-off: an in-process asyncio loop instead of Celery + Redis. A broker is the right
production answer (retries, multiple workers, observability) but standing one up for a
single periodic job would add infrastructure without adding demonstrable capability.

The evaluation itself is synchronous SQLAlchemy + scikit-learn, so it is pushed onto a
worker thread via `run_in_executor`. Running it inline would block the event loop and
stall every in-flight HTTP request for the duration of the sweep.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.api.routers.monitoring import run_for_user
from app.core.database import SessionLocal
from app.models.user import User

logger = logging.getLogger(__name__)

MINIMUM_INTERVAL_SECONDS = 60


def run_sweep() -> int:
    """Evaluate every site for every user. Returns the number of users processed."""
    processed = 0
    db = SessionLocal()
    try:
        users = db.execute(select(User)).scalars().all()
        for user in users:
            try:
                run_for_user(db, user)
                processed += 1
            except Exception:
                db.rollback()
                logger.exception("Agent sweep failed for user %s", user.id)
    finally:
        db.close()
    return processed


async def monitoring_loop(interval: int) -> None:
    """Run `run_sweep` on a fixed interval until the application shuts down."""
    delay = max(MINIMUM_INTERVAL_SECONDS, interval)
    loop = asyncio.get_running_loop()
    while True:
        try:
            processed = await loop.run_in_executor(None, run_sweep)
            logger.info("Agent sweep complete for %s user(s)", processed)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Agent sweep raised an unexpected error")
        await asyncio.sleep(delay)
