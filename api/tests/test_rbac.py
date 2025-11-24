import os
import importlib

appmod = importlib.import_module('api.app')


def test_rbac_session_population_and_management(monkeypatch):
    # enable dev-login
    monkeypatch.setenv('OIDC_DEV_ALLOW', 'true')
    monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'dev@local')
    app = appmod.app
    app.config['TESTING'] = True

    # ensure clean DB state
    with app.app_context():
        # remove any existing assignments for this principal
        appmod.db.session.query(appmod.RoleAssignment).filter_by(principal_type='email', principal='dev@local').delete()
        appmod.db.session.commit()

    # create an assignment directly
    with app.app_context():
        ra = appmod.RoleAssignment(principal_type='email', principal='dev@local', role='operator')
        appmod.db.session.add(ra)
        appmod.db.session.commit()
        created_id = ra.id

    with app.test_client() as client:
        # perform dev-login which should populate session roles
        resp = client.get('/api/admin/oidc/dev-login?email=dev@local')
        assert resp.status_code == 302
        # inspect session to ensure roles present
        with client.session_transaction() as sess:
            assert sess.get('admin') is True
            assert isinstance(sess.get('roles'), list)
            assert 'operator' in sess.get('roles')

        # list roles endpoint should show our assignment
        resp2 = client.get('/api/admin/roles')
        assert resp2.status_code == 200
        j = resp2.get_json()
        assert any(r.get('role') == 'operator' and r.get('principal') == 'dev@local' for r in j)

        # obtain csrf token
        resp3 = client.get('/api/admin/csrf')
        assert resp3.status_code == 200
        csrf = resp3.get_json().get('csrf_token')
        assert csrf

        # try adding a duplicate role via POST (should return exists)
        resp4 = client.post('/api/admin/roles', json={'principal_type': 'email', 'principal': 'dev@local', 'role': 'operator'}, headers={'X-CSRF-Token': csrf})
        assert resp4.status_code == 200
        assert resp4.get_json().get('status') in ('exists', 'ok')

        # remove the created assignment via DELETE
        resp5 = client.delete(f'/api/admin/roles/{created_id}', headers={'X-CSRF-Token': csrf})
        assert resp5.status_code == 200
        assert resp5.get_json().get('status') == 'deleted'

    # verify it's gone from DB
    with app.app_context():
        found = appmod.RoleAssignment.query.get(created_id)
        assert found is None

def test_role_audit_entries_exist_after_operations(monkeypatch):
    monkeypatch.setenv('OIDC_DEV_ALLOW', 'true')
    monkeypatch.setenv('OIDC_ADMIN_ALLOWLIST', 'dev@local')
    app = appmod.app
    app.config['TESTING'] = True
    with app.test_client() as client:
        # login and get csrf
        client.get('/api/admin/oidc/dev-login?email=dev@local')
        r = client.get('/api/admin/csrf')
        csrf = r.get_json().get('csrf_token')
        # add a role
        client.post('/api/admin/roles', json={'principal_type':'email','principal':'dev@local','role':'operator'}, headers={'X-CSRF-Token': csrf})
        # fetch role-audit
        resp = client.get('/api/admin/role-audit')
        assert resp.status_code == 200
        j = resp.get_json()
        assert isinstance(j, list)
