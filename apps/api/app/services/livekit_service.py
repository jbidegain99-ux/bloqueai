"""
LiveKit token generation service for video interviews.

Uses LiveKit Cloud for WebRTC-based video rooms.
Generates JWT access tokens for participants to join rooms.
"""

import structlog
from datetime import timedelta
from typing import Optional

from livekit import api

from app.core.config import settings

logger = structlog.get_logger()


class LiveKitService:
    """Service for LiveKit room and token management."""

    def __init__(self) -> None:
        self.api_key = settings.livekit_api_key or ""
        self.api_secret = settings.livekit_api_secret or ""
        self.livekit_url = settings.livekit_url or ""

        if not all([self.api_key, self.api_secret, self.livekit_url]):
            logger.warning(
                "livekit_not_configured",
                message="LiveKit environment variables not set — video interviews disabled",
            )

    def create_token(
        self,
        room_name: str,
        participant_identity: str,
        participant_name: str,
        is_ai_agent: bool = False,
        ttl_minutes: int = 60,
    ) -> str:
        """
        Generate a LiveKit access token for a participant.

        Args:
            room_name: Unique room identifier (e.g., interview_{uuid})
            participant_identity: Unique participant ID
            participant_name: Display name in video room
            is_ai_agent: If True, grants agent/admin permissions
            ttl_minutes: Token validity in minutes

        Returns:
            JWT access token string
        """
        token = api.AccessToken(self.api_key, self.api_secret)
        token.with_identity(participant_identity)
        token.with_name(participant_name)
        token.with_ttl(timedelta(minutes=ttl_minutes))

        # Grant permissions
        grant = api.VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )

        if is_ai_agent:
            grant.room_admin = True

        token.with_grants(grant)

        jwt_token = token.to_jwt()
        logger.info(
            "livekit_token_created",
            room=room_name,
            identity=participant_identity,
            is_agent=is_ai_agent,
        )
        return jwt_token

    async def create_room(self, room_name: str) -> dict:
        """
        Create a LiveKit room for an interview.

        Args:
            room_name: Unique room name

        Returns:
            Dict with room name, sid, and creation time
        """
        room_service = api.RoomServiceClient(
            self.livekit_url,
            self.api_key,
            self.api_secret,
        )

        room = await room_service.create_room(
            api.CreateRoomRequest(
                name=room_name,
                empty_timeout=300,  # 5 min timeout when empty
                max_participants=3,  # Candidate + AI + optional observer
            )
        )

        logger.info(
            "livekit_room_created",
            room_name=room.name,
            room_sid=room.sid,
        )

        return {
            "name": room.name,
            "sid": room.sid,
            "created_at": room.creation_time,
        }


# Singleton instance
_livekit_service: Optional[LiveKitService] = None


def get_livekit_service() -> LiveKitService:
    """Get or create the LiveKit service singleton."""
    global _livekit_service
    if _livekit_service is None:
        _livekit_service = LiveKitService()
    return _livekit_service
