"""System Settings model for global configuration."""

from sqlalchemy import Column, String, Integer, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import BaseModel


class SystemSettings(BaseModel):
    """
    System settings for global configuration.

    Uses a key-value pattern for flexibility.
    Common settings:
    - default_match_threshold: Global default for CV match threshold (default: 70)
    - max_interview_questions: Default number of interview questions
    - cv_max_size_mb: Maximum CV file size in MB
    """
    __tablename__ = "system_settings"

    # Key for the setting (unique identifier)
    key = Column(String(100), unique=True, nullable=False, index=True)

    # Value stored as string (can be converted to appropriate type)
    value = Column(String(500), nullable=True)

    # Integer value for numeric settings
    value_int = Column(Integer, nullable=True)

    # Boolean value for flag settings
    value_bool = Column(Boolean, nullable=True)

    # JSON value for complex settings
    value_json = Column(JSONB, nullable=True)

    # Human-readable description
    description = Column(Text, nullable=True)

    # Category for grouping settings
    category = Column(String(100), default="general", nullable=False)

    # Whether this setting can be modified via UI
    is_editable = Column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<SystemSettings {self.key}={self.value or self.value_int or self.value_bool}>"

    @classmethod
    def get_int(cls, db, key: str, default: int = 0) -> int:
        """Get an integer setting value."""
        setting = db.query(cls).filter(cls.key == key).first()
        if setting and setting.value_int is not None:
            return setting.value_int
        return default

    @classmethod
    def get_str(cls, db, key: str, default: str = "") -> str:
        """Get a string setting value."""
        setting = db.query(cls).filter(cls.key == key).first()
        if setting and setting.value is not None:
            return setting.value
        return default

    @classmethod
    def get_bool(cls, db, key: str, default: bool = False) -> bool:
        """Get a boolean setting value."""
        setting = db.query(cls).filter(cls.key == key).first()
        if setting and setting.value_bool is not None:
            return setting.value_bool
        return default
