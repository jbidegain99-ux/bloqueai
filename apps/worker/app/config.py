"""Worker configuration."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Worker settings loaded from environment variables."""

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

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "talentos-uploads"
    minio_use_ssl: bool = False

    # LLM
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: Optional[str] = None
    llm_model: str = "gpt-4o-mini"

    @property
    def use_stub_llm(self) -> bool:
        return not self.llm_api_key or self.llm_api_key.strip() == ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
