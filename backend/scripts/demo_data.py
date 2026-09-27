"""Seed a believable demo campus: 8 students at 'Demo Institute of Technology', one squad,
3 weeks of sessions with rising form scores. Idempotent (skips if demo users exist).

Run:  uv run python -m scripts.demo_data
Demo login: demo@fitsathi.app / demo12345
"""

import random
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Exercise,
    Institute,
    SessionExercise,
    Squad,
    SquadMember,
    User,
    UserProfile,
    UserStats,
    WorkoutSession,
)
from app.utils.dates import IST
from seeds.seed import seed_all

STUDENTS = [
    ("demo@fitsathi.app", "Asha", "CSE", "Block C"),
    ("rahul@fitsathi.app", "Rahul", "CSE", "Block C"),
    ("priya@fitsathi.app", "Priya", "CSE", "Block A"),
    ("arjun@fitsathi.app", "Arjun", "CSE", "Block B"),
    ("neha@fitsathi.app", "Neha", "CSE", "Block A"),
    ("vikram@fitsathi.app", "Vikram", "ECE", "Block D"),
    ("sana@fitsathi.app", "Sana", "ECE", "Block D"),
    ("dev@fitsathi.app", "Dev", "MECH", "Block E"),
]
PASSWORD = "demo12345"


def main() -> None:
    Base.metadata.create_all(engine)
    rng = random.Random(42)
    with SessionLocal() as db:
        seed_all(db)
        if db.scalar(select(User).where(User.email == STUDENTS[0][0])):
            print("demo data already present")
            seed_demo_nutrition(db)
            return

        inst = db.scalar(select(Institute).where(Institute.slug == "demo-institute"))
        ex_by_slug = {e.slug: e for e in db.scalars(select(Exercise)).all()}
        cv_exercises = [
            ex_by_slug[s] for s in ("squat", "jumping_jack", "lunge", "pushup", "plank")
        ]

        users: list[User] = []
        for email, name, dept, hostel in STUDENTS:
            u = User(
                email=email,
                password_hash=hash_password(PASSWORD),
                name=name,
                institute_id=inst.id,
                department=dept,
                hostel=hostel,
            )
            u.profile = UserProfile(
                goal="general",
                level="beginner",
                minutes_per_session=15,
                days_per_week=4,
                preferences={"voice": True, "language": "en"},
                onboarding_completed_at=datetime.now(UTC) - timedelta(days=22),
            )
            u.stats = UserStats()
            db.add(u)
            users.append(u)
        db.flush()

        squad = Squad(
            name="Block C Beasts",
            invite_code="DEMO42",
            institute_id=inst.id,
            created_by=users[0].id,
        )
        for u in users[:5]:
            squad.members.append(SquadMember(user_id=u.id))
        db.add(squad)

        today = datetime.now(IST).replace(hour=7, minute=5, second=0, microsecond=0)
        for idx, u in enumerate(users):
            consistency = [1.0, 0.95, 0.9, 0.85, 0.8, 0.65, 0.5, 0.55][idx]
            base_form = 66 + idx * 2
            last_day = None
            streak = 0
            longest = 0
            total_sessions = 0
            total_verified = 0
            for day_offset in range(21, -1, -1):
                if idx == 0:
                    # Demo account: trains 2 of every 3 days, never today -> today's plan
                    # shows the "+2 reps after two good sessions" progression story.
                    if day_offset == 0 or day_offset % 3 == 0:
                        continue
                elif day_offset == 0:
                    continue
                elif not (idx < 5 and day_offset == 1) and rng.random() > consistency:
                    continue  # CSE students always trained yesterday (keeps dept row visible)
                day = today - timedelta(days=day_offset)
                started = day + timedelta(minutes=rng.randint(-40, 40))
                improvement = (21 - day_offset) * 1.2
                rows: list[SessionExercise] = []
                verified_seconds = 0
                total_reps = 0
                forms: list[float] = []
                for pos, ex in enumerate(rng.sample(cv_exercises, 3), start=2):
                    target_reps = 24 if ex.mode == "reps" else 0
                    target_seconds = 60 if ex.mode == "hold" else 0
                    form = min(97.0, base_form + improvement + rng.uniform(-6, 6))
                    reps = target_reps - rng.randint(0, 1) if target_reps else 0
                    held = target_seconds - rng.randint(0, 4) if target_seconds else 0
                    dur = 110 + rng.randint(-15, 25)
                    rows.append(
                        SessionExercise(
                            user_id=u.id,
                            exercise_id=ex.id,
                            position=pos,
                            mode="cv",
                            sets_completed=2,
                            reps_completed=reps,
                            seconds_held=held,
                            target_reps=target_reps,
                            target_seconds=target_seconds,
                            duration_seconds=dur,
                            form_score=round(form, 1),
                            mean_visibility=0.82,
                            verified=True,
                            form_flags={"depth": rng.randint(0, 3)} if ex.slug == "squat" else {},
                            rep_events=[],
                            created_at=started.astimezone(UTC),
                        )
                    )
                    verified_seconds += dur
                    total_reps += reps
                    forms.append(form)
                duration = verified_seconds + 90
                s = WorkoutSession(
                    user_id=u.id,
                    client_session_id=uuid.uuid4(),
                    started_at=started.astimezone(UTC),
                    ended_at=(started + timedelta(seconds=duration)).astimezone(UTC),
                    duration_seconds=duration,
                    mode="cv",
                    total_reps=total_reps,
                    avg_form_score=round(sum(forms) / len(forms), 1),
                    verified_seconds=verified_seconds,
                    verified=True,
                    rpe=3 if idx == 0 else rng.choice([2, 3, 3, 4]),
                    device_info={"ua": "demo"},
                    created_at=started.astimezone(UTC),
                )
                s.exercises = rows
                db.add(s)
                d = day.date()
                if last_day is not None and d == last_day + timedelta(days=1):
                    streak += 1
                else:
                    streak = 1
                longest = max(longest, streak)
                last_day = d
                total_sessions += 1
                total_verified += verified_seconds
            u.stats.current_streak = (
                streak if last_day and (today.date() - last_day).days <= 1 else 0
            )
            u.stats.longest_streak = longest
            u.stats.last_workout_date = last_day
            u.stats.total_sessions = total_sessions
            u.stats.total_verified_seconds = total_verified
        db.commit()
        print(f"created {len(users)} demo students, squad DEMO42, ~3 weeks of sessions")
        print("login: demo@fitsathi.app / demo12345   dashboard: /campus/demo-institute")
        seed_demo_nutrition(db)


# A week of plausible hostel eating for the demo account: (meal, food slug, servings).
DEMO_DAY_MENUS = (
    (
        ("breakfast", "veg_poha", 1),
        ("breakfast", "masala_chai", 1),
        ("lunch", "roti", 3),
        ("lunch", "toor_dal", 1),
        ("lunch", "mixed_veg", 1),
        ("lunch", "curd", 1),
        ("snack", "roasted_chana", 1),
        ("snack", "banana", 1),
        ("dinner", "khichdi", 1),
        ("dinner", "salad", 1),
    ),
    (
        ("breakfast", "idli", 3),
        ("breakfast", "sambar", 1),
        ("lunch", "rajma", 1),
        ("lunch", "rice", 1.5),
        ("lunch", "salad", 1),
        ("snack", "samosa", 1),
        ("snack", "masala_chai", 1),
        ("dinner", "roti", 3),
        ("dinner", "palak_sabzi", 1),
        ("dinner", "paneer", 0.5),
    ),
    (
        ("breakfast", "oats", 1),
        ("breakfast", "milk_toned", 1),
        ("breakfast", "banana", 1),
        ("lunch", "roti", 2),
        ("lunch", "chole", 1),
        ("lunch", "curd", 1),
        ("snack", "sprouts", 1),
        ("dinner", "rice", 1),
        ("dinner", "toor_dal", 1),
        ("dinner", "aloo_sabzi", 1),
    ),
)


def seed_demo_nutrition(db) -> None:
    """Give the demo student a nutrition profile and a week of logs. Idempotent."""
    from app.models import Food, FoodLog, NutritionProfile, WaterIntake
    from app.utils.dates import local_today

    demo = db.scalar(select(User).where(User.email == STUDENTS[0][0]))
    if demo is None or db.get(NutritionProfile, demo.id) is not None:
        return
    db.add(
        NutritionProfile(
            user_id=demo.id,
            sex="female",
            age=20,
            height_cm=158,
            weight_kg=54,
            activity_level="light",
            diet_type="veg",
        )
    )
    foods = {f.slug: f for f in db.scalars(select(Food)).all()}
    today = local_today()
    for back in range(6, -1, -1):
        day = today - timedelta(days=back)
        menu = DEMO_DAY_MENUS[back % len(DEMO_DAY_MENUS)]
        if back == 0:  # today: only breakfast and lunch so far, leaving room to log more
            menu = tuple(m for m in menu if m[0] in ("breakfast", "lunch"))
        for meal, slug, servings in menu:
            f = foods[slug]
            db.add(
                FoodLog(
                    user_id=demo.id,
                    log_date=day,
                    meal=meal,
                    food_id=f.id,
                    name=f.name,
                    serving=f.serving,
                    servings=servings,
                    calories=round(f.calories * servings, 1),
                    protein_g=round(f.protein_g * servings, 1),
                    carbs_g=round(f.carbs_g * servings, 1),
                    fat_g=round(f.fat_g * servings, 1),
                    fiber_g=round(f.fiber_g * servings, 1),
                    iron_mg=round(f.iron_mg * servings, 1),
                    calcium_mg=round(f.calcium_mg * servings, 1),
                    vitamin_c_mg=round(f.vitamin_c_mg * servings, 1),
                )
            )
        water = 1000 if back == 0 else 1750 + (back % 3) * 250
        db.add(WaterIntake(user_id=demo.id, log_date=day, water_ml=water))
    db.commit()
    print("demo nutrition: profile + 7 days of meals and water for demo@fitsathi.app")


if __name__ == "__main__":
    main()
