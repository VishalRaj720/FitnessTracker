import json
from datetime import timedelta
from pathlib import Path

import pytest

from app.nutrition import (
    BodyMetrics,
    FitnessCategory,
    FoodInfo,
    Nutrients,
    build_plan,
    compute_targets,
    diet_allows,
)
from app.nutrition.catalog import DIET_RANK, MEAL_TEMPLATES
from app.utils.dates import local_today
from tests.conftest import auth, onboard, register

FOODS_JSON = Path(__file__).resolve().parents[1] / "seeds" / "foods.json"
NUTRIENT_KEYS = (
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "iron_mg",
    "calcium_mg",
    "vitamin_c_mg",
)


def catalog() -> list[FoodInfo]:
    rows = json.loads(FOODS_JSON.read_text(encoding="utf-8"))
    return [
        FoodInfo(
            id=i + 1,
            slug=r["slug"],
            name=r["name"],
            category=r["category"],
            diet=r["diet"],
            serving=r["serving"],
            nutrients=Nutrients(**{k: float(r[k]) for k in NUTRIENT_KEYS}),
            tags=tuple(r["tags"]),
        )
        for i, r in enumerate(rows)
    ]


def body(**kw) -> BodyMetrics:
    base = dict(
        sex="male",
        age=20,
        height_cm=175,
        weight_kg=70,
        activity_level="moderate",
        diet_type="veg",
    )
    base.update(kw)
    return BodyMetrics(**base)


def cat(goal="general", level="beginner", minutes=15, days=4) -> FitnessCategory:
    return FitnessCategory(goal=goal, level=level, minutes_per_session=minutes, days_per_week=days)


# ---------------------------------------------------------------------------------------------
# Engine


def test_targets_match_hand_calculation():
    t = compute_targets(body(), cat())
    # Mifflin-St Jeor: 10*70 + 6.25*175 - 5*20 + 5 = 1698.75; x1.55 moderate
    assert t.bmr == 1699
    assert t.tdee == 2633
    assert t.calories == 2630
    assert t.protein_g == 84  # 1.2 g/kg, general beginner
    assert t.fiber_g == 37  # 14 g per 1000 kcal
    assert t.water_ml == 2500
    assert (t.iron_mg, t.calcium_mg, t.vitamin_c_mg) == (19, 1000, 80)
    assert t.protein_pct + t.carbs_pct + t.fat_pct == 100


def test_macros_add_up_to_the_calorie_target():
    for goal in ("general", "fat_loss", "strength", "consistency"):
        for sex in ("male", "female", "other"):
            t = compute_targets(body(sex=sex), cat(goal=goal))
            energy = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9
            assert abs(energy - t.calories) <= 15, (goal, sex, energy, t.calories)
            assert sum(t.meal_calories.values()) == pytest.approx(t.calories, abs=20)


def test_category_drives_energy_and_protein():
    b = body()
    fat_loss = compute_targets(b, cat(goal="fat_loss"))
    general = compute_targets(b, cat(goal="general"))
    strength = compute_targets(b, cat(goal="strength"))
    assert fat_loss.calories < general.calories < strength.calories
    assert fat_loss.adjustment_pct == -20 and strength.adjustment_pct == 10
    assert fat_loss.protein_g > general.protein_g
    advanced = compute_targets(b, cat(goal="strength", level="advanced"))
    assert advanced.protein_g > strength.protein_g


def test_a_deficit_never_goes_below_resting_needs():
    small = body(sex="female", age=17, height_cm=150, weight_kg=42, activity_level="sedentary")
    t = compute_targets(small, cat(goal="fat_loss"))
    assert t.calories >= t.bmr
    assert t.calories >= 1200
    assert t.carbs_g >= 100


def test_heavier_bodies_get_protein_from_a_reference_weight():
    heavy = body(weight_kg=110)  # BMI ~36
    t = compute_targets(heavy, cat(goal="fat_loss"))
    assert t.protein_g < 110 * 1.6


def test_training_volume_raises_water():
    light = compute_targets(body(), cat(minutes=10, days=3))
    heavy = compute_targets(body(), cat(minutes=30, days=6))
    assert heavy.water_ml >= light.water_ml


def test_diet_ranks():
    assert diet_allows("veg", "vegan")
    assert diet_allows("non_veg", "egg")
    assert not diet_allows("veg", "egg")
    assert not diet_allows("vegan", "veg")


def test_meal_templates_declare_their_true_diet():
    by_slug = {f.slug: f for f in catalog()}
    for t in MEAL_TEMPLATES:
        needed = max(DIET_RANK[by_slug[s].diet] for s, _ in t["items"])
        assert DIET_RANK[t["diet"]] >= needed, t["key"]


@pytest.mark.parametrize("diet", ["vegan", "veg", "egg", "non_veg"])
def test_plans_only_offer_food_the_diet_allows(diet):
    plan = build_plan(body(diet_type=diet), cat(), catalog())
    offered = [p.food for g in plan.food_groups for p in g.items]
    offered += [i.food for m in plan.meals for i in m.items]
    offered += [i.food for i in plan.limit]
    assert offered
    assert all(diet_allows(diet, f.diet) for f in offered), [f.slug for f in offered]
    # Every meal of the day has at least one suggestion.
    assert {m.meal for m in plan.meals} == {"breakfast", "lunch", "snack", "dinner"}
    assert all(g.items for g in plan.food_groups)


def test_meal_portions_scale_to_the_budget():
    big = build_plan(body(weight_kg=90, height_cm=185), cat(goal="strength"), catalog())
    small = build_plan(
        body(sex="female", weight_kg=50, height_cm=155, activity_level="light"),
        cat(goal="fat_loss"),
        catalog(),
    )
    big_lunch = next(m for m in big.meals if m.meal == "lunch")
    small_lunch = next(m for m in small.meals if m.meal == "lunch")
    assert big_lunch.nutrients.calories > small_lunch.nutrients.calories
    for m in big.meals + small.meals:
        assert 0.5 * m.budget_calories <= m.nutrients.calories <= 2 * m.budget_calories, m.key


def test_countable_foods_come_in_whole_pieces():
    for goal in ("fat_loss", "strength"):
        for diet in ("egg", "non_veg", "vegan"):
            plan = build_plan(body(diet_type=diet, weight_kg=80), cat(goal=goal), catalog())
            for m in plan.meals:
                for i in m.items:
                    if "whole" in i.food.tags:
                        assert i.servings == int(i.servings) >= 1, (m.key, i.food.slug)
                    else:
                        assert (i.servings * 2) == int(i.servings * 2), (m.key, i.food.slug)


def test_recommendations_skip_limit_foods_and_list_them_separately():
    plan = build_plan(body(diet_type="non_veg"), cat(goal="fat_loss"), catalog())
    recommended = {p.food.slug for g in plan.food_groups for p in g.items}
    limited = {i.food.slug for i in plan.limit}
    assert limited and not (recommended & limited)
    assert all("limit" in i.food.tags for i in plan.limit)
    protein = next(g for g in plan.food_groups if g.key == "protein")
    assert protein.items[0].food.slug == "chicken_breast"


def _guidance_codes(b: BodyMetrics, c: FitnessCategory) -> set[str]:
    return {g.code for g in build_plan(b, c, catalog()).guidance}


def test_guidance_reflects_the_person():
    codes = _guidance_codes(body(sex="female", diet_type="vegan"), cat())
    assert {"iron", "b12", "complete_protein", "disclaimer"} <= codes
    assert "growing" in _guidance_codes(body(age=16), cat(goal="fat_loss"))
    assert "iron" not in _guidance_codes(body(), cat())


# ---------------------------------------------------------------------------------------------
# API

PROFILE = {
    "sex": "female",
    "age": 20,
    "height_cm": 160,
    "weight_kg": 55,
    "activity_level": "light",
    "diet_type": "veg",
}


def _ready_user(client, goal="fat_loss") -> str:
    token = register(client)["access_token"]
    onboard(client, token, goal=goal)
    r = client.put("/api/v1/nutrition/profile", json=PROFILE, headers=auth(token))
    assert r.status_code == 200, r.text
    return token


def _food_id(client, token, slug):
    r = client.get("/api/v1/nutrition/foods", params={"compatible": "false"}, headers=auth(token))
    return next(f["id"] for f in r.json() if f["slug"] == slug)


def test_nutrition_requires_auth(client):
    for path in ("/profile", "/plan", "/day", "/history", "/foods"):
        assert client.get(f"/api/v1/nutrition{path}").status_code == 401


def test_plan_needs_onboarding_then_metrics(client):
    token = register(client)["access_token"]
    r = client.get("/api/v1/nutrition/plan", headers=auth(token))
    assert r.status_code == 409 and r.json()["error"]["code"] == "onboarding_required"
    onboard(client, token)
    r = client.get("/api/v1/nutrition/plan", headers=auth(token))
    assert r.status_code == 409 and r.json()["error"]["code"] == "nutrition_profile_required"
    assert client.get("/api/v1/nutrition/profile", headers=auth(token)).json() is None


def test_profile_validation(client):
    token = register(client)["access_token"]
    onboard(client, token)
    for bad in ({"age": 5}, {"height_cm": 50}, {"diet_type": "keto"}, {"sex": "x"}):
        r = client.put("/api/v1/nutrition/profile", json={**PROFILE, **bad}, headers=auth(token))
        assert r.status_code == 422, bad


def test_preview_does_not_save_and_matches_the_plan(client):
    token = register(client)["access_token"]
    onboard(client, token, goal="fat_loss")
    r = client.post("/api/v1/nutrition/preview", json=PROFILE, headers=auth(token))
    assert r.status_code == 200
    preview = r.json()
    assert client.get("/api/v1/nutrition/profile", headers=auth(token)).json() is None

    client.put("/api/v1/nutrition/profile", json=PROFILE, headers=auth(token))
    plan = client.get("/api/v1/nutrition/plan", headers=auth(token)).json()
    assert plan["targets"] == preview
    assert plan["category"]["goal"] == "fat_loss"
    assert plan["category"]["label"] == "Fat loss · Vegetarian · Beginner"
    assert plan["profile"]["bmi"] == pytest.approx(21.5, abs=0.1)
    assert plan["targets"]["adjustment_pct"] < 0
    assert plan["food_groups"] and plan["meals"] and plan["guidance"] and plan["limit"]
    assert plan["strategy"]["title"] == "High-protein moderate deficit"


def test_changing_the_onboarding_goal_changes_the_targets(client):
    token = _ready_user(client, goal="fat_loss")
    cut = client.get("/api/v1/nutrition/plan", headers=auth(token)).json()["targets"]
    onboard(client, token, goal="strength")
    bulk = client.get("/api/v1/nutrition/plan", headers=auth(token)).json()["targets"]
    assert bulk["calories"] > cut["calories"]


def test_food_search_respects_diet(client):
    token = _ready_user(client)
    slugs = {f["slug"] for f in client.get("/api/v1/nutrition/foods", headers=auth(token)).json()}
    assert "paneer" in slugs and "chicken_curry" not in slugs and "boiled_egg" not in slugs
    r = client.get(
        "/api/v1/nutrition/foods", params={"q": "chick", "compatible": "false"}, headers=auth(token)
    )
    assert {f["slug"] for f in r.json()} >= {"chicken_curry", "chicken_breast"}


def test_logging_a_day(client):
    token = _ready_user(client)
    roti = _food_id(client, token, "roti")
    dal = _food_id(client, token, "toor_dal")

    r = client.post(
        "/api/v1/nutrition/logs",
        json={"meal": "lunch", "food_id": roti, "servings": 2},
        headers=auth(token),
    )
    assert r.status_code == 201
    roti_entry = r.json()
    assert roti_entry["nutrients"]["calories"] == 208
    assert roti_entry["serving"] == "1 medium roti (40 g)"

    r = client.post(
        "/api/v1/nutrition/logs",
        json={
            "meal": "snack",
            "custom": {"name": "Protein bar", "calories": 200, "protein_g": 20},
        },
        headers=auth(token),
    )
    assert r.status_code == 201 and r.json()["food_id"] is None

    r = client.post(
        "/api/v1/nutrition/logs/batch",
        json={"meal": "dinner", "items": [{"food_id": dal, "servings": 1}]},
        headers=auth(token),
    )
    assert r.status_code == 201 and len(r.json()) == 1

    day = client.get("/api/v1/nutrition/day", headers=auth(token)).json()
    assert day["has_profile"] is True
    assert len(day["entries"]) == 3
    assert day["consumed"]["calories"] == pytest.approx(208 + 200 + 150)
    assert day["consumed"]["protein_g"] == pytest.approx(7.2 + 20 + 9)
    assert day["remaining"]["calories"] == pytest.approx(
        day["targets"]["calories"] - day["consumed"]["calories"]
    )

    r = client.delete(f"/api/v1/nutrition/logs/{roti_entry['id']}", headers=auth(token))
    assert r.status_code == 204
    day = client.get("/api/v1/nutrition/day", headers=auth(token)).json()
    assert len(day["entries"]) == 2


def test_log_validation(client):
    token = _ready_user(client)
    roti = _food_id(client, token, "roti")
    bad = [
        {"meal": "lunch"},  # neither source
        {"meal": "lunch", "food_id": roti, "custom": {"name": "x", "calories": 1}},  # both
        {"meal": "brunch", "food_id": roti},
        {"meal": "lunch", "food_id": roti, "servings": 0},
    ]
    for body_ in bad:
        r = client.post("/api/v1/nutrition/logs", json=body_, headers=auth(token))
        assert r.status_code == 422, body_
    r = client.post(
        "/api/v1/nutrition/logs", json={"meal": "lunch", "food_id": 99999}, headers=auth(token)
    )
    assert r.status_code == 404

    tomorrow = (local_today() + timedelta(days=1)).isoformat()
    r = client.post(
        "/api/v1/nutrition/logs",
        json={"meal": "lunch", "food_id": roti, "date": tomorrow},
        headers=auth(token),
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "bad_date"
    r = client.get("/api/v1/nutrition/day", params={"date": tomorrow}, headers=auth(token))
    assert r.status_code == 422


def test_cannot_delete_someone_elses_log(client):
    owner = _ready_user(client)
    roti = _food_id(client, owner, "roti")
    entry = client.post(
        "/api/v1/nutrition/logs", json={"meal": "lunch", "food_id": roti}, headers=auth(owner)
    ).json()
    intruder = _ready_user(client)
    r = client.delete(f"/api/v1/nutrition/logs/{entry['id']}", headers=auth(intruder))
    assert r.status_code == 404
    assert len(client.get("/api/v1/nutrition/day", headers=auth(owner)).json()["entries"]) == 1


def test_water_accumulates_and_clamps(client):
    token = _ready_user(client)
    for _ in range(2):
        r = client.post("/api/v1/nutrition/water", json={"amount_ml": 250}, headers=auth(token))
    assert r.json()["water_ml"] == 500
    r = client.post("/api/v1/nutrition/water", json={"amount_ml": -1000}, headers=auth(token))
    assert r.json()["water_ml"] == 0
    r = client.post("/api/v1/nutrition/water", json={"amount_ml": 0}, headers=auth(token))
    assert r.status_code == 422
    client.post("/api/v1/nutrition/water", json={"amount_ml": 750}, headers=auth(token))
    day = client.get("/api/v1/nutrition/day", headers=auth(token)).json()
    assert day["consumed"]["water_ml"] == 750


def test_history_covers_the_requested_days(client):
    token = _ready_user(client)
    roti = _food_id(client, token, "roti")
    yesterday = (local_today() - timedelta(days=1)).isoformat()
    client.post(
        "/api/v1/nutrition/logs",
        json={"meal": "dinner", "food_id": roti, "date": yesterday},
        headers=auth(token),
    )
    h = client.get("/api/v1/nutrition/history", params={"days": 7}, headers=auth(token)).json()
    assert len(h["days"]) == 7
    assert h["days"][-1]["date"] == local_today().isoformat()
    assert h["days"][-2]["calories"] == 104 and h["days"][-2]["entries"] == 1
    assert h["targets"]["calories"] > 0


def test_day_works_before_the_profile_exists(client):
    token = register(client)["access_token"]
    onboard(client, token)
    day = client.get("/api/v1/nutrition/day", headers=auth(token)).json()
    assert day["has_profile"] is False
    assert day["targets"] is None and day["remaining"] is None
    assert day["consumed"]["calories"] == 0
