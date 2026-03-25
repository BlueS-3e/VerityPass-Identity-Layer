import apiClient from './apiClient';

/**
 * Call the backend credit assessment endpoint.
 * payload should be { draft: {...}, bank_meta: {...}, onchain: {...} }
 */
export default async function assessCredit(payload) {
  return apiClient.apiPost('/api/credit/assess', payload || {});
}
