"""Candidate scoring for one plan slot. Higher is better. Every term is explainable."""

from app.recommender.catalog import LEVEL_INDEX
from app.recommender.types import ExerciseInfo, HistoryInput


def used_on(history: HistoryInput, slug: str, days_ago: int, today) -> bool:
    for s in history.sessions:
        if (today - s.day).days == days_ago and slug in s.exercise_slugs:
            return True
    return False


def last_form(history: HistoryInput, slug: str) -> float | None:
    for s in history.sessions:  # newest first
        if slug in s.exercise_forms:
            return s.exercise_forms[slug]
    return None


def score_candidate(
    ex: ExerciseInfo,
    level: str,
    history: HistoryInput,
    today,
    prefer_cv: bool,
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    level_idx = LEVEL_INDEX.get(level, 1)

    score = 10.0
    gap = abs(ex.difficulty - level_idx)
    if gap:
        score -= 3.0 * gap
        reasons.append(f"difficulty_gap:{gap}")

    # Recency penalties are deliberately smaller than the camera bonus: variety rotates
    # *among* camera-tracked exercises rather than pushing users to untracked ones.
    if used_on(history, ex.slug, 1, today):
        score -= 2.0
        reasons.append("used_yesterday")
    elif used_on(history, ex.slug, 2, today):
        score -= 1.0
        reasons.append("used_day_before")

    if ex.cv_supported:
        score += 4.0 if prefer_cv else 3.0
        reasons.append("camera_tracked")

    lf = last_form(history, ex.slug)
    if lf is not None and lf < 70:
        # Keep weak exercises in rotation (with a focus cue) instead of dropping them.
        score += 1.5
        reasons.append(f"needs_form_work:{lf:.0f}")

    return score, reasons
