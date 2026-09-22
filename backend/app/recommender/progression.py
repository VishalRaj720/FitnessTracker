"""Volume progression from recent history. Returns a multiplier and rationale entries."""

from datetime import date

from app.recommender.types import HistoryInput


def progression(history: HistoryInput, today: date) -> tuple[float, list[dict]]:
    sessions = history.sessions
    rationale: list[dict] = []

    if not sessions:
        rationale.append({"code": "baseline", "reason": "first_plan"})
        return 1.0, rationale

    days_since_last = (today - sessions[0].day).days
    if days_since_last >= 4:
        rationale.append({"code": "welcome_back", "days_missed": days_since_last})
        return 0.85, rationale

    last = sessions[0]
    if last.rpe == 5 or last.completed_ratio < 0.6:
        rationale.append(
            {
                "code": "reduce_volume",
                "reason": "hard_or_incomplete_last_session",
                "completed_ratio": round(last.completed_ratio, 2),
                "rpe": last.rpe,
            }
        )
        return 0.85, rationale

    if last.avg_form is not None and last.avg_form < 60:
        rationale.append(
            {"code": "reduce_volume", "reason": "low_form", "form": round(last.avg_form)}
        )
        return 0.9, rationale

    recent = sessions[:2]
    if len(recent) == 2 and all(
        s.completed_ratio >= 0.9
        and (s.avg_form is None or s.avg_form >= 80)
        and (s.rpe is None or s.rpe <= 3)
        for s in recent
    ):
        rationale.append({"code": "progress_volume", "reason": "two_good_sessions", "pct": 10})
        return 1.10, rationale

    rationale.append({"code": "hold_volume", "reason": "steady"})
    return 1.0, rationale


def consecutive_training_days(history: HistoryInput, today: date) -> int:
    days = sorted({s.day for s in history.sessions}, reverse=True)
    streak = 0
    expected = today - _one_day()
    for d in days:
        if d == expected:
            streak += 1
            expected = expected - _one_day()
        elif d > expected:
            continue
        else:
            break
    return streak


def _one_day():
    from datetime import timedelta

    return timedelta(days=1)
