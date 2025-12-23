// Small boot-time backend check used to detect a misconfigured VITE_API_BASE
import apiClient from './utils/apiClient';

export async function checkBackend(timeoutMs = 3000) {
  // Use apiClient so base resolution honors runtime API_BASE. apiClient.apiFetch
  // will throw on non-OK responses; return boolean accordingly.
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    // Use /api/version endpoint which always exists as a lightweight health check
    await apiClient.apiFetch('/api/version', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(id);
    return true;
  } catch (e) {
    console.debug('[checkBackend] Backend health check failed:', e.message);
    return false;
  }
}
