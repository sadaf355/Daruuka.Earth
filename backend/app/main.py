import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import ai, auth, metrics, monitoring, notifications, projects, sites
from app.core.config import settings
from app.services.agent import monitoring_loop

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the autonomous monitoring agent alongside the API, and stop it cleanly."""
    task: asyncio.Task | None = None
    if settings.AGENT_ENABLED:
        task = asyncio.create_task(monitoring_loop(settings.AGENT_INTERVAL_SECONDS))
    yield
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="Darukaa.Earth API",
    description="Geospatial carbon & biodiversity analytics platform — backend API.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(sites.router)
app.include_router(metrics.router)
app.include_router(ai.router)
app.include_router(notifications.router)
app.include_router(monitoring.router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
