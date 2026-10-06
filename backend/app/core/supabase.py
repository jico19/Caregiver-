import threading
import postgrest
from httpx import Client as SyncClient
from supabase import create_client, Client
from app.core.config import settings

import time
from contextvars import ContextVar

# Tracks (query_count: int, total_duration_seconds: float) per request thread/task
db_metrics: ContextVar[dict | None] = ContextVar("db_metrics", default=None)

# Force http2=False on postgrest and auth to prevent RemoteProtocolError ("Server disconnected")
# caused by stale HTTP/2 connection reuse when idle, and instrument latency/query counts.
_orig_postgrest_session = postgrest.SyncPostgrestClient.create_session

def _safe_postgrest_session(self, base_url, headers, timeout, verify=True, proxy=None):
    def on_request(request):
        request.extensions["start_time"] = time.time()

    def on_response(response):
        start = response.request.extensions.get("start_time")
        if start is not None:
            elapsed = time.time() - start
            metrics = db_metrics.get()
            if metrics is not None:
                metrics["queries"] += 1
                metrics["duration"] += elapsed

    return SyncClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        verify=verify,
        proxy=proxy,
        follow_redirects=True,
        http2=False,
        event_hooks={"request": [on_request], "response": [on_response]},
    )

postgrest.SyncPostgrestClient.create_session = _safe_postgrest_session

try:
    import gotrue._sync.gotrue_base_api as _gotrue_mod
    _orig_gotrue_init = _gotrue_mod.SyncGoTrueBaseAPI.__init__

    def _safe_gotrue_init(self, *, url, headers, http_client=None, verify=True, proxy=None):
        if http_client is None:
            http_client = SyncClient(
                verify=bool(verify),
                proxy=proxy,
                follow_redirects=True,
                http2=False,
            )
        _orig_gotrue_init(self, url=url, headers=headers, http_client=http_client, verify=verify, proxy=proxy)

    _gotrue_mod.SyncGoTrueBaseAPI.__init__ = _safe_gotrue_init
except Exception:
    pass

_client: Client | None = None
_client_anon: Client | None = None
_client_lock = threading.Lock()


def _close_client(c: Client | None):
    if c is None:
        return
    try:
        if hasattr(c, "postgrest") and hasattr(c.postgrest, "session"):
            c.postgrest.session.close()
    except Exception:
        pass


def reset_supabase():
    """Reset and close the cached singleton instances."""
    global _client, _client_anon
    with _client_lock:
        if _client is not None:
            _close_client(_client)
            _client = None
        if _client_anon is not None:
            _close_client(_client_anon)
            _client_anon = None


def get_supabase() -> Client:
    """Return the shared Supabase service client (thread-safe lazy singleton)."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def get_supabase_anon() -> Client:
    """Return an anon-key client for operations that run as the calling user (thread-safe lazy singleton)."""
    global _client_anon
    if _client_anon is None:
        with _client_lock:
            if _client_anon is None:
                _client_anon = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    return _client_anon
