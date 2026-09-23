"""LLM access, behind a protocol so the rest of the app never imports a vendor SDK."""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from typing import Protocol

log = logging.getLogger("fitsathi.companion")

#: Total tries, not extra ones. Two is enough to absorb the common single 503.
MAX_ATTEMPTS = 2

#: Server-side congestion, not a problem with the request.
_TRANSIENT_STATUS = {429, 500, 502, 503, 504}


def _status_of(exc: Exception) -> int | None:
    code = getattr(exc, "code", None)
    if isinstance(code, int):
        return code
    status = getattr(getattr(exc, "response", None), "status_code", None)
    return status if isinstance(status, int) else None


def _is_transient(exc: Exception) -> bool:
    status = _status_of(exc)
    if status is not None:
        return status in _TRANSIENT_STATUS
    # Connection resets and read timeouts surface as httpx errors with no status.
    name = type(exc).__name__
    return name.endswith(("ConnectError", "ReadTimeout", "ConnectTimeout", "RemoteProtocolError"))

# Requests are short and mostly spent waiting on the network, so a small shared pool is
# enough. It also gives us a hard wall-clock timeout that does not depend on the SDK
# honouring one, which matters for the in-workout cue where a late answer is a useless one.
_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="companion")


class LLMProvider(Protocol):
    name: str

    def generate(
        self,
        *,
        system: str,
        user: str,
        model: str,
        timeout_s: float,
        max_output_tokens: int,
        json_output: bool = True,
    ) -> str | None:
        """Return the model's text, or None if it failed, timed out or is not configured."""
        ...


class NullProvider:
    """Used when no API key is set. Every call returns None, and callers fall back."""

    name = "null"

    def generate(self, **_kwargs) -> None:
        return None


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key
        self._client = None

    def _get_client(self):
        if self._client is None:
            # Imported lazily so a missing SDK degrades to "companion unavailable" rather
            # than stopping the whole API from booting.
            from google import genai

            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def _call(
        self, system: str, user: str, model: str, max_output_tokens: int, json_output: bool
    ) -> str | None:
        from google.genai import types

        client = self._get_client()
        config = types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=max_output_tokens,
            temperature=0.7,
            response_mime_type="application/json" if json_output else "text/plain",
        )
        resp = client.models.generate_content(model=model, contents=user, config=config)
        return getattr(resp, "text", None)

    def generate(
        self,
        *,
        system: str,
        user: str,
        model: str,
        timeout_s: float,
        max_output_tokens: int,
        json_output: bool = True,
    ) -> str | None:
        """Call the model, retrying transient congestion while the budget allows.

        Free-tier Gemini returns 503/504 a large fraction of the time — measured at roughly
        one call in two during the day. Those are not real failures, they are queueing, and
        a single immediate retry converts most of them into answers. Everything else (auth,
        a bad model name, a bad argument) is returned as a failure straight away, because
        retrying it would only waste the caller's deadline.
        """
        deadline = time.monotonic() + timeout_s
        attempt = 0
        while True:
            attempt += 1
            remaining = deadline - time.monotonic()
            if remaining <= 0.5:
                log.info("companion: %s out of time after %d attempt(s)", model, attempt - 1)
                return None
            future = _pool.submit(self._call, system, user, model, max_output_tokens, json_output)
            try:
                return future.result(timeout=remaining)
            except FutureTimeout:
                log.info("companion: %s timed out after %.1fs", model, timeout_s)
                return None
            except Exception as e:  # noqa: BLE001
                if attempt < MAX_ATTEMPTS and _is_transient(e):
                    log.info("companion: %s transient (%s), retrying", model, _status_of(e))
                    continue
                log.warning("companion: %s call failed", model, exc_info=True)
                return None


def build_provider(api_key: str | None) -> LLMProvider:
    if not api_key:
        return NullProvider()
    return GeminiProvider(api_key)
