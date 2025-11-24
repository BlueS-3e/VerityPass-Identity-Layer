import importlib
import os

import pytest


def reload_app_with_env(monkeypatch):
    # Simulate production environment before importing/reloading the module
    monkeypatch.setenv('FLASK_ENV', 'production')
    monkeypatch.setenv('ENV', 'production')
    # Ensure critical envs are not set so the enforcement will detect them
    monkeypatch.delenv('NFT_STORAGE_API_KEY', raising=False)
    monkeypatch.delenv('SECRET_KEY', raising=False)
    # Reload the app module so it picks up the env
    import api.app as appmod
    importlib.reload(appmod)
    return appmod


def test_enforce_required_envs_exits_when_missing(monkeypatch):
    appmod = reload_app_with_env(monkeypatch)
    with pytest.raises(SystemExit):
        appmod.enforce_required_envs_or_exit()


def test_dev_login_blocked_in_production(monkeypatch):
    appmod = reload_app_with_env(monkeypatch)
    client = appmod.app.test_client()
    resp = client.get('/api/admin/oidc/dev-login?email=dev@local')
    assert resp.status_code == 403
    assert resp.get_json().get('status') in ('dev_login_disabled_in_production', 'dev_login_disabled')
