"""rules_v1 — deterministic, explainable plan generation.

generate(profile, history, catalog, today, seed) -> PlanOutput

Steps
1. Template from minutes (slots, sets, rest).
2. Category composition from goal.
3. Per slot: score candidates, pick best (seeded tie-break), attach focus cue if weak form.
4. Volume = default × level factor × progression multiplier (bounded per day).
5. Recovery rule: 3+ consecutive training days -> mobility + core hold day.
"""

import random
from datetime import date

from app.recommender.catalog import (
    COMPOSITION,
    LEVEL_FACTOR,
    MAX_REP_DELTA_PER_DAY,
    MAX_SETS,
    MIN_HOLD_SECONDS,
    MIN_REPS,
    SECONDS_PER_REP,
    TRANSITION_SECONDS,
    WARMUP_CATEGORY,
    WARMUP_SECONDS,
    template_for,
)
from app.recommender.progression import consecutive_training_days, progression
from app.recommender.scoring import last_form, score_candidate
from app.recommender.types import (
    ExerciseInfo,
    HistoryInput,
    PlanItemOutput,
    PlanOutput,
    ProfileInput,
)

FOCUS_CUES = {
    "squat": "Focus: depth — hips below knees",
    "pushup": "Focus: straight body line",
    "lunge": "Focus: upright torso",
    "jumping_jack": "Focus: arms all the way up",
    "plank": "Focus: hips level",
}


def generate(
    profile: ProfileInput,
    history: HistoryInput,
    catalog: list[ExerciseInfo],
    today: date,
    seed: str = "",
) -> PlanOutput:
    rng = random.Random(seed or f"{today.isoformat()}")
    slots, sets, rest = template_for(profile.minutes_per_session)
    level_factor = LEVEL_FACTOR.get(profile.level, 1.0)
    prefer_cv = profile.goal == "consistency"
    if profile.goal == "consistency":
        level_factor *= 0.8

    rationale: list[dict] = []
    multiplier, prog_rationale = progression(history, today)
    rationale.extend(prog_rationale)

    by_cat: dict[str, list[ExerciseInfo]] = {}
    for ex in catalog:
        by_cat.setdefault(ex.category, []).append(ex)

    items: list[PlanItemOutput] = []
    position = 1

    # Warm-up
    warmups = by_cat.get(WARMUP_CATEGORY, [])
    if warmups:
        w = rng.choice(sorted(warmups, key=lambda e: e.slug))
        items.append(
            PlanItemOutput(
                exercise_id=w.id,
                slug=w.slug,
                position=position,
                target_sets=1,
                target_reps=0,
                target_seconds=WARMUP_SECONDS,
                rest_seconds=15,
            )
        )
        position += 1

    recovery = consecutive_training_days(history, today) >= 3
    if recovery:
        rationale.append({"code": "recovery_day", "consecutive_days": 3})
        categories = ["core", "mobility", "core"]
        sets = 2
    else:
        base = COMPOSITION.get(profile.goal, COMPOSITION["general"])
        categories = (base * 3)[:slots]
        rationale.append({"code": "composition", "goal": profile.goal, "categories": categories})

    chosen: set[str] = set()
    for cat in categories:
        candidates = [e for e in by_cat.get(cat, []) if e.slug not in chosen]
        if not candidates:
            continue
        scored = []
        for ex in candidates:
            s, reasons = score_candidate(ex, profile.level, history, today, prefer_cv)
            scored.append((s, rng.random(), ex, reasons))
        scored.sort(key=lambda t: (-t[0], t[1]))
        _, _, ex, reasons = scored[0]
        chosen.add(ex.slug)

        target_reps, target_seconds, vol_rationale = _volume(
            ex, level_factor, multiplier, history, today
        )
        rationale.extend(vol_rationale)

        focus = None
        lf = last_form(history, ex.slug)
        if lf is not None and lf < 70:
            focus = FOCUS_CUES.get(ex.slug, "Focus: controlled movement")
            rationale.append({"code": "focus_cue", "exercise": ex.slug, "last_form": round(lf)})

        items.append(
            PlanItemOutput(
                exercise_id=ex.id,
                slug=ex.slug,
                position=position,
                target_sets=sets,
                target_reps=target_reps,
                target_seconds=target_seconds,
                rest_seconds=rest,
                focus_cue=focus,
            )
        )
        position += 1

    if not recovery:
        _fit_to_budget(items, profile.minutes_per_session)
    est = _estimate_minutes(items)
    return PlanOutput(items=items, estimated_minutes=est, rationale=rationale)


def _fit_to_budget(items: list[PlanItemOutput], minutes: int) -> None:
    """Greedy: add/remove sets on main items (never the warm-up) until the estimate
    lands inside 80%..120% of the user's time budget."""
    main = [it for it in items if it.position > 1]
    if not main:
        return
    for _ in range(12):
        est = _estimate_minutes(items) * 60
        if est < 0.8 * minutes * 60:
            candidates = [it for it in main if it.target_sets < MAX_SETS]
            if not candidates:
                return
            min(candidates, key=lambda it: it.target_sets).target_sets += 1
        elif est > 1.2 * minutes * 60:
            candidates = [it for it in main if it.target_sets > 1]
            if not candidates:
                return
            max(candidates, key=lambda it: it.target_sets).target_sets -= 1
        else:
            return


def _volume(
    ex: ExerciseInfo, level_factor: float, multiplier: float, history: HistoryInput, today: date
) -> tuple[int, int, list[dict]]:
    rationale: list[dict] = []
    if ex.mode == "reps":
        base = max(MIN_REPS, round(ex.default_reps * level_factor))
        target = max(MIN_REPS, round(base * multiplier))
        delta = target - base
        if delta > MAX_REP_DELTA_PER_DAY:
            target = base + MAX_REP_DELTA_PER_DAY
            delta = MAX_REP_DELTA_PER_DAY
        if delta != 0:
            rationale.append({"code": "progress_reps", "exercise": ex.slug, "delta": delta})
        return target, 0, rationale
    base = max(MIN_HOLD_SECONDS, round(ex.default_seconds * level_factor / 5) * 5)
    target = max(MIN_HOLD_SECONDS, round(base * multiplier / 5) * 5)
    delta = target - base
    if delta != 0:
        rationale.append({"code": "progress_seconds", "exercise": ex.slug, "delta": delta})
    return 0, target, rationale


def _estimate_minutes(items: list[PlanItemOutput]) -> int:
    total = 0.0
    for it in items:
        per_set = it.target_reps * SECONDS_PER_REP if it.target_reps else it.target_seconds
        total += it.target_sets * per_set + max(0, it.target_sets - 1) * it.rest_seconds
        total += TRANSITION_SECONDS
    return max(1, round(total / 60))
