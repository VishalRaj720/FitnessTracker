from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Every value can be overridden via environment or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "FitSathi API"
    environment: str = "development"

    # SQLite by default so the project runs with zero setup.
    # Postgres: postgresql+psycopg://user:pass@localhost:5432/fitsathi
    database_url: str = "sqlite:///./fitsathi.db"

    jwt_secret: str = "dev-only-secret-change-me-before-deploying-1234567890"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,"
        "capacitor://localhost,http://localhost"
    )

    auto_seed: bool = True  # seed exercises + institutes on first start

    # AI coach. With no key the feature disables itself and the app behaves exactly as it
    # did before: deterministic cues during a workout, no Coach tab.
    gemini_api_key: str = ""
    gemini_model_cue: str = "gemini-3.5-flash-lite"
    gemini_model_chat: str = "gemini-3.5-flash-lite"
    companion_enabled: bool = True
    # Both paths use the 'lite' tier: measured on a free-tier key, the full flash models
    # answered 0 of 2 calls (503 "high demand") while lite answered in 22-38 s. These are
    # reasoning models, so the time is thinking, not network. That latency is also why the
    # in-workout coach analyses a whole set during the rest period rather than a single rep
    # mid-set — see the CoachDirector docstring on the web side.
    companion_cue_timeout_s: float = 35.0
    # Chat carries the whole user context, so it reasons for longer than a cue does and
    # was timing out at 60 s on the free tier. Two minutes is a poor wait but a working
    # one; on a paid tier this should come back down.
    companion_chat_timeout_s: float = 120.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
