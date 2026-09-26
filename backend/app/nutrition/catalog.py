"""Static nutrition knowledge: energy factors, per-category targets, strategies and meal templates.

Sources for the numbers, so they can be checked rather than trusted:
- BMR: Mifflin-St Jeor (1990), the equation most dietetics bodies default to.
- Activity multipliers: the standard FAO/WHO-style PAL bands.
- Iron, calcium and vitamin C: ICMR-NIN "Nutrient Requirements for Indians" (2020) RDAs.
- Fibre: 14 g per 1000 kcal (US Dietary Guidelines), clamped to a sensible band.
- Protein per kg: sports-nutrition consensus ranges (ISSN), scaled down for goals that do not
  need muscle gain.
"""

ACTIVITY_FACTOR = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

# Sex constant in Mifflin-St Jeor. "other" sits halfway between the two published values.
BMR_SEX_CONSTANT = {"male": 5.0, "female": -161.0, "other": -78.0}

# Calorie adjustment on top of maintenance (TDEE), by the category chosen at onboarding.
GOAL_ENERGY_ADJUSTMENT = {
    "fat_loss": -0.20,
    "general": 0.0,
    "consistency": 0.0,
    "strength": 0.10,
}

# Never recommend eating below this, whatever the arithmetic says.
CALORIE_FLOOR = {"male": 1500, "female": 1200, "other": 1350}

PROTEIN_G_PER_KG = {
    "fat_loss": {"beginner": 1.6, "intermediate": 1.8, "advanced": 2.0},
    "strength": {"beginner": 1.6, "intermediate": 1.8, "advanced": 2.0},
    "general": {"beginner": 1.2, "intermediate": 1.4, "advanced": 1.6},
    "consistency": {"beginner": 1.0, "intermediate": 1.2, "advanced": 1.4},
}
# Above this BMI, protein and fat minimums are computed from the weight at this BMI instead,
# so a heavier body is not handed an unreachable gram target.
REFERENCE_BMI = 27.0
MAX_PROTEIN_SHARE = 0.35

FAT_SHARE = {"fat_loss": 0.25, "strength": 0.25, "general": 0.28, "consistency": 0.30}
MIN_FAT_G_PER_KG = 0.6
MIN_CARBS_G = 130  # the brain's daily glucose floor (RDA)

FIBER_PER_1000_KCAL = 14
FIBER_MIN_G, FIBER_MAX_G = 20, 40

WATER_ML_PER_KG = 35
WATER_ML_PER_TRAINING_MINUTE = 10
WATER_MIN_ML, WATER_MAX_ML = 2000, 4500

IRON_MG = {"male": 19.0, "female": 29.0, "other": 29.0}
CALCIUM_MG = 1000
VITAMIN_C_MG = {"male": 80, "female": 65, "other": 80}

# Share of the day's calories each meal is planned around.
MEAL_SPLIT = {"breakfast": 0.25, "lunch": 0.35, "snack": 0.10, "dinner": 0.30}

# A food suits a person when its diet rank is at or below theirs.
DIET_RANK = {"vegan": 0, "veg": 1, "egg": 2, "non_veg": 3}

DIET_LABEL = {
    "vegan": "Vegan",
    "veg": "Vegetarian",
    "egg": "Eggetarian",
    "non_veg": "Non-vegetarian",
}
GOAL_LABEL = {
    "general": "General fitness",
    "fat_loss": "Fat loss",
    "strength": "Strength",
    "consistency": "Just stay consistent",
}
LEVEL_LABEL = {"beginner": "Beginner", "intermediate": "Intermediate", "advanced": "Advanced"}

STRATEGY = {
    "fat_loss": (
        "High-protein moderate deficit",
        "About 20% under maintenance, with protein kept high so the weight you lose is fat, "
        "not muscle. Fibre-rich dal, sabzi and salad keep you full on fewer calories.",
        (
            "Build every plate around a protein source first.",
            "Fill half the plate with vegetables or salad before adding rice or roti.",
            "Swap fried snacks and sugary drinks for fruit, chana or buttermilk.",
        ),
    ),
    "strength": (
        "Lean surplus for strength",
        "About 10% above maintenance, so the extra push and leg volume in your plan has "
        "fuel to build on. Protein at every meal, carbohydrate around training.",
        (
            "Hit your protein target across 4 meals, not one big one.",
            "Eat a carb-plus-protein meal within two hours after training.",
            "Add calorie-dense whole foods — milk, peanuts, bananas — if you undershoot.",
        ),
    ),
    "general": (
        "Balanced maintenance plate",
        "Eat at maintenance: half the plate vegetables, a quarter protein, a quarter whole "
        "grains. Enough to train well and recover, without tracking every gram.",
        (
            "Half vegetables, a quarter protein, a quarter whole grains.",
            "Keep fried and sugary foods to an occasional treat.",
            "Drink water steadily through the day, more on workout days.",
        ),
    ),
    "consistency": (
        "Simple, regular meals",
        "No counting obsession. Three regular meals with a protein source in each, a "
        "sensible snack and water through the day is what makes showing up easy.",
        (
            "Eat at roughly the same times every day.",
            "One protein source in every meal: dal, curd, paneer, eggs or chicken.",
            "Carry a snack (fruit, chana, peanuts) so you never train on empty.",
        ),
    ),
}

# Meal templates. `diet` is the most permissive diet the template needs; `goals` is where it
# fits best (empty = everyone). Items are (food slug, servings) at a ~2000 kcal day's portion;
# the engine rescales servings to the person's own meal budget.
MEAL_TEMPLATES: tuple[dict, ...] = (
    # Breakfast
    {
        "key": "poha_curd",
        "meal": "breakfast",
        "title": "Vegetable poha, curd & banana",
        "diet": "veg",
        "goals": ("general", "consistency"),
        "items": (("veg_poha", 1), ("curd", 1), ("banana", 1)),
    },
    {
        "key": "oats_pb",
        "meal": "breakfast",
        "title": "Oats in milk with peanut butter & banana",
        "diet": "veg",
        "goals": ("strength", "general"),
        "items": (("oats", 1), ("milk_toned", 1), ("peanut_butter", 1), ("banana", 1)),
    },
    {
        "key": "moong_chilla",
        "meal": "breakfast",
        "title": "Moong dal chilla with orange",
        "diet": "vegan",
        "goals": ("fat_loss", "general"),
        "items": (("moong_chilla", 2), ("orange", 1)),
    },
    {
        "key": "idli_sambar",
        "meal": "breakfast",
        "title": "Idli with sambar",
        "diet": "vegan",
        "goals": ("consistency", "general"),
        "items": (("idli", 3), ("sambar", 1)),
    },
    {
        "key": "eggs_toast",
        "meal": "breakfast",
        "title": "Boiled eggs, whole-wheat toast & fruit",
        "diet": "egg",
        "goals": ("fat_loss", "strength"),
        "items": (("boiled_egg", 2), ("wheat_bread", 1), ("apple", 1)),
    },
    # Lunch
    {
        "key": "dal_roti_thali",
        "meal": "lunch",
        "title": "Roti, dal, sabzi, curd & salad",
        "diet": "veg",
        "goals": (),
        "items": (("roti", 2), ("toor_dal", 1), ("mixed_veg", 1), ("curd", 1), ("salad", 1)),
    },
    {
        "key": "rajma_rice",
        "meal": "lunch",
        "title": "Rajma, rice & salad",
        "diet": "vegan",
        "goals": ("strength", "general", "consistency"),
        "items": (("rajma", 1), ("rice", 1), ("salad", 1)),
    },
    {
        "key": "chole_brown_rice",
        "meal": "lunch",
        "title": "Chole, brown rice & salad",
        "diet": "vegan",
        "goals": ("fat_loss", "general"),
        "items": (("chole", 1), ("brown_rice", 1), ("salad", 1)),
    },
    {
        "key": "chicken_roti",
        "meal": "lunch",
        "title": "Chicken curry, roti & salad",
        "diet": "non_veg",
        "goals": ("strength", "fat_loss", "general"),
        "items": (("chicken_curry", 1), ("roti", 2), ("salad", 1)),
    },
    {
        "key": "paneer_bhurji_roti",
        "meal": "lunch",
        "title": "Paneer bhurji, roti & salad",
        "diet": "veg",
        "goals": ("strength", "fat_loss"),
        "items": (("paneer_bhurji", 1), ("roti", 2), ("salad", 1)),
    },
    # Snack
    {
        "key": "chana_fruit",
        "meal": "snack",
        "title": "Roasted chana & guava",
        "diet": "vegan",
        "goals": ("fat_loss", "general", "consistency"),
        "items": (("roasted_chana", 1), ("guava", 1)),
    },
    {
        "key": "sprouts_chaat",
        "meal": "snack",
        "title": "Sprouts chaat",
        "diet": "vegan",
        "goals": ("fat_loss", "general"),
        "items": (("sprouts", 1),),
    },
    {
        "key": "milk_banana",
        "meal": "snack",
        "title": "Milk & banana after training",
        "diet": "veg",
        "goals": ("strength", "consistency"),
        "items": (("milk_toned", 1), ("banana", 1)),
    },
    {
        "key": "buttermilk_peanuts",
        "meal": "snack",
        "title": "Buttermilk & peanuts",
        "diet": "veg",
        "goals": ("general", "strength"),
        "items": (("buttermilk", 1), ("peanuts", 1)),
    },
    {
        "key": "eggs_snack",
        "meal": "snack",
        "title": "Two boiled eggs",
        "diet": "egg",
        "goals": ("fat_loss", "strength"),
        "items": (("boiled_egg", 2),),
    },
    # Dinner
    {
        "key": "khichdi_curd",
        "meal": "dinner",
        "title": "Khichdi, curd & salad",
        "diet": "veg",
        "goals": ("consistency", "general", "fat_loss"),
        "items": (("khichdi", 1), ("curd", 1), ("salad", 1)),
    },
    {
        "key": "palak_paneer_roti",
        "meal": "dinner",
        "title": "Palak, paneer & roti",
        "diet": "veg",
        "goals": ("strength", "general"),
        "items": (("palak_sabzi", 1), ("paneer", 0.5), ("roti", 2)),
    },
    {
        "key": "soya_roti",
        "meal": "dinner",
        "title": "Soya chunk curry, roti & salad",
        "diet": "vegan",
        "goals": ("fat_loss", "strength"),
        "items": (("soya_curry", 1), ("roti", 2), ("salad", 1)),
    },
    {
        "key": "dal_rice_palak",
        "meal": "dinner",
        "title": "Dal, rice & palak",
        "diet": "vegan",
        "goals": ("general", "consistency"),
        "items": (("toor_dal", 1), ("rice", 1), ("palak_sabzi", 1)),
    },
    {
        "key": "egg_curry_roti",
        "meal": "dinner",
        "title": "Egg curry, roti & salad",
        "diet": "egg",
        "goals": ("strength", "general"),
        "items": (("egg_curry", 1), ("roti", 2), ("salad", 1)),
    },
    {
        "key": "fish_rice",
        "meal": "dinner",
        "title": "Fish curry, rice & sabzi",
        "diet": "non_veg",
        "goals": ("fat_loss", "strength", "general"),
        "items": (("fish_curry", 1), ("rice", 1), ("mixed_veg", 1)),
    },
)

# Recommended food groups: which catalog categories feed each group.
FOOD_GROUPS = (
    ("protein", "Protein sources", ("protein", "legume", "dairy")),
    ("carbs", "Smart carbohydrates", ("grain", "dish")),
    ("fats", "Healthy fats", ("nuts_seeds",)),
    ("produce", "Fruits & vegetables", ("fruit", "vegetable")),
)
FOOD_GROUP_SIZE = 5
LIMIT_LIST_SIZE = 6
