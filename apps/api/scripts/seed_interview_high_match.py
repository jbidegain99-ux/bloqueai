"""Seed script for high-match interview E2E testing.

This is a convenience wrapper around seed_interview_e2e.py which already creates
all the necessary data for a complete interview E2E flow:

- Company: "E2E Test Corp"
- Rubric: 4 criteria (technical, communication, problem_solving, culture_fit)
- Employer: hr@e2e-test.com / Test123!
- Candidate: candidate@e2e-test.com / Test123!
- Job: "Desarrollador Full Stack" with match_threshold=60
- Application: match_score=85 (above threshold), status=MATCH_PASSED

Usage:
    cd apps/api
    python scripts/seed_interview_high_match.py

After running:
1. Login as candidate@e2e-test.com / Test123!
2. Navigate to /candidate/applications
3. Start interview for the "Desarrollador Full Stack" job
4. Complete 10 questions
5. Verify transcript/scoring persists in /admin/interviews

Requires: DATABASE_URL environment variable pointing to a PostgreSQL database.
"""

import sys
import os

# Add parent dir to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.seed_interview_e2e import seed_interview_e2e

if __name__ == "__main__":
    print("=" * 60)
    print("  SEED: High-Match Interview E2E")
    print("  (Wrapper for seed_interview_e2e.py)")
    print("=" * 60)
    seed_interview_e2e()
