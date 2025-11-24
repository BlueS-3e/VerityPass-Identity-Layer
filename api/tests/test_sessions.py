import importlib
import pytest

appmod = importlib.import_module('api.app')


@pytest.mark.skipif(not getattr(appmod, '_redis', None) or not getattr(appmod, '_flask_session_available', False), reason="Redis-backed sessions not configured in this environment")
def test_redis_session_persistence(monkeypatch):
    """Smoke test: when REDIS_URL and Flask-Session are available, ensure
    session persists when cookie is reused across client instances.
    """
    app = appmod.app
    app.config['TESTING'] = True

    with app.test_client() as c1:
        # perform dev-login to set a session (dev-login respects OIDC_DEV_ALLOW at request-time)
        monkeypatch.setenv('OIDC_DEV_ALLOW', 'true')
        monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'dev@local')
        resp = c1.get('/api/admin/oidc/dev-login?email=dev@local')
        assert resp.status_code == 302
        # read admin check
        r = c1.get('/api/admin/check')
        assert r.get_json().get('admin') is True
        # capture cookies
        cookies = {c.name: c.value for c in c1.cookie_jar}

    # new client, reuse cookies
    with app.test_client() as c2:
        for name, val in cookies.items():
            c2.set_cookie('localhost', name, val)
        r2 = c2.get('/api/admin/check')
        assert r2.get_json().get('admin') is True
