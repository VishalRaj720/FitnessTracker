from tests.conftest import auth, onboard, register


def test_register_login_me(client):
    out = register(client, email="asha@nitk.edu.in")
    assert out["user"]["onboarding_completed"] is False
    token = out["access_token"]

    r = client.get("/api/v1/users/me", headers=auth(token))
    assert r.status_code == 200
    assert r.json()["email"] == "asha@nitk.edu.in"

    r = client.post(
        "/api/v1/auth/login", json={"email": "ASHA@nitk.edu.in", "password": "password123"}
    )
    assert r.status_code == 200

    r = client.post(
        "/api/v1/auth/login", json={"email": "asha@nitk.edu.in", "password": "wrong-pass"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


def test_duplicate_email_rejected(client):
    register(client, email="dup@test.edu")
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "dup@test.edu", "password": "password123", "name": "X"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


def test_me_requires_token(client):
    r = client.get("/api/v1/users/me")
    assert r.status_code == 401


def test_onboarding_sets_profile_and_institute(client):
    token = register(client)["access_token"]
    me = onboard(client, token)
    assert me["onboarding_completed"] is True
    assert me["profile"]["goal"] == "general"
    assert me["institute"]["id"] == 1
    assert me["department"] == "CSE"


def test_plan_requires_onboarding(client):
    token = register(client)["access_token"]
    r = client.get("/api/v1/plans/today", headers=auth(token))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "onboarding_required"


def test_institute_search(client):
    r = client.get("/api/v1/institutes", params={"q": "nit"})
    assert r.status_code == 200
    names = [i["name"] for i in r.json()]
    assert any("NIT" in n for n in names)
