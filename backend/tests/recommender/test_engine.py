import json
from datetime import date, timedelta
from pathlib import Path

from app.recommender import (
    ExerciseInfo,
    HistoryInput,
    ProfileInput,
    SessionSummary,
    generate,
)

SEEDS = Path(__file__).resolve().parents[2] / "seeds" / "exercises.json"


def catalog() -> list[ExerciseInfo]:
    rows = json.loads(SEEDS.read_text(encoding="utf-8"))
    return [
        ExerciseInfo(
            id=i + 1,
            slug=r["slug"],
            name=r["name"],
            category=r["category"],
            difficulty=r["difficulty"],
            mode=r["mode"],
            cv_supported=r["cv_supported"],
            default_reps=r["default_reps"],
            default_seconds=r["default_seconds"],
        )
        for i, r in enumerate(rows)
    ]


TODAY = date(2026, 11, 20)
BEGINNER = ProfileInput(goal="general", level="beginner", minutes_per_session=15, days_per_week=4)


def test_first_plan_is_baseline_and_fits_time():
    out = generate(BEGINNER, HistoryInput(sessions=()), catalog(), TODAY, seed="x")
    assert out.generated_by == "rules_v1"
    assert out.items[0].slug in {"march_in_place", "arm_circles"}
    assert len(out.items) == 5  # warm-up + 4 slots for 15 min
    assert {r["code"] for r in out.rationale} >= {"baseline", "composition"}
    assert 11 <= out.estimated_minutes <= 20
    for it in out.items[1:]:
        assert 2 <= it.target_sets <= 4
        assert it.target_reps >= 4 or it.target_seconds >= 10


def test_deterministic_for_same_seed():
    a = generate(BEGINNER, HistoryInput(sessions=()), catalog(), TODAY, seed="u1:2026-11-20")
    b = generate(BEGINNER, HistoryInput(sessions=()), catalog(), TODAY, seed="u1:2026-11-20")
    assert [i.slug for i in a.items] == [i.slug for i in b.items]


def test_two_good_sessions_progress_volume():
    hist = HistoryInput(
        sessions=(
            SessionSummary(
                day=TODAY - timedelta(days=1),
                completed_ratio=1.0,
                avg_form=90,
                rpe=2,
                exercise_forms={"squat": 90},
                exercise_slugs=("squat",),
            ),
            SessionSummary(
                day=TODAY - timedelta(days=3),
                completed_ratio=1.0,
                avg_form=88,
                rpe=3,
                exercise_forms={"squat": 88},
                exercise_slugs=("squat",),
            ),
        )
    )
    out = generate(BEGINNER, hist, catalog(), TODAY, seed="x")
    codes = [r["code"] for r in out.rationale]
    assert "progress_volume" in codes
    assert any(r["code"] in ("progress_reps", "progress_seconds") for r in out.rationale)


def test_hard_session_reduces_volume():
    hist = HistoryInput(
        sessions=(
            SessionSummary(day=TODAY - timedelta(days=1), completed_ratio=0.4, avg_form=70, rpe=5),
        )
    )
    out = generate(BEGINNER, hist, catalog(), TODAY, seed="x")
    assert any(r["code"] == "reduce_volume" for r in out.rationale)


def test_weak_form_keeps_exercise_with_focus_cue():
    hist = HistoryInput(
        sessions=(
            SessionSummary(
                day=TODAY - timedelta(days=2),
                completed_ratio=1.0,
                avg_form=65,
                rpe=3,
                exercise_forms={"squat": 55},
                exercise_slugs=("squat",),
            ),
        )
    )
    out = generate(BEGINNER, hist, catalog(), TODAY, seed="x")
    squat = next((i for i in out.items if i.slug == "squat"), None)
    assert squat is not None and squat.focus_cue and "depth" in squat.focus_cue.lower()
    assert any(r["code"] == "focus_cue" and r["exercise"] == "squat" for r in out.rationale)


def test_recovery_day_after_three_consecutive_days():
    hist = HistoryInput(
        sessions=tuple(
            SessionSummary(day=TODAY - timedelta(days=d), completed_ratio=1.0, avg_form=85, rpe=3)
            for d in (1, 2, 3)
        )
    )
    out = generate(BEGINNER, hist, catalog(), TODAY, seed="x")
    assert any(r["code"] == "recovery_day" for r in out.rationale)
    cats = {i.slug for i in out.items}
    assert "jumping_jack" not in cats


def test_welcome_back_after_gap():
    hist = HistoryInput(
        sessions=(
            SessionSummary(day=TODAY - timedelta(days=6), completed_ratio=1.0, avg_form=85, rpe=3),
        )
    )
    out = generate(BEGINNER, hist, catalog(), TODAY, seed="x")
    assert any(r["code"] == "welcome_back" for r in out.rationale)


def test_thirty_minute_advanced_has_more_volume():
    adv = ProfileInput(goal="strength", level="advanced", minutes_per_session=30, days_per_week=5)
    out = generate(adv, HistoryInput(sessions=()), catalog(), TODAY, seed="x")
    assert len(out.items) == 6
    assert all(1 <= i.target_sets <= 4 for i in out.items[1:])
    assert 24 <= out.estimated_minutes <= 36


def test_estimate_lands_inside_time_budget_for_all_templates():
    for minutes in (10, 15, 20, 30):
        for level in ("beginner", "intermediate", "advanced"):
            p = ProfileInput(
                goal="general", level=level, minutes_per_session=minutes, days_per_week=4
            )
            out = generate(p, HistoryInput(sessions=()), catalog(), TODAY, seed="x")
            assert 0.75 * minutes <= out.estimated_minutes <= 1.3 * minutes, (
                minutes,
                level,
                out.estimated_minutes,
            )


def test_baseline_plan_has_no_spurious_progression():
    out = generate(BEGINNER, HistoryInput(sessions=()), catalog(), TODAY, seed="x")
    assert not any(r["code"] in ("progress_reps", "progress_seconds") for r in out.rationale)
