import { CID } from 'multiformats/cid';

// Returns true if the provided value is a valid IPFS CID or ipfs:// URI
export function isValidCID(value) {
  if (!value) return false;
  const v = String(value).trim();
  const stripped = v.replace(/^ipfs:\/\//i, '');
  try {
    // CID.parse will throw if invalid
    CID.parse(stripped);
    return true;
  } catch (e) {
    return false;
  }
}

// Normalize to raw CID string (no ipfs:// prefix)
export function normalizeCid(value) {
  if (!value) return '';
  return String(value).trim().replace(/^ipfs:\/\//i, '');
}
