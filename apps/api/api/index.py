"""Vercel serverless function entry point."""

import sys
from pathlib import Path

# Add parent directory to path so we can import app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

# Vercel expects 'app' as the export name for ASGI applications
# This is the FastAPI app instance
app = app
