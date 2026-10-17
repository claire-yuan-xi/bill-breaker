"""
Where the hosted model will live (for example a Hugging Face Space serving the
fine-tuned FLAN-T5 and the personalizer). Unset until the weights are saved and
deployed; the admin view shows the notebook run until then.
"""

import httpx

from ..config import settings


class ModelError(Exception):
    pass


async def explain_with_model(text: str, title: str, profile: dict) -> dict:
    if not settings.ml_endpoint:
        raise ModelError("No model endpoint configured (ML_ENDPOINT).")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                settings.ml_endpoint, json={"text": text, "title": title, "profile": profile}
            )
    except httpx.HTTPError as exc:
        raise ModelError("The model call failed.") from exc
    if res.status_code != 200:
        raise ModelError(f"Model endpoint returned {res.status_code}")
    data = res.json()
    return {"general": str(data.get("general", "")), "personalized": str(data.get("personalized", ""))}
