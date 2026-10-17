"""Bill page header data and published share pages."""

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from ..services import shares
from ..services.bill_sources import fetch_congress_text, official_search_url
from ..services.rate_limit import bump, client_ip
from ..validation import BILL_NO, STATE

router = APIRouter()


class MetaIn(BaseModel):
    state: str = "US"
    billNo: str = ""
    hasText: bool = False

    @field_validator("state")
    @classmethod
    def _state(cls, v: str) -> str:
        if not STATE.match(v):
            raise ValueError("invalid state")
        return v

    @field_validator("billNo")
    @classmethod
    def _bill(cls, v: str) -> str:
        if v and not BILL_NO.match(v):
            raise ValueError("invalid bill number")
        return v


@router.post("/api/bill-meta")
async def bill_meta(data: MetaIn):
    state, bill_no = data.state, data.billNo
    source_url = official_search_url(state, bill_no)
    notice = None
    if not data.hasText and bill_no and state == "US":
        async with httpx.AsyncClient(follow_redirects=True) as client:
            found = await fetch_congress_text(client, bill_no)
        if found:
            source_url = found[1]
        else:
            notice = (
                "Could not auto-fetch this bill from congress.gov. Open the official source, copy "
                "the text, and paste it on the Paste tab."
            )
    elif not data.hasText and bill_no:
        notice = (
            "State bill text cannot be auto-fetched. Open the official source, copy the text, "
            "and paste it on the Paste tab."
        )
    return {
        "id": f"{state} {bill_no}".strip() if bill_no else "pasted bill",
        "jurisdiction": state,
        "sourceUrl": source_url,
        "textProvided": data.hasText,
        "notice": notice,
    }


class ShareIn(BaseModel):
    state: str = Field(pattern=r"^[A-Z]{2}$")
    bill_no: str = Field(default="", max_length=20)
    title: str | None = Field(default=None, max_length=300)
    source_url: str | None = Field(default=None, max_length=2000)
    payload: dict

    @field_validator("bill_no")
    @classmethod
    def _bill(cls, v: str) -> str:
        if v and not BILL_NO.match(v):
            raise ValueError("invalid bill number")
        return v


@router.post("/api/share")
async def create_share(data: ShareIn, request: Request):
    ip = client_ip(request)
    for key, limit, window, message in (
        ("1m", 5, 60, "Too many publishes from this IP. Wait a minute and try again."),
        ("1h", 30, 3600, "Hourly publish limit reached. Try again later."),
    ):
        if not (await bump(f"ip:{ip}:publish:{key}", limit, window, endpoint="publish")).allowed:
            raise HTTPException(429, message)
    try:
        slug = shares.create(data.state, data.bill_no, data.title, data.source_url, data.payload)
    except ValueError as exc:
        raise HTTPException(413, str(exc)) from exc
    return {"slug": slug}
