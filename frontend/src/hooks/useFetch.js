import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

/**
 * Cached GET wrapper over api.js backed by TanStack Query.
 *
 * @param {string} url            API path, e.g. '/caregivers/me'
 * @param {object} [options]
 * @param {object} [options.params]  Query params appended to the URL
 * @param {boolean} [options.enabled] Gate the fetch (e.g. `!!token`)
 * @param {number} [options.staleTime] Override the global staleTime for this query
 * @param {*} [options.defaultData] Placeholder used while the first fetch is in flight
 * @returns {{ data, isLoading, isFetching, isSuccess, error, refetch }}
 */
export default function useFetch(url, options = {}) {
  const { token } = useAuth();
  const { params = {}, enabled = true, staleTime, defaultData = null } = options;

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined || value === 'all') return;
    qs.set(key, value);
  });
  const search = qs.toString();
  const fullUrl = `${url}${search ? `?${search}` : ''}`;

  const query = useQuery({
    queryKey: [url, JSON.stringify(params)],
    queryFn: () => api.get(fullUrl, token || undefined),
    enabled,
    staleTime,
    placeholderData: defaultData,
  });

  return {
    data: query.data ?? defaultData,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    error: query.error ? (query.error.detail || query.error.message || 'Failed to load data.') : '',
    refetch: query.refetch,
  };
}