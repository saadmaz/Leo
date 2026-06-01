"""
Google Analytics 4 Data API service.

Uses a server-side service account to fetch GA4 reporting data.
Each project stores its own ga4PropertyId; the shared service account
must be granted "Viewer" access to the property in the GA4 console.

Service account credentials come from GA4_SERVICE_ACCOUNT_KEY (full JSON string)
in settings.  Property IDs are stored per-project in Firestore as ga4PropertyId.

All public functions are async — they use httpx under the hood via the
google-analytics-data client library.
"""
from __future__ import annotations

import json
import logging
from datetime import date, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def _get_client():
    """
    Build and return an authenticated BetaAnalyticsDataClient.
    Returns None if credentials are not configured.
    """
    from backend.config import settings

    if not settings.GA4_SERVICE_ACCOUNT_KEY:
        return None

    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.oauth2 import service_account

        key_data = json.loads(settings.GA4_SERVICE_ACCOUNT_KEY)
        creds = service_account.Credentials.from_service_account_info(
            key_data,
            scopes=["https://www.googleapis.com/auth/analytics.readonly"],
        )
        return BetaAnalyticsDataClient(credentials=creds)
    except Exception as exc:
        logger.error("GA4 client init failed: %s", exc)
        return None


def is_configured() -> bool:
    """Return True when the service account key is present in settings."""
    from backend.config import settings
    return bool(settings.GA4_SERVICE_ACCOUNT_KEY)


def get_status(project: dict) -> dict:
    """
    Return connection status for a project.
    configured = service account key is set server-side.
    property_id = the project's stored GA4 property ID (may be None).
    """
    return {
        "configured": is_configured(),
        "property_id": project.get("ga4PropertyId"),
        "connected": is_configured() and bool(project.get("ga4PropertyId")),
    }


async def get_overview(property_id: str, days: int = 30) -> dict:
    """
    Fetch a session/user/pageview overview for the last `days` days.
    Returns zeroed dict on failure so callers can render gracefully.
    """
    import asyncio

    def _run():
        client = _get_client()
        if not client:
            return None

        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest,
        )

        end = date.today()
        start = end - timedelta(days=days)

        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            metrics=[
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="screenPageViews"),
                Metric(name="bounceRate"),
                Metric(name="averageSessionDuration"),
            ],
        )
        try:
            resp = client.run_report(req)
            if resp.rows:
                row = resp.rows[0]
                vals = [v.value for v in row.metric_values]
                return {
                    "sessions": int(vals[0]),
                    "users": int(vals[1]),
                    "pageviews": int(vals[2]),
                    "bounce_rate": round(float(vals[3]) * 100, 1),
                    "avg_session_duration": round(float(vals[4]), 1),
                    "days": days,
                }
        except Exception as exc:
            logger.error("GA4 overview query failed for %s: %s", property_id, exc)
        return None

    return await asyncio.to_thread(_run) or {
        "sessions": 0, "users": 0, "pageviews": 0,
        "bounce_rate": 0.0, "avg_session_duration": 0.0, "days": days,
    }


async def get_sessions_over_time(property_id: str, days: int = 30) -> list[dict]:
    """
    Daily sessions time-series for the last `days` days.
    Returns list of { date, sessions }.
    """
    import asyncio

    def _run():
        client = _get_client()
        if not client:
            return []

        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )

        end = date.today()
        start = end - timedelta(days=days)

        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            dimensions=[Dimension(name="date")],
            metrics=[Metric(name="sessions")],
            order_bys=[OrderBy(dimension=OrderBy.DimensionOrderBy(dimension_name="date"))],
        )
        try:
            resp = client.run_report(req)
            return [
                {
                    "date": row.dimension_values[0].value,
                    "sessions": int(row.metric_values[0].value),
                }
                for row in resp.rows
            ]
        except Exception as exc:
            logger.error("GA4 sessions-over-time query failed for %s: %s", property_id, exc)
            return []

    return await asyncio.to_thread(_run)


async def get_traffic_sources(property_id: str, days: int = 30) -> list[dict]:
    """
    Sessions breakdown by channel group (Organic Search, Direct, Referral, etc.).
    Returns list of { channel, sessions, users }.
    """
    import asyncio

    def _run():
        client = _get_client()
        if not client:
            return []

        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )

        end = date.today()
        start = end - timedelta(days=days)

        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            dimensions=[Dimension(name="sessionDefaultChannelGrouping")],
            metrics=[Metric(name="sessions"), Metric(name="totalUsers")],
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=10,
        )
        try:
            resp = client.run_report(req)
            return [
                {
                    "channel": row.dimension_values[0].value,
                    "sessions": int(row.metric_values[0].value),
                    "users": int(row.metric_values[1].value),
                }
                for row in resp.rows
            ]
        except Exception as exc:
            logger.error("GA4 traffic sources query failed for %s: %s", property_id, exc)
            return []

    return await asyncio.to_thread(_run)


async def get_top_pages(property_id: str, days: int = 30, limit: int = 10) -> list[dict]:
    """
    Top pages by page views with engagement metrics.
    Returns list of { page_path, title, pageviews, avg_time_on_page }.
    """
    import asyncio

    def _run():
        client = _get_client()
        if not client:
            return []

        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )

        end = date.today()
        start = end - timedelta(days=days)

        req = RunReportRequest(
            property=f"properties/{property_id}",
            date_ranges=[DateRange(start_date=str(start), end_date=str(end))],
            dimensions=[
                Dimension(name="pagePath"),
                Dimension(name="pageTitle"),
            ],
            metrics=[
                Metric(name="screenPageViews"),
                Metric(name="averageSessionDuration"),
            ],
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="screenPageViews"), desc=True)],
            limit=limit,
        )
        try:
            resp = client.run_report(req)
            return [
                {
                    "page_path": row.dimension_values[0].value,
                    "title": row.dimension_values[1].value,
                    "pageviews": int(row.metric_values[0].value),
                    "avg_time_on_page": round(float(row.metric_values[1].value), 1),
                }
                for row in resp.rows
            ]
        except Exception as exc:
            logger.error("GA4 top pages query failed for %s: %s", property_id, exc)
            return []

    return await asyncio.to_thread(_run)
