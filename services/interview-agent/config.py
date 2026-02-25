"""Configuration for the standalone interview agent service."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Agent service settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # LiveKit (WebRTC transport)
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""

    # Deepgram (Speech-to-Text)
    deepgram_api_key: str = ""

    # ElevenLabs (Text-to-Speech)
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

    # LLM (Anthropic Claude)
    llm_api_key: str = ""

    # Callback to main API
    main_api_url: str = ""
    agent_webhook_secret: str = "change-me-in-production"


settings = Settings()
