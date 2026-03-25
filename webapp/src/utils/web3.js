import * as ethers from "ethers";
// Ethers v6 top-level helpers (assume ethers v6 is installed)
const JsonRpcProvider = ethers.JsonRpcProvider;
const ContractClass = ethers.Contract;
const formatEther = ethers.formatEther;
const parseEther = ethers.parseEther;
const formatUnits = ethers.formatUnits;
const getAddress = ethers.getAddress;
import { getEthersProvider } from './ethersProvider';
import apiClient from './apiClient';
import { API_BASE } from "../config.js";
import { listInjectedProviders, getNetworkConfig } from './providerDetect';

// RealMintLaunchpad contract ABI (minimal interface for key methods)
const RealMintLaunchpadABI = {
  abi: [
    {
      "inputs": [
        { "internalType": "address", "name": "launchpadOwner", "type": "address" },
        { "internalType": "address", "name": "paymentRecipient", "type": "address" },
        { "internalType": "uint256", "name": "listingFeeAmount", "type": "uint256" }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "internalType": "bytes32", "name": "projectId", "type": "bytes32" },
        { "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
        { "internalType": "string", "name": "name", "type": "string" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
      ],
      "name": "ProjectListed",
      "type": "event"
    },
    {
      "inputs": [{ "internalType": "bytes32", "name": "projectId", "type": "bytes32" }],
      "name": "getProject",
      "outputs": [
        { "internalType": "address", "name": "owner", "type": "address" },
        { "internalType": "string", "name": "name", "type": "string" },
        { "internalType": "uint256", "name": "launchDate", "type": "uint256" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "string", "name": "projectName", "type": "string" },
        { "internalType": "uint256", "name": "launchDate", "type": "uint256" }
      ],
      "name": "listProject",
      "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "listingFee",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

// Network defaults (BSC / BNB Chain)
const BSC = {
  mainnet: {
    chainId: "0x38",
    chainName: "Binance Smart Chain Mainnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://bsc-dataseed.binance.org/"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  testnet: {
    chainId: "0x61",
    chainName: "Binance Smart Chain Testnet",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
    blockExplorerUrls: ["https://testnet.bscscan.com"],
  },
};

// Default to empty string to avoid attempting ENS/name resolution on placeholder
export const CONTRACT_ADDRESS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CONTRACT_ADDRESS) || "";
export const PAYMENT_ADDRESS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PAYMENT_ADDRESS) || CONTRACT_ADDRESS;
// Recommended default listing fee: set to 0.02 native token units (e.g., 0.02 BNB)
// Rationale: balances covering typical L1/L2 gas costs for submission, deters spam
// while remaining affordable for small projects. Operators can override via
// VITE_LISTING_FEE at build time if a different value is desired.
export const DEFAULT_LISTING_FEE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_LISTING_FEE) || '0.02';

let _provider = null;

// Allow configuring default runtime RPC / chain via Vite env vars:
// - VITE_RPC_URL : override the JSON-RPC URL used by the fallback provider
// - VITE_DEFAULT_CHAIN_ID : numeric chain id (56 or 97) to choose mainnet/testnet fallback
// Runtime default chain id may be overridden by Vite env or by user selection stored in localStorage
const BUILD_DEFAULT_CHAIN_ID = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DEFAULT_CHAIN_ID)
  ? Number(import.meta.env.VITE_DEFAULT_CHAIN_ID)
  : 97;

function _getRuntimeSelectedChainId() {
  try {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('selected_chain') : null;
    if (stored) return Number(stored);
  } catch (e) {}
  // fallback to build-time default
  return BUILD_DEFAULT_CHAIN_ID;
}

export function getProvider() {
  if (!_provider) {
    if (typeof window !== "undefined" && window.ethereum) {
      _provider = getEthersProvider(window.ethereum) || null;
      try {
        // When wallet signals a chain/account change, drop cached provider so
        // callers will re-resolve signer/provider state.
        window.ethereum?.on?.("chainChanged", () => { _provider = null; });
        window.ethereum?.on?.("accountsChanged", () => { _provider = null; });
      } catch (e) { /* ignore listener install errors */ }
    } else {
      // Choose fallback RPC from env or default to configured chain based on runtime selection
      const envRpc = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RPC_URL) || '';
      const selectedChain = _getRuntimeSelectedChainId();
      
      // Get RPC for the selected chain from network config, with fallback to BSC testnet
      let fallbackRpc;
      const networkConfig = getNetworkConfig(selectedChain);
      if (envRpc) {
        fallbackRpc = envRpc;
      } else if (networkConfig && Array.isArray(networkConfig.rpcUrls) && networkConfig.rpcUrls.length) {
        fallbackRpc = networkConfig.rpcUrls[0];
      } else {
        // Ultimate fallback to BSC testnet if no config found
        fallbackRpc = BSC.testnet.rpcUrls[0];
      }
      
      _provider = new JsonRpcProvider(fallbackRpc);
    }
  }
  return _provider;
}

export function setSelectedChain(chainId) {
  try { if (typeof window !== 'undefined') window.localStorage.setItem('selected_chain', String(chainId)); } catch (e) {}
  _provider = null; // drop cached provider so callers re-resolve signer/provider
}

export function getSigner() {
  const prov = getProvider();
  try {
    // BrowserProvider.getSigner may throw if no accounts are available.
    const signer = prov.getSigner && prov.getSigner();
    return signer || null;
  } catch (e) {
    return null;
  }
}

export function getContract(address = CONTRACT_ADDRESS, signerOrProvider = null) {
  // Basic validation: avoid passing an invalid string (e.g. placeholder) to ethers.Contract
  // which will try to resolve a name (ENS) and may fail with "runner does not support name resolution".
  const so = signerOrProvider || getSigner() || getProvider();
  try {
  // normalize/check address; getAddress will throw for invalid addresses
  const normalized = getAddress(address);
  return new ContractClass(normalized, RealMintLaunchpadABI.abi, so);
  } catch (err) {
    // Throw a clearer error so callers can handle the case (and avoid deep provider name resolution errors)
    throw new Error(`Invalid contract address provided to getContract: ${String(address)}`);
  }
}

// ensureBscChain now accepts an optional injectedProvider param. If provided,
// the provider's RPC methods will be used instead of `window.ethereum`.
export async function ensureBscChain({ useTestnet = true } = {}, injectedProvider = undefined) {
  const ethProvider = injectedProvider || (typeof window !== "undefined" ? window.ethereum : undefined);
  if (typeof window === "undefined" || !ethProvider) throw new Error("No injected wallet detected (window.ethereum missing)");
  // Some non-EVM wallets (e.g. Phantom for Solana) expose window.solana and may
  // also expose shims that confuse EVM chain switching. Detect common Solana
  // wallets and surface a clearer error to callers so the UI can instruct users
  // to use an EVM-compatible wallet (MetaMask) instead of attempting a switch.
  try {
    // Keep Solana detection via window.solana (extensions may not appear on the provider object)
    if (typeof window !== 'undefined' && window.solana && window.solana.isPhantom) {
      throw new Error('Detected Phantom (Solana) wallet — this wallet does not support automatic EVM chain switching. Please use an EVM wallet (MetaMask) or switch networks manually.');
    }
  } catch (e) {
    // ignore
  }
  const target = useTestnet ? BSC.testnet : BSC.mainnet;
  const chainId = target.chainId;
  // Normalize current chainId and short-circuit if already on target
  try {
    const current = await ethProvider.request({ method: 'eth_chainId' }).catch(() => null);
    if (current && String(current).toLowerCase() === String(chainId).toLowerCase()) {
      return { already: true };
    }
  } catch (e) {
    // ignore and attempt switch
  }

  try {
    await ethProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    _provider = null; return { switched: true };
  } catch (switchError) {
    // User rejected the request
    if (switchError && switchError.code === 4001) {
      throw new Error('User rejected chain switch request');
    }
    // Unrecognized chain — try adding it
    if (switchError && (switchError.code === 4902 || /unrecognized/i.test(switchError.message || ''))) {
      try {
        await ethProvider.request({ method: "wallet_addEthereumChain", params: [target] });
        _provider = null; return { added: true };
      } catch (addErr) {
        // Some wallets don't support programmatic chain add; surface helpful message
        const rpc = (target.rpcUrls && target.rpcUrls[0]) || '';
        throw new Error(`Wallet does not support automatic chain addition. Please add chain manually using RPC URL: ${rpc}`);
      }
    }
    // Unknown failure — rethrow with message
    throw switchError;
  }
}

export async function requestAccounts(provider = null) {
  const mapWalletRequestError = (e) => {
    const msg = String(e?.message || '').toLowerCase();
    const nestedMethod = String(e?.data?.method || '').toLowerCase();
    const code = Number(e?.code);
    if (code === 4001) return new Error('User rejected account access');
    if (code === -32603 && (nestedMethod.includes('public_requestaccounts') || msg.includes('origin not allowed'))) {
      return new Error('Wallet origin is not allowed by this extension. Please use MetaMask/WalletConnect or disable non-EVM wallet extensions for this site.');
    }
    return e;
  };

  // If a provider object was explicitly provided, prefer using it directly
  // but only when it implements the EIP-1193 `request()` method. Otherwise
  // fall back to enumerating injected providers.
  if (provider) {
    // If provider implements request(), use it.
    if (typeof provider.request === 'function') {
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        return accounts;
      } catch (e) {
        throw mapWalletRequestError(e);
      }
    }

    // Some wrappers may nest the raw injected provider under `.provider`
    if (provider.provider && typeof provider.provider.request === 'function') {
      try {
        const accounts = await provider.provider.request({ method: 'eth_requestAccounts' });
        return accounts;
      } catch (e) {
        throw mapWalletRequestError(e);
      }
    }

    // If the explicit provider doesn't expose request(), continue to the
    // enumeration path below instead of throwing a TypeError.
  }

  // No explicit provider: enumerate injected providers and try sensible candidates
  if (typeof window === 'undefined' || !window.ethereum) throw new Error('No injected wallet detected');
  const items = listInjectedProviders() || [];
  if (!items || items.length === 0) {
    // Fallback to window.ethereum if nothing enumerated
    if (window.ethereum && typeof window.ethereum.request === 'function') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        return accounts;
      } catch (e) {
        throw mapWalletRequestError(e);
      }
    }
    throw new Error('No injected wallet detected');
  }

  // Try preferred wallets first
  const preferred = ['MetaMask', 'Coinbase Wallet', 'Brave Wallet'];
  for (const name of preferred) {
    const found = items.find(it => it.name === name && it.provider && typeof it.provider.request === 'function');
    if (!found) continue;
    try {
      const accs = await found.provider.request({ method: 'eth_requestAccounts' });
      return accs;
    } catch (e) {
      if (Number(e?.code) === 4001) throw mapWalletRequestError(e);
      // otherwise continue to next candidate
    }
  }

  // Next try any non-Trust provider that supports request()
  const nonTrust = items.filter(it => it.name !== 'Trust Wallet' && it.provider && typeof it.provider.request === 'function');
  for (const it of nonTrust) {
    try {
      const accs = await it.provider.request({ method: 'eth_requestAccounts' });
      return accs;
    } catch (e) {
      if (Number(e?.code) === 4001) throw mapWalletRequestError(e);
    }
  }

  // If only Trust Wallet remains, allow it as a last resort (but do not prefer it)
  const trust = items.find(it => it.name === 'Trust Wallet' && it.provider && typeof it.provider.request === 'function');
  if (trust) {
    try {
      const accs = await trust.provider.request({ method: 'eth_requestAccounts' });
      return accs;
    } catch (e) {
      throw mapWalletRequestError(e);
    }
  }

  // As a final fallback try the aggregated window.ethereum provider if it exposes request()
  if (window.ethereum && typeof window.ethereum.request === 'function') {
    try {
      const accs = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accs;
    } catch (e) {
      throw mapWalletRequestError(e);
    }
  }

  throw new Error('No injected wallet detected or no provider supports account requests');
}

export async function getBalance(address) {
  const prov = getProvider();
  try { const balance = await prov.getBalance(address); return formatEther(balance); } catch (e) { console.error(e); return null; }
}

// API helpers
async function apiPost(path, body, opts = {}) {
  return apiClient.apiPost(path, body, opts);
}

export async function pinAttestationToApi(payload) { return apiPost('/api/attestations/pin', payload); }
export async function submitAttestationForVerify(payload) { return apiPost('/api/attestations', payload); }
export async function fetchProjects() { return apiClient.apiGet('/api/projects'); }
export async function submitProjectForm(formData) { return apiClient.apiPost('/api/projects', formData, { headers: {}, body: formData }); }

// Admin helpers
export async function adminLogin(password) {
  try {
    await apiClient.apiPost('/api/admin/login', { password });
    return true;
  } catch (e) {
    return false;
  }
}

export async function adminListProjects() {
  // apiClient.apiGet will throw on non-OK; keep the original semantics by
  // propagating an explicit 'Unauthorized' message when appropriate.
  try {
    return await apiClient.apiGet('/api/admin/projects');
  } catch (e) {
    const err = new Error('Unauthorized');
    err.cause = e;
    throw err;
  }
}

export async function adminUpdateProject(id, status, csrfToken = null) {
  const headers = {};
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return apiClient.apiFetch(`/api/admin/projects/${id}`, { method: 'PATCH', headers, body: { status } });
}

export async function adminDeleteProject(id, csrfToken = null) {
  const headers = {};
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return apiClient.apiFetch(`/api/admin/projects/${id}`, { method: 'DELETE', headers });
}

export async function adminSiwe(message, signature) {
  try {
    await apiClient.apiPost('/api/admin/siwe', { message, signature });
    return true;
  } catch (e) {
    return false;
  }
}

// Check whether current session is an admin. This calls the admin projects endpoint
// and returns a boolean. It is safe to call from the client: a false response
// simply means the user is not authenticated as admin. Note: this is UI-only
// visibility control — server-side checks remain authoritative.
export async function isAdmin() {
  try {
    await adminListProjects();
    return true;
  } catch (e) {
    return false;
  }
}

// On-chain attestation publishing (ABI-limited)
const ATTESTATION_ABI = [
  "function publishAttestationTyped(address subject, bytes32 schemaHash, string dataCID, uint256 expiresAt, bytes signature) returns (uint256)",
  "function publishAttestationSigned(address subject, bytes32 schemaHash, string dataCID, uint256 expiresAt, bytes signature) returns (uint256)",
  "function publishAttestation(address subject, bytes32 schemaHash, string dataCID, uint256 expiresAt) returns (uint256)"
];

export async function publishAttestationOnChain(contractAddress, callPayload) {
  if (!contractAddress) throw new Error('contractAddress required');
  const provider = getProvider();
  const signer = getSigner();
  const so = signer || provider;
  const contract = new ContractClass(contractAddress, ATTESTATION_ABI, so);
  const dataForChain = callPayload.dataCID && callPayload.dataCID.startsWith('ipfs://') ? callPayload.dataCID.replace(/^ipfs:\/\//, '') : callPayload.dataCID;
  const tx = await contract.publishAttestationTyped(callPayload.subject, callPayload.schemaHash, dataForChain, callPayload.expiresAt, callPayload.signature);
  return tx;
}

export async function pinAndPublish(contractAddress, payload) {
  const pinResp = await pinAttestationToApi(payload);
  const callPayload = pinResp.call_payload || null;
  let tx = null;
  if (contractAddress && callPayload) {
    tx = await publishAttestationOnChain(contractAddress, callPayload);
    await tx.wait();
  }
  return { pinResp, tx };
}

// Payment helper: send native token to configured payment address (or contract)
export async function payListingFee(amount = DEFAULT_LISTING_FEE, toAddress = PAYMENT_ADDRESS) {
  const signer = getSigner();
  if (!signer) throw new Error('No signer available; connect wallet first');
  const tx = await signer.sendTransaction({ to: toAddress, value: parseEther(String(amount)) });
  return tx;
}

// Prefer on-chain owner() as the authoritative fee recipient.
// Frontend env var `VITE_PAYMENT_ADDRESS` should be treated as display-only.
// In production builds, warn if VITE_PAYMENT_ADDRESS is not set so operators
// don't mistakenly think the frontend controls fee routing.
if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) {
  const envSet = Boolean(import.meta.env.VITE_PAYMENT_ADDRESS)
  if (!envSet) {
    // Non-blocking warning: production build without VITE_PAYMENT_ADDRESS
    // could indicate missing operator config. The canonical recipient is
    // the on-chain `owner()` of the contract; frontends must not be treated
    // as a source of truth for fund routing.
    // Use console.warn so it appears in production browser logs for operators.
    // (Do not throw to avoid breaking the UI in edge cases.)
    // eslint-disable-next-line no-console
    console.warn('[web3] production build: VITE_PAYMENT_ADDRESS is not set — ensure contract owner() is a multisig/timelock and frontend is display-only')
  }
}

// Returns the on-chain owner() for the launchpad contract. Use this in the UI
// when you need the authoritative fee recipient address (e.g. show operator
// multisig address). Returns null on error.
export async function getOnChainOwner (contractAddress = CONTRACT_ADDRESS) {
  // Validate address early and avoid creating a Contract when the configured address is a placeholder
  try {
  getAddress(contractAddress);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[web3] getOnChainOwner skipped: invalid or missing contract address:', contractAddress);
    return null;
  }

  try {
    const contract = getContract(contractAddress)
    // contract.owner() should be available on-owner based contracts (Ownable)
    const ownerAddr = await contract.owner()
    return ownerAddr
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[web3] getOnChainOwner failed while querying owner():', err && err.message ? err.message : err)
    return null
  }
}

// Export a helpers object so internal functions can be mocked in tests.
export const __web3_helpers = { getOnChainOwner };

// Return an authoritative fee recipient (prefer on-chain owner, fallback to env)
export async function getAuthoritativeFeeRecipient (contractAddress = CONTRACT_ADDRESS) {
  // Prefer on-chain owner() as the authoritative fee recipient when available.
  // Note: tests may mock __web3_helpers.getOnChainOwner; call it always and
  // fallback to PAYMENT_ADDRESS when it returns falsy or throws.
  try {
    const onChain = await __web3_helpers.getOnChainOwner(contractAddress);
    if (onChain) return onChain;
  } catch (e) {
    // ignore and fall back to env
  }
  return PAYMENT_ADDRESS;
}

// --- Fee preview & loyalty helpers ---
export async function getFeePreview(contractAddress = CONTRACT_ADDRESS, projectId) {
  const contract = getContract(contractAddress);
  // fetch project and platform params
  const proj = await contract.getProject(projectId);
  const tokenAddr = proj[2];
  const projectOwner = proj[0];
  const totalRaised = proj[3].toString();
  const platformFeeUsdCents = (await contract.platformFeeUsdCents()).toString();
  const platformPctBps = (await contract.platformPctBps()).toString();
  const pctThresholdUsdCents = (await contract.pctThresholdUsdCents()).toString();

  // convert flat fee to token units via contract helper
  const flatUnits = await contract.usdCentsToTokenUnits(tokenAddr, platformFeeUsdCents);
  const flatUnitsBn = flatUnits;

  // compute payout after flat (BN arithmetic in JS via BigInt / string)
  const totalRaisedBn = BigInt(totalRaised);
  const flatBn = BigInt(flatUnitsBn.toString());
  let payoutBn = totalRaisedBn > flatBn ? totalRaisedBn - flatBn : BigInt(0);

  let pctFeeBn = BigInt(0);
  if (parseInt(platformPctBps) > 0) {
    const thresholdUnits = BigInt((await contract.usdCentsToTokenUnits(tokenAddr, pctThresholdUsdCents)).toString());
    if (totalRaisedBn > thresholdUnits) {
      pctFeeBn = (payoutBn * BigInt(parseInt(platformPctBps))) / BigInt(10000);
      if (pctFeeBn > payoutBn) pctFeeBn = payoutBn;
      payoutBn = payoutBn - pctFeeBn;
    }
  }

  const totalFeeBn = flatBn + pctFeeBn;

  // Resolve token decimals and human-friendly strings
  let decimals = 18;
  try {
  const tokenContract = new ContractClass(tokenAddr, ["function decimals() view returns (uint8)", "function symbol() view returns (string)"], getProvider());
    decimals = Number((await tokenContract.decimals()));
    const symbol = await tokenContract.symbol().catch(()=>null);

    // convert units to human strings
    const flatHuman = formatUnits(flatBn.toString(), decimals);
    const pctHuman = formatUnits(pctFeeBn.toString(), decimals);
    const totalFeeHuman = formatUnits(totalFeeBn.toString(), decimals);
    const payoutHuman = formatUnits(payoutBn.toString(), decimals);

    // price feed info (if available). detect feed decimals if the feed exposes them
    let price = null;
    let priceDecimals = 8;
    let priceHuman = null;
    let priceTimestamp = null;
    let flatFeeUsd = null;
    let pctFeeUsd = null;
    let totalFeeUsd = null;
    try {
      const feedAddr = await contract.tokenPriceFeed(tokenAddr);
  const zeroAddr = '0x' + '00'.repeat(20);
  if (feedAddr && feedAddr !== zeroAddr) {
  const feed = new ContractClass(feedAddr, [
          "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
          "function decimals() view returns (uint8)"
        ], getProvider());
        const round = await feed.latestRoundData();
        price = BigInt(round[1].toString());
        priceTimestamp = Number(round[3].toString());
        try { priceDecimals = Number(await feed.decimals()); } catch (e) { priceDecimals = 8; }

        // helper to convert token units -> USD cents using BigInt math
        const toUsdCents = (tokenUnitsBn) => {
          // usdCents = tokenUnits * price * 100 / (10**decimals * 10**priceDecimals)
          const numerator = tokenUnitsBn * price * 100n;
          const denom = 10n ** BigInt(decimals) * 10n ** BigInt(priceDecimals);
          return numerator / denom; // integer cents
        };

        try {
          const flatUsdCents = toUsdCents(BigInt(flatBn.toString()));
          const pctUsdCents = toUsdCents(BigInt(pctFeeBn.toString()));
          const totalUsdCents = toUsdCents(BigInt(totalFeeBn.toString()));
          flatFeeUsd = `${(flatUsdCents/100n).toString()}.${(flatUsdCents%100n).toString().padStart(2,'0')}`;
          pctFeeUsd = `${(pctUsdCents/100n).toString()}.${(pctUsdCents%100n).toString().padStart(2,'0')}`;
          totalFeeUsd = `${(totalUsdCents/100n).toString()}.${(totalUsdCents%100n).toString().padStart(2,'0')}`;
        } catch (e) {
          // ignore
        }

        priceHuman = (Number(price) / (10 ** priceDecimals)).toString();
      }
    } catch (e) {
      // ignore price feed errors
    }

    return {
      token: tokenAddr,
      projectOwner,
      tokenSymbol: symbol,
      decimals,
      totalRaised: totalRaisedBn.toString(),
      totalRaisedHuman: formatUnits(totalRaisedBn.toString(), decimals),
      flatFeeUnits: flatBn.toString(),
      flatFeeHuman,
      flatFeeUsd,
      pctFeeUnits: pctFeeBn.toString(),
      pctFeeHuman: pctHuman,
      pctFeeUsd,
      totalFeeUnits: totalFeeBn.toString(),
      totalFeeHuman,
      totalFeeUsd,
      payoutUnits: payoutBn.toString(),
      payoutHuman,
      price: price ? price.toString() : null,
      priceDecimals,
      priceHuman,
      priceTimestamp,
    };
  } catch (e) {
    // if token introspection fails, return raw units
    return {
      token: tokenAddr,
      projectOwner,
      totalRaised: totalRaisedBn.toString(),
      flatFeeUnits: flatBn.toString(),
      pctFeeUnits: pctFeeBn.toString(),
      totalFeeUnits: totalFeeBn.toString(),
      payoutUnits: payoutBn.toString(),
    };
  }
}

export async function getSignerAddress() {
  // Important: never trigger a wallet popup from passive page loads.
  // Prefer a silent account probe via `eth_accounts` and only return if already authorized.
  try {
    if (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.request === 'function') {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (Array.isArray(accounts) && accounts.length > 0) {
        return accounts[0];
      }
      return null;
    }
  } catch (e) {
    return null;
  }

  const signer = getSigner();
  if (!signer) return null;
  try { return await signer.getAddress(); } catch (e) { return null; }
}

export async function withdrawProject(contractAddress = CONTRACT_ADDRESS, projectId) {
  const contract = getContract(contractAddress);
  const signer = getSigner();
  if (!signer) throw new Error('No signer available');
  const tx = await contract.connect(signer).withdraw(projectId);
  return tx;
}

export async function registerReferrer(contractAddress = CONTRACT_ADDRESS, referrer) {
  const contract = getContract(contractAddress);
  const signer = getSigner();
  if (!signer) throw new Error('No signer');
  const tx = await contract.connect(signer).registerReferrer(referrer);
  await tx.wait();
  return tx;
}

export async function claimRebate(contractAddress = CONTRACT_ADDRESS, tokenAddr) {
  const contract = getContract(contractAddress);
  const signer = getSigner();
  if (!signer) throw new Error('No signer');
  const tx = await contract.connect(signer).claimRebate(tokenAddr);
  await tx.wait();
  return tx;
}


