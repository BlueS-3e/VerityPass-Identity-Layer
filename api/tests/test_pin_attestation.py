import json
import os
import sys
import time
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

# Ensure project root is on sys.path so tests can import the api package
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import api.app as app_module


def test_pin_attestation_legacy_signature(monkeypatch, tmp_path):
    # Use test client
    client = app_module.app.test_client()

    # Create an issuer account
    issuer = Account.create()
    issuer_address = issuer.address

    # Create subject address (random)
    subject = Account.create()
    subject_address = subject.address

    # schema hash (bytes-like HexBytes)
    schema_hash = Web3.keccak(text="income-proof-v1")
    schema_hash_hex = Web3.to_hex(schema_hash)

    data_cid = "ipfs://fake-content"
    expires_at = int(time.time()) + 3600

    # Build EIP-712 style digest and sign it (server supports EIP-712)
    # domain: name="AttestationRegistry", version="1", chainId, verifyingContract
    contract_addr = '0x' + '00'*20
    chain_id = 1
    domain_typehash = Web3.keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    name_hash = Web3.keccak(text="AttestationRegistry")
    version_hash = Web3.keccak(text="1")
    domain_separator = Web3.solidity_keccak(['bytes32','bytes32','bytes32','uint256','address'], [domain_typehash, name_hash, version_hash, chain_id, contract_addr])

    data_cid_hash = Web3.keccak(text=data_cid)
    att_typehash = Web3.keccak(text="Attestation(address subject,bytes32 schemaHash,bytes32 dataCIDHash,uint256 expiresAt)")
    struct_hash = Web3.solidity_keccak(['bytes32','address','bytes32','bytes32','uint256'], [att_typehash, subject_address, schema_hash, data_cid_hash, expires_at])
    digest_bytes = Web3.keccak(b"\x19\x01" + domain_separator + struct_hash)
    msg = encode_defunct(hexstr=digest_bytes.hex())
    signed = Account.sign_message(msg, issuer.key)
    signature = signed.signature.hex()

    # monkeypatch pin_to_nft_storage to avoid network
    def fake_pin(json_data):
        return "ipfs://fakecid123"

    monkeypatch.setattr(app_module, 'pin_to_nft_storage', fake_pin)

    payload = {
        'issuer': issuer_address,
        'subject': subject_address,
        'schemaHash': schema_hash_hex,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': signature,
        # contractAddress omitted to use zero address fallback
    }

    resp = client.post('/api/attestations/pin', json=payload)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    j = resp.get_json()
    assert j['status'] == 'ok'
    assert j['verified'] is True
    assert 'pin' in j and j['pin'].startswith('ipfs://')