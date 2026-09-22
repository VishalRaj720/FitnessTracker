from tests.conftest import auth, onboard, register
from tests.test_plans_sessions import _session_payload


def test_squad_create_join_leaderboard(client):
    t1 = register(client, name="Asha")["access_token"]
    t2 = register(client, name="Rahul")["access_token"]
    onboard(client, t1)
    onboard(client, t2)

    r = client.post("/api/v1/squads", json={"name": "Block C Beasts"}, headers=auth(t1))
    assert r.status_code == 201, r.text
    squad = r.json()
    assert squad["member_count"] == 1 and len(squad["invite_code"]) == 6

    r = client.post("/api/v1/squads", json={"name": "Another"}, headers=auth(t1))
    assert r.status_code == 409  # one squad per user

    r = client.post("/api/v1/squads/join", json={"invite_code": "ZZZZZZ"}, headers=auth(t2))
    assert r.status_code == 404

    r = client.post(
        "/api/v1/squads/join", json={"invite_code": squad["invite_code"].lower()}, headers=auth(t2)
    )
    assert r.status_code == 200 and r.json()["member_count"] == 2

    # Rahul trains, Asha doesn't
    plan2 = client.get("/api/v1/plans/today", headers=auth(t2)).json()
    client.post("/api/v1/sessions", json=_session_payload(plan2), headers=auth(t2))

    r = client.get(f"/api/v1/squads/{squad['id']}/leaderboard", headers=auth(t1))
    assert r.status_code == 200, r.text
    rows = r.json()["rows"]
    assert rows[0]["name"] == "Rahul" and rows[0]["rank"] == 1 and rows[0]["verified_minutes"] > 0
    assert rows[1]["name"] == "Asha" and rows[1]["is_me"] is True

    t3 = register(client)["access_token"]
    r = client.get(f"/api/v1/squads/{squad['id']}/leaderboard", headers=auth(t3))
    assert r.status_code == 403

    r = client.post("/api/v1/squads/leave", headers=auth(t2))
    assert r.status_code == 204
    assert client.get("/api/v1/squads/mine", headers=auth(t2)).json() is None


def test_institute_stats_with_k_anonymity(client):
    tokens = []
    for i in range(6):
        t = register(client, name=f"S{i}")["access_token"]
        onboard(client, t, institute_id=1, department="CSE" if i < 5 else "ECE")
        tokens.append(t)
    for t in tokens:
        plan = client.get("/api/v1/plans/today", headers=auth(t)).json()
        client.post("/api/v1/sessions", json=_session_payload(plan), headers=auth(t))

    r = client.get("/api/v1/institutes/iit-bombay/stats")
    assert r.status_code == 200, r.text
    stats = r.json()
    assert stats["this_week"]["active_students"] == 6
    assert stats["this_week"]["verified_sessions"] == 6
    depts = {d["department"] for d in stats["by_department"]}
    assert "CSE" in depts and "ECE" not in depts  # ECE has 1 student -> hidden
    assert len(stats["trend"]) == 8

    assert client.get("/api/v1/institutes/nope/stats").status_code == 404
