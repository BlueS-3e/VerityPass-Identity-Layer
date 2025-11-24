import os
import sys
import time
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

# Ensure project root on sys.path so tests can import api package
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import api.app as app_module


def _build_eip712_digest(subject, schema_hash, data_cid, expires_at, contract_addr=None, chain_id=1):
    if not contract_addr:
        contract_addr = '0x' + '00'*20
    domain_typehash = Web3.keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    name_hash = Web3.keccak(text="AttestationRegistry")
    version_hash = Web3.keccak(text="1")
    domain_separator = Web3.solidity_keccak(['bytes32','bytes32','bytes32','uint256','address'], [domain_typehash, name_hash, version_hash, chain_id, contract_addr])
    data_cid_hash = Web3.keccak(text=data_cid)
    att_typehash = Web3.keccak(text="Attestation(address subject,bytes32 schemaHash,bytes32 dataCIDHash,uint256 expiresAt)")
    # allow schema_hash to be bytes or hexstr
    schema_bytes = schema_hash
    if isinstance(schema_hash, str) and schema_hash.startswith('0x'):
        schema_bytes = bytes.fromhex(schema_hash[2:])
    struct_hash = Web3.solidity_keccak(['bytes32','address','bytes32','bytes32','uint256'], [att_typehash, subject, schema_bytes, data_cid_hash, int(expires_at)])
    digest_bytes = Web3.keccak(b"\x19\x01" + domain_separator + struct_hash)
    return encode_defunct(hexstr=digest_bytes.hex())


def test_accepts_hex_and_nonhex_signature(monkeypatch):
    client = app_module.app.test_client()
    issuer = Account.create()
    subject = Account.create()
    schema_hash = Web3.keccak(text="income-proof-v1")
    schema_hash_hex = Web3.to_hex(schema_hash)
    data_cid = "ipfs://fake-content"
    expires_at = int(time.time()) + 3600

    msg = _build_eip712_digest(subject.address, schema_hash_hex, data_cid, expires_at)
    signed = Account.sign_message(msg, issuer.key)
    sig_hex = signed.signature.hex()  # no 0x
    sig_pref = '0x' + sig_hex

    # patch pin to avoid network
    monkeypatch.setattr(app_module, 'pin_to_nft_storage', lambda j: 'ipfs://fakecid123')

    payload1 = {
        'issuer': issuer.address,
        'subject': subject.address,
        'schemaHash': schema_hash_hex,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': sig_hex,
    }
    resp1 = client.post('/api/attestations/pin', json=payload1)
    assert resp1.status_code == 200, resp1.get_data(as_text=True)

    payload2 = dict(payload1)
    payload2['signature'] = sig_pref
    resp2 = client.post('/api/attestations/pin', json=payload2)
    assert resp2.status_code == 200, resp2.get_data(as_text=True)


def test_accepts_legacy_personal_sign(monkeypatch):
    client = app_module.app.test_client()
    issuer = Account.create()
    subject = Account.create()
    schema_hash = Web3.keccak(text="income-proof-v1")
    schema_hash_hex = Web3.to_hex(schema_hash)
    data_cid = "ipfs://fake-content"
    expires_at = int(time.time()) + 3600

    # legacy message without domain
    contract_addr = '0x' + '00'*20
    legacy_hash = Web3.solidity_keccak(['address','bytes32','string','uint256','address'], [subject.address, schema_hash_hex, data_cid, expires_at, contract_addr])
    legacy_msg = encode_defunct(hexstr=legacy_hash.hex())
    signed = Account.sign_message(legacy_msg, issuer.key)
    sig = signed.signature.hex()

    monkeypatch.setattr(app_module, 'pin_to_nft_storage', lambda j: 'ipfs://fakecid123')

    payload = {
        'issuer': issuer.address,
        'subject': subject.address,
        'schemaHash': schema_hash_hex,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': sig,
    }
    resp = client.post('/api/attestations/pin', json=payload)
    assert resp.status_code == 200, resp.get_data(as_text=True)


def test_accepts_v27_and_v0_variants(monkeypatch):
    client = app_module.app.test_client()
    issuer = Account.create()
    subject = Account.create()
    schema_hash = Web3.keccak(text="income-proof-v1")
    schema_hash_hex = Web3.to_hex(schema_hash)
    data_cid = "ipfs://fake-content"
    expires_at = int(time.time()) + 3600

    msg = _build_eip712_digest(subject.address, schema_hash_hex, data_cid, expires_at)
    signed = Account.sign_message(msg, issuer.key)
    sig_bytes = signed.signature
    # r | s | v
    r = sig_bytes[:32]
    s = sig_bytes[32:64]
    v = sig_bytes[64]

    # ensure v is 27/28; if not, make a 27/28 variant
    if v in (0, 1):
        v27 = bytes([v + 27])
    else:
        v27 = bytes([v])

    sig_v27 = (r + s + v27).hex()
    # produce v0 variant
    v0 = bytes([ (v27[0] - 27) & 0xFF ])
    sig_v0 = (r + s + v0).hex()

    monkeypatch.setattr(app_module, 'pin_to_nft_storage', lambda j: 'ipfs://fakecid123')

    payload27 = {
        'issuer': issuer.address,
        'subject': subject.address,
        'schemaHash': schema_hash_hex,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': '0x' + sig_v27,
    }
    resp27 = client.post('/api/attestations/pin', json=payload27)
    assert resp27.status_code == 200, resp27.get_data(as_text=True)

    payload0 = dict(payload27)
    payload0['signature'] = '0x' + sig_v0
    resp0 = client.post('/api/attestations/pin', json=payload0)
    assert resp0.status_code == 200, resp0.get_data(as_text=True)
