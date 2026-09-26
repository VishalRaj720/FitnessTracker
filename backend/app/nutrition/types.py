"""Plain data types for the nutrition engine. This package must never import SQLAlchemy or
FastAPI — the service layer converts rows into these and back, exactly like the recommender."""

from __future__ import annotations

from dataclasses import dataclass, field, fields

MEALS = ("breakfast", "lunch", "snack", "dinner")


@dataclass(frozen=True)
class Nutrients:
    """Amounts for one serving, one log entry or one day. Water lives on the day, not here."""

    calories: float = 0.0
    protein_g: float = 0.0
    carbs_g: float = 0.0
    fat_g: float = 0.0
    fiber_g: float = 0.0
    iron_mg: float = 0.0
    calcium_mg: float = 0.0
    vitamin_c_mg: float = 0.0

    def scaled(self, k: float) -> Nutrients:
        return Nutrients(**{f.name: getattr(self, f.name) * k for f in fields(self)})

    def __add__(self, other: Nutrients) -> Nutrients:
        return Nutrients(
            **{f.name: getattr(self, f.name) + getattr(other, f.name) for f in fields(self)}
        )

    def rounded(self) -> Nutrients:
        return Nutrients(**{f.name: round(getattr(self, f.name), 1) for f in fields(self)})


@dataclass(frozen=True)
class BodyMetrics:
    sex: str  # male|female|other
    age: int
    height_cm: float
    weight_kg: float
    activity_level: str  # sedentary|light|moderate|active|very_active
    diet_type: str  # vegan|veg|egg|non_veg


@dataclass(frozen=True)
class FitnessCategory:
    """The category the person picked during onboarding, plus their training volume."""

    goal: str  # general|fat_loss|strength|consistency
    level: str  # beginner|intermediate|advanced
    minutes_per_session: int
    days_per_week: int


@dataclass(frozen=True)
class Targets:
    bmr: int
    tdee: int
    adjustment_pct: int
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    fiber_g: int
    water_ml: int
    iron_mg: float
    calcium_mg: int
    vitamin_c_mg: int
    protein_pct: int
    carbs_pct: int
    fat_pct: int
    meal_calories: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class FoodInfo:
    id: int
    slug: str
    name: str
    category: str  # grain|legume|dairy|protein|fruit|vegetable|nuts_seeds|dish|snack|beverage
    diet: str  # vegan|veg|egg|non_veg — the most permissive diet the food needs
    serving: str
    nutrients: Nutrients
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class FoodPick:
    food: FoodInfo
    reason: str


@dataclass(frozen=True)
class FoodGroup:
    key: str
    title: str
    items: tuple[FoodPick, ...]


@dataclass(frozen=True)
class LimitItem:
    food: FoodInfo
    reason: str


@dataclass(frozen=True)
class MealItem:
    food: FoodInfo
    servings: float


@dataclass(frozen=True)
class MealSuggestion:
    key: str
    meal: str
    title: str
    items: tuple[MealItem, ...]
    nutrients: Nutrients
    budget_calories: int


@dataclass(frozen=True)
class Guidance:
    code: str
    title: str
    body: str
    tone: str  # info|tip|warn


@dataclass(frozen=True)
class Strategy:
    title: str
    summary: str
    principles: tuple[str, ...]


@dataclass(frozen=True)
class NutritionPlan:
    targets: Targets
    strategy: Strategy
    food_groups: tuple[FoodGroup, ...]
    limit: tuple[LimitItem, ...]
    meals: tuple[MealSuggestion, ...]
    guidance: tuple[Guidance, ...]
