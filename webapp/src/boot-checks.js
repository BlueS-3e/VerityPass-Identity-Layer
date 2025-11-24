// Small boot-time backend check used to detect a misconfigured VITE_API_BASE
import apiClient from './utils/apiClient';

export async function checkBackend(timeoutMs = 3000) {
  // Use apiClient so base resolution honors runtime API_BASE. apiClient.apiFetch
  // will throw on non-OK responses; return boolean accordingly.
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    await apiClient.apiFetch('/api/health', { signal: controller.signal, cache: 'no-store' });
    clearTimeout(id);
    return true;
  } catch (e) {
    return false;
  }
}
