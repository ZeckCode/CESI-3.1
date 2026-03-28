/**
 * Thin wrapper around fetch() that automatically injects the
 * Authorization header from localStorage when a token exists.
 *
 * Usage:
 *   import { apiFetch, apiFetchData, authHeaders } from '../api/apiFetch';
 *
 *   // Raw fetch response
 *   const res = await apiFetch('/api/grades/items/');
 *   const data = await res.json();
 *
 *   // Parsed response directly
 *   const data = await apiFetchData('/api/grades/items/');
 */
import { API_BASE_URL } from '../../config/api.js';
import { getToken } from '../Auth/auth';

/**
 * Normalizes request URL by combining API_BASE_URL with a relative path.
 * - If url is absolute (http/https), uses it as-is.
 * - Otherwise, it prefixes API_BASE_URL.
 * - Supports VITE_API_URL both with and without /api suffix.
 */
function resolveUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;

  const base = API_BASE_URL.replace(/\/api\/?$/i, '').replace(/\/$/, '');

  // Keep the endpoint simple: path can be '/api/...' or '/...'
  let path = url.replace(/^\/+/, '');
  if (path.toLowerCase().startsWith('api/')) {
    path = path.slice(4);
  }

  const apiPrefix = API_BASE_URL.endsWith('/api') || API_BASE_URL.endsWith('/api/')
    ? '/api'
    : '';

  return `${base}${apiPrefix}/${path}`.replace(/([^:]\/)\/+/g, '$1');
}

/**
 * Returns a headers object with the Authorization token (if present).
 * Merge additional headers by passing an object.
 */
export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
}

/**
 * Keep existing behavior:
 * returns the raw fetch Response object.
 */
export async function apiFetch(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const requestUrl = resolveUrl(url);
  return fetch(requestUrl, {
    credentials: 'include',
    ...rest,
    headers: authHeaders(extraHeaders),
  });
}

/**
 * New helper:
 * returns parsed JSON/text and throws readable errors.
 */
export async function apiFetchData(url, options = {}) {
  const response = await apiFetch(url, options);

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => null);
  }

  if (!response.ok) {
    const error = new Error(
      (data && typeof data === 'object' && (data.detail || data.error)) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    error.response = response;
    throw error;
  }

  return data;
}