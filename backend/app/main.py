import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.exceptions import register_exception_handlers
from app.core.limiter import limiter
from app.core.logging import configure_logging

log = logging.getLogger("fitsathi")


def init_db() -> None:
    import app.models  # noqa: F401  (register tables)

    Base.metadata.create_all(engine)
    if settings.auto_seed:
        from seeds.seed import seed_all

        with SessionLocal() as db:
            added = seed_all(db)
            if any(added.values()):
                log.info("seeded %s", added)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    init_db()
    log.info(
        "%s started (%s, db=%s)",
        settings.app_name,
        settings.environment,
        "sqlite" if settings.is_sqlite else "postgres",
    )
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="Backend for FitSathi: on-device AI form coach, adaptive plans, campus squads.",
        lifespan=lifespan,
    )
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(request, exc):  # noqa: ARG001
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=429,
            content={"error": {"code": "rate_limited", "message": "Too many requests"}},
        )

    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok", "app": settings.app_name}

    return app


app = create_app()
