"""
Shared GA4 Data API client for Pillar 7.

Reusable helpers that any pillar7 service can import.
Requires: google-analytics-data>=0.18.0 in requirements.txt (already added by Pillar 4).
"""
from __future__ import annotations

import json
import logging
from typing import Any

from backend.config import settings

logger = logging.getLogger(__name__)


def _get_ga4_client():
    """Build an authenticated BetaAnalyticsDataClient or raise RuntimeError."""
    if not settings.GA4_PROPERTY_ID or not settings.GA4_SERVICE_ACCOUNT_KEY:
        raise RuntimeError("GA4_PROPERTY_ID and GA4_SERVICE_ACCOUNT_KEY are required.")
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account

        key_data = json.loads(settings.GA4_SERVICE_ACCOUNT_KEY)
        credentials = service_account.Credentials.from_service_account_info(
            key_data,
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        return BetaAnalyticsDataClient(credentials=credentials)
    except ImportError:
        raise RuntimeError(
            "google-analytics-data package is not installed. "
            "Add 'google-analytics-data' to requirements.txt."
        )


async def run_report(
    dimensions: list[str],
    metrics: list[str],
    date_range_days: int = 30,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """
    Run a GA4 report and return rows as a list of dicts.
    Keys are the dimension/metric names.
    Falls back to [] if not configured or on error.
    """
    if not settings.GA4_PROPERTY_ID or not settings.GA4_SERVICE_ACCOUNT_KEY:
        return []
    try:
        from google.analytics.data_v1beta.types import (
            RunReportRequest, DateRange, Dimension, Metric,
        )
        import asyncio

        client = _get_ga4_client()
        request = RunReportRequest(
            property=f"properties/{settings.GA4_PROPERTY_ID}",
            dimensions=[Dimension(name=d) for d in dimensions],
            metrics=[Metric(name=m) for m in metrics],
            date_ranges=[DateRange(start_date=f"{date_range_days}daysAgo", end_date="today")],
            limit=limit,
        )
        response = await asyncio.to_thread(client.run_report, request)
        rows = []
        all_keys = dimensions + metrics
        for row in response.rows:
            vals = [v.value for v in row.dimension_values] + [v.value for v in row.metric_values]
            rows.append(dict(zip(all_keys, vals)))
        return rows
    except Exception as exc:
        logger.warning("GA4 report failed: %s", exc)
        return []
