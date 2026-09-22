"""Static knowledge: category composition per goal, level factors, templates per time budget."""

LEVEL_INDEX = {"beginner": 1, "intermediate": 2, "advanced": 3}

# Multiplier applied to an exercise's default (intermediate) volume.
LEVEL_FACTOR = {"beginner": 0.7, "intermediate": 1.0, "advanced": 1.3}

# Ordered main-slot categories per goal. Truncated/extended to the template's slot count.
COMPOSITION = {
    "general": ["legs", "cardio", "core", "push", "legs"],
    "fat_loss": ["cardio", "legs", "cardio", "core", "push"],
    "strength": ["legs", "push", "core", "push", "legs"],
    "consistency": ["legs", "cardio", "core", "push", "legs"],
}

# minutes -> (main slots, sets per exercise, rest seconds)
TEMPLATES = {
    10: (3, 2, 30),
    15: (4, 2, 30),
    20: (4, 3, 30),
    30: (5, 3, 40),
}

WARMUP_CATEGORY = "mobility"
WARMUP_SECONDS = 60

# Seconds per rep used for time estimation.
SECONDS_PER_REP = 3.5
TRANSITION_SECONDS = 25  # includes camera re-framing between exercises

# Progression bounds
MAX_REP_DELTA_PER_DAY = 2
MIN_REPS = 4
MIN_HOLD_SECONDS = 10
MAX_SETS = 4


def template_for(minutes: int) -> tuple[int, int, int]:
    keys = sorted(TEMPLATES)
    chosen = keys[0]
    for k in keys:
        if minutes >= k:
            chosen = k
    return TEMPLATES[chosen]
