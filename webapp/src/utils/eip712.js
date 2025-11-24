import * as ethers from 'ethers';
import { getEthersProvider } from './ethersProvider';

// ethers v6: use top-level helpers
const keccak256 = ethers.keccak256;
const toUtf8Bytes = ethers.toUtf8Bytes;

// Helper to compute keccak256 of UTF-8 string and return 0x-prefixed hex32
export function keccak256Utf8(text) {
  return keccak256(toUtf8Bytes(text));
}

// Build EIP-712 domain and typed data for Attestation
export function buildAttestationTypedData({chainId = 1, verifyingContract = '0x' + '00'.repeat(20), subject, schemaHash, dataCID, expiresAt}) {
  const domain = {
    name: "AttestationRegistry",
    version: "1",
    chainId: chainId,
    verifyingContract: verifyingContract,
  };

  const types = {
    Attestation: [
      { name: "subject", type: "address" },
      { name: "schemaHash", type: "bytes32" },
      { name: "dataCIDHash", type: "bytes32" },
      { name: "expiresAt", type: "uint256" }
    ]
  };

  // schemaHash: allow either 0x-prefixed bytes32 or a textual schema name
  let schemaHashHex = schemaHash;
  if (typeof schemaHash === 'string' && !schemaHash.startsWith('0x')) {
    schemaHashHex = keccak256Utf8(schemaHash);
  }

  const dataCIDHash = keccak256Utf8(dataCID);

  const value = {
    subject: subject,
    schemaHash: schemaHashHex,
    dataCIDHash: dataCIDHash,
    expiresAt: Math.floor(Number(expiresAt) || Math.floor(Date.now()/1000) + 3600)
  };

  return { domain, types, value };
}

// Request signer from injected provider and sign typed data (ethers v6)
export async function signAttestationTypedData({domain, types, value}, injectedProvider = undefined) {
  // injectedProvider: optional provider object (e.g. selected entry from window.ethereum.providers)
  const ethProvider = injectedProvider || (typeof window !== 'undefined' && window.ethereum);
  if (!ethProvider) throw new Error('No injected wallet provider found');
  const provider = getEthersProvider(ethProvider);
  if (!provider) throw new Error('Ethers provider not available (incompatible ethers version or no raw provider)');
  // Many providers support the `request` RPC; ensure accounts are available
  try {
    if (typeof ethProvider.request === 'function') {
      await ethProvider.request({ method: 'eth_requestAccounts' });
    }
  } catch (e) {
    // ignore and let getSigner fail if necessary
  }
  const signer = await provider.getSigner();
  // Try ethers' built-in helper if available (some providers expose it)
  if (typeof signer._signTypedData === 'function') {
    return await signer._signTypedData(domain, types, value);
  }

  // Fallback: use the provider's eth_signTypedData_v4 RPC method (MetaMask compatible)
  try {
  const address = await signer.getAddress();
    // Some injected wallets (MetaMask, others) expect the EIP712Domain type to be
    // explicitly present in the `types` object for eth_signTypedData_v4. Build a
    // copy that includes the standard EIP712Domain definition and our types.
    const domainType = [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' }
    ];

    const typesForRpc = Object.assign({}, types);
    // Only add EIP712Domain if it's not already present
    if (!typesForRpc.EIP712Domain) typesForRpc.EIP712Domain = domainType;

    const typedData = {
      types: typesForRpc,
      domain: domain,
      primaryType: Object.keys(types)[0] || 'Attestation',
      message: value,
    };
    // Use the chosen injected provider for the RPC request if possible
    const rpcTarget = ethProvider;
    const sig = await rpcTarget.request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    });
    return sig;
  } catch (e) {
    // rethrow a helpful error
    throw new Error('Failed to sign typed data with injected wallet: ' + (e?.message || e));
  }
}
