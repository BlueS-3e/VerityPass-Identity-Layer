# Smart Contract Specification — Identity & Attestations (MVP)

This document describes the minimal on-chain contracts for the MVP: IdentityRegistry and AttestationRegistry, plus the simple CreditScoreManager interface.

## Goals
- Provide on-chain pointers to user metadata (IPFS CIDs).
- Allow trusted issuers to publish attestations referencing user identity.
- Provide a simple mechanism for an oracle/authorized account to publish aggregated credit scores.

## IdentityRegistry (Minimal ERC-725-like)

Purpose: keep a mapping between an identity owner (EOA) and a metadata pointer (CID). Keep the contract intentionally small.

Storage
- mapping(address => string) public metadataCID;

Events
- event IdentityCreated(address indexed owner, string metadataCID);
- event IdentityUpdated(address indexed owner, string oldCID, string newCID);

Functions
- createIdentity(string calldata metadataCID)
  - Requirement: caller must not already have a metadataCID stored
  - Action: store mapping[msg.sender] = metadataCID; emit IdentityCreated

- updateIdentity(string calldata metadataCID)
  - Requirement: caller must have existing identity
  - Action: replace metadataCID and emit IdentityUpdated

- getMetadata(address owner) view returns (string memory)

Access control: simple owner-only for updates (owner == msg.sender). No roles for MVP.

## AttestationRegistry

Purpose: store compact attestations created by issuers. Attestations are small objects referencing an IPFS CID with the attestation payload, plus signer information.

Storage
- struct Attestation { address issuer; address subject; bytes32 schemaHash; string dataCID; uint256 issuedAt; uint256 expiresAt; }
- mapping(uint256 => Attestation) public attestations;
- uint256 public nextAttestationId;

Events
- event AttestationPublished(uint256 indexed attestationId, address indexed issuer, address indexed subject, bytes32 schemaHash, string dataCID);

Functions
- publishAttestation(address subject, bytes32 schemaHash, string calldata dataCID, uint256 expiresAt)
  - Requirement: issuer is msg.sender
  - Action: store attestation struct, emit AttestationPublished

- getAttestation(uint256 id) view returns (Attestation)

Issuer registry (optional for MVP): we will permit any issuer to publish for MVP but rely on off-chain trust & backend aggregation. Later we will add an issuer registration/verification flow.

Signature-based attestation submission (off-chain issuer) pattern (recommended):
- Issuer signs attestation payload off-chain using EIP-191/EIP-712, user can submit that signed payload to the AttestationRegistry which verifies signature and stores the attestation. For MVP we accept on-chain publication by issuer directly.

## CreditScoreManager (Simple interface)

Purpose: store a lightweight score pointer for identity subject; allow authorized account (oracle/admin) to publish aggregated score references.

Storage
- mapping(address => bytes32) public scoreHash; // hash or CID of score data
- mapping(address => uint8) public scoreBucket; // simple bucket (0..100)

Events
- event ScorePublished(address indexed subject, bytes32 scoreHash, uint8 bucket);

Functions
- publishScore(address subject, bytes32 scoreHash, uint8 bucket)
  - Requirement: onlyOwner or onlyOracle (admin role) for MVP
  - Action: store and emit

- getScore(address subject) view returns (bytes32, uint8)

## LendingSimulation (MVP)

Purpose: demonstrate how lenders could use scoreBucket to reduce collateral requirements. This contract will be a simple simulation and not hold user funds for MVP.

Functions (simulation):
- calculateCollateralRequirement(address subject, uint256 loanAmount) view returns (uint256 collateralRequired)
  - Implementation: lookup `scoreBucket` and apply multiplier (e.g., high score => 20% collateral, low score => 150%).

## Events & Indexing
- All registry writes emit events to let off-chain indexers build a full attestations map and CID lookup.

## Security Considerations (MVP)
- No sensitive PII on-chain
- Verify EOA signatures for any attestation that purports to come from an issuer (when supporting off-chain signature submission)
- Start with centralized oracle for `publishScore`, plan to decentralize via governance

## Upgrade Path
- Add IssuerRegistry with KYC/verification
- Add EIP-712 structured signatures to allow user-submitted attestations
- Add merkle-root based batch attestation publication for gas efficiency
- Add zk proofs for private attestations and proof-of-income

## deploy and test smart contract on testnet
 cd contracts
 set -o allexport; source .env; set +o allexport
 export DEPLOYER_PRIVATE_KEY="$PRIVATE_KEY"
 export SEPOLIA_RPC_URL="${SEPOLIA_RPC:-$RPC_URL}"
 npx hardhat run --network sepolia scripts/deploy.js