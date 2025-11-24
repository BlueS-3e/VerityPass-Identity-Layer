import * as ethers from 'ethers';

// Return an ethers Provider for ethers v6 (BrowserProvider / JsonRpcProvider).
// This project has migrated to ethers v6; we simplify provider creation to
// use v6 APIs. If a legacy provider wrapper is needed, handle it elsewhere.
export function getEthersProvider(rawProvider) {
  if (!rawProvider) return null;
  try {
    if (ethers && typeof ethers.BrowserProvider === 'function') {
      return new ethers.BrowserProvider(rawProvider);
    }
  } catch (e) {
    // ignore and return null; callers can fallback to other strategies
  }
  // If no BrowserProvider support, but a JsonRpc endpoint was passed, try JsonRpcProvider
  try {
    if (ethers && typeof ethers.JsonRpcProvider === 'function') {
      return new ethers.JsonRpcProvider(rawProvider);
    }
  } catch (e) {}
  return null;
}

// Helper to obtain a signer from an ethers provider produced by getEthersProvider.
export async function getSignerFromEthersProvider(ethersProvider) {
  if (!ethersProvider) return null;
  try {
    if (typeof ethersProvider.getSigner === 'function') return ethersProvider.getSigner();
  } catch (e) {
    // ignore
  }
  return null;
}
