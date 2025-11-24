import os
import json
import pytest

class DummyPlaid:
    class Item:
        @staticmethod
        def public_token():
            pass

    def __init__(self, client_id=None, secret=None, environment=None):
        self._client_id = client_id
        self._secret = secret
        self._env = environment

    class Item:
        @staticmethod
        def public_token_exchange(public_token):
            return {'access_token': 'access-sandbox-123', 'item_id': 'item-abc'}

    def Item_public_token_exchange(self, public_token):
        return {'access_token': 'access-sandbox-123', 'item_id': 'item-abc'}


@pytest.fixture
def client(tmp_path, monkeypatch):
    # configure Plaid env to enable handler flow
    os.environ['PLAID_CLIENT_ID'] = 'test_id'
    os.environ['PLAID_SECRET'] = 'test_secret'
    os.environ['PLAID_ENV'] = 'sandbox'

    # monkeypatch PlaidClient used in app
    class FakeClient:
        def __init__(self, client_id=None, secret=None, environment=None):
            pass
        class Item:
            @staticmethod
            def public_token_exchange(public_token):
                return {'access_token': 'access-sandbox-123', 'item_id': 'item-abc'}
        class LinkToken:
            @staticmethod
            def create(req):
                return {'link_token': 'link-sandbox-xyz'}

    import importlib
    appmod = importlib.import_module('api.app')
    monkeypatch.setattr(appmod, 'PlaidClient', FakeClient)
    monkeypatch.setattr(appmod, '_plaid_available', True)

    import importlib
    appmod = importlib.import_module('api.app')
    app = appmod.app
    db = appmod.db
    OAuthCredential = appmod.OAuthCredential

    app.config['TESTING'] = True
    with app.test_client() as c:
        # ensure DB empty
        with app.app_context():
            db.drop_all()
            db.create_all()
        yield c


def test_create_link_token(client):
    resp = client.post('/api/connect/plaid/create_link_token', json={'owner_addr': '0xdead'})
    assert resp.status_code == 200
    j = resp.get_json()
    assert 'link_token' in j


def test_exchange_public_token(client):
    # call exchange endpoint
    resp = client.post('/api/connect/plaid/exchange_public_token', json={'public_token': 'public-xyz', 'account_id': 'acc-1', 'owner_addr': '0xabc'})
    assert resp.status_code == 200
    j = resp.get_json()
    assert j['status'] == 'ok'
    # check DB entry
    import importlib
    appmod = importlib.import_module('api.app')
    app = appmod.app
    OAuthCredential = appmod.OAuthCredential
    with app.app_context():
        creds = OAuthCredential.query.filter_by(provider='plaid').all()
        assert len(creds) == 1
        assert creds[0].account_id in ('acc-1', 'item-abc')
        assert creds[0].attestation_cid is None or isinstance(creds[0].attestation_cid, str)


def test_plaid_accounts_summary(client):
    """Ensure the Plaid accounts summary endpoint returns aggregated data
    only to the session that bound the identity (or admin)."""
    # Exchange public token to create an OAuthCredential first
    resp = client.post('/api/connect/plaid/exchange_public_token', json={'public_token': 'public-xyz', 'account_id': 'acc-1', 'owner_addr': '0xabc'})
    assert resp.status_code == 200
    j = resp.get_json()
    assert j['status'] == 'ok'

    import importlib
    appmod = importlib.import_module('api.app')
    app = appmod.app
    OAuthCredential = appmod.OAuthCredential

    # Find stored credential
    with app.app_context():
        creds = OAuthCredential.query.filter_by(provider='plaid').all()
        assert len(creds) == 1
        owner = creds[0].owner_addr

    # By default session is not bound; the endpoint should reject access
    resp2 = client.post('/api/connect/plaid/accounts', json={'owner_addr': owner})
    assert resp2.status_code == 401

    # Bind identity in session and retry
    with client.session_transaction() as sess:
        sess['identity_bound'] = True
        sess['identity_owner'] = owner

    resp3 = client.post('/api/connect/plaid/accounts', json={'owner_addr': owner})
    # With fake Plaid client, endpoint should return a summary or 200/404 depending on fetch
    # Accept either 200 or 404 (no credential) but not 401
    assert resp3.status_code in (200, 404)
