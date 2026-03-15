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
import { getToken } from '../Auth/auth';

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
  return fetch(url, {
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