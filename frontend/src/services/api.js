const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, { status = 0, detail = message, code = null, fieldErrors = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function getErrorDetails(payload, fallback) {
  if (typeof payload === 'string') {
    return { detail: payload, message: payload };
  }

  if (Array.isArray(payload)) {
    return {
      detail: 'Request validation failed.',
      message: 'Request validation failed.',
      fieldErrors: payload,
    };
  }

  const detail = payload?.detail || payload?.message || fallback;
  return {
    detail: typeof detail === 'string' ? detail : fallback,
    message: typeof detail === 'string' ? detail : fallback,
    code: payload?.code || null,
    fieldErrors: Array.isArray(payload?.detail) ? payload.detail : payload?.field_errors || null,
  };
}

async function parseResponseBody(res) {
  if (res.status === 204) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return res.json();
}

async function request(method, path, body, token, signal) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, { once: true });

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const payload = await parseResponseBody(res).catch(() => null);
      const details = getErrorDetails(payload, res.statusText || 'Request failed.');
      throw new ApiError(details.message, { status: res.status, ...details });
    }

    return parseResponseBody(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out or was cancelled.', { code: 'REQUEST_ABORTED' });
    }
    throw new ApiError('Network request failed.', { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
  }
}

async function upload(path, formData, token, signal) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortRequest = () => controller.abort();
  signal?.addEventListener('abort', abortRequest, { once: true });

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    if (!res.ok) {
      const payload = await parseResponseBody(res).catch(() => null);
      const details = getErrorDetails(payload, res.statusText || 'Upload failed.');
      throw new ApiError(details.message, { status: res.status, ...details });
    }

    return parseResponseBody(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out or was cancelled.', { code: 'REQUEST_ABORTED' });
    }
    throw new ApiError('Network request failed.', { code: 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortRequest);
  }
}

export const api = {
  get: (path, token, signal) => request('GET', path, null, token, signal),
  post: (path, body, token, signal) => request('POST', path, body, token, signal),
  put: (path, body, token, signal) => request('PUT', path, body, token, signal),
  patch: (path, body, token, signal) => request('PATCH', path, body, token, signal),
  delete: (path, token, signal) => request('DELETE', path, null, token, signal),
  upload: (path, formData, token, signal) => upload(path, formData, token, signal),
};
