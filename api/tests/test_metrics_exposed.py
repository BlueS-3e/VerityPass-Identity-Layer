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


def test_metrics_expose_after_pin(monkeypatch):
    client = app_module.app.test_client()

    issuer = Account.create()
    subject = Account.create()
    schema_hash = Web3.keccak(text="income-proof-v1")
    schema_hash_hex = Web3.to_hex(schema_hash)
    data_cid = "ipfs://fake-content"
    expires_at = int(time.time()) + 3600

    # sign a simple legacy pref (tests don't need full EIP-712 here)
    legacy_hash = Web3.solidity_keccak(['address','bytes32','string','uint256','address'], [subject.address, schema_hash, data_cid, expires_at, '0x' + '00'*20])
    msg = encode_defunct(hexstr=legacy_hash.hex())
    signed = Account.sign_message(msg, issuer.key)
    signature = signed.signature.hex()

    # monkeypatch pin_to_nft_storage to avoid network
    monkeypatch.setattr(app_module, 'pin_to_nft_storage', lambda j: 'ipfs://fakecid123')

    payload = {
        'issuer': issuer.address,
        'subject': subject.address,
        'schemaHash': schema_hash_hex,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': signature,
    }

    resp = client.post('/api/attestations/pin', json=payload)
    assert resp.status_code == 200

    # Now fetch metrics and assert our metric names appear
    m = client.get('/metrics')
    assert m.status_code == 200
    body = m.get_data(as_text=True)
    assert 'realmint_attestation_pin_success_total' in body
    assert 'realmint_attestation_pin_failure_total' in body
    assert 'realmint_attestation_validation_failure_total' in body
    assert 'realmint_attestation_pin_duration_seconds' in body
