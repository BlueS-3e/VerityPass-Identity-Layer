import importlib
import os

appmod = importlib.import_module('api.app')


def test_role_audit_listing(monkeypatch):
    # Prepare environment for dev-login and allowlist
    monkeypatch.setenv('OIDC_DEV_ALLOW', 'true')
    monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'audit@local')
    app = appmod.app
    app.config['TESTING'] = True

    # ensure no pre-existing audits for this principal
    with app.app_context():
        appmod.db.session.query(appmod.RoleAudit).filter_by(principal='audit@local').delete()
        appmod.db.session.commit()

    with app.test_client() as client:
        # create a role via POST
        resp = client.get('/api/admin/oidc/dev-login?email=audit@local')
        assert resp.status_code == 302
        # get csrf
        r = client.get('/api/admin/csrf')
        csrf = r.get_json().get('csrf_token')
        assert csrf
        # add role
        resp2 = client.post('/api/admin/roles', json={'principal_type': 'email', 'principal': 'audit@local', 'role': 'auditor'}, headers={'X-CSRF-Token': csrf})
        assert resp2.status_code == 200
        # list audit entries
        resp3 = client.get('/api/admin/role-audit')
        assert resp3.status_code == 200
        j = resp3.get_json()
        # Expect at least one audit entry for the added role
        assert any(e.get('principal') == 'audit@local' and e.get('action') == 'add' for e in j)
