"""
Content Scout - Python Scraping Service
Pinterest, Google Images, DuckDuckGo scraping with Scrapling's anti-bot bypass.
Runs as a local FastAPI server on port 8899.
"""

import asyncio
import base64
import json
import re
from io import BytesIO
from typing import Optional
from urllib.parse import quote, urljoin

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scrapling import Fetcher

app = FastAPI(title="Content Scout Scraper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

fetcher = Fetcher(auto_match=False)


# ── Models ──────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    sources: list[str] = ["duckduckgo", "pinterest", "google"]
    industry: str = ""

class ProxyRequest(BaseModel):
    url: str

class SearchResult(BaseModel):
    title: str
    imageUrl: str
    thumbnailUrl: str
    sourceUrl: str
    platform: str
    width: int = 0
    height: int = 0


# ── Scrapers ────────────────────────────────────────

def search_duckduckgo(query: str) -> list[dict]:
    """DuckDuckGo image search - no API key needed."""
    results = []
    try:
        # Step 1: Get vqd token
        token_page = fetcher.get(
            f"https://duckduckgo.com/?q={quote(query)}&iax=images&ia=images"
        )
        vqd_match = re.search(r'vqd=["\']([^"\']+)', token_page.text)
        if not vqd_match:
            print("DDG: Could not extract vqd token")
            return []
        vqd = vqd_match.group(1)

        # Step 2: Fetch image results
        img_url = (
            f"https://duckduckgo.com/i.js?"
            f"l=us-en&o=json&q={quote(query)}&vqd={vqd}&f=,,,,,&p=1"
        )
        img_resp = fetcher.get(img_url)
        data = json.loads(img_resp.text)

        for r in (data.get("results") or [])[:20]:
            if r.get("image"):
                results.append({
                    "title": r.get("title", ""),
                    "imageUrl": r["image"],
                    "thumbnailUrl": r.get("thumbnail", r["image"]),
                    "sourceUrl": r.get("url", ""),
                    "platform": "duckduckgo",
                    "width": r.get("width", 0),
                    "height": r.get("height", 0),
                })
    except Exception as e:
        print(f"DDG error: {e}")
    return results


def search_pinterest(query: str) -> list[dict]:
    """Pinterest scraping - parse HTML for pin images."""
    results = []
    try:
        url = f"https://www.pinterest.com/search/pins/?q={quote(query)}"
        page = fetcher.get(url)
        html = page.text

        # Try extracting original images
        orig_pattern = re.compile(
            r'"orig":\{"url":"(https://i\.pinimg\.com/originals/[^"]+)",'
            r'"width":(\d+),"height":(\d+)'
        )
        for match in orig_pattern.finditer(html):
            if len(results) >= 15:
                break
            results.append({
                "title": f"Pinterest {len(results) + 1}",
                "imageUrl": match.group(1),
                "thumbnailUrl": match.group(1).replace("/originals/", "/236x/"),
                "sourceUrl": "https://www.pinterest.com",
                "platform": "pinterest",
                "width": int(match.group(2)),
                "height": int(match.group(3)),
            })

        # Fallback: 736x images
        if not results:
            seen = set()
            for match in re.finditer(
                r'https://i\.pinimg\.com/736x/[a-f0-9/]+\.\w+', html
            ):
                img_url = match.group(0)
                if img_url in seen or len(results) >= 15:
                    continue
                seen.add(img_url)
                results.append({
                    "title": f"Pinterest {len(results) + 1}",
                    "imageUrl": img_url.replace("/736x/", "/originals/"),
                    "thumbnailUrl": img_url,
                    "sourceUrl": "https://www.pinterest.com",
                    "platform": "pinterest",
                    "width": 736,
                    "height": 0,
                })
    except Exception as e:
        print(f"Pinterest error: {e}")
    return results


def search_google_images(query: str) -> list[dict]:
    """Google Images scraping."""
    results = []
    try:
        url = f"https://www.google.com/search?q={quote(query)}&tbm=isch&ijn=0"
        page = fetcher.get(url)
        html = page.text

        seen = set()
        # Google embeds full-res image URLs in JS arrays: ["url", height, width]
        pattern = re.compile(
            r'\["(https?://[^"]+\.(?:jpg|jpeg|png|webp))",\s*(\d+),\s*(\d+)\]'
        )
        for match in pattern.finditer(html):
            if len(results) >= 20:
                break
            img_url = match.group(1)
            height = int(match.group(2))
            width = int(match.group(3))
            if width < 200 or height < 200:
                continue
            if img_url in seen or "gstatic.com" in img_url or "google.com" in img_url:
                continue
            seen.add(img_url)
            results.append({
                "title": f"Image {len(results) + 1}",
                "imageUrl": img_url,
                "thumbnailUrl": img_url,
                "sourceUrl": img_url,
                "platform": "google",
                "width": width,
                "height": height,
            })
    except Exception as e:
        print(f"Google Images error: {e}")
    return results


def proxy_image(image_url: str) -> dict:
    """Download an image and return as base64."""
    resp = fetcher.get(image_url)
    raw = resp.content if hasattr(resp, 'content') else resp.text.encode()
    b64 = base64.b64encode(raw).decode()
    # Guess mime type
    if image_url.endswith(".png"):
        mime = "image/png"
    elif image_url.endswith(".webp"):
        mime = "image/webp"
    else:
        mime = "image/jpeg"
    return {"base64": b64, "mimeType": mime}


# ── API Endpoints ───────────────────────────────────

@app.post("/search")
def api_search(req: SearchRequest):
    query = f"{req.industry} {req.query}".strip() if req.industry else req.query
    all_results = []
    sources_report = {}

    for source in req.sources:
        try:
            if source == "duckduckgo":
                r = search_duckduckgo(f"{query} social media post design")
            elif source == "pinterest":
                r = search_pinterest(query)
            elif source == "google":
                r = search_google_images(f"{query} social media design inspiration")
            else:
                continue
            if r:
                sources_report[source] = len(r)
                all_results.extend(r)
        except Exception as e:
            print(f"Source {source} failed: {e}")

    # Deduplicate
    seen = set()
    unique = []
    for item in all_results:
        if item["imageUrl"] not in seen:
            seen.add(item["imageUrl"])
            unique.append(item)

    return {
        "results": unique,
        "total": len(unique),
        "sources_report": sources_report,
    }


@app.post("/proxy")
def api_proxy(req: ProxyRequest):
    return proxy_image(req.url)


@app.get("/health")
def api_health():
    return {
        "status": "ok",
        "engine": "scrapling",
        "sources": ["duckduckgo", "pinterest", "google"],
    }


if __name__ == "__main__":
    import uvicorn
    print("🔍 Content Scout Scraper starting on http://localhost:8899")
    uvicorn.run(app, host="0.0.0.0", port=8899)
