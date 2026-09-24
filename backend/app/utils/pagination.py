from pydantic import BaseModel, Field


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


def paginate(query, params: PaginationParams) -> dict:
    """Apply Supabase range paging to an already-selected query builder.

    Call sites MUST build the query as
    ``table(...).select("<columns>", count="exact")`` and chain their
    filters/order first — in supabase-py, filter/transform methods (``eq``,
    ``order``, ``range``) only exist on the builder returned by ``select``, and
    ``count`` is only settable as a kwarg of ``select``. This helper only adds
    the ``range`` slice and reads ``res.count`` (PostgREST COUNT) so ``total``
    is real, not ``len(fetched)``. ``range(start, end)`` has an inclusive end.
    """
    start = (params.page - 1) * params.page_size
    end = start + params.page_size - 1
    res = query.range(start, end).execute()
    items = res.data or []
    total = res.count if getattr(res, "count", None) is not None else len(items)
    pages = (total + params.page_size - 1) // params.page_size if total else 0
    return {
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": pages,
        "items": items,
    }