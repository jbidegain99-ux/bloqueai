"""AI Video Avatar service scaffolding.

This module provides scaffolding for future AI video avatar integration
(e.g., HeyGen, D-ID, or similar services).

Feature flag: Set AVATAR_ENABLED=true and AVATAR_PROVIDER=heygen|did|mock
to enable video avatar in interviews.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

from app.core.config import settings


class AvatarProvider(ABC):
    """Abstract base class for avatar providers."""

    @abstractmethod
    async def initialize_session(self, session_id: str) -> dict[str, Any]:
        """Initialize a new avatar session.

        Returns connection details for WebSocket/WebRTC stream.
        """
        pass

    @abstractmethod
    async def send_text(self, session_id: str, text: str) -> dict[str, Any]:
        """Send text to avatar for speech synthesis.

        Returns audio/video stream information.
        """
        pass

    @abstractmethod
    async def close_session(self, session_id: str) -> bool:
        """Close an avatar session."""
        pass

    @abstractmethod
    async def get_session_status(self, session_id: str) -> dict[str, Any]:
        """Get current status of avatar session."""
        pass


class MockAvatarProvider(AvatarProvider):
    """Mock avatar provider for development and testing."""

    async def initialize_session(self, session_id: str) -> dict[str, Any]:
        """Return mock session initialization data."""
        return {
            "session_id": session_id,
            "status": "initialized",
            "type": "mock",
            "connection": {
                "type": "mock",
                "url": None,
                "token": None,
            },
            "avatar": {
                "name": "AI Interviewer",
                "language": "es-ES",
                "voice": "professional_female",
            },
        }

    async def send_text(self, session_id: str, text: str) -> dict[str, Any]:
        """Return mock audio/video metadata."""
        import hashlib
        text_hash = hashlib.md5(text.encode()).hexdigest()[:8]

        # Estimate speaking duration (roughly 150 words per minute)
        word_count = len(text.split())
        duration_seconds = (word_count / 150) * 60

        return {
            "session_id": session_id,
            "text": text,
            "text_hash": text_hash,
            "estimated_duration_seconds": round(duration_seconds, 1),
            "status": "completed",
            "audio_url": None,  # Would contain presigned URL in real implementation
            "video_url": None,  # Would contain presigned URL in real implementation
        }

    async def close_session(self, session_id: str) -> bool:
        """Always returns success for mock."""
        return True

    async def get_session_status(self, session_id: str) -> dict[str, Any]:
        """Return mock session status."""
        return {
            "session_id": session_id,
            "status": "active",
            "type": "mock",
            "created_at": None,
            "messages_sent": 0,
        }


class HeyGenProvider(AvatarProvider):
    """HeyGen avatar provider (placeholder implementation).

    To enable:
    1. Set AVATAR_PROVIDER=heygen
    2. Set HEYGEN_API_KEY=your_api_key
    3. Implement the methods below with HeyGen's Streaming API

    Documentation: https://docs.heygen.com/reference/streaming-api
    """

    def __init__(self):
        self.api_key = getattr(settings, 'heygen_api_key', None)
        self.base_url = "https://api.heygen.com/v1"

    async def initialize_session(self, session_id: str) -> dict[str, Any]:
        """Initialize HeyGen streaming session."""
        # TODO: Implement HeyGen session creation
        # POST /streaming.new
        raise NotImplementedError("HeyGen integration not yet implemented")

    async def send_text(self, session_id: str, text: str) -> dict[str, Any]:
        """Send text to HeyGen for avatar speech."""
        # TODO: Implement HeyGen text-to-speech
        # POST /streaming.task
        raise NotImplementedError("HeyGen integration not yet implemented")

    async def close_session(self, session_id: str) -> bool:
        """Close HeyGen streaming session."""
        # TODO: Implement HeyGen session close
        # POST /streaming.stop
        raise NotImplementedError("HeyGen integration not yet implemented")

    async def get_session_status(self, session_id: str) -> dict[str, Any]:
        """Get HeyGen session status."""
        raise NotImplementedError("HeyGen integration not yet implemented")


class DIDProvider(AvatarProvider):
    """D-ID avatar provider (placeholder implementation).

    To enable:
    1. Set AVATAR_PROVIDER=did
    2. Set DID_API_KEY=your_api_key
    3. Implement the methods below with D-ID's Streaming API

    Documentation: https://docs.d-id.com/reference/streams-overview
    """

    def __init__(self):
        self.api_key = getattr(settings, 'did_api_key', None)
        self.base_url = "https://api.d-id.com"

    async def initialize_session(self, session_id: str) -> dict[str, Any]:
        """Initialize D-ID streaming session."""
        # TODO: Implement D-ID session creation
        raise NotImplementedError("D-ID integration not yet implemented")

    async def send_text(self, session_id: str, text: str) -> dict[str, Any]:
        """Send text to D-ID for avatar speech."""
        # TODO: Implement D-ID text-to-speech
        raise NotImplementedError("D-ID integration not yet implemented")

    async def close_session(self, session_id: str) -> bool:
        """Close D-ID streaming session."""
        # TODO: Implement D-ID session close
        raise NotImplementedError("D-ID integration not yet implemented")

    async def get_session_status(self, session_id: str) -> dict[str, Any]:
        """Get D-ID session status."""
        raise NotImplementedError("D-ID integration not yet implemented")


def get_avatar_provider() -> Optional[AvatarProvider]:
    """Get the configured avatar provider, if enabled."""
    if not getattr(settings, 'avatar_enabled', False):
        return None

    provider = getattr(settings, 'avatar_provider', 'mock')

    if provider == 'heygen':
        return HeyGenProvider()
    elif provider == 'did':
        return DIDProvider()
    else:
        return MockAvatarProvider()


# Singleton instance (None if disabled)
avatar_provider = get_avatar_provider()
