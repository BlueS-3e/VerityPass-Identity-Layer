EIP-712 spec for AttestationRegistry

This folder contains the canonical EIP-712 typed-data spec for attestations used by the AttestationRegistry contract.

Files:
- `attestation_eip712.json` - canonical JSON for domain/types/primaryType. Fill `domain.chainId` and `domain.verifyingContract` at runtime (frontend/tests) before signing.

Notes:
- The on-chain contract computes the struct digest using:
  - ATTESTATION_TYPEHASH = keccak256("Attestation(address subject,bytes32 schemaHash,bytes32 dataCIDHash,uint256 expiresAt)")
  - dataCIDHash == keccak256(bytes(dataCID))
- Frontend must compute `dataCIDHash` as `ethers.keccak256(ethers.toUtf8Bytes(dataCID))` and pass that value in the typed-data value for `dataCIDHash`.
- Use domain.name="AttestationRegistry" and domain.version="1" to match the contract.
