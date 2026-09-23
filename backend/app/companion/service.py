"""Orchestration for the coach: build the payload, call the model, validate what comes back."""

from __future__ import annotations

import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.companion import guard, prompts
from app.companion.context import build_context
from app.companion.provider import LLMProvider, build_provider
from app.core.config import settings
from app.models import User, WorkoutSession
from app.models.companion import CompanionMessage, CompanionThread, SessionDebrief
from app.schemas.companion import ChatIn, ChatOut, CueIn, CueOut, DebriefOut, SuggestedAction

log = logging.getLogger("fitsathi.companion")

_provider: LLMProvider | None = None

HISTORY_TURNS = 6


def provider() -> LLMProvider:
    global _provider
    if _provider is None:
        _provider = build_provider(settings.gemini_api_key)
    return _provider


def reset_provider(p: LLMProvider | None = None) -> None:
    """Swap the provider. Used by tests, which must never reach the network."""
    global _provider
    _provider = p


def enabled() -> bool:
    return settings.companion_enabled and provider().name != "null"


def _language(user: User) -> str:
    prefs = (user.profile.preferences if user.profile else None) or {}
    return "hi" if prefs.get("language") == "hi" else "en"


# --------------------------------------------------------------------------- cue


def cue(db: Session, user: User, payload: CueIn) -> CueOut:
    """Per-rep form analysis. Must be fast or useless, so it never touches the database."""
    if not enabled() or not payload.reps:
        return CueOut()

    body = {
        "exercise": payload.exercise_slug,
        "set_number": payload.set_number,
        "reps_so_far": payload.rep_count,
        "mode": payload.mode,
        "what_each_number_means": payload.glossary,
        "a_good_rep_looks_like": payload.reference,
        "coaching_notes": payload.notes,
        "already_said": payload.already_said,
        "rules_that_fired_this_set": payload.recent_violations,
        "recent_reps_oldest_first": [
            {
                "index": r.index,
                "series": r.series,
                "descent_ms": r.descent_ms,
                "bottom_ms": r.bottom_ms,
                "ascent_ms": r.ascent_ms,
                "total_ms": r.total_ms,
            }
            for r in payload.reps
        ],
    }
    raw = provider().generate(
        system=prompts.cue_system(_language(user)),
        user=json.dumps(body, separators=(",", ":")),
        model=settings.gemini_model_cue,
        timeout_s=settings.companion_cue_timeout_s,
        max_output_tokens=200,
    )
    cleaned = guard.clean_cue(guard.parse_json(raw))
    if not cleaned:
        return CueOut()
    return CueOut(**cleaned)


# --------------------------------------------------------------------------- chat


def _thread(db: Session, user: User) -> CompanionThread:
    t = db.scalar(select(CompanionThread).where(CompanionThread.user_id == user.id))
    if t is None:
        t = CompanionThread(user_id=user.id)
        db.add(t)
        db.flush()
    return t


def history(db: Session, user: User) -> list[CompanionMessage]:
    t = db.scalar(select(CompanionThread).where(CompanionThread.user_id == user.id))
    return list(t.messages) if t else []


def clear_history(db: Session, user: User) -> None:
    t = db.scalar(select(CompanionThread).where(CompanionThread.user_id == user.id))
    if t:
        db.delete(t)
        db.commit()


def chat(db: Session, user: User, payload: ChatIn) -> ChatOut:
    lang = _language(user)
    thread = _thread(db, user)
    db.add(
        CompanionMessage(thread_id=thread.id, user_id=user.id, role="user", content=payload.message)
    )

    canned = guard.precheck(payload.message, lang)
    if canned:
        # Medical and nutrition questions get a fixed answer. A coach improvising about
        # knee pain is exactly the failure mode worth designing out.
        db.add(
            CompanionMessage(
                thread_id=thread.id,
                user_id=user.id,
                role="coach",
                content=canned,
                context_digest={"guard": "precheck"},
            )
        )
        db.commit()
        return ChatOut(reply=canned, in_scope=True)

    if not enabled():
        db.commit()
        return ChatOut(reply=_unavailable(lang), in_scope=True)

    ctx = build_context(db, user)
    recent = list(thread.messages)[-HISTORY_TURNS:]
    body = {
        "user_context": ctx,
        "client_reported_unverified": payload.client_reported or {},
        "conversation_so_far": [{"role": m.role, "content": m.content} for m in recent],
        "message": payload.message,
    }
    raw = provider().generate(
        system=prompts.chat_system(lang),
        user=json.dumps(body, separators=(",", ":"), default=str),
        model=settings.gemini_model_chat,
        timeout_s=settings.companion_chat_timeout_s,
        max_output_tokens=700,
    )
    cleaned = guard.clean_chat(guard.parse_json(raw), lang)
    if not cleaned:
        db.commit()
        return ChatOut(reply=_unavailable(lang), in_scope=True)

    db.add(
        CompanionMessage(
            thread_id=thread.id,
            user_id=user.id,
            role="coach",
            content=cleaned["reply"],
            context_digest={"streak": ctx["streak"], "this_week": ctx["this_week"]},
        )
    )
    db.commit()
    return ChatOut(
        reply=cleaned["reply"],
        in_scope=cleaned["in_scope"],
        suggested_actions=[SuggestedAction(**a) for a in cleaned["suggested_actions"]],
    )


def _unavailable(lang: str) -> str:
    return (
        "मैं अभी जवाब नहीं दे पा रहा। थोड़ी देर बाद कोशिश करें — आपका वर्कआउट वैसे ही चलता रहेगा।"
        if lang == "hi"
        else (
            "I can't reach the coach right now. "
            "Your workouts still work as normal — try again in a moment."
        )
    )


# --------------------------------------------------------------------------- debrief


def debrief(db: Session, user: User, session_id) -> DebriefOut:
    cached = db.get(SessionDebrief, session_id)
    if cached:
        return DebriefOut(text=cached.text)
    if not enabled():
        return DebriefOut(text=None)

    ws = db.scalar(
        select(WorkoutSession).where(
            WorkoutSession.id == session_id, WorkoutSession.user_id == user.id
        )
    )
    if ws is None:
        return DebriefOut(text=None)

    body = {
        "user_context": build_context(db, user),
        "session_just_finished": {
            "minutes": round(ws.duration_seconds / 60),
            "mode": ws.mode,
            "total_reps": ws.total_reps,
            "avg_form_score": round(ws.avg_form_score, 1) if ws.avg_form_score else None,
            "exercises": [
                {
                    "exercise": x.exercise.slug,
                    "sets": x.sets_completed,
                    "reps": x.reps_completed,
                    "seconds_held": x.seconds_held,
                    "form_score": round(x.form_score, 1) if x.form_score else None,
                    "form_flags": x.form_flags or {},
                }
                for x in ws.exercises
            ],
        },
    }
    raw = provider().generate(
        system=prompts.debrief_system(_language(user)),
        user=json.dumps(body, separators=(",", ":"), default=str),
        model=settings.gemini_model_chat,
        timeout_s=settings.companion_chat_timeout_s,
        max_output_tokens=400,
    )
    cleaned = guard.clean_chat(guard.parse_json(raw), _language(user))
    if not cleaned:
        return DebriefOut(text=None)

    db.add(SessionDebrief(session_id=ws.id, user_id=user.id, text=cleaned["reply"]))
    db.commit()
    return DebriefOut(text=cleaned["reply"])
