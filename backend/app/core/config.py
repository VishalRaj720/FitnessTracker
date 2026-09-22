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
