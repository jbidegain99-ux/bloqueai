"""Unit tests for the matching service scoring logic."""

import pytest

from app.services.matching_service import (
    _calculate_skills_score,
    _normalize_skills_list,
    WEIGHT_SEMANTIC,
    WEIGHT_SKILLS,
    WEIGHT_OTHER,
)


class TestCalculateSkillsScore:
    """Tests for _calculate_skills_score()."""

    def test_full_match(self):
        """All required skills are present."""
        result = _calculate_skills_score(
            ["python", "react", "sql"],
            ["python", "react", "sql"],
        )
        assert result["score"] == 100.0
        assert len(result["matched"]) == 3
        assert len(result["missing"]) == 0

    def test_partial_match(self):
        """Some required skills are present."""
        result = _calculate_skills_score(
            ["python", "react"],
            ["python", "react", "sql", "docker"],
        )
        assert result["score"] == 50.0
        assert set(result["matched"]) == {"python", "react"}
        assert set(result["missing"]) == {"sql", "docker"}

    def test_no_match(self):
        """No required skills are present."""
        result = _calculate_skills_score(
            ["java", "spring"],
            ["python", "react"],
        )
        assert result["score"] == 0.0
        assert len(result["matched"]) == 0
        assert len(result["missing"]) == 2

    def test_case_insensitive(self):
        """Skills matching should be case-insensitive."""
        result = _calculate_skills_score(
            ["python", "react", "sql"],
            ["Python", "REACT", "Sql"],
        )
        assert result["score"] == 100.0
        assert len(result["matched"]) == 3

    def test_no_requirements(self):
        """When no skills are required, return neutral score."""
        result = _calculate_skills_score(
            ["python", "react"],
            [],
        )
        assert result["score"] == 50.0
        assert len(result["matched"]) == 0
        assert len(result["missing"]) == 0

    def test_empty_candidate_skills(self):
        """Candidate has no skills, but job has requirements."""
        result = _calculate_skills_score(
            [],
            ["python", "react"],
        )
        assert result["score"] == 0.0
        assert len(result["missing"]) == 2

    def test_both_empty(self):
        """Both sides empty."""
        result = _calculate_skills_score([], [])
        assert result["score"] == 50.0

    def test_extra_candidate_skills_dont_hurt(self):
        """Candidate having extra skills doesn't reduce score."""
        result = _calculate_skills_score(
            ["python", "react", "sql", "docker", "kubernetes", "aws"],
            ["python", "react"],
        )
        assert result["score"] == 100.0


class TestNormalizeSkillsList:
    """Tests for _normalize_skills_list()."""

    def test_normal_list(self):
        assert _normalize_skills_list(["Python", "React"]) == ["python", "react"]

    def test_none_input(self):
        assert _normalize_skills_list(None) == []

    def test_empty_list(self):
        assert _normalize_skills_list([]) == []

    def test_strips_whitespace(self):
        assert _normalize_skills_list(["  Python  ", " React "]) == ["python", "react"]

    def test_filters_falsy(self):
        assert _normalize_skills_list(["Python", "", None, "React"]) == ["python", "react"]

    def test_non_list_input(self):
        assert _normalize_skills_list("not a list") == []


class TestScoringWeights:
    """Verify scoring weights sum to 1.0."""

    def test_weights_sum_to_one(self):
        total = WEIGHT_SEMANTIC + WEIGHT_SKILLS + WEIGHT_OTHER
        assert abs(total - 1.0) < 1e-9

    def test_semantic_is_dominant(self):
        assert WEIGHT_SEMANTIC > WEIGHT_SKILLS
        assert WEIGHT_SEMANTIC > WEIGHT_OTHER
