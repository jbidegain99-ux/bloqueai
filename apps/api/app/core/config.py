"""Application configuration with Pydantic Settings."""

from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql://talentos:talentos@localhost:5432/talentos"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # MinIO (S3-compatible storage) - Optional
    minio_endpoint: Optional[str] = None
    minio_access_key: Optional[str] = None
    minio_secret_key: Optional[str] = None
    minio_bucket: str = "talentos-uploads"
    minio_use_ssl: bool = False

    # JWT Auth
    jwt_secret_key: str = "your-super-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # LLM Provider
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: Optional[str] = None
    llm_model: str = "gpt-4o-mini"

    # Embeddings
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # Avatar Integration (video AI avatar for interviews)
    avatar_enabled: bool = False
    avatar_provider: str = "mock"  # mock, heygen, or did
    heygen_api_key: Optional[str] = None
    did_api_key: Optional[str] = None

    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_debug: bool = True
    api_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Rate Limiting
    rate_limit_per_minute: int = 60

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # Feature Flags
    enable_dev_overrides: bool = False
    enable_payroll: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string.

        Supports wildcard patterns like *.vercel.app for Vercel preview URLs.
        """
        origins = [origin.strip() for origin in self.api_cors_origins.split(",")]
        # Check if we have a Vercel wildcard pattern - if so, we'll handle it in middleware
        return origins

    @property
    def use_stub_llm(self) -> bool:
        """Check if we should use stub LLM provider."""
        return not self.llm_api_key or self.llm_api_key.strip() == ""

    @property
    def storage_enabled(self) -> bool:
        """Check if storage is configured."""
        return bool(self.minio_endpoint and self.minio_access_key and self.minio_secret_key)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
