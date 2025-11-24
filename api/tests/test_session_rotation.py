import os
import importlib

import pytest


def setup_module(module):
    # Ensure we run in non-production for dev-login to be enabled
    os.environ['FLASK_ENV'] = 'development'
    os.environ['OIDC_DEV_ALLOW'] = 'true'
    os.environ['OIDC_ADMIN_ALLOWLIST'] = 'dev@local'
    import api.app as appmod
    importlib.reload(appmod)


def test_session_rotation_on_oidc_dev_login(monkeypatch):
    import api.app as appmod
    client = appmod.app.test_client()

    # Create a pre-login session key
    with client.session_transaction() as sess:
        sess['pre_login_key'] = 'preserve-me'

    # Ensure pre-login key exists
    with client.session_transaction() as sess:
        assert 'pre_login_key' in sess

    # Perform dev OIDC login
    resp = client.get('/api/admin/oidc/dev-login?email=dev@local', follow_redirects=False)
    assert resp.status_code in (302, 200, 303, 302)

    # After login, previous session data should be cleared and admin set
    with client.session_transaction() as sess:
        assert 'pre_login_key' not in sess
        assert sess.get('admin') is True
        assert sess.get('admin_email') == 'dev@local'


def teardown_module(module):
    # cleanup env
    os.environ.pop('OIDC_DEV_ALLOW', None)
    os.environ.pop('OIDC_ADMIN_ALLOWLIST', None)
    os.environ.pop('FLASK_ENV', None)
