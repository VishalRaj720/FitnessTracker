"""Coach tests. A fake provider stands in for Gemini — no test ever reaches the network."""

import json

import pytest

from app.companion import service
from app.companion.guard import clean_chat, clean_cue, parse_json, precheck
from tests.conftest import auth, onboard, register


class FakeProvider:
    """Returns a scripted reply and records what it was asked."""

    name = "fake"

    def __init__(self, reply=None):
        self.reply = reply
        self.calls: list[dict] = []

    def generate(self, *, system, user, model, timeout_s, max_output_tokens, json_output=True):
        self.calls.append({"system": system, "user": user, "model": model, "timeout_s": timeout_s})
        if callable(self.reply):
            return self.reply(user)
        return self.reply


@pytest.fixture(autouse=True)
def _isolate_provider():
    service.reset_provider(None)
    yield
    service.reset_provider(None)


def _user(client):
    token = register(client)["access_token"]
    onboard(client, token)
    return token


# --------------------------------------------------------------------------- status


def test_disabled_without_an_api_key(client):
    token = _user(client)
    r = client.get("/api/v1/companion/status", headers=auth(token))
    assert r.status_code == 200
    assert r.json() == {"enabled": False, "provider": "null"}


def test_chat_degrades_gracefully_when_disabled(client):
    token = _user(client)
    r = client.post(
        "/api/v1/companion/chat", json={"message": "how is my squat?"}, headers=auth(token)
    )
    assert r.status_code == 200
    # It answers rather than erroring, so the UI never has to special-case an outage.
    assert r.json()["reply"]
    assert r.json()["in_scope"] is True


def test_cue_is_silent_when_disabled(client):
    token = _user(client)
    r = client.post(
        "/api/v1/companion/cue",
        json={
            "exercise_slug": "squat",
            "reps": [{"index": 1, "series": {"kneeAngle": [170, 90, 170]}}],
        },
        headers=auth(token),
    )
    assert r.status_code == 200
    assert r.json()["cue"] is None
    assert r.json()["urgency"] == 0


# --------------------------------------------------------------------------- cue


def test_cue_returns_the_models_correction(client):
    token = _user(client)
    service.reset_provider(
        FakeProvider(
            json.dumps(
                {
                    "observation": "torso lean rose 38 to 55 across reps 4-7",
                    "cue": "Chest up before you descend",
                    "urgency": 2,
                    "novel": True,
                    "in_scope": True,
                }
            )
        )
    )
    r = client.post(
        "/api/v1/companion/cue",
        json={
            "exercise_slug": "squat",
            "rep_count": 7,
            "reps": [{"index": 7, "series": {"torsoLean": [8, 22, 55, 30]}, "total_ms": 2100}],
        },
        headers=auth(token),
    )
    assert r.status_code == 200
    assert r.json()["cue"] == "Chest up before you descend"
    assert r.json()["urgency"] == 2


def test_cue_is_dropped_when_the_model_says_it_is_not_novel(client):
    token = _user(client)
    service.reset_provider(
        FakeProvider(
            json.dumps(
                {"observation": "same as before", "cue": "Go lower", "urgency": 2, "novel": False}
            )
        )
    )
    r = client.post(
        "/api/v1/companion/cue",
        json={
            "exercise_slug": "squat",
            "reps": [{"index": 2, "series": {"kneeAngle": [170, 120]}}],
        },
        headers=auth(token),
    )
    # Analysing every rep is fine; speaking on every rep would nag.
    assert r.json()["cue"] is None


def test_cue_sends_the_kinematics_and_never_an_image(client):
    token = _user(client)
    fake = FakeProvider(json.dumps({"cue": "Slow the descent", "urgency": 1, "novel": True}))
    service.reset_provider(fake)
    client.post(
        "/api/v1/companion/cue",
        json={
            "exercise_slug": "squat",
            "reps": [{"index": 1, "series": {"kneeAngle": [172, 95, 168]}, "descent_ms": 700}],
            "glossary": {"kneeAngle": "hip-knee-ankle angle"},
        },
        headers=auth(token),
    )
    sent = fake.calls[0]["user"]
    assert "kneeAngle" in sent and "172" in sent
    for forbidden in ("image", "base64", "data:", "landmark", "jpeg", "png"):
        assert forbidden not in sent.lower(), f"{forbidden} leaked into the cue payload"


def test_cue_skips_the_model_entirely_with_no_reps(client):
    token = _user(client)
    fake = FakeProvider(json.dumps({"cue": "x", "urgency": 1, "novel": True}))
    service.reset_provider(fake)
    r = client.post(
        "/api/v1/companion/cue", json={"exercise_slug": "squat", "reps": []}, headers=auth(token)
    )
    assert r.json()["cue"] is None
    assert fake.calls == []


def test_cue_uses_the_cheaper_model_and_a_bounded_timeout(client):
    token = _user(client)
    fake = FakeProvider(json.dumps({"cue": "Chest up", "urgency": 2, "novel": True}))
    service.reset_provider(fake)
    client.post(
        "/api/v1/companion/cue",
        json={"exercise_slug": "squat", "reps": [{"index": 1, "series": {"kneeAngle": [170, 95]}}]},
        headers=auth(token),
    )
    # The cue path uses the cheaper 'lite' model, and its timeout is bounded but generous:
    # these models reason before answering, and the answer is consumed during a rest period,
    # not mid-repetition. An unbounded wait would pile up requests across a whole session.
    assert "lite" in fake.calls[0]["model"]
    assert 5.0 <= fake.calls[0]["timeout_s"] <= 60.0


def test_a_timeout_produces_no_cue_rather_than_an_error(client):
    token = _user(client)
    service.reset_provider(FakeProvider(None))  # None is what a timeout returns
    r = client.post(
        "/api/v1/companion/cue",
        json={"exercise_slug": "squat", "reps": [{"index": 1, "series": {"kneeAngle": [170, 95]}}]},
        headers=auth(token),
    )
    assert r.status_code == 200
    assert r.json()["cue"] is None


# --------------------------------------------------------------------------- chat


def test_chat_answers_and_is_remembered(client):
    token = _user(client)
    service.reset_provider(
        FakeProvider(
            json.dumps(
                {
                    "reply": "Your squat depth improved this week.",
                    "in_scope": True,
                    "suggested_actions": [],
                }
            )
        )
    )
    r = client.post(
        "/api/v1/companion/chat", json={"message": "how is my squat?"}, headers=auth(token)
    )
    assert r.json()["reply"] == "Your squat depth improved this week."

    thread = client.get("/api/v1/companion/thread", headers=auth(token)).json()
    assert [m["role"] for m in thread["messages"]] == ["user", "coach"]


def test_chat_is_given_real_streak_numbers_not_client_claims(client):
    token = _user(client)
    fake = FakeProvider(json.dumps({"reply": "ok", "in_scope": True, "suggested_actions": []}))
    service.reset_provider(fake)
    client.post(
        "/api/v1/companion/chat",
        json={"message": "what is my streak?", "client_reported": {"current_streak": 999}},
        headers=auth(token),
    )
    sent = json.loads(fake.calls[0]["user"])
    # The server's own numbers, with the client's claim quarantined under its own key.
    assert sent["user_context"]["streak"]["current_days"] == 0
    assert sent["client_reported_unverified"] == {"current_streak": 999}


def test_out_of_scope_replies_are_replaced_not_passed_through(client):
    token = _user(client)
    service.reset_provider(
        FakeProvider(
            json.dumps(
                {
                    "reply": "The capital of France is Paris.",
                    "in_scope": False,
                    "suggested_actions": [],
                }
            )
        )
    )
    r = client.post(
        "/api/v1/companion/chat", json={"message": "capital of France?"}, headers=auth(token)
    )
    assert "Paris" not in r.json()["reply"]
    assert r.json()["in_scope"] is False


def test_pain_questions_never_reach_the_model(client):
    token = _user(client)
    fake = FakeProvider(
        json.dumps({"reply": "Try stretching it out and push through.", "in_scope": True})
    )
    service.reset_provider(fake)
    r = client.post(
        "/api/v1/companion/chat",
        json={"message": "my knee hurts when I squat"},
        headers=auth(token),
    )
    assert fake.calls == [], "a pain question must not be improvised"
    assert "push through" not in r.json()["reply"]
    assert "doctor" in r.json()["reply"].lower() or "physio" in r.json()["reply"].lower()


def test_nutrition_questions_never_reach_the_model(client):
    token = _user(client)
    fake = FakeProvider(json.dumps({"reply": "Eat 1200 calories a day.", "in_scope": True}))
    service.reset_provider(fake)
    r = client.post(
        "/api/v1/companion/chat",
        json={"message": "how many calories should I eat?"},
        headers=auth(token),
    )
    assert fake.calls == []
    assert "1200" not in r.json()["reply"]


def test_a_malformed_reply_does_not_reach_the_user(client):
    token = _user(client)
    service.reset_provider(FakeProvider("not json at all"))
    r = client.post(
        "/api/v1/companion/chat", json={"message": "how is my form?"}, headers=auth(token)
    )
    assert r.status_code == 200
    assert "not json at all" not in r.json()["reply"]


def test_history_can_be_cleared(client):
    token = _user(client)
    service.reset_provider(
        FakeProvider(json.dumps({"reply": "hi", "in_scope": True, "suggested_actions": []}))
    )
    client.post("/api/v1/companion/chat", json={"message": "hello"}, headers=auth(token))
    assert client.delete("/api/v1/companion/thread", headers=auth(token)).status_code == 204
    assert client.get("/api/v1/companion/thread", headers=auth(token)).json()["messages"] == []


def test_one_user_cannot_read_anothers_thread(client):
    a = _user(client)
    b = _user(client)
    service.reset_provider(
        FakeProvider(json.dumps({"reply": "private", "in_scope": True, "suggested_actions": []}))
    )
    client.post("/api/v1/companion/chat", json={"message": "secret"}, headers=auth(a))
    assert client.get("/api/v1/companion/thread", headers=auth(b)).json()["messages"] == []


def test_companion_requires_auth(client):
    assert client.get("/api/v1/companion/status").status_code == 401
    assert client.post("/api/v1/companion/chat", json={"message": "hi"}).status_code == 401


# --------------------------------------------------------------------------- guard units


@pytest.mark.parametrize(
    "message",
    [
        "my shoulder hurts",
        "I think I sprained my ankle",
        "feeling dizzy after the set",
        "I am pregnant",
    ],
)
def test_precheck_catches_medical_questions(message):
    assert precheck(message) is not None


@pytest.mark.parametrize(
    "message", ["how is my squat depth?", "what is my streak?", "should I train tomorrow?"]
)
def test_precheck_lets_training_questions_through(message):
    assert precheck(message) is None


def test_parse_json_recovers_a_fenced_reply():
    assert parse_json('```json\n{"cue":"Chest up"}\n```') == {"cue": "Chest up"}


def test_parse_json_recovers_json_wrapped_in_prose():
    assert parse_json('Sure! {"cue":"Go lower"} hope that helps') == {"cue": "Go lower"}


def test_parse_json_gives_up_cleanly():
    assert parse_json("no json here") is None
    assert parse_json(None) is None


def test_clean_cue_rejects_zero_urgency_and_overlong_text():
    assert clean_cue({"cue": "fine", "urgency": 0, "novel": True}) is None
    assert clean_cue({"cue": "x" * 200, "urgency": 2, "novel": True}) is None
    assert clean_cue({"cue": "Chest up", "urgency": 5, "novel": True})["urgency"] == 3


def test_clean_chat_drops_unknown_action_kinds():
    out = clean_chat(
        {
            "reply": "ok",
            "in_scope": True,
            "suggested_actions": [
                {"kind": "open_exercise", "label": "Squat", "slug": "squat"},
                {"kind": "delete_account", "label": "Delete", "slug": None},
            ],
        }
    )
    assert [a["kind"] for a in out["suggested_actions"]] == ["open_exercise"]


# --------------------------------------------------------------------------- provider retry


class _Boom(Exception):
    def __init__(self, code):
        super().__init__(f"status {code}")
        self.code = code


def _provider_with(side_effects):
    """A GeminiProvider whose network call is replaced by a scripted sequence."""
    from app.companion.provider import GeminiProvider

    p = GeminiProvider("test-key")
    calls = {"n": 0}

    def fake_call(system, user, model, max_output_tokens, json_output):
        i = calls["n"]
        calls["n"] += 1
        outcome = side_effects[min(i, len(side_effects) - 1)]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    p._call = fake_call  # noqa: SLF001
    return p, calls


def _gen(p, timeout_s=10.0):
    return p.generate(
        system="s", user="u", model="m", timeout_s=timeout_s, max_output_tokens=10
    )


def test_a_congested_call_is_retried_once_and_succeeds():
    # Free-tier Gemini returns 503 for roughly half of all calls; that is queueing, not a
    # real failure, and retrying it is the difference between a working coach and a silent one.
    p, calls = _provider_with([_Boom(503), '{"ok":true}'])
    assert _gen(p) == '{"ok":true}'
    assert calls["n"] == 2


def test_retries_stop_after_the_attempt_limit():
    p, calls = _provider_with([_Boom(503)])
    assert _gen(p) is None
    assert calls["n"] == 2


def test_a_bad_request_is_not_retried():
    # 400 means the request itself is wrong; trying again just burns the caller's deadline.
    p, calls = _provider_with([_Boom(400)])
    assert _gen(p) is None
    assert calls["n"] == 1


def test_an_auth_failure_is_not_retried():
    p, calls = _provider_with([_Boom(403)])
    assert _gen(p) is None
    assert calls["n"] == 1


def test_a_dropped_connection_counts_as_transient():
    class ConnectError(Exception):
        pass

    p, calls = _provider_with([ConnectError("reset"), "ok"])
    assert _gen(p) == "ok"
    assert calls["n"] == 2


def test_no_retry_once_the_deadline_has_passed():
    import time as _t

    def slow(*_a, **_k):
        _t.sleep(0.3)
        raise _Boom(503)

    from app.companion.provider import GeminiProvider

    p = GeminiProvider("test-key")
    p._call = slow  # noqa: SLF001
    # Budget only covers the first attempt, so the retry must be skipped rather than
    # overrunning the timeout the caller asked for.
    assert p.generate(system="s", user="u", model="m", timeout_s=0.6, max_output_tokens=10) is None


def test_a_missing_key_never_calls_out():
    from app.companion.provider import build_provider

    p = build_provider("")
    assert p.name == "null"
    assert p.generate(system="s", user="u", model="m", timeout_s=1, max_output_tokens=10) is None
