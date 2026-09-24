import postgrest
from httpx import Client as SyncClient
from supabase import create_client, Client
from app.core.config import settings

# Force http2=False on postgrest and auth to prevent RemoteProtocolError ("Server disconnected")
# caused by stale HTTP/2 connection reuse when idle.
_orig_postgrest_session = postgrest.SyncPostgrestClient.create_session

def _safe_postgrest_session(self, base_url, headers, timeout, verify=True, proxy=None):
    return SyncClient(
        base_url=base_url,
        headers=headers,
        timeout=timeout,
        verify=verify,
        proxy=proxy,
        follow_redirects=True,
        http2=False,
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


def reset_supabase():
    """Reset the cached singleton instance."""
    global _client
    _client = None


def get_supabase() -> Client:
    """Return the shared Supabase client (lazy singleton)."""
    global _client
    if _client is None:
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def get_supabase_anon() -> Client:
    """Return an anon-key client for operations that run as the calling user."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
