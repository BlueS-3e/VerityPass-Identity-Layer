import os
import importlib

appmod = importlib.import_module('api.app')


def test_oidc_dev_login(monkeypatch):
    # Enable dev-login by setting env (endpoints read env at request-time)
    monkeypatch.setenv('OIDC_DEV_ALLOW', 'true')
    monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'dev@local')
    app = appmod.app
    app.config['TESTING'] = True
    with app.test_client() as client:
        resp = client.get('/api/admin/oidc/dev-login?email=dev@local')
        assert resp.status_code == 302
        resp2 = client.get('/api/admin/check')
        j = resp2.get_json()
        assert j.get('admin') is True


def test_oidc_callback_monkeypatched(monkeypatch):
    # Monkeypatch oauth to a fake object to simulate IdP
    app = appmod.app
    app.config['TESTING'] = True

    class FakeOIDC:
        def authorize_access_token(self):
            return {'access_token': 'fake-token', 'id_token': 'fake-id'}

        def userinfo(self, token=None):
            return {'email': 'allowed@example.com'}

        def parse_id_token(self, token):
            return {'email': 'allowed@example.com'}

    # The app expects oauth.oidc to be the registered client; provide a simple
    # object with an `oidc` attribute exposing the required methods.
    from types import SimpleNamespace
    monkeypatch.setattr(appmod, 'oauth', SimpleNamespace(oidc=FakeOIDC()))
    monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'allowed@example.com')

    with app.test_client() as c:
        resp = c.get('/api/admin/oidc/callback')
        assert resp.status_code == 302
        resp2 = c.get('/api/admin/check')
        j = resp2.get_json()
        assert j.get('admin') is True
