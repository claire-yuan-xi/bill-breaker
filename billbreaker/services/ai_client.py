"""Calls Gemini through its OpenAI-compatible endpoint with a forced function call."""

import json
import logging

import httpx

from ..config import settings

log = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


class AIError(Exception):
    """code is RATE_LIMIT, AI_UNAVAILABLE or AI_GATEWAY_ERROR."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


async def call_ai(system: str, user: str, schema: dict) -> dict:
    if not settings.gemini_api_key:
        raise AIError("AI_UNAVAILABLE")
    body = {
        "model": settings.gemini_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "tools": [{"type": "function", "function": schema}],
        "tool_choice": {"type": "function", "function": {"name": schema["name"]}},
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            res = await client.post(
                GEMINI_URL,
                json=body,
                headers={"Authorization": f"Bearer {settings.gemini_api_key}"},
            )
    except httpx.HTTPError as exc:
        log.error("Gemini request failed: %s", exc)
        raise AIError("AI_GATEWAY_ERROR") from exc
    if res.status_code == 429:
        raise AIError("RATE_LIMIT")
    if res.status_code == 403:
        raise AIError("AI_UNAVAILABLE")
    if res.status_code != 200:
        log.error("Gemini %s: %s", res.status_code, res.text[:500])
        raise AIError("AI_GATEWAY_ERROR")
    try:
        call = res.json()["choices"][0]["message"]["tool_calls"][0]
        return json.loads(call["function"]["arguments"])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise AIError("AI_GATEWAY_ERROR") from exc
