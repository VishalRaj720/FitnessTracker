"""Wire shapes for /nutrition.

One nutrient vocabulary is used everywhere — `calories`, `protein_g`, `carbs_g`, `fat_g`,
`fiber_g`, `iron_mg`, `calcium_mg`, `vitamin_c_mg` (+ `water_ml` on a day) — so a target, what
was eaten and what is left can be compared field by field without any mapping on the client.
"""

import datetime as dt
import uuid
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Sex = Literal["male", "female", "other"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]
DietType = Literal["vegan", "veg", "egg", "non_veg"]
Meal = Literal["breakfast", "lunch", "snack", "dinner"]


class NutritionProfileIn(BaseModel):
    sex: Sex
    age: int = Field(ge=14, le=80)
    height_cm: float = Field(ge=120, le=230)
    weight_kg: float = Field(ge=30, le=250)
    activity_level: ActivityLevel
    diet_type: DietType


class NutritionProfileOut(NutritionProfileIn):
    bmi: float
    updated_at: dt.datetime


class FoodNutrients(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    iron_mg: float
    calcium_mg: float
    vitamin_c_mg: float


class DailyNutrients(FoodNutrients):
    water_ml: float


class MealCalories(BaseModel):
    breakfast: int
    lunch: int
    snack: int
    dinner: int


class NutritionTargetsOut(DailyNutrients):
    bmr: int
    tdee: int
    adjustment_pct: int
    protein_pct: int
    carbs_pct: int
    fat_pct: int
    meal_calories: MealCalories


class CategoryOut(BaseModel):
    """The person's category: their onboarding goal and level, plus diet and activity."""

    goal: str
    goal_label: str
    level: str
    level_label: str
    diet_type: str
    diet_label: str
    activity_level: str
    label: str


class FoodOut(BaseModel):
    id: int
    slug: str
    name: str
    category: str
    diet: str
    serving: str
    nutrients: FoodNutrients
    tags: list[str]


class FoodPickOut(BaseModel):
    food: FoodOut
    reason: str


class FoodGroupOut(BaseModel):
    key: str
    title: str
    items: list[FoodPickOut]


class LimitItemOut(BaseModel):
    food: FoodOut
    reason: str


class MealItemOut(BaseModel):
    food: FoodOut
    servings: float


class MealSuggestionOut(BaseModel):
    key: str
    meal: Meal
    title: str
    items: list[MealItemOut]
    nutrients: FoodNutrients
    budget_calories: int


class StrategyOut(BaseModel):
    title: str
    summary: str
    principles: list[str]


class GuidanceOut(BaseModel):
    code: str
    title: str
    body: str
    tone: Literal["info", "tip", "warn"]


class NutritionPlanOut(BaseModel):
    category: CategoryOut
    profile: NutritionProfileOut
    targets: NutritionTargetsOut
    strategy: StrategyOut
    food_groups: list[FoodGroupOut]
    limit: list[LimitItemOut]
    meals: list[MealSuggestionOut]
    guidance: list[GuidanceOut]


class CustomFoodIn(BaseModel):
    """Something not in the catalog. Macros are the per-serving values the person enters."""

    name: str = Field(min_length=1, max_length=80)
    calories: float = Field(ge=0, le=3000)
    protein_g: float = Field(default=0, ge=0, le=300)
    carbs_g: float = Field(default=0, ge=0, le=500)
    fat_g: float = Field(default=0, ge=0, le=300)
    fiber_g: float = Field(default=0, ge=0, le=100)


class FoodLogIn(BaseModel):
    meal: Meal
    food_id: int | None = None
    custom: CustomFoodIn | None = None
    servings: float = Field(default=1, gt=0, le=10)
    date: dt.date | None = None

    @model_validator(mode="after")
    def _one_source(self):
        if (self.food_id is None) == (self.custom is None):
            raise ValueError("send exactly one of food_id or custom")
        return self


class FoodLogBatchItem(BaseModel):
    food_id: int
    servings: float = Field(default=1, gt=0, le=10)


class FoodLogBatchIn(BaseModel):
    meal: Meal
    items: list[FoodLogBatchItem] = Field(min_length=1, max_length=12)
    date: dt.date | None = None


class FoodLogOut(BaseModel):
    id: uuid.UUID
    date: dt.date
    meal: Meal
    food_id: int | None
    name: str
    serving: str | None
    servings: float
    nutrients: FoodNutrients
    created_at: dt.datetime


class WaterIn(BaseModel):
    amount_ml: int = Field(ge=-2000, le=2000)
    date: dt.date | None = None

    @model_validator(mode="after")
    def _non_zero(self):
        if self.amount_ml == 0:
            raise ValueError("amount_ml must not be 0")
        return self


class WaterOut(BaseModel):
    date: dt.date
    water_ml: int


class DailyNutritionOut(BaseModel):
    date: dt.date
    has_profile: bool
    targets: NutritionTargetsOut | None
    consumed: DailyNutrients
    remaining: DailyNutrients | None
    entries: list[FoodLogOut]


class HistoryDay(DailyNutrients):
    date: dt.date
    entries: int


class NutritionHistoryOut(BaseModel):
    days: list[HistoryDay]
    targets: NutritionTargetsOut | None
