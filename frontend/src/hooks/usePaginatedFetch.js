import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { api } from '../services/api';

/**
 * Server-side pagination for Supabase-backed list endpoints, cached via
 * TanStack Query. Keeps the previous page visible while paging (no flash).
 *
 * Expects responses shaped `{ <listKey>: [...], total, page, page_size, pages }`
 * and appends `page`/`page_size` to the request URL.
 */
export default function usePaginatedFetch({
  url,
  token,
  params = {},
  listKey,
  pageSize: initialPageSize = 20,
}) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    setPageState(1);
  }, [paramsKey]);

  const queryKey = ['paginated', url, paramsKey, page, pageSize, token];

  const query = useQuery({
    queryKey,
    queryFn: () => {
      const queryString = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined || value === 'all') return;
        queryString.set(key, value);
      });
      queryString.set('page', String(page));
      queryString.set('page_size', String(pageSize));

      const qs = queryString.toString();
      return api.get(`${url}${qs ? `?${qs}` : ''}`, token);
    },
    placeholderData: (prev) => prev,
  });

  const data = query.data || {};
  const items = data[listKey] || [];
  const total = data.total ?? 0;
  const pages = data.pages ?? 0;

  useEffect(() => {
    if (pages > 1 && page > pages) {
      setPageState(pages);
    } else if (pages === 0 && page !== 1) {
      setPageState(1);
    }
  }, [pages, page]);

  const changePage = useCallback((next) => {
    setPageState((current) => {
      const clamped = Math.max(1, Math.min(next, pages || next));
      return clamped === current ? current : clamped;
    });
  }, [pages]);

  const changePageSize = useCallback((nextSize) => {
    setPageSizeState(nextSize);
    setPageState(1);
  }, []);

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['paginated', url, paramsKey] });
  }, [url, paramsKey]);

  const setItems = useCallback((updater) => {
    queryClient.setQueryData(queryKey, (prev) => {
      const oldItems = prev?.[listKey] || [];
      return {
        ...(prev || {}),
        [listKey]: typeof updater === 'function' ? updater(oldItems) : updater,
        total: typeof updater === 'function' ? prev?.total ?? oldItems.length : updater.length,
      };
    });
  }, [queryKey, listKey]);

  return {
    items,
    total,
    pages,
    page,
    pageSize,
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error.detail || query.error.message || 'Failed to load records.') : '',
    setItems,
    reload,
    setPage: changePage,
    setPageSize: changePageSize,
    setError: () => {},
  };
}