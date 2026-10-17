"""Live legislation headlines from AP, via Google News RSS filtered to apnews.com."""

import asyncio
import logging

import httpx

from .google_news import ap_search_url, decode_google_news_link
from .text import clean_title, extract_tag

log = logging.getLogger(__name__)

FEED_URL = (
    "https://news.google.com/rss/search?q=(bill+OR+legislation+OR+law+OR+statute+OR+congress"
    "+OR+senate)+site:apnews.com&hl=en-US&gl=US&ceid=US:en"
)
MAX_ITEMS = 40


def parse_feed(xml: str) -> list[dict]:
    items = []
    for raw in xml.split("<item>")[1 : MAX_ITEMS + 1]:
        block = "<item>" + raw.split("</item>")[0] + "</item>"
        items.append(
            {
                "title": extract_tag("title", block),
                "link": extract_tag("link", block),
                "pubDate": extract_tag("pubDate", block),
                "source": extract_tag("source", block) or "AP News",
            }
        )
    return items


async def legislation_news() -> dict:
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            res = await client.get(FEED_URL, headers={"User-Agent": "Mozilla/5.0 BillBreaker"})
            if res.status_code != 200:
                return {"items": [], "error": f"Feed unavailable ({res.status_code})"}
            items = parse_feed(res.text)
            decoded = await asyncio.gather(
                *(decode_google_news_link(it["link"], client) for it in items)
            )
    except httpx.HTTPError as exc:
        log.warning("AP feed error: %s", exc)
        return {"items": [], "error": "Could not load live headlines"}
    for item, url in zip(items, decoded):
        item["link"] = url or ap_search_url(clean_title(item["title"]))
    return {"items": items, "error": None}
