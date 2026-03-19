"""Apify client — scrapes Instagram profiles via the Instagram Profile Scraper actor."""

import asyncio
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

APIFY_BASE = "https://api.apify.com/v2"
# Instagram profile + posts scraper actor
INSTAGRAM_ACTOR = "apify/instagram-scraper"


async def scrape_instagram(handle: str, api_key: str, max_posts: int = 30) -> dict:
    """
    Scrape an Instagram profile using Apify.

    Normalises the handle (strips @, /), runs the actor synchronously,
    and returns structured data:
        profile   — bio, follower count, name, category, website
        posts     — list of {caption, hashtags, likes, timestamp, image_url}
        raw_captions — joined caption text for LLM analysis
    """
    # Normalise handle
    clean_handle = handle.lstrip("@").strip("/").split("/")[-1]
    logger.info("Apify: scraping Instagram @%s (max %d posts)", clean_handle, max_posts)

    run_input = {
        "directUrls": [f"https://www.instagram.com/{clean_handle}/"],
        "resultsType": "posts",
        "resultsLimit": max_posts,
        "addParentData": True,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        # Start actor run (synchronous mode — waits for completion)
        resp = await client.post(
            f"{APIFY_BASE}/acts/{INSTAGRAM_ACTOR}/run-sync-get-dataset-items",
            params={"token": api_key, "timeout": 90, "memory": 256},
            json=run_input,
        )
        if resp.status_code == 404:
            # Fall back: actor slug changed — try the Dataset API
            raise RuntimeError(f"Apify actor {INSTAGRAM_ACTOR} not found. Check actor name.")
        resp.raise_for_status()
        items: list[dict] = resp.json()

    if not items:
        logger.warning("Apify returned 0 items for @%s", clean_handle)
        return _empty_instagram(clean_handle)

    # Extract profile from first item's ownerUsername / biography fields
    first = items[0]
    profile = {
        "username": clean_handle,
        "full_name": first.get("ownerFullName", ""),
        "biography": first.get("biography", ""),
        "followers": first.get("followersCount", 0),
        "following": first.get("followingCount", 0),
        "website": first.get("externalUrl", ""),
        "category": first.get("businessCategoryName", ""),
        "profile_pic_url": first.get("profilePicUrl", ""),
    }

    posts = []
    for item in items:
        caption = item.get("caption", "") or ""
        posts.append({
            "caption": caption,
            "hashtags": item.get("hashtags", []),
            "likes": item.get("likesCount", 0),
            "comments": item.get("commentsCount", 0),
            "timestamp": item.get("timestamp", ""),
            "image_url": item.get("displayUrl", ""),
            "type": item.get("type", ""),
        })

    raw_captions = "\n\n---\n\n".join(
        p["caption"] for p in posts if p["caption"]
    )

    return {
        "profile": profile,
        "posts": posts,
        "raw_captions": raw_captions,
        "source_type": "instagram",
        "handle": clean_handle,
    }


def _empty_instagram(handle: str) -> dict:
    return {
        "profile": {"username": handle},
        "posts": [],
        "raw_captions": "",
        "source_type": "instagram",
        "handle": handle,
    }
