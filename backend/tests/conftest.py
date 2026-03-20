"""
Shared pytest configuration and fixtures.

pytest-asyncio is configured in async auto mode so every async test function
is treated as a coroutine without needing @pytest.mark.asyncio on each one.
(The @pytest.mark.asyncio decorators are still included explicitly for
clarity, but they become redundant with asyncio_mode = "auto".)
"""

import pytest


# Use asyncio_mode = "auto" when running with pytest-asyncio >= 0.21.
# This can also be set in pytest.ini / pyproject.toml:
#   [tool.pytest.ini_options]
#   asyncio_mode = "auto"
def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark a test as an asyncio coroutine"
    )
