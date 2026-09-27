"""Deterministic nutrition engine: body metrics + fitness category -> targets and advice.

Same contract as the workout recommender: pure functions over plain dataclasses, no I/O, so
every number the app shows can be reproduced in a unit test.
"""

from __future__ import annotations

import math

from app.nutrition.catalog import (
    ACTIVITY_FACTOR,
    BMR_SEX_CONSTANT,
    CALCIUM_MG,
    CALORIE_FLOOR,
    DIET_RANK,
    FAT_SHARE,
    FIBER_MAX_G,
    FIBER_MIN_G,
    FIBER_PER_1000_KCAL,
    FOOD_GROUP_SIZE,
    FOOD_GROUPS,
    GOAL_ENERGY_ADJUSTMENT,
    IRON_MG,
    LIMIT_LIST_SIZE,
    MAX_PROTEIN_SHARE,
    MEAL_SPLIT,
    MEAL_TEMPLATES,
    MIN_CARBS_G,
    MIN_FAT_G_PER_KG,
    PROTEIN_G_PER_KG,
    REFERENCE_BMI,
    STRATEGY,
    VITAMIN_C_MG,
    WATER_MAX_ML,
    WATER_MIN_ML,
    WATER_ML_PER_KG,
    WATER_ML_PER_TRAINING_MINUTE,
)
from app.nutrition.types import (
    MEALS,
    BodyMetrics,
    FitnessCategory,
    FoodGroup,
    FoodInfo,
    FoodPick,
    Guidance,
    LimitItem,
    MealItem,
    MealSuggestion,
    Nutrients,
    NutritionPlan,
    Strategy,
    Targets,
)


def diet_allows(person_diet: str, food_diet: str) -> bool:
    """A vegetarian can eat vegan food; nobody is offered food their diet excludes."""
    return DIET_RANK.get(food_diet, 99) <= DIET_RANK.get(person_diet, -1)


def bmi(body: BodyMetrics) -> float:
    h = body.height_cm / 100
    return body.weight_kg / (h * h)


def _reference_weight(body: BodyMetrics) -> float:
    h = body.height_cm / 100
    return body.weight_kg if bmi(body) <= REFERENCE_BMI else REFERENCE_BMI * h * h


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def compute_targets(body: BodyMetrics, category: FitnessCategory) -> Targets:
    bmr = (
        10 * body.weight_kg
        + 6.25 * body.height_cm
        - 5 * body.age
        + BMR_SEX_CONSTANT.get(body.sex, BMR_SEX_CONSTANT["other"])
    )
    tdee = bmr * ACTIVITY_FACTOR[body.activity_level]
    adjustment = GOAL_ENERGY_ADJUSTMENT.get(category.goal, 0.0)
    calories = tdee * (1 + adjustment)
    floor = CALORIE_FLOOR.get(body.sex, CALORIE_FLOOR["other"])
    # A deficit never goes below resting needs; young people especially must not.
    calories = max(calories, floor, bmr) if adjustment < 0 else max(calories, floor)
    calories = round(calories / 10) * 10

    ref_w = _reference_weight(body)
    per_kg = PROTEIN_G_PER_KG.get(category.goal, PROTEIN_G_PER_KG["general"])
    protein = min(ref_w * per_kg.get(category.level, 1.2), calories * MAX_PROTEIN_SHARE / 4)
    fat_min = MIN_FAT_G_PER_KG * ref_w
    fat = max(calories * FAT_SHARE.get(category.goal, 0.28) / 9, fat_min)
    carbs = (calories - protein * 4 - fat * 9) / 4
    if carbs < MIN_CARBS_G:
        # Free calories for carbohydrate: fat first (down to its minimum), then protein
        # (down to 1 g/kg). Only tiny calorie budgets ever reach this branch.
        short = (MIN_CARBS_G - carbs) * 4
        take = min(short, max(0.0, (fat - fat_min) * 9))
        fat -= take / 9
        short -= take
        if short > 0:
            take = min(short, max(0.0, (protein - ref_w) * 4))
            protein -= take / 4
        carbs = (calories - protein * 4 - fat * 9) / 4

    protein_g, fat_g, carbs_g = round(protein), round(fat), max(0, round(carbs))
    protein_pct = round(protein_g * 4 * 100 / calories)
    fat_pct = round(fat_g * 9 * 100 / calories)
    weekly_minutes = category.minutes_per_session * category.days_per_week
    water = body.weight_kg * WATER_ML_PER_KG + weekly_minutes * WATER_ML_PER_TRAINING_MINUTE / 7

    return Targets(
        bmr=round(bmr),
        tdee=round(tdee),
        adjustment_pct=round((calories / tdee - 1) * 100),
        calories=int(calories),
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        fiber_g=int(_clamp(round(calories / 1000 * FIBER_PER_1000_KCAL), FIBER_MIN_G, FIBER_MAX_G)),
        water_ml=int(_clamp(round(water / 250) * 250, WATER_MIN_ML, WATER_MAX_ML)),
        iron_mg=IRON_MG.get(body.sex, IRON_MG["other"]),
        calcium_mg=CALCIUM_MG,
        vitamin_c_mg=VITAMIN_C_MG.get(body.sex, VITAMIN_C_MG["other"]),
        protein_pct=protein_pct,
        carbs_pct=100 - protein_pct - fat_pct,
        fat_pct=fat_pct,
        meal_calories={m: round(calories * MEAL_SPLIT[m] / 10) * 10 for m in MEALS},
    )


# ---------------------------------------------------------------------------------------------
# Food ranking


def _fmt(x: float) -> str:
    return f"{round(x, 1):g}"


def _per_100_kcal(amount: float, n: Nutrients) -> float:
    return amount * 100 / n.calories if n.calories else 0.0


def _score(group: str, goal: str, body: BodyMetrics, f: FoodInfo) -> float:
    n = f.nutrients
    dense = "calorie_dense" in f.tags
    if group == "protein":
        s = _per_100_kcal(n.protein_g, n) * 4 + (n.protein_g * 0.4 if goal == "strength" else 0)
        return s - (8 if dense and goal == "fat_loss" else 0)
    if group == "carbs":
        s = _per_100_kcal(n.fiber_g, n) * 6
        if goal == "strength":
            s += n.carbs_g * 0.08
        if goal == "fat_loss":
            s -= n.fat_g * 0.4 + (6 if dense else 0)
        return s - (3 if dense else 0)
    if group == "fats":
        return n.protein_g + n.fiber_g * 2 - (n.calories / 60 if goal == "fat_loss" else 0)
    # produce
    iron_weight = 4 if body.sex != "male" else 1.5
    s = min(n.vitamin_c_mg, 120) / 12 + n.fiber_g * 2.5 + n.iron_mg * iron_weight
    return s + n.calcium_mg / 60 - (n.calories / 40 if goal == "fat_loss" else 0)


def _reason(group: str, f: FoodInfo) -> str:
    n = f.nutrients
    if group == "protein":
        return f"{_fmt(n.protein_g)} g protein · {_fmt(n.calories)} kcal"
    if group == "carbs":
        return f"{_fmt(n.carbs_g)} g carbs · {_fmt(n.fiber_g)} g fibre"
    if group == "fats":
        return f"{_fmt(n.fat_g)} g fat · {_fmt(n.protein_g)} g protein"
    best = max(
        (
            (n.vitamin_c_mg / 80, f"{_fmt(n.vitamin_c_mg)} mg vitamin C"),
            (n.iron_mg / 19, f"{_fmt(n.iron_mg)} mg iron"),
            (n.calcium_mg / 1000, f"{_fmt(n.calcium_mg)} mg calcium"),
            (n.fiber_g / 30, f"{_fmt(n.fiber_g)} g fibre"),
        ),
        key=lambda t: t[0],
    )
    return f"{best[1]} · {_fmt(n.calories)} kcal"


def recommend_food_groups(
    category: FitnessCategory, body: BodyMetrics, foods: list[FoodInfo]
) -> tuple[FoodGroup, ...]:
    allowed = [f for f in foods if diet_allows(body.diet_type, f.diet) and "limit" not in f.tags]
    groups: list[FoodGroup] = []
    for key, title, categories in FOOD_GROUPS:
        pool = [f for f in allowed if f.category in categories]
        pool.sort(key=lambda f: (-_score(key, category.goal, body, f), f.slug))
        picks = tuple(FoodPick(food=f, reason=_reason(key, f)) for f in pool[:FOOD_GROUP_SIZE])
        groups.append(FoodGroup(key=key, title=title, items=picks))
    return tuple(groups)


_LIMIT_REASON = (
    ("fried", "Deep-fried"),
    ("sugary", "Mostly added sugar"),
    ("refined", "Refined flour, high sodium"),
    ("red_meat", "Red meat, high in saturated fat"),
    ("creamy", "Butter and cream heavy"),
)


def limit_list(body: BodyMetrics, foods: list[FoodInfo]) -> tuple[LimitItem, ...]:
    pool = [f for f in foods if "limit" in f.tags and diet_allows(body.diet_type, f.diet)]
    pool.sort(key=lambda f: (-f.nutrients.calories, f.slug))
    out: list[LimitItem] = []
    for f in pool[:LIMIT_LIST_SIZE]:
        why = next((label for tag, label in _LIMIT_REASON if tag in f.tags), "Occasional food")
        n = f.nutrients
        detail = f"{_fmt(n.calories)} kcal"
        if "sugary" in f.tags:
            detail += f", {_fmt(n.carbs_g)} g sugar/carbs"
        elif n.fat_g >= 5:
            detail += f", {_fmt(n.fat_g)} g fat"
        out.append(LimitItem(food=f, reason=f"{why} — {detail} per {f.serving}"))
    return tuple(out)


# ---------------------------------------------------------------------------------------------
# Meals


def _portion(food: FoodInfo, servings: float) -> float:
    """Countable foods (eggs, roti, fruit) round to whole pieces, halves rounding down so a
    meal leans under its budget; everything else rounds to the nearest half serving."""
    if "whole" in food.tags:
        return float(max(1, math.ceil(servings - 0.5)))
    return max(0.5, round(servings * 2) / 2)


def suggest_meals(
    category: FitnessCategory, body: BodyMetrics, targets: Targets, foods: list[FoodInfo]
) -> tuple[MealSuggestion, ...]:
    by_slug = {f.slug: f for f in foods}
    person_rank = DIET_RANK.get(body.diet_type, 0)
    out: list[MealSuggestion] = []
    for meal in MEALS:
        candidates = [
            (i, t)
            for i, t in enumerate(MEAL_TEMPLATES)
            if t["meal"] == meal
            and diet_allows(body.diet_type, t["diet"])
            and all(slug in by_slug for slug, _ in t["items"])
        ]

        def rank(pair: tuple[int, dict]) -> tuple[int, int, int]:
            i, t = pair
            goal_fit = 0 if category.goal in t["goals"] else (1 if not t["goals"] else 2)
            diet_fit = 0 if DIET_RANK[t["diet"]] == person_rank else 1
            return (goal_fit, diet_fit, i)

        budget = targets.meal_calories.get(meal, 0)
        for _, t in sorted(candidates, key=rank)[:2]:
            base = sum(by_slug[s].nutrients.calories * k for s, k in t["items"])
            factor = _clamp(budget / base, 0.75, 1.75) if base else 1.0
            items = tuple(
                MealItem(food=by_slug[s], servings=_portion(by_slug[s], k * factor))
                for s, k in t["items"]
            )
            total = Nutrients()
            for it in items:
                total = total + it.food.nutrients.scaled(it.servings)
            out.append(
                MealSuggestion(
                    key=t["key"],
                    meal=meal,
                    title=t["title"],
                    items=items,
                    nutrients=total.rounded(),
                    budget_calories=budget,
                )
            )
    return tuple(out)


# ---------------------------------------------------------------------------------------------
# Guidance


def guidance(
    category: FitnessCategory, body: BodyMetrics, targets: Targets
) -> tuple[Guidance, ...]:
    g: list[Guidance] = [
        Guidance(
            "protein_spread",
            "Spread your protein",
            f"Aim for about {round(targets.protein_g / 4)} g of protein at each of four meals — "
            "your body uses it better than one big dose at dinner.",
            "tip",
        ),
        Guidance(
            "hydration",
            "Hydration",
            f"{_fmt(targets.water_ml / 1000)} L a day is about {targets.water_ml // 250} glasses. "
            "Add a glass for every 15–20 minutes of training.",
            "info",
        ),
        Guidance(
            "training_fuel",
            "Fuel the session",
            "Have a light carb-plus-protein snack 60–90 minutes before your "
            f"{category.minutes_per_session}-minute workout, and a proper meal within two hours "
            "after it.",
            "tip",
        ),
    ]

    gap = abs(targets.tdee - targets.calories)
    if category.goal == "fat_loss":
        g.append(
            Guidance(
                "steady_deficit",
                "Steady, not drastic",
                f"Your target sits about {gap} kcal under maintenance. Crash dieting costs muscle "
                "and the energy you need to train — keep it steady.",
                "info",
            )
        )
    elif category.goal == "strength":
        g.append(
            Guidance(
                "surplus",
                "Eat enough to grow",
                f"You're about {gap} kcal above maintenance. If your weight hasn't moved in three "
                "weeks, add a glass of milk or a handful of peanuts.",
                "info",
            )
        )
    elif category.goal == "consistency":
        g.append(
            Guidance(
                "routine",
                "Routine beats perfection",
                "Regular meal times make regular workouts easier. Don't train on an empty "
                "stomach and don't skip breakfast on workout days.",
                "info",
            )
        )
    else:
        g.append(
            Guidance(
                "plate",
                "The balanced plate",
                "Half vegetables, a quarter protein, a quarter whole grains — at lunch and dinner.",
                "info",
            )
        )

    if body.age < 18:
        g.append(
            Guidance(
                "growing",
                "Still growing",
                "Under 18, your body needs energy to grow. These targets never drop below your "
                "resting needs — don't cut further on your own.",
                "warn",
            )
        )

    if body.diet_type == "vegan":
        g += [
            Guidance(
                "b12",
                "Vitamin B12",
                "Plant foods have almost no natural B12. Ask a doctor about a supplement or "
                "fortified foods.",
                "warn",
            ),
            Guidance(
                "complete_protein",
                "Combine proteins",
                "Pair dal, rajma or chole with rice or roti — together they cover every essential "
                "amino acid. Tofu and soya chunks are your densest protein.",
                "tip",
            ),
        ]
    elif body.diet_type == "veg":
        g.append(
            Guidance(
                "b12",
                "Vitamin B12",
                "B12 comes mainly from animal foods. Have curd, milk or paneer every day to cover "
                "it.",
                "warn",
            )
        )
    elif body.diet_type == "egg":
        g.append(
            Guidance(
                "eggs",
                "Eggs are an easy win",
                "Two eggs give about 13 g of complete protein plus B12 — a quick breakfast or "
                "post-workout snack.",
                "tip",
            )
        )
    else:
        g.append(
            Guidance(
                "lean_meat",
                "Choose lean",
                "Prefer chicken, fish and eggs — curried or grilled rather than fried. Keep red "
                "and processed meat occasional.",
                "tip",
            )
        )

    if body.sex != "male":
        g.append(
            Guidance(
                "iron",
                "Iron matters",
                f"Your iron target is {_fmt(targets.iron_mg)} mg. Pair dal, chana, palak or bajra "
                "with vitamin C (lemon, amla, guava) and keep tea and coffee away from meals.",
                "warn",
            )
        )

    g += [
        Guidance(
            "mess",
            "Mess-hall hacks",
            "Ask for less gravy and oil, add curd and salad, and take a second helping of dal "
            "before a second helping of rice.",
            "tip",
        ),
        Guidance(
            "disclaimer",
            "General guidance",
            "These are estimates for healthy adults, not medical advice. With a medical "
            "condition, check with a doctor or registered dietitian.",
            "info",
        ),
    ]
    return tuple(g)


def build_plan(
    body: BodyMetrics, category: FitnessCategory, foods: list[FoodInfo]
) -> NutritionPlan:
    targets = compute_targets(body, category)
    title, summary, principles = STRATEGY.get(category.goal, STRATEGY["general"])
    return NutritionPlan(
        targets=targets,
        strategy=Strategy(title=title, summary=summary, principles=principles),
        food_groups=recommend_food_groups(category, body, foods),
        limit=limit_list(body, foods),
        meals=suggest_meals(category, body, targets, foods),
        guidance=guidance(category, body, targets),
    )
