"""Diet & nutrition: profile, personalised plan, daily intake log, water and history.

The person's *category* is the goal and level they picked at onboarding (`UserProfile`). This
service joins it with their `NutritionProfile` body metrics and hands both to the pure engine in
`app.nutrition`, which owns every number. Days are IST calendar days, like streaks and weeks.
"""

import uuid
from collections import defaultdict
from dataclasses import fields
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.models import Food, FoodLog, NutritionProfile, User, WaterIntake
from app.nutrition import (
    BodyMetrics,
    FitnessCategory,
    FoodInfo,
    Nutrients,
    Targets,
    build_plan,
    compute_targets,
    diet_allows,
)
from app.nutrition.catalog import DIET_LABEL, GOAL_LABEL, LEVEL_LABEL
from app.nutrition.engine import bmi
from app.schemas.nutrition import (
    CategoryOut,
    DailyNutrients,
    DailyNutritionOut,
    FoodGroupOut,
    FoodLogBatchIn,
    FoodLogIn,
    FoodLogOut,
    FoodNutrients,
    FoodOut,
    FoodPickOut,
    GuidanceOut,
    HistoryDay,
    LimitItemOut,
    MealCalories,
    MealItemOut,
    MealSuggestionOut,
    NutritionHistoryOut,
    NutritionPlanOut,
    NutritionProfileIn,
    NutritionProfileOut,
    NutritionTargetsOut,
    StrategyOut,
    WaterIn,
    WaterOut,
)
from app.utils.dates import local_today

MAX_BACKFILL_DAYS = 60
MAX_WATER_ML = 10_000
NUTRIENT_FIELDS = tuple(f.name for f in fields(Nutrients))

# ---------------------------------------------------------------------------------------------
# Conversions


def _category(user: User) -> FitnessCategory:
    p = user.profile
    if p is None or p.onboarding_completed_at is None:
        raise AppError("onboarding_required", "Complete onboarding to get nutrition targets", 409)
    return FitnessCategory(
        goal=p.goal,
        level=p.level,
        minutes_per_session=p.minutes_per_session,
        days_per_week=p.days_per_week,
    )


def _body(data: NutritionProfile | NutritionProfileIn) -> BodyMetrics:
    return BodyMetrics(
        sex=data.sex,
        age=data.age,
        height_cm=data.height_cm,
        weight_kg=data.weight_kg,
        activity_level=data.activity_level,
        diet_type=data.diet_type,
    )


def _nutrients_of(row: Food | FoodLog) -> Nutrients:
    return Nutrients(**{k: float(getattr(row, k) or 0) for k in NUTRIENT_FIELDS})


def _food_info(f: Food) -> FoodInfo:
    return FoodInfo(
        id=f.id,
        slug=f.slug,
        name=f.name,
        category=f.category,
        diet=f.diet,
        serving=f.serving,
        nutrients=_nutrients_of(f),
        tags=tuple(f.tags or ()),
    )


def _nutrients_out(n: Nutrients) -> FoodNutrients:
    return FoodNutrients(**{k: round(getattr(n, k), 1) for k in NUTRIENT_FIELDS})


def _food_out(f: FoodInfo) -> FoodOut:
    return FoodOut(
        id=f.id,
        slug=f.slug,
        name=f.name,
        category=f.category,
        diet=f.diet,
        serving=f.serving,
        nutrients=_nutrients_out(f.nutrients),
        tags=list(f.tags),
    )


def _targets_out(t: Targets) -> NutritionTargetsOut:
    return NutritionTargetsOut(
        calories=t.calories,
        protein_g=t.protein_g,
        carbs_g=t.carbs_g,
        fat_g=t.fat_g,
        fiber_g=t.fiber_g,
        iron_mg=t.iron_mg,
        calcium_mg=t.calcium_mg,
        vitamin_c_mg=t.vitamin_c_mg,
        water_ml=t.water_ml,
        bmr=t.bmr,
        tdee=t.tdee,
        adjustment_pct=t.adjustment_pct,
        protein_pct=t.protein_pct,
        carbs_pct=t.carbs_pct,
        fat_pct=t.fat_pct,
        meal_calories=MealCalories(**t.meal_calories),
    )


def _profile_out(np: NutritionProfile) -> NutritionProfileOut:
    return NutritionProfileOut(
        sex=np.sex,
        age=np.age,
        height_cm=np.height_cm,
        weight_kg=np.weight_kg,
        activity_level=np.activity_level,
        diet_type=np.diet_type,
        bmi=round(bmi(_body(np)), 1),
        updated_at=np.updated_at,
    )


def _log_out(row: FoodLog) -> FoodLogOut:
    return FoodLogOut(
        id=row.id,
        date=row.log_date,
        meal=row.meal,
        food_id=row.food_id,
        name=row.name,
        serving=row.serving,
        servings=row.servings,
        nutrients=_nutrients_out(_nutrients_of(row)),
        created_at=row.created_at,
    )


def _catalog(db: Session) -> list[FoodInfo]:
    return [_food_info(f) for f in db.scalars(select(Food).order_by(Food.id)).all()]


def _resolve_date(d: date | None) -> date:
    today = local_today()
    if d is None:
        return today
    if d > today:
        raise AppError("bad_date", "Can't log food for a future day", 422)
    if d < today - timedelta(days=MAX_BACKFILL_DAYS):
        raise AppError("bad_date", f"Only the last {MAX_BACKFILL_DAYS} days can be edited", 422)
    return d


# ---------------------------------------------------------------------------------------------
# Profile & plan


def _get_profile_row(db: Session, user: User) -> NutritionProfile | None:
    return db.get(NutritionProfile, user.id)


def get_profile(db: Session, user: User) -> NutritionProfileOut | None:
    row = _get_profile_row(db, user)
    return _profile_out(row) if row else None


def upsert_profile(db: Session, user: User, data: NutritionProfileIn) -> NutritionProfileOut:
    row = _get_profile_row(db, user)
    if row is None:
        row = NutritionProfile(user_id=user.id)
        db.add(row)
    for k, v in data.model_dump().items():
        setattr(row, k, v)
    db.commit()
    db.refresh(row)
    return _profile_out(row)


def preview_targets(user: User, data: NutritionProfileIn) -> NutritionTargetsOut:
    """Targets for metrics that are not saved yet — powers the live preview while typing."""
    return _targets_out(compute_targets(_body(data), _category(user)))


def _category_out(user: User, np: NutritionProfile) -> CategoryOut:
    cat = _category(user)
    goal_label = GOAL_LABEL.get(cat.goal, cat.goal)
    level_label = LEVEL_LABEL.get(cat.level, cat.level)
    diet_label = DIET_LABEL.get(np.diet_type, np.diet_type)
    return CategoryOut(
        goal=cat.goal,
        goal_label=goal_label,
        level=cat.level,
        level_label=level_label,
        diet_type=np.diet_type,
        diet_label=diet_label,
        activity_level=np.activity_level,
        label=f"{goal_label} · {diet_label} · {level_label}",
    )


def get_plan(db: Session, user: User) -> NutritionPlanOut:
    category = _category(user)
    row = _get_profile_row(db, user)
    if row is None:
        raise AppError(
            "nutrition_profile_required", "Add your body metrics to get a nutrition plan", 409
        )
    plan = build_plan(_body(row), category, _catalog(db))
    return NutritionPlanOut(
        category=_category_out(user, row),
        profile=_profile_out(row),
        targets=_targets_out(plan.targets),
        strategy=StrategyOut(
            title=plan.strategy.title,
            summary=plan.strategy.summary,
            principles=list(plan.strategy.principles),
        ),
        food_groups=[
            FoodGroupOut(
                key=g.key,
                title=g.title,
                items=[FoodPickOut(food=_food_out(p.food), reason=p.reason) for p in g.items],
            )
            for g in plan.food_groups
        ],
        limit=[LimitItemOut(food=_food_out(i.food), reason=i.reason) for i in plan.limit],
        meals=[
            MealSuggestionOut(
                key=m.key,
                meal=m.meal,
                title=m.title,
                items=[MealItemOut(food=_food_out(i.food), servings=i.servings) for i in m.items],
                nutrients=_nutrients_out(m.nutrients),
                budget_calories=m.budget_calories,
            )
            for m in plan.meals
        ],
        guidance=[
            GuidanceOut(code=g.code, title=g.title, body=g.body, tone=g.tone) for g in plan.guidance
        ],
    )


def _targets_for(db: Session, user: User) -> NutritionTargetsOut | None:
    """Today's targets, or None while the profile (fitness or nutrition) is incomplete."""
    row = _get_profile_row(db, user)
    p = user.profile
    if row is None or p is None or p.onboarding_completed_at is None:
        return None
    return _targets_out(compute_targets(_body(row), _category(user)))


# ---------------------------------------------------------------------------------------------
# Food catalog & logging


def search_foods(db: Session, user: User, q: str | None, compatible: bool) -> list[FoodOut]:
    stmt = select(Food).order_by(Food.name)
    if q and q.strip():
        stmt = stmt.where(func.lower(Food.name).like(f"%{q.strip().lower()}%"))
    foods = [_food_info(f) for f in db.scalars(stmt).all()]
    row = _get_profile_row(db, user)
    if compatible and row is not None:
        foods = [f for f in foods if diet_allows(row.diet_type, f.diet)]
    return [_food_out(f) for f in foods]


def _new_log(
    user: User,
    day: date,
    meal: str,
    servings: float,
    *,
    food: Food | None = None,
    name: str | None = None,
    per_serving: Nutrients | None = None,
) -> FoodLog:
    """A log row from a catalog food, or from a custom name + per-serving nutrients."""
    per = _nutrients_of(food) if food is not None else (per_serving or Nutrients())
    total = per.scaled(servings).rounded()
    return FoodLog(
        user_id=user.id,
        log_date=day,
        meal=meal,
        food_id=food.id if food else None,
        name=food.name if food else (name or "Custom food"),
        serving=food.serving if food else None,
        servings=servings,
        **{k: getattr(total, k) for k in NUTRIENT_FIELDS},
    )


def _food_or_404(db: Session, food_id: int) -> Food:
    food = db.get(Food, food_id)
    if food is None:
        raise AppError("food_not_found", "That food is not in the catalog", 404)
    return food


def add_log(db: Session, user: User, data: FoodLogIn) -> FoodLogOut:
    day = _resolve_date(data.date)
    if data.food_id is not None:
        food = _food_or_404(db, data.food_id)
        row = _new_log(user, day, data.meal, data.servings, food=food)
    else:
        c = data.custom
        assert c is not None  # guaranteed by FoodLogIn's validator
        per = Nutrients(
            calories=c.calories,
            protein_g=c.protein_g,
            carbs_g=c.carbs_g,
            fat_g=c.fat_g,
            fiber_g=c.fiber_g,
        )
        row = _new_log(user, day, data.meal, data.servings, name=c.name.strip(), per_serving=per)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _log_out(row)


def add_logs_batch(db: Session, user: User, data: FoodLogBatchIn) -> list[FoodLogOut]:
    """Log a whole suggested meal in one request (and one transaction)."""
    day = _resolve_date(data.date)
    rows = [
        _new_log(user, day, data.meal, item.servings, food=_food_or_404(db, item.food_id))
        for item in data.items
    ]
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return [_log_out(r) for r in rows]


def delete_log(db: Session, user: User, log_id: uuid.UUID) -> None:
    row = db.get(FoodLog, log_id)
    if row is None or row.user_id != user.id:
        raise AppError("not_found", "Log entry not found", 404)
    db.delete(row)
    db.commit()


def add_water(db: Session, user: User, data: WaterIn) -> WaterOut:
    day = _resolve_date(data.date)
    row = db.get(WaterIntake, (user.id, day))
    if row is None:
        row = WaterIntake(user_id=user.id, log_date=day, water_ml=0)
        db.add(row)
    row.water_ml = max(0, min(MAX_WATER_ML, (row.water_ml or 0) + data.amount_ml))
    db.commit()
    return WaterOut(date=day, water_ml=row.water_ml)


# ---------------------------------------------------------------------------------------------
# Day & history


def _daily(n: Nutrients, water_ml: float) -> DailyNutrients:
    return DailyNutrients(
        **{k: round(getattr(n, k), 1) for k in NUTRIENT_FIELDS}, water_ml=float(water_ml)
    )


def day(db: Session, user: User, d: date | None) -> DailyNutritionOut:
    the_day = _resolve_date(d)
    rows = db.scalars(
        select(FoodLog)
        .where(FoodLog.user_id == user.id, FoodLog.log_date == the_day)
        .order_by(FoodLog.created_at)
    ).all()
    water = db.get(WaterIntake, (user.id, the_day))
    eaten = Nutrients()
    for r in rows:
        eaten = eaten + _nutrients_of(r)
    consumed = _daily(eaten, water.water_ml if water else 0)

    targets = _targets_for(db, user)
    remaining = None
    if targets is not None:
        remaining = DailyNutrients(
            **{
                k: round(max(0.0, getattr(targets, k) - getattr(consumed, k)), 1)
                for k in (*NUTRIENT_FIELDS, "water_ml")
            }
        )
    return DailyNutritionOut(
        date=the_day,
        has_profile=_get_profile_row(db, user) is not None,
        targets=targets,
        consumed=consumed,
        remaining=remaining,
        entries=[_log_out(r) for r in rows],
    )


def history(db: Session, user: User, days: int) -> NutritionHistoryOut:
    today = local_today()
    start = today - timedelta(days=days - 1)
    rows = db.scalars(
        select(FoodLog).where(
            FoodLog.user_id == user.id, FoodLog.log_date >= start, FoodLog.log_date <= today
        )
    ).all()
    waters = db.scalars(
        select(WaterIntake).where(
            WaterIntake.user_id == user.id,
            WaterIntake.log_date >= start,
            WaterIntake.log_date <= today,
        )
    ).all()
    eaten: dict[date, Nutrients] = defaultdict(Nutrients)
    counts: dict[date, int] = defaultdict(int)
    for r in rows:
        eaten[r.log_date] = eaten[r.log_date] + _nutrients_of(r)
        counts[r.log_date] += 1
    water_by_day = {w.log_date: w.water_ml for w in waters}

    out: list[HistoryDay] = []
    for i in range(days):
        d = start + timedelta(days=i)
        daily = _daily(eaten[d], water_by_day.get(d, 0))
        out.append(HistoryDay(date=d, entries=counts[d], **daily.model_dump()))
    return NutritionHistoryOut(days=out, targets=_targets_for(db, user))
