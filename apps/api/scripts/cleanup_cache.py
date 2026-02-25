"""Manual cleanup script for expired CV analysis cache entries.

Usage:
    cd apps/api
    python -m scripts.cleanup_cache
"""

import sys
import os

# Ensure the app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.utils.cache import cleanup_expired_cache


def main() -> None:
    db = SessionLocal()
    try:
        deleted = cleanup_expired_cache(db)
        print(f"Cleanup complete: {deleted} expired cache entries deleted.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
