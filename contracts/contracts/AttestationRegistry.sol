// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AttestationRegistry {
    struct Attestation {
        address issuer;
        address subject;
        bytes32 schemaHash;
        string dataCID;
        uint256 issuedAt;
        uint256 expiresAt;
    }

    uint256 public nextAttestationId;
    mapping(uint256 => Attestation) public attestations;

    event AttestationPublished(uint256 indexed attestationId, address indexed issuer, address indexed subject, bytes32 schemaHash, string dataCID, uint256 issuedAt, uint256 expiresAt);

    constructor() {
        nextAttestationId = 1;
    }

    // EIP-712 typehash for Attestation struct
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256("Attestation(address subject,bytes32 schemaHash,bytes32 dataCIDHash,uint256 expiresAt)");

    /// @dev Computes the EIP-712 domain separator for this contract
    function domainSeparator() public view returns (bytes32) {
        bytes32 domainTypeHash = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
        return keccak256(abi.encode(
            domainTypeHash,
            keccak256(bytes("AttestationRegistry")),
            keccak256(bytes("1")),
            block.chainid,
            address(this)
        ));
    }

    /// @notice Publish an attestation using an off-chain EIP-712 typed signature from the issuer
    /// @dev The issuer signs the typed data for the Attestation struct (with dataCID hashed as bytes32)
    function publishAttestationTyped(address subject, bytes32 schemaHash, string calldata dataCID, uint256 expiresAt, bytes calldata signature) external returns (uint256) {
        // inline struct hash to reduce stack usage
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            subject,
            schemaHash,
            keccak256(bytes(dataCID)),
            expiresAt
        ))));
        // Prefer the prefixed (eth_sign / signMessage) recovery, but fall back to raw EIP-712 recovery if not present.
        bytes32 pref = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        address issuer = recoverSigner(pref, signature);
        if (issuer == address(0)) {
            issuer = recoverSigner(digest, signature);
        }
        require(issuer != address(0), "Invalid signature");

        uint256 id = nextAttestationId++;
        attestations[id] = Attestation({
            issuer: issuer,
            subject: subject,
            schemaHash: schemaHash,
            dataCID: dataCID,
            issuedAt: block.timestamp,
            expiresAt: expiresAt
        });
        emit AttestationPublished(id, issuer, subject, schemaHash, dataCID, block.timestamp, expiresAt);
        return id;
    }

    function publishAttestation(address subject, bytes32 schemaHash, string calldata dataCID, uint256 expiresAt) external returns (uint256) {
        uint256 id = nextAttestationId++;
        attestations[id] = Attestation({
            issuer: msg.sender,
            subject: subject,
            schemaHash: schemaHash,
            dataCID: dataCID,
            issuedAt: block.timestamp,
            expiresAt: expiresAt
        });
        emit AttestationPublished(id, msg.sender, subject, schemaHash, dataCID, block.timestamp, expiresAt);
        return id;
    }

    /// @notice Publish an attestation using an off-chain signature from the issuer
    /// @dev The issuer signs keccak256(abi.encode(subject, schemaHash, dataCID, expiresAt, address(this))) and the signature is an Ethereum Signed Message
    function publishAttestationSigned(address subject, bytes32 schemaHash, string calldata dataCID, uint256 expiresAt, bytes calldata signature) external returns (uint256) {
        bytes32 hash = keccak256(abi.encode(subject, schemaHash, dataCID, expiresAt, address(this)));
        // recreate the prefixed hash that eth_sign / signMessage creates
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        address issuer = recoverSigner(prefixed, signature);
        require(issuer != address(0), "Invalid signature");

        uint256 id = nextAttestationId++;
        attestations[id] = Attestation({
            issuer: issuer,
            subject: subject,
            schemaHash: schemaHash,
            dataCID: dataCID,
            issuedAt: block.timestamp,
            expiresAt: expiresAt
        });
        emit AttestationPublished(id, issuer, subject, schemaHash, dataCID, block.timestamp, expiresAt);
        return id;
    }

    function recoverSigner(bytes32 _prefixedHash, bytes memory _sig) internal pure returns (address) {
        if (_sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            r := mload(add(_sig, 0x20))
            s := mload(add(_sig, 0x40))
            v := byte(0, mload(add(_sig, 0x60)))
        }
        // adjust v value
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(_prefixedHash, v, r, s);
    }

    function getAttestation(uint256 id) external view returns (Attestation memory) {
        return attestations[id];
    }
}
