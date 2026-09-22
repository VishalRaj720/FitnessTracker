import uuid
from datetime import UTC, datetime, timedelta

from tests.conftest import auth, onboard, register


def _session_payload(plan: dict, minutes_ago: int = 20, mode: str = "cv") -> dict:
    now = datetime.now(UTC)
    started = now - timedelta(minutes=minutes_ago)
    exercises = []
    for item in plan["items"]:
        ex = item["exercise"]
        cv = ex["cv_supported"] and mode == "cv"
        exercises.append(
            {
                "exercise_id": ex["id"],
                "plan_item_id": item["id"],
                "position": item["position"],
                "mode": "cv" if cv else "manual",
                "sets_completed": item["target_sets"],
                "reps_completed": item["target_reps"] * item["target_sets"],
                "seconds_held": item["target_seconds"] * item["target_sets"],
                "target_reps": item["target_reps"] * item["target_sets"],
                "target_seconds": item["target_seconds"] * item["target_sets"],
                "duration_seconds": 120,
                "form_score": 88.0 if cv else None,
                "mean_visibility": 0.85 if cv else None,
                "form_flags": {"depth": 1} if cv else {},
                "rep_events": [[1200, 100, 92, 1400]] if cv else [],
            }
        )
    return {
        "client_session_id": str(uuid.uuid4()),
        "plan_id": plan["id"],
        "mode": mode,
        "started_at": started.isoformat(),
        "ended_at": (started + timedelta(seconds=120 * len(exercises))).isoformat(),
        "device_info": {"ua": "pytest"},
        "exercises": exercises,
    }


def test_today_plan_is_generated_once_and_explained(client):
    token = register(client)["access_token"]
    onboard(client, token)
    r1 = client.get("/api/v1/plans/today", headers=auth(token))
    assert r1.status_code == 200, r1.text
    plan = r1.json()
    assert plan["generated_by"] == "rules_v1"
    assert plan["estimated_minutes"] >= 5
    assert len(plan["items"]) >= 4  # warm-up + slots
    assert plan["items"][0]["exercise"]["category"] == "mobility"
    codes = {r["code"] for r in plan["rationale"]}
    assert "baseline" in codes and "composition" in codes
    assert any(i["exercise"]["cv_supported"] for i in plan["items"])

    r2 = client.get("/api/v1/plans/today", headers=auth(token))
    assert r2.json()["id"] == plan["id"]  # idempotent per day


def test_session_save_is_idempotent_and_updates_streak(client):
    token = register(client)["access_token"]
    onboard(client, token)
    plan = client.get("/api/v1/plans/today", headers=auth(token)).json()

    payload = _session_payload(plan)
    r = client.post("/api/v1/sessions", json=payload, headers=auth(token))
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["verified"] is True
    assert out["verified_seconds"] > 0
    assert out["streak"]["current"] == 1 and out["streak"]["changed"] is True
    assert out["plan_status"] == "completed"
    assert out["avg_form_score"] == 88.0

    r_dup = client.post("/api/v1/sessions", json=payload, headers=auth(token))
    assert r_dup.status_code == 201
    assert r_dup.json()["duplicate"] is True
    assert r_dup.json()["id"] == out["id"]

    me = client.get("/api/v1/users/me", headers=auth(token)).json()
    assert me["stats"]["total_sessions"] == 1
    assert me["stats"]["current_streak"] == 1

    r = client.patch(f"/api/v1/sessions/{out['id']}", json={"rpe": 3}, headers=auth(token))
    assert r.status_code == 200 and r.json()["rpe"] == 3

    r = client.get("/api/v1/sessions", headers=auth(token))
    assert r.status_code == 200 and len(r.json()["items"]) == 1

    r = client.get("/api/v1/progress/summary", headers=auth(token))
    assert r.status_code == 200
    summary = r.json()
    assert summary["this_week"]["sessions"] == 1
    assert summary["streak"]["current"] == 1
    assert len(summary["weekly"]) == 8
    assert any(t["exercise_slug"] for t in summary["form_trend"])


def test_manual_session_is_not_verified(client):
    token = register(client)["access_token"]
    onboard(client, token)
    plan = client.get("/api/v1/plans/today", headers=auth(token)).json()
    payload = _session_payload(plan, mode="manual")
    r = client.post("/api/v1/sessions", json=payload, headers=auth(token))
    assert r.status_code == 201
    assert r.json()["verified"] is False
    assert r.json()["verified_seconds"] == 0


def test_unknown_exercise_rejected(client):
    token = register(client)["access_token"]
    onboard(client, token)
    payload = {
        "client_session_id": str(uuid.uuid4()),
        "mode": "manual",
        "started_at": "2026-09-20T07:00:00+05:30",
        "ended_at": "2026-09-20T07:10:00+05:30",
        "exercises": [
            {
                "exercise_id": 9999,
                "position": 1,
                "mode": "manual",
                "sets_completed": 1,
                "reps_completed": 10,
                "duration_seconds": 60,
            }
        ],
    }
    r = client.post("/api/v1/sessions", json=payload, headers=auth(token))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "exercise_not_found"


def test_other_user_cannot_read_session(client):
    t1 = register(client)["access_token"]
    onboard(client, t1)
    plan = client.get("/api/v1/plans/today", headers=auth(t1)).json()
    sid = client.post("/api/v1/sessions", json=_session_payload(plan), headers=auth(t1)).json()[
        "id"
    ]

    t2 = register(client)["access_token"]
    r = client.get(f"/api/v1/sessions/{sid}", headers=auth(t2))
    assert r.status_code == 404
