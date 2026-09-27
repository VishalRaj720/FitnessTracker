"""Scope and safety checks that do not depend on the model behaving.

The prompt shapes the common case. This handles the rest: a cheap pre-check that answers
obvious medical questions without spending a model call, and a post-check that validates
the JSON actually came back in the shape the app is going to render.
"""

from __future__ import annotations

import json
import re

# Deliberately narrow. These are matched as whole words against the user's message, and a
# hit only ever *adds* a safety reply — it never silently drops a legitimate training
# question, because over-blocking a fitness app's own subject matter is its own failure.
_MEDICAL = re.compile(
    r"\b(injur\w*|sprain\w*|fracture\w*|dislocat\w*|torn|tear|physio\w*|"
    r"doctor|clinic|surgery|chest pain|dizzy|dizziness|faint\w*|numb\w*|"
    r"pregnan\w*|medication|painkiller|concussion)\b",
    re.I,
)
_PAIN = re.compile(r"\b(pain|hurts?|hurting|aching|ache)\b", re.I)
_NUTRITION = re.compile(
    r"\b(diet|calorie\w*|macros?|protein powder|supplement\w*|"
    r"what should i eat|meal plan|weight loss|lose weight|fat loss plan)\b",
    re.I,
)

MEDICAL_REPLY = {
    "en": (
        "That sounds like something to get looked at by a doctor or physio rather than "
        "worked through — I can't assess it. If you want, I'll keep today's session light "
        "and skip anything that loads it."
    ),
    "hi": (
        "यह डॉक्टर या फिजियो को दिखाने वाली बात लगती है, इसे सहते हुए व्यायाम न करें — मैं इसकी जाँच "
        "नहीं कर सकता। चाहें तो आज का सेशन हल्का रख सकते हैं।"
    ),
}

# The coach still never improvises food advice. The Nutrition tab computes targets from the
# person's own profile with fixed, published formulas, so that is where these questions go.
NUTRITION_REPLY = {
    "en": (
        "I don't improvise nutrition or weight targets — your Nutrition tab calculates them "
        "from your goal and body metrics. I can help with the training side: what you train, "
        "how often, and how your form is holding up."
    ),
    "hi": (
        "मैं खानपान या वज़न के लक्ष्य अपने मन से नहीं बताता — आपका Nutrition टैब आपके लक्ष्य और "
        "शरीर के माप से उन्हें गिनता है। ट्रेनिंग में मदद कर सकता हूँ — क्या करें, कितनी बार, "
        "और फ़ॉर्म कैसी चल रही है।"
    ),
}

OUT_OF_SCOPE_REPLY = {
    "en": (
        "That's outside what I can help with. Ask me about your training, your form or your plan."
    ),
    "hi": "यह मेरे दायरे से बाहर है। अपनी ट्रेनिंग, फ़ॉर्म या प्लान के बारे में पूछें।",
}


def precheck(message: str, language: str = "en") -> str | None:
    """A canned reply when the question must not be improvised, else None."""
    lang = language if language in MEDICAL_REPLY else "en"
    if _MEDICAL.search(message) or _PAIN.search(message):
        return MEDICAL_REPLY[lang]
    if _NUTRITION.search(message):
        return NUTRITION_REPLY[lang]
    return None


def parse_json(raw: str | None) -> dict | None:
    """Models sometimes wrap JSON in prose or a fence. Recover it, or give up cleanly."""
    if not raw:
        return None
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\s*|\s*```$", "", text, flags=re.I | re.S).strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            value = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None
    return value if isinstance(value, dict) else None


def clean_cue(data: dict | None) -> dict | None:
    """Validate a cue payload. Anything malformed is dropped rather than half-rendered."""
    if not data:
        return None
    cue = str(data.get("cue") or "").strip()
    if not cue or len(cue) > 120:
        return None
    try:
        urgency = int(data.get("urgency", 0))
    except (TypeError, ValueError):
        urgency = 0
    if urgency <= 0 or not bool(data.get("novel", True)):
        return None
    return {
        "observation": str(data.get("observation") or "").strip()[:300],
        "cue": cue,
        "urgency": max(1, min(3, urgency)),
    }


def clean_chat(data: dict | None, language: str = "en") -> dict | None:
    if not data:
        return None
    reply = str(data.get("reply") or "").strip()
    if not reply:
        return None
    in_scope = bool(data.get("in_scope", True))
    if not in_scope:
        lang = language if language in OUT_OF_SCOPE_REPLY else "en"
        return {"reply": OUT_OF_SCOPE_REPLY[lang], "in_scope": False, "suggested_actions": []}

    actions = []
    allowed = {"start_workout", "open_exercise", "open_tutorial", "open_progress"}
    raw_actions = data.get("suggested_actions")
    if isinstance(raw_actions, list):
        for a in raw_actions[:2]:
            if not isinstance(a, dict):
                continue
            kind = str(a.get("kind") or "")
            if kind not in allowed:
                continue
            label = str(a.get("label") or "").strip()[:40]
            if not label:
                continue
            slug = a.get("slug")
            actions.append({"kind": kind, "label": label, "slug": str(slug) if slug else None})
    return {"reply": reply[:1200], "in_scope": True, "suggested_actions": actions}
