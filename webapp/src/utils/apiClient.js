import { API_BASE } from '../config';

function resolveUrl(path) {
  const base = (typeof API_BASE === 'function') ? API_BASE() : (API_BASE || '');
  if (!path) return base || '';
  // If path is absolute (http/https), return as-is
  if (/^https?:\/\//.test(path)) return path;
  // If path already includes a host (protocol-relative), return as-is
  if (/^\/\//.test(path)) return path;
  // If path starts with /api, prefer configured API_BASE if present
  if (path.startsWith('/api')) {
    if (base) return base.replace(/\/$/, '') + path;
    return path; // fallback to same-origin
  }
  // otherwise, join with base if provided
  return base ? base.replace(/\/$/, '') + '/' + path.replace(/^\//, '') : path;
}

async function apiFetch(path, opts = {}) {
  const url = resolveUrl(path);
  const defaultOpts = { credentials: 'include', headers: {} };
  const final = { ...defaultOpts, ...opts };
  // If body is a plain object and not FormData, stringify and set header
  if (final.body && typeof final.body === 'object' && !(final.body instanceof FormData)) {
    final.headers = { 'Content-Type': 'application/json', ...(final.headers || {}) };
    final.body = JSON.stringify(final.body);
  }
  
  // Log the request for debugging
  console.debug('[apiClient] Request:', { method: final.method || 'GET', path, url, hasBody: !!final.body });
  
  let res;
  try {
    res = await fetch(url, final);
  } catch (fetchError) {
    console.error('[apiClient] Fetch failed:', { path, url, error: fetchError.message });
    throw new Error(`Network error calling ${path}: ${fetchError.message}`);
  }
  
  // Some tests or environments may mock fetch and return a plain object
  // without a Headers instance. Be defensive when reading headers.
  let contentType = '';
  if (res && res.headers) {
    try {
      if (typeof res.headers.get === 'function') {
        contentType = res.headers.get('content-type') || '';
      } else if (typeof res.headers['content-type'] === 'string') {
        contentType = res.headers['content-type'];
      }
    } catch (e) {
      contentType = '';
    }
  }

  let payload = null;
  // Prefer JSON when content-type indicates it, or when a .json() method exists
  if (contentType.includes('application/json') || (res && typeof res.json === 'function')) {
    payload = await (res.json ? res.json() : Promise.resolve(null)).catch(() => null);
  } else if (res && typeof res.text === 'function') {
    payload = await res.text().catch(() => null);
  } else {
    payload = null;
  }
  
  // Log response for debugging
  console.debug('[apiClient] Response:', { path, status: res.status, ok: res.ok, contentType });
  
  if (!res.ok) {
    console.error('[apiClient] API error:', { path, status: res.status, payload });
    const err = new Error((payload && payload.error) || `API error: ${res.status}`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export async function apiGet(path, opts = {}) {
  return apiFetch(path, { method: 'GET', ...opts });
}

export async function apiPost(path, body, opts = {}) {
  return apiFetch(path, { method: 'POST', body, ...opts });
}

export default { resolveUrl, apiFetch, apiGet, apiPost };
