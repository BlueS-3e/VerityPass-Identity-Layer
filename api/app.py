from flask import Flask, request, jsonify, send_from_directory, session, make_response
from werkzeug.exceptions import HTTPException, NotFound
from flask_cors import CORS
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Histogram
from flask_sqlalchemy import SQLAlchemy
from web3 import Web3
from eth_utils import to_checksum_address
from eth_account.messages import encode_defunct
from eth_account import Account
import os
import time
import threading
import secrets
import re
import datetime

# Optional imports; availability is checked at runtime where needed.
try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    _proxy_fix_available = True
except Exception:
    _proxy_fix_available = False

try:
    from authlib.integrations.flask_client import OAuth
    _oidc_available = True
except Exception:
    OAuth = None
    _oidc_available = False

# Redis (optional) and server-side session support
REDIS_URL = os.getenv('REDIS_URL')
_redis = None
if REDIS_URL:
    try:
        import redis
        _redis = redis.from_url(REDIS_URL)
        # verify connectivity early: if Redis is not reachable, disable it and
        # fall back to in-memory/session cookie behavior for local dev.
        try:
            _redis.ping()
        except Exception as _e:
            print(f"Warning: Redis at {REDIS_URL} is not reachable: {_e}; disabling Redis usage for this process")
            _redis = None
    except Exception:
        _redis = None

_flask_session_available = False
if _redis:
    try:
        from flask_session import Session
        _flask_session_available = True
    except Exception:
        _flask_session_available = False

# Lightweight in-memory nonce store for dev/tests
_nonce_store = {}
_nonce_lock = threading.Lock()

def _cleanup_nonces():
    now = int(time.time())
    with _nonce_lock:
        for k, v in list(_nonce_store.items()):
            if v < now:
                del _nonce_store[k]

def _start_nonce_cleanup():
    def loop():
        while True:
            time.sleep(60)
            _cleanup_nonces()
    t = threading.Thread(target=loop, daemon=True)
    t.start()

try:
    _start_nonce_cleanup()
except Exception:
    pass

app = Flask(__name__)

# Read secret key from environment for production. If missing, warn (tests/dev may still run).
SECRET_KEY = os.getenv('SECRET_KEY') or os.getenv('FLASK_SECRET') or os.getenv('APP_SECRET')
if not SECRET_KEY:
    print("WARNING: SECRET_KEY not set in environment. Using insecure default. Set SECRET_KEY for production.")
    SECRET_KEY = 'dev-insecure-secret'
app.secret_key = SECRET_KEY

# Session cookie security settings (override via env in production)
app.config['SESSION_COOKIE_HTTPONLY'] = True
# Allow operators to tune SameSite; default to Lax which balances CSRF protection and
# common SSO redirect requirements. Normalize and validate the value to avoid
# accidental misconfiguration (only 'Lax', 'Strict' or 'None' are permitted).
_samesite = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
_samesite_norm = _samesite.capitalize() if isinstance(_samesite, str) else 'Lax'
if _samesite_norm not in ('Lax', 'Strict', 'None'):
    print(f"Warning: invalid SESSION_COOKIE_SAMESITE='{_samesite}'; falling back to 'Lax'")
    _samesite_norm = 'Lax'
app.config['SESSION_COOKIE_SAMESITE'] = _samesite_norm

# Determine if we're running in a production environment; many deployments set FLASK_ENV=production
_env_name = os.getenv('FLASK_ENV', os.getenv('ENV', '')).lower()
_is_production = _env_name == 'production' or os.getenv('FORCE_PROD', '').lower() == 'true'

# Optionally enable ProxyFix to make request.url_root and request.host reflect
# the public-facing origin when the app sits behind a reverse proxy (nginx, LB).
# Enable with ENABLE_PROXY_FIX=true and configure the number of proxies to trust
# via PROXY_FIX_X_FOR, PROXY_FIX_X_PROTO, PROXY_FIX_X_HOST, PROXY_FIX_X_PORT, PROXY_FIX_X_PREFIX.
if os.getenv('ENABLE_PROXY_FIX', 'false').lower() == 'true':
    if _proxy_fix_available:
        x_for = int(os.getenv('PROXY_FIX_X_FOR', '1'))
        x_proto = int(os.getenv('PROXY_FIX_X_PROTO', '1'))
        x_host = int(os.getenv('PROXY_FIX_X_HOST', '1'))
        x_port = int(os.getenv('PROXY_FIX_X_PORT', '0'))
        x_prefix = int(os.getenv('PROXY_FIX_X_PREFIX', '0'))
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=x_for, x_proto=x_proto, x_host=x_host, x_port=x_port, x_prefix=x_prefix)
        print(f"Info: ProxyFix enabled (x_for={x_for}, x_proto={x_proto}, x_host={x_host}, x_port={x_port}, x_prefix={x_prefix})")
    else:
        print("Warning: ENABLE_PROXY_FIX requested but werkzeug.middleware.proxy_fix is not available")

# By default enable secure cookies in production. Operators may explicitly set SESSION_COOKIE_SECURE env var
# to control behavior. In development the default remains False to allow non-TLS local testing.
if _is_production:
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
else:
    app.config['SESSION_COOKIE_SECURE'] = os.getenv('SESSION_COOKIE_SECURE', 'false').lower() == 'true'

# Configure session lifetime (seconds). Default: 7 days. Operators may reduce for stricter security.
from datetime import timedelta
_session_seconds = int(os.getenv('SESSION_LIFETIME_SECONDS', str(60 * 60 * 24 * 7)))
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(seconds=_session_seconds)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Limit maximum upload size (default: 10 MiB). Can be lowered in production via env.
app.config['MAX_CONTENT_LENGTH'] = int(os.getenv('MAX_CONTENT_LENGTH', str(10 * 1024 * 1024)))


@app.after_request
def set_security_headers(response):
    """Attach minimal security headers. Override CSP via CUSTOM_CSP_HEADER."""
    response.headers.setdefault('X-Content-Type-Options', 'nosniff')
    response.headers.setdefault('X-Frame-Options', 'DENY')
    response.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    # Optional CSP header: keep minimal default but allow overriding via env
    custom_csp = os.getenv('CUSTOM_CSP_HEADER')
    if custom_csp:
        response.headers.setdefault('Content-Security-Policy', custom_csp)
    else:
        # Build a conservative default CSP. In development we allow an additional
        # `unsafe-eval` token for trusted localhost origins because tools like
        # Vite use `eval()` for dev sourcemaps and HMR which would otherwise be
        # blocked by strict CSP. Do NOT enable `unsafe-eval` in production.
        try:
            origin = request.headers.get('Origin') or ''
        except Exception:
            origin = ''
        script_src = ["'self'", "'unsafe-inline'"]
        # Allow eval in dev only for localhost origins
        if (not _is_production) and (origin.startswith('http://localhost:') or origin.startswith('http://127.0.0.1:')):
            script_src.append("'unsafe-eval'")
        csp = "default-src 'self'; img-src 'self' data:; script-src " + ' '.join(script_src) + "; style-src 'self' 'unsafe-inline';"
        response.headers.setdefault('Content-Security-Policy', csp)
    # Only set Strict-Transport-Security when cookies are marked secure (i.e. TLS)
    if app.config.get('SESSION_COOKIE_SECURE'):
        response.headers.setdefault('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    # Development-friendly CORS echo fallback: if the request Origin is one of the
    # configured `allowed_origins` (or a localhost variant) and Flask-CORS did not
    # add an `Access-Control-Allow-Origin` header for some reason, echo it here.
    try:
        origin_hdr = request.headers.get('Origin')
    except Exception:
        origin_hdr = None
    try:
        if origin_hdr and not response.headers.get('Access-Control-Allow-Origin'):
            # `allowed_origins` is defined later in the module but available at
            # runtime when this function is executed.
            try:
                ok = False
                if origin_hdr in (allowed_origins or []):
                    ok = True
                # Also accept common localhost patterns when allowed_origins is empty
                if not ok and (origin_hdr.startswith('http://localhost:') or origin_hdr.startswith('http://127.0.0.1:')):
                    ok = True
                if ok:
                    response.headers.setdefault('Access-Control-Allow-Origin', origin_hdr)
                    response.headers.setdefault('Access-Control-Allow-Credentials', 'true')
                    response.headers.setdefault('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                    response.headers.setdefault('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
            except Exception:
                pass
    except Exception:
        pass
    return response

# CORS: allow origins from ALLOWED_ORIGINS env or sane localhost defaults.
raw_allowed = os.getenv('ALLOWED_ORIGINS')
if raw_allowed:
    allowed_origins = [o.strip() for o in raw_allowed.split(',') if o.strip()]
else:
    # sensible development defaults (vite dev server and typical ports)
    # include common dev ports (5173 and 5174) and both localhost/127.0.0.1 variants
    allowed_origins = [
        'http://localhost:5173', 'http://127.0.0.1:5173',
        'http://localhost:5174', 'http://127.0.0.1:5174',
        'http://localhost:3000'
    ]
    print("WARNING: ALLOWED_ORIGINS not set; defaulting to localhost dev origins. Set ALLOWED_ORIGINS in production to restrict CORS.")

# Apply CORS only for /api/* resources to avoid over-broad exposure.
CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

import sys


# Generic JSON error handler for API routes: return JSON instead of HTML
# This prevents Werkzeug HTML error pages being returned to XHR/fetch callers
# and makes client-side error handling consistent. In production we avoid
# leaking exception details.
@app.errorhandler(Exception)
def handle_exception(e):
    try:
        # Log the exception
        msg = f"Unhandled exception on {request.path}: {str(e)[:400]}"
        print(msg)
        if SENTRY_DSN:
            try:
                sentry_sdk.capture_exception(e)
            except Exception:
                pass
    except Exception:
        pass
    # If this is an HTTPException (e.g. 404 Not Found) and the request is
    # not an API path, return the default HTTP response so Flask/Werkzeug can
    # render a proper HTML error page instead of bubbling into a 500 from
    # re-raising here. For API paths, return JSON payloads.
    try:
        if isinstance(e, HTTPException):
            if request.path.startswith('/api/'):
                # API clients expect JSON
                if _is_production:
                    return jsonify({'status': 'error', 'error': 'internal_server_error'}), 500
                else:
                    return jsonify({'status': 'error', 'error': str(e)}), 500
            # Non-API HTTP exceptions (like 404): return the Werkzeug-provided response
            return e.get_response()
        else:
            # Non-HTTP exceptions: for API routes return JSON, otherwise re-raise
            if request.path.startswith('/api/'):
                if _is_production:
                    return jsonify({'status': 'error', 'error': 'internal_server_error'}), 500
                else:
                    return jsonify({'status': 'error', 'error': str(e)}), 500
    except Exception:
        pass
    # Not an API route and not an HTTPException: re-raise to allow default handling
    raise e

# Read env vars. Use safe defaults for dev/tests; enforce stricter checks at
# process start in production (see enforce_required_envs_or_exit()).
ADMIN_PW = os.getenv('ADMIN_PASSWORD', 'admin123')
NFT_KEY = os.getenv('NFT_STORAGE_API_KEY')
ENABLE_LAUNCHPAD = os.getenv('ENABLE_LAUNCHPAD', 'true').lower() != 'false'
# Allow owner actions (list/delete credentials) without an on-chain signature when set to 'true'.
# This is useful when the frontend does not perform wallet-based signing and the operator
# accepts owner-provided addresses as sufficient proof. Default: false.
ALLOW_OWNER_ACTIONS_NO_SIG = os.getenv('ALLOW_OWNER_ACTIONS_NO_SIG', 'false').lower() == 'true'
if not NFT_KEY:
    print("WARNING: NFT_STORAGE_API_KEY is not set. Attestation pinning to nft.storage will fail until this is configured.")

from functools import wraps
from datetime import datetime
try:
    # cryptography is optional in dev, but recommended in prod
    from cryptography.fernet import Fernet
    _fernet_available = True
except Exception:
    Fernet = None
    _fernet_available = False

try:
    # plaid client (optional) - used only if PLAID_CLIENT_ID/PLAID_SECRET are set
    from plaid import Client as PlaidClient
    _plaid_available = True
except Exception:
    PlaidClient = None
    _plaid_available = False

# Optional rate limiting: use Flask-Limiter when available; fall back to a no-op.
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _limiter_available = True
except Exception:
    Limiter = None
    get_remote_address = None
    _limiter_available = False

# Initialize limiter if available (attach after app exists)
if _limiter_available:
    # Initialize limiter; prefer Redis backend when REDIS_URL is set.
    # Use Redis storage only when a Redis client was successfully created
    limiter_storage = REDIS_URL if (_redis is not None) else None
    try:
        if limiter_storage:
            limiter = Limiter(key_func=get_remote_address, storage_uri=limiter_storage)
        else:
            limiter = Limiter(key_func=get_remote_address)
        try:
            limiter.init_app(app)
        except TypeError:
            # Fallback: some older versions accept (app, ...)
            if limiter_storage:
                limiter = Limiter(app, key_func=get_remote_address, storage_uri=limiter_storage)
            else:
                limiter = Limiter(app, key_func=get_remote_address)
    except Exception:
        # If any error initializing limiter with Redis occurs, fallback to dummy limiter
        limiter = None
        _limiter_available = False
        print("WARNING: Flask-Limiter initialization failed; falling back to dummy limiter")
else:
    # dummy limiter object with a .limit decorator that does nothing
    class _DummyLimiter:
        def limit(self, limit_str):
            def _decorator(f):
                return f
            return _decorator
    limiter = _DummyLimiter()
    print("WARNING: Flask-Limiter not installed; rate limiting disabled. Install with: pip install Flask-Limiter")

# Decide whether to allow password-based admin login. In production we strongly
# discourage the default dev password; operators may explicitly disable password
# login via DISABLE_PASSWORD_LOGIN=true. If running in production and the
# ADMIN_PW is still the insecure default, disable password login automatically.
DISABLE_PASSWORD_LOGIN = os.getenv('DISABLE_PASSWORD_LOGIN', 'false').lower() == 'true'
if _is_production and ADMIN_PW == 'admin123':
    DISABLE_PASSWORD_LOGIN = True
    print('Info: password-based admin login disabled in production until ADMIN_PASSWORD is set')

# If Redis is available and Flask-Session is installed, configure server-side sessions
if _redis and _flask_session_available:
    try:
        # Configure Flask-Session to use Redis for server-side sessions
        app.config['SESSION_TYPE'] = 'redis'
        app.config['SESSION_REDIS'] = _redis
        app.config['SESSION_USE_SIGNER'] = True
        # Optionally set session cookie name and secure options remain configured above
        Session(app)
        print('Info: Flask-Session initialized to use Redis for server-side sessions')
    except Exception as e:
        print('Warning: Flask-Session could not be initialized: ' + str(e))

def require_launchpad_enabled(fn):
    """Decorator to gate Launchpad-related endpoints when ENABLE_LAUNCHPAD is false."""
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not ENABLE_LAUNCHPAD:
            return jsonify({'status': 'launchpad_disabled'}), 403
        return fn(*args, **kwargs)
    return wrapped


def enforce_required_envs_or_exit():
    """Enforce required env vars when starting the server directly.

    This will be invoked only from the `if __name__ == '__main__'` block so
    tests that import the module don't get a SystemExit during collection.
    """
    missing = []
    # Basic required vars (keep NFT pinning required because attestations rely on pinning)
    if os.getenv('NFT_STORAGE_API_KEY') is None:
        missing.append('NFT_STORAGE_API_KEY')

    # In production require a non-default SECRET_KEY
    if _is_production:
        if SECRET_KEY == 'dev-insecure-secret':
            missing.append('SECRET_KEY (must be a strong secret in production)')

        # Ensure the public API base is known or ProxyFix is enabled and available so
        # request.url_root will be correct behind a reverse proxy. Operators should
        # prefer setting PUBLIC_API_BASE in production to avoid relying on forwarded headers.
        public_api_base = os.getenv('PUBLIC_API_BASE')
        enable_proxy_fix = os.getenv('ENABLE_PROXY_FIX', 'false').lower() == 'true'
        if not public_api_base and not (enable_proxy_fix and _proxy_fix_available):
            missing.append('PUBLIC_API_BASE or ENABLE_PROXY_FIX (with werkzeug ProxyFix available)')

        # Enforce that ALLOWED_ORIGINS is explicitly configured in production to
        # avoid accidentally allowing open CORS policies. The application has
        # sensible dev defaults, but in production this must be set.
        if os.getenv('ALLOWED_ORIGINS') is None:
            missing.append('ALLOWED_ORIGINS (configure allowed frontend origins)')

        # Admin auth: require either a strong ADMIN_PASSWORD or that password-login is
        # explicitly disabled and an OIDC provider is configured.
        admin_pw = os.getenv('ADMIN_PASSWORD')
        disable_pw = os.getenv('DISABLE_PASSWORD_LOGIN', 'false').lower() == 'true'
        oidc_ok = bool(OIDC_CLIENT_ID and OIDC_CLIENT_SECRET and OIDC_ISSUER)
        if not disable_pw:
            if not admin_pw or admin_pw == 'admin123':
                missing.append('ADMIN_PASSWORD (set a strong password) or set DISABLE_PASSWORD_LOGIN=true and configure OIDC')
        else:
            if not oidc_ok:
                missing.append('OIDC configuration (OIDC_CLIENT_ID/SECRET/ISSUER) is required when DISABLE_PASSWORD_LOGIN=true')

        # If REDIS_URL is provided but redis client failed to initialize, error in prod
        if REDIS_URL and not _redis:
            missing.append('REDIS_URL provided but redis client failed to initialize')

        # If Redis is intended for server-side sessions but Flask-Session not installed,
        # report an error so operators correct their environment.
        if REDIS_URL and not _flask_session_available:
            missing.append('Flask-Session not installed/available while REDIS_URL is set')

        # Admin access method sanity: ensure at least one admin authentication
        # mechanism is configured in production. Acceptable options include:
        # - ADMIN_ADDRESS or ADMIN_ADDRESSES (SIWE addresses),
        # - CHECK_OWNER_CONTRACT_ADDR (on-chain owner lookup),
        # - a non-default ADMIN_PASSWORD (if password login is enabled), or
        # - a configured OIDC provider (OIDC_CLIENT_ID/SECRET/ISSUER).
        admin_addr_env = os.getenv('ADMIN_ADDRESS') or os.getenv('ADMIN_ADDRESSES')
        contract_addr = os.getenv('CHECK_OWNER_CONTRACT_ADDR') or os.getenv('CHECK_OWNER_CONTRACT_ADDR_ALT')
        # admin_pw and oidc_ok variables exist above in this function's scope
        try:
            admin_pw = admin_pw  # reuse variable defined earlier
        except NameError:
            admin_pw = os.getenv('ADMIN_PASSWORD')
        try:
            oidc_ok = oidc_ok
        except NameError:
            oidc_ok = bool(os.getenv('OIDC_CLIENT_ID') and os.getenv('OIDC_CLIENT_SECRET') and os.getenv('OIDC_ISSUER'))

        if not (admin_addr_env or contract_addr or (admin_pw and admin_pw != 'admin123') or oidc_ok):
            missing.append('ADMIN_ADDRESS/ADMIN_ADDRESSES or CHECK_OWNER_CONTRACT_ADDR or ADMIN_PASSWORD (or configure OIDC)')

    if missing:
        print("ERROR: Required environment variables or runtime support missing: " + ", ".join(missing))
        print("Aborting startup. Set the required environment variables and restart the server.")
        sys.exit(1)

# Database (SQLite for simple deployments/tests)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///projects.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class Project(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_name = db.Column(db.String(120))
    contract_link = db.Column(db.String(255))
    launch_date = db.Column(db.String(64))
    description = db.Column(db.Text)
    status = db.Column(db.String(32), default="pending")
    wallet_address = db.Column(db.String(128))
    whitepaper_filename = db.Column(db.String(255))


class AttestationModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    issuer = db.Column(db.String(128))
    subject = db.Column(db.String(128))
    schema_hash = db.Column(db.String(66))
    data_cid = db.Column(db.String(255))
    expires_at = db.Column(db.Integer)
    signature = db.Column(db.String(256))
    verified = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.Integer)
    pin_cid = db.Column(db.String(255), nullable=True)
    # optional JSON blob storing minimal metadata (e.g. Plaid fingerprint) for drafts
    plaid_meta = db.Column(db.Text, nullable=True)


class OwnerAudit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    checked_at = db.Column(db.Integer)
    checked_by = db.Column(db.String(128))
    rpc = db.Column(db.String(255))
    contract_addr = db.Column(db.String(128))
    owner_address = db.Column(db.String(128))
    expected_owner = db.Column(db.String(128), nullable=True)
    match = db.Column(db.Boolean)


class OAuthCredential(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String(64), nullable=False)
    account_id = db.Column(db.String(255), nullable=True)
    owner_addr = db.Column(db.String(128), nullable=True)
    encrypted_token = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.Integer, default=lambda: int(time.time()))
    attestation_cid = db.Column(db.String(255), nullable=True)


class CreditAssessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    attestation_id = db.Column(db.Integer, nullable=True)
    attestation_cid = db.Column(db.String(255), nullable=True)
    score = db.Column(db.Integer, nullable=True)
    offers = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.Integer, default=lambda: int(time.time()))


with app.app_context():
    db.create_all()


# RBAC: simple role assignment table. Principals can be emails (OIDC) or addresses (SIWE/owner)
class RoleAssignment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    principal_type = db.Column(db.String(32), nullable=False)  # 'email' or 'address'
    principal = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(64), nullable=False)

    def as_dict(self):
        return {'id': self.id, 'principal_type': self.principal_type, 'principal': self.principal, 'role': self.role}

with app.app_context():
    # ensure new table exists
    try:
        db.create_all()
    except Exception:
        pass

# Audit table for role changes
class RoleAudit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    changed_at = db.Column(db.Integer)
    changed_by = db.Column(db.String(128))
    action = db.Column(db.String(16))
    principal_type = db.Column(db.String(32))
    principal = db.Column(db.String(255))
    role = db.Column(db.String(64))

    def as_dict(self):
        return {'id': self.id, 'changed_at': self.changed_at, 'changed_by': self.changed_by, 'action': self.action, 'principal_type': self.principal_type, 'principal': self.principal, 'role': self.role}

# Prometheus metrics (use a dedicated CollectorRegistry to avoid duplicate
# registration when the module is imported multiple times during tests)
from prometheus_client import CollectorRegistry
_METRICS_REGISTRY = CollectorRegistry()
_REQUESTS = Counter('veritypass_requests_total', 'Total HTTP requests', ['method', 'endpoint'], registry=_METRICS_REGISTRY)
# Attestation pinning metrics
_ATTEST_PIN_SUCCESS = Counter('veritypass_attestation_pin_success_total', 'Successful attestation pins', registry=_METRICS_REGISTRY)
_ATTEST_PIN_FAILURE = Counter('veritypass_attestation_pin_failure_total', 'Failed attestation pins', registry=_METRICS_REGISTRY)
# Validation failures (bad payload or signature)
_ATTEST_VALIDATION_FAILURE = Counter('veritypass_attestation_validation_failure_total', 'Attestation validation failures', registry=_METRICS_REGISTRY)
# Pin latency
_ATTEST_PIN_LATENCY = Histogram('veritypass_attestation_pin_duration_seconds', 'Attestation pin duration seconds', registry=_METRICS_REGISTRY)
# Owner no-signature acceptance counter (when ALLOW_OWNER_ACTIONS_NO_SIG is used)
_OWNER_NO_SIG_ACCEPTED = Counter('veritypass_owner_actions_no_sig_total', 'Owner actions accepted without signature', ['endpoint'], registry=_METRICS_REGISTRY)

# Role change metric: action in {add,remove}
_ROLE_CHANGE_COUNTER = Counter('veritypass_role_changes_total', 'Role assignment changes', ['action', 'principal_type'], registry=_METRICS_REGISTRY)

# Initialize Sentry if DSN provided (optional in dev/tests)
SENTRY_DSN = os.getenv('SENTRY_DSN')
if SENTRY_DSN:
    try:
        sentry_sdk.init(dsn=SENTRY_DSN, integrations=[FlaskIntegration()], traces_sample_rate=0.0)
        print("Sentry initialized")
    except Exception:
        # don't fail startup if Sentry init fails
        print("Warning: Sentry initialization failed")

# OIDC / Authlib configuration (optional)
OIDC_CLIENT_ID = os.getenv('OIDC_CLIENT_ID')
OIDC_CLIENT_SECRET = os.getenv('OIDC_CLIENT_SECRET')
OIDC_ISSUER = os.getenv('OIDC_ISSUER')
# optional: comma-separated list of allowed admin emails from the IdP
OIDC_ADMIN_ALLOWLIST = os.getenv('OIDC_ADMIN_ALLOWLIST')
# Dev support: allow a simple dev-login endpoint when enabled (DEV only)
OIDC_DEV_ALLOW = os.getenv('OIDC_DEV_ALLOW', 'false').lower() == 'true'

oauth = None
if _oidc_available and OIDC_ISSUER and OIDC_CLIENT_ID and OIDC_CLIENT_SECRET:
    try:
        oauth = OAuth(app)
        oauth.register(
            name='oidc',
            client_id=OIDC_CLIENT_ID,
            client_secret=OIDC_CLIENT_SECRET,
            server_metadata_url=(OIDC_ISSUER.rstrip('/') + '/.well-known/openid-configuration'),
            client_kwargs={'scope': 'openid email profile'}
        )
        print('Info: OIDC client registered')
    except Exception as e:
        oauth = None
        print('Warning: OIDC client registration failed:', str(e))
else:
    if _oidc_available:
        print('Info: OIDC not fully configured; skipping registration')
    else:
        print('Info: authlib not installed; OIDC endpoints disabled')


@app.before_request
def _before_request_metrics():
    try:
        _REQUESTS.labels(method=request.method, endpoint=request.path).inc()
    except Exception:
        pass


@app.route('/api/attestations', methods=['POST'])
def receive_attestation():
    data = request.json
    # Expect: issuer, subject, schemaHash, dataCID, expiresAt, signature, contractAddress (optional)
    issuer = data.get('issuer')
    subject = data.get('subject')
    schema_hash = data.get('schemaHash')
    data_cid = data.get('dataCID')
    expires_at = int(data.get('expiresAt', 0))
    signature = data.get('signature')
    contract_addr = data.get('contractAddress', None)

    if not (issuer and subject and schema_hash and data_cid and signature):
        try:
            _ATTEST_VALIDATION_FAILURE.inc()
        except Exception:
            pass
        return jsonify({'status': 'missing fields'}), 400

    # Build the solidity-encoded message and recover signer
    try:
        # If contract address not provided, use empty address
        if not contract_addr:
            contract_addr = '0x' + '00'*20
        # compute keccak256(abi.encode(subject, schemaHash, dataCID, expiresAt, contractAddress))
        message_hash = Web3.solidity_keccak(['address','bytes32','string','uint256','address'], [subject, schema_hash, data_cid, expires_at, contract_addr])
        eth_message = encode_defunct(hexstr=message_hash.hex())
        recovered = Account.recover_message(eth_message, signature=signature)
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 400

    verified = (to_checksum_address(recovered) == to_checksum_address(issuer))

    att = AttestationModel(
        issuer=issuer,
        subject=subject,
        schema_hash=schema_hash,
        data_cid=data_cid,
        expires_at=expires_at,
        signature=signature,
        verified=verified,
        created_at=int(time.time())
    )
    db.session.add(att)
    db.session.commit()

    return jsonify({'status': 'ok', 'verified': verified, 'attestation_id': att.id}), 200


def pin_to_nft_storage(json_data: dict) -> str:
    """Pin JSON data to nft.storage and return the ipfs URI (ipfs://CID)"""
    import requests
    from os import getenv
    api_key = getenv("NFT_STORAGE_API_KEY")
    if not api_key:
        raise RuntimeError("NFT_STORAGE_API_KEY not set in environment")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    resp = requests.post("https://api.nft.storage/upload", headers=headers, json=json_data, timeout=30)
    resp.raise_for_status()
    j = resp.json()
    cid = j.get("value", {}).get("cid")
    if not cid:
        raise RuntimeError(f"Unexpected nft.storage response: {j}")
    return f"ipfs://{cid}"


def _get_fernet():
    """Return a Fernet instance using PLAID_ENCRYPTION_KEY env var. If not set,
    try to derive a key from SECRET_KEY (not ideal for prod). Returns None if
    cryptography is not available.
    """
    key = os.getenv('PLAID_ENCRYPTION_KEY')
    if not key:
        # fallback: derive from SECRET_KEY by padding/truncating (not cryptographically ideal)
        fallback = SECRET_KEY.encode('utf-8')
        # Simple deterministic 32-byte key derivation (use HKDF in prod)
        import base64
        derived = (fallback * 4)[:32]
        key = base64.urlsafe_b64encode(derived)
    if not _fernet_available:
        return None
    try:
        return Fernet(key if isinstance(key, bytes) else key.encode('utf-8'))
    except Exception:
        return None


def _encrypt_value(v: str) -> str:
    f = _get_fernet()
    if not f:
        # fallback: return plaintext (warn in logs). In production this should never happen.
        print('Warning: cryptography.Fernet not available or key invalid; storing plaintext token')
        return v
    return f.encrypt(v.encode('utf-8')).decode('utf-8')


def _decrypt_value(ct: str) -> str:
    f = _get_fernet()
    if not f:
        return ct
    try:
        return f.decrypt(ct.encode('utf-8')).decode('utf-8')
    except Exception:
        return ct


def _verify_owner_signed_message(owner_addr: str, message: str, signature: str) -> bool:
    """Verify that `signature` is a signature of `message` by `owner_addr`.

    Uses eth_account to recover address from signature and compares checksummed addresses.
    """
    if not owner_addr or not message or not signature:
        return False
    try:
        recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
        return to_checksum_address(recovered) == to_checksum_address(owner_addr)
    except Exception:
        return False


def _owner_action_allowed(owner: str, message: str, signature: str) -> bool:
    """Return True if an owner-scoped action should be allowed.

    Allowed when any of:
      - an admin session is active
      - ALLOW_OWNER_ACTIONS_NO_SIG env var is true and an owner address is provided (no signature required)
      - the provided message+signature recover to the owner address
    """
    # Admins may always act
    if session.get('admin'):
        return True
    # Operator override: allow owner actions without an on-chain signature
    if ALLOW_OWNER_ACTIONS_NO_SIG and owner:
        # increment metric and log for auditability
        try:
            # label by endpoint path for simple aggregation
            _OWNER_NO_SIG_ACCEPTED.labels(endpoint=(request.path or 'unknown')).inc()
        except Exception:
            pass
        try:
            msg = f"Owner action accepted without signature (owner={owner}, endpoint={request.path}, remote={request.remote_addr})"
            print(msg)
            if SENTRY_DSN:
                try:
                    sentry_sdk.capture_message(msg)
                except Exception:
                    pass
        except Exception:
            pass
        return True
    # Otherwise require a valid owner signature
    return _verify_owner_signed_message(owner, message, signature)


def try_recover_signature(issuer, subject, schema_hash, data_cid, expires_at, signature, contract_addr=None, chain_id=None):
    """Attempt multiple recovery strategies and return (verified_bool, recovered_address)
    Strategies:
      - legacy: keccak(abi.encode(subject,schemaHash,dataCID,expiresAt,contractAddr)) prefixed (personal_sign)
      - eip712: domainSeparator + structHash prefixed (signMessage) fallback
    """
    try:
        # prepare common values
        if not contract_addr:
            contract_addr = '0x' + '00'*20
        # normalize schema_hash: tests send hex string (0x...) representing bytes32
        schema_hash_bytes = schema_hash
        if isinstance(schema_hash, str) and schema_hash.startswith('0x'):
            try:
                schema_hash_bytes = bytes.fromhex(schema_hash[2:])
            except Exception:
                schema_hash_bytes = schema_hash
        # legacy message
        legacy_hash = Web3.solidity_keccak(['address','bytes32','string','uint256','address'], [subject, schema_hash_bytes, data_cid, int(expires_at), contract_addr])
        legacy_pref = encode_defunct(hexstr=legacy_hash.hex())
        # Try a few signature formats: hex string or raw bytes
        recovered_legacy = None
        try:
            recovered_legacy = Account.recover_message(legacy_pref, signature=signature)
        except Exception:
            try:
                if isinstance(signature, str) and signature.startswith('0x'):
                    recovered_legacy = Account.recover_message(legacy_pref, signature=bytes.fromhex(signature[2:]))
            except Exception:
                recovered_legacy = None

        # EIP-712 style
        # domain: name="AttestationRegistry", version="1", chainId, verifyingContract
        # Default to chain id 1 (mainnet) when not provided. Using Web3.eth.chain_id
        # can fail when Web3 has no provider in this environment, so prefer a safe default.
        if chain_id is None:
            chain_id = 1
        domain_typehash = Web3.keccak(text="EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
        name_hash = Web3.keccak(text="AttestationRegistry")
        version_hash = Web3.keccak(text="1")
        domain_separator = Web3.solidity_keccak(['bytes32','bytes32','bytes32','uint256','address'], [domain_typehash, name_hash, version_hash, int(chain_id), contract_addr])

        data_cid_hash = Web3.keccak(text=data_cid)
        att_typehash = Web3.keccak(text="Attestation(address subject,bytes32 schemaHash,bytes32 dataCIDHash,uint256 expiresAt)")
        struct_hash = Web3.solidity_keccak(['bytes32','address','bytes32','bytes32','uint256'], [att_typehash, subject, schema_hash_bytes, data_cid_hash, int(expires_at)])
        digest_bytes = Web3.keccak(b"\x19\x01" + domain_separator + struct_hash)
        prefixed = encode_defunct(hexstr=digest_bytes.hex())
        recovered_eip = None
        try:
            recovered_eip = Account.recover_message(prefixed, signature=signature)
        except Exception:
            try:
                if isinstance(signature, str) and signature.startswith('0x'):
                    recovered_eip = Account.recover_message(prefixed, signature=bytes.fromhex(signature[2:]))
            except Exception:
                recovered_eip = None

        # choose prefixed eip if not None, else legacy if not None
        recovered = None
        if recovered_eip:
            recovered = recovered_eip
        elif recovered_legacy:
            recovered = recovered_legacy

        if not recovered:
            return (False, None)
        return (to_checksum_address(recovered) == to_checksum_address(issuer), to_checksum_address(recovered))
    except Exception as e:
        # In production we don't expose internals; return failure. Keep logging minimal.
        return (False, None)


@app.route('/api/attestations/pin', methods=['POST'])
def pin_attestation():
    data = request.json
    issuer = data.get('issuer')
    subject = data.get('subject')
    schema_hash = data.get('schemaHash')
    data_cid = data.get('dataCID')
    expires_at = int(data.get('expiresAt', 0))
    signature = data.get('signature')
    contract_addr = data.get('contractAddress', None)
    chain_id = data.get('chainId', None)

    if not (issuer and subject and schema_hash and data_cid and signature):
        return jsonify({'status': 'missing fields'}), 400

    verified, recovered = try_recover_signature(issuer, subject, schema_hash, data_cid, expires_at, signature, contract_addr, chain_id)

    if not verified:
        # fallback: try direct legacy pref recovery here (sometimes formats differ)
        try:
            legacy_hash = Web3.solidity_keccak(['address','bytes32','string','uint256','address'], [subject, schema_hash, data_cid, int(expires_at), contract_addr or ('0x' + '00'*20)])
            legacy_pref = encode_defunct(hexstr=legacy_hash.hex())
            recovered2 = None
            try:
                recovered2 = Account.recover_message(legacy_pref, signature=signature)
            except Exception:
                try:
                    if isinstance(signature, str) and signature.startswith('0x'):
                        recovered2 = Account.recover_message(legacy_pref, signature=bytes.fromhex(signature[2:]))
                except Exception:
                    recovered2 = None
            if recovered2 and to_checksum_address(recovered2) == to_checksum_address(issuer):
                verified = True
                recovered = to_checksum_address(recovered2)
        except Exception:
            pass

    if not verified:
        try:
            _ATTEST_VALIDATION_FAILURE.inc()
        except Exception:
            pass
        return jsonify({'status': 'invalid signature', 'recovered': recovered}), 400

    # build attestation JSON to pin
    att_json = {
        'issuer': issuer,
        'subject': subject,
        'schemaHash': schema_hash,
        'dataCID': data_cid,
        'expiresAt': expires_at,
        'signature': signature
    }
    try:
        # measure pin latency
        with _ATTEST_PIN_LATENCY.time():
            pinned = pin_to_nft_storage(att_json)
    except Exception as e:
        # Instrument failure and capture to Sentry if configured
        try:
            _ATTEST_PIN_FAILURE.inc()
        except Exception:
            pass
        try:
            sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return jsonify({'status': 'pin_error', 'error': str(e)}), 500

    # store record
    att = AttestationModel(
        issuer=issuer,
        subject=subject,
        schema_hash=schema_hash,
        data_cid=pinned,
        expires_at=expires_at,
        signature=signature,
        verified=True,
        created_at=int(time.time()),
        pin_cid=pinned
    )
    db.session.add(att)
    db.session.commit()

    # record metric: successful pin
    try:
        _ATTEST_PIN_SUCCESS.inc()
    except Exception:
        pass

    # return structured payload for client to submit on-chain
    return jsonify({'status': 'ok', 'verified': True, 'pin': pinned, 'attestation_id': att.id,
                    'call_payload': {
                        'subject': subject,
                        'schemaHash': schema_hash,
                        'dataCID': pinned,
                        'expiresAt': expires_at,
                        'signature': signature
                    }}), 200

@app.route('/api/projects', methods=['POST'])
@require_launchpad_enabled
def upload_project():
    data = request.form
    whitepaper = request.files.get('whitepaper')
    filename = None
    if whitepaper:
        # validate filename and limit extensions
        from werkzeug.utils import secure_filename
        allowed_ext = {'pdf', 'doc', 'docx', 'md', 'txt'}
        orig_name = secure_filename(whitepaper.filename or 'upload')
        ext = orig_name.rsplit('.', 1)[-1].lower() if '.' in orig_name else ''
        if ext not in allowed_ext:
            return jsonify({'status': 'invalid_file_type'}), 400
        # Build a safe filename
        filename = f"{secure_filename(data.get('projectName','project'))}_{orig_name}"
        # Save to uploads folder. MAX_CONTENT_LENGTH enforces maximum size.
        whitepaper.save(os.path.join(UPLOAD_FOLDER, filename))
    project = Project(
        project_name=data.get('projectName'),
        contract_link=data.get('contractLink'),
        launch_date=data.get('launchDate'),
        description=data.get('description'),
        # NOTE: walletAddress is intentionally ignored by the API surface since
        # frontend no longer relies on global wallet connections. The DB column
        # is retained for backward compatibility/migration, but we avoid writing
        # or exposing it here to keep the API focused on project metadata.
        wallet_address=None,
        whitepaper_filename=filename
    )
    db.session.add(project)
    db.session.commit()
    return jsonify({"status": "success"}), 200

@app.route('/api/projects', methods=['GET'])
def list_projects():
    projects = Project.query.all()
    out = []
    for p in projects:
        out.append({
            "id": p.id,
            "project_name": p.project_name,
            "contract_link": p.contract_link,
            "launch_date": p.launch_date,
            "description": p.description,
            "status": p.status,
            # wallet_address intentionally omitted from API response
            "whitepaper_filename": p.whitepaper_filename,
        })
    return jsonify(out)


@app.route('/api/admin/check', methods=['GET'])
def admin_check():
    """Simple endpoint for the frontend to verify whether the current session is an admin.

    Returns JSON: {"admin": true|false}
    """
    return jsonify({'admin': bool(session.get('admin')), 'admin_addr': session.get('admin_addr')}), 200


@app.route('/api/admin/nonce', methods=['GET'])
def admin_nonce():
    """Return a one-time nonce for SIWE login. Nonce is stored server-side with TTL."""
    # generate a random nonce
    nonce = secrets.token_urlsafe(16)
    ttl = int(os.getenv('SIWE_NONCE_TTL', '600'))
    # try redis first
    if _redis:
        try:
            _redis.setex(f'siwe:nonce:{nonce}', ttl, '1')
            return jsonify({'nonce': nonce}), 200
        except Exception:
            pass
    # fallback to in-memory
    with _nonce_lock:
        _nonce_store[nonce] = int(time.time()) + ttl
    return jsonify({'nonce': nonce}), 200


@app.route('/api/admin/auth_methods', methods=['GET'])
def admin_auth_methods():
    """Return which admin authentication methods are enabled.

    Response JSON: { password: bool, siwe: bool, oidc: bool }
    This is read-only metadata for the admin UI to decide which buttons to show.
    """
    # Password login: disabled in our deployment by default (removed)
    password_enabled = False
    # SIWE is supported when Account.recover_message is available (always true here)
    siwe_enabled = True
    # OIDC: enabled when oauth client is registered or dev-login allowed
    oidc_enabled = False
    try:
        # if oauth object is set and has an 'oidc' attribute, assume enabled
        if oauth and getattr(oauth, 'oidc', None) is not None:
            oidc_enabled = True
    except Exception:
        oidc_enabled = False
    # Dev fallback: respect env var at request time
    if os.getenv('OIDC_DEV_ALLOW', 'false').lower() == 'true':
        oidc_enabled = True
    return jsonify({'password': password_enabled, 'siwe': siwe_enabled, 'oidc': oidc_enabled}), 200


@app.route('/api/frontend-config', methods=['GET'])
def frontend_config():
    """Return lightweight runtime configuration for the frontend.

    Fields:
      - api_base: the base URL of this API server
      - auth_methods: same shape as /api/admin/auth_methods
      - allow_owner_actions_no_sig: whether the operator accepts no-sig owner actions
      - allowed_origins: list of configured CORS origins (for debugging)
      - admin_ui_url: optional admin UI host configured via ADMIN_UI_URL or VITE_ADMIN_HOST
    """
    # Prefer an explicit PUBLIC_API_BASE when set (helps when behind proxies/load-balancers)
    api_base = os.getenv('PUBLIC_API_BASE') or request.url_root.rstrip('/')
    # reuse auth methods logic
    auth = {
        'password': False,
        'siwe': True,
        'oidc': False,
    }
    try:
        if oauth and getattr(oauth, 'oidc', None) is not None:
            auth['oidc'] = True
    except Exception:
        auth['oidc'] = False
    if os.getenv('OIDC_DEV_ALLOW', 'false').lower() == 'true':
        auth['oidc'] = True

    admin_ui = os.getenv('ADMIN_UI_URL') or os.getenv('VITE_ADMIN_HOST') or ''

    # Optional runtime values for frontend demos/features. These allow the
    # frontend to be configured at runtime (no rebuild) by returning values
    # from environment variables when set.
    aave_pool = os.getenv('VITE_AAVE_POOL_ADDRESS') or os.getenv('AAVE_POOL_ADDRESS') or ''
    aave_price = os.getenv('VITE_AAVE_PRICE_ORACLE') or os.getenv('AAVE_PRICE_ORACLE') or ''

    return jsonify({
        'api_base': api_base,
        'auth_methods': auth,
        'allow_owner_actions_no_sig': ALLOW_OWNER_ACTIONS_NO_SIG,
        'allowed_origins': allowed_origins,
        'admin_ui_url': admin_ui,
        # Demo/runtime feature flags and addresses
        'aave_pool_address': aave_pool,
        'aave_price_oracle': aave_price,
    }), 200


@app.route('/api/debug/env', methods=['GET'])
def debug_env():
    """Development-only debug endpoint to inspect a few runtime env vars.

    Returns JSON with `ADMIN_DEV_ALLOW_ANY`, `FLASK_ENV` and whether the app
    thinks it's running in production. Disabled in production.
    """
    if _is_production:
        return jsonify({'status': 'disabled_in_production'}), 403
    return jsonify({
        'ADMIN_DEV_ALLOW_ANY': os.getenv('ADMIN_DEV_ALLOW_ANY'),
        'FLASK_ENV': os.getenv('FLASK_ENV'),
        '_is_production': _is_production,
        'ALLOWED_ORIGINS': allowed_origins
    }), 200


@app.route('/api/identity/bound', methods=['GET'])
def identity_bound():
    """Return whether the current session has an identity bound via signature."""
    return jsonify({'bound': bool(session.get('identity_bound', False))}), 200


@app.route('/api/identity/bind', methods=['POST'])
def identity_bind():
    """Bind a wallet identity to the current session using a personal_sign signature.

    Expects JSON: { owner_addr, message, signature }
    Returns: { identity_id, bound: true }
    NOTE: This endpoint verifies the signature server-side. In production consider
    stricter nonce handling and CSRF protections.
    """
    data = request.json or {}
    owner = data.get('owner_addr')
    nonce = data.get('nonce')
    signature = data.get('signature')
    if not (owner and nonce and signature):
        return jsonify({'status': 'missing_fields'}), 400
    # consume and verify nonce to avoid replay attacks
    if not _consume_nonce(nonce):
        return jsonify({'status': 'invalid_or_expired_nonce'}), 400
    ok = _verify_owner_signed_message(owner, nonce, signature)
    if not ok:
        return jsonify({'status': 'invalid_signature'}), 400
    # mark session as bound
    session['identity_bound'] = True
    session['identity_id'] = secrets.token_urlsafe(16)
    # store the owner address in session for claim operations
    try:
        session['identity_owner'] = to_checksum_address(owner)
    except Exception:
        session['identity_owner'] = owner
    return jsonify({'status': 'ok', 'identity_id': session['identity_id'], 'bound': True}), 200



@app.route('/api/identity/nonce', methods=['GET'])
def identity_nonce():
    """Issue a single-use nonce for identity binding. Stored in Redis when available
    or in the in-memory nonce store with TTL.
    Returns: { nonce }
    """
    nonce = secrets.token_urlsafe(16)
    ttl = int(os.getenv('IDENTITY_NONCE_TTL', '600'))
    # try redis
    if _redis:
        try:
            _redis.setex(f'identity:nonce:{nonce}', ttl, '1')
            return jsonify({'nonce': nonce}), 200
        except Exception:
            pass
    # fallback to in-memory store
    with _nonce_lock:
        _nonce_store[nonce] = int(time.time()) + ttl
    return jsonify({'nonce': nonce}), 200


@app.route('/api/attestations/draft', methods=['POST'])
def create_attestation_draft():
    """Create a draft attestation record from Plaid/link metadata.

    This does NOT pin to nft.storage or publish on-chain. It creates a DB
    record that can be later pinned/published by the user.
    Expects JSON: { owner_addr, plaid }
    Returns: { status: 'ok', attestation_id }
    """
    data = request.json or {}
    owner = data.get('owner_addr')
    plaid = data.get('plaid')
    if not owner or not plaid:
        return jsonify({'status': 'missing_fields'}), 400
    try:
        # Extract a minimal fingerprint from the Plaid payload to surface in the UI
        plaid_meta = None
        try:
            md = plaid if isinstance(plaid, dict) else {}
            metadata = md.get('metadata') if isinstance(md.get('metadata'), dict) else (md.get('metadata') or md)
            inst = None
            acct_mask = None
            acct_name = None
            if isinstance(metadata, dict):
                if isinstance(metadata.get('institution'), dict):
                    inst = metadata.get('institution', {}).get('name')
                elif isinstance(metadata.get('institution'), str):
                    inst = metadata.get('institution')
                accts = metadata.get('accounts') or metadata.get('account') or []
                if isinstance(accts, list) and len(accts) > 0 and isinstance(accts[0], dict):
                    acct_mask = accts[0].get('mask') or accts[0].get('last4') or accts[0].get('account_mask')
                    acct_name = accts[0].get('name') or accts[0].get('account_name')
            fingerprint = {}
            if inst: fingerprint['institution'] = inst
            if acct_mask: fingerprint['account_mask'] = acct_mask
            if acct_name: fingerprint['account_name'] = acct_name
            if fingerprint:
                plaid_meta = json.dumps(fingerprint)
        except Exception:
            plaid_meta = None

        att = AttestationModel(
            issuer=owner,
            subject=owner,
            schema_hash='plaid-draft',
            data_cid='',
            expires_at=0,
            signature='',
            verified=False,
            created_at=int(time.time()),
            pin_cid=None,
            plaid_meta=plaid_meta
        )
        db.session.add(att)
        db.session.commit()
        # Optionally persist plaid metadata to OAuthCredential or another table
        return jsonify({'status': 'ok', 'attestation_id': att.id}), 200
    except Exception as e:
        print('Error creating draft attestation:', str(e))
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/attestations/<int:att_id>', methods=['GET'])
def get_attestation(att_id):
    """Return an attestation (draft or pinned) by id.

    This endpoint is used by the UI to inspect draft state and pin status.
    Response includes: id, issuer, subject, schema_hash, data_cid, pin_cid, verified, created_at
    """
    try:
        att = AttestationModel.query.get(att_id)
        if not att:
            return jsonify({'status': 'not_found'}), 404
        return jsonify({
            'id': att.id,
            'issuer': att.issuer,
            'subject': att.subject,
            'schema_hash': att.schema_hash,
            'data_cid': att.data_cid,
            'pin_cid': att.pin_cid,
            'verified': bool(att.verified),
            'created_at': att.created_at,
            'plaid_meta': att.plaid_meta
        }), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/attestations/<int:att_id>/claim', methods=['POST'])
def claim_attestation(att_id):
    """Allow a session-bound identity to claim an anonymous draft.

    Preconditions:
      - session['identity_bound'] must be True
      - session['identity_owner'] must be present
      - attestation must exist and not already be pinned
      - attestation.issuer must be 'anon' or empty (to avoid stealing)
    """
    if not session.get('identity_bound'):
        return jsonify({'status': 'unauthorized', 'reason': 'not_bound'}), 401
    owner = session.get('identity_owner')
    if not owner:
        return jsonify({'status': 'unauthorized', 'reason': 'no_owner'}), 401
    try:
        att = AttestationModel.query.get(att_id)
        if not att:
            return jsonify({'status': 'not_found'}), 404
        # Prevent claiming if already pinned (anchored)
        if att.pin_cid:
            return jsonify({'status': 'already_pinned'}), 400
        # Allow claiming only when issuer is anonymous or matches current owner
        issuer_norm = (att.issuer or '').lower()
        if issuer_norm and issuer_norm != 'anon' and to_checksum_address(issuer_norm) != to_checksum_address(owner):
            return jsonify({'status': 'forbidden', 'reason': 'already_owned'}), 403
        # Claim: set issuer/subject to owner
        att.issuer = owner
        att.subject = owner
        db.session.commit()
        return jsonify({'status': 'ok', 'attestation_id': att.id}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/version', methods=['GET'])
def version_info():
    """Return a small version payload useful for debugging deployments.

    - git_commit: short sha if available
    - version: package/version string if set via env
    """
    git_sha = None
    try:
        # attempt to read .git/HEAD or use git if available
        head = os.path.join(os.path.dirname(__file__), '..', '.git', 'HEAD')
        head = os.path.abspath(head)
        if os.path.exists(head):
            with open(head, 'r') as f:
                ref = f.read().strip()
                if ref.startswith('ref:'):
                    ref_path = ref.split(':', 1)[1].strip()
                    ref_file = os.path.join(os.path.dirname(__file__), '..', '.git', ref_path)
                    ref_file = os.path.abspath(ref_file)
                    if os.path.exists(ref_file):
                        with open(ref_file, 'r') as rf:
                            git_sha = rf.read().strip()[:12]
                else:
                    git_sha = ref[:12]
    except Exception:
        git_sha = None

    return jsonify({'git_commit': git_sha, 'version': os.getenv('APP_VERSION', None)}), 200


@app.route('/api/uploads/exists/<path:filename>', methods=['GET'])
def upload_exists(filename):
    """Check whether a given uploaded file exists. Returns { exists: bool }."""
    safe_path = os.path.join(UPLOAD_FOLDER, secure_filename(filename))
    exists = os.path.exists(safe_path)
    return jsonify({'exists': exists}), 200


# Serve favicon.ico if present in the `static/` directory; otherwise return 204
@app.route('/favicon.ico')
def favicon():
    static_dir = os.path.join(app.root_path, 'static')
    ico_path = os.path.join(static_dir, 'favicon.ico')
    if os.path.exists(ico_path):
        return send_from_directory(static_dir, 'favicon.ico')
    # No favicon available; return empty success so browsers don't spam 404s
    return ('', 204)


@app.route('/api/connect/plaid/create_link_token', methods=['POST'])
def plaid_create_link_token():
    """Create a Plaid link token. Expects JSON: { "owner_addr": "0x..." }

    Returns: { link_token }
    """
    data = request.json or {}
    owner = data.get('owner_addr')
    client_id = os.getenv('PLAID_CLIENT_ID')
    secret = os.getenv('PLAID_SECRET')
    env = os.getenv('PLAID_ENV', 'sandbox')
    if not client_id or not secret or not _plaid_available:
        return jsonify({'status': 'plaid_not_configured'}), 400
    try:
        client = PlaidClient(client_id=client_id, secret=secret, environment=env)
        response = client.LinkToken.create({
            'user': {'client_user_id': owner or 'anon'},
            'client_name': 'VerityPass Connect',
            'products': ['auth', 'transactions'],
            'country_codes': ['US'],
            'language': 'en'
        })
        link_token = response.get('link_token') or response.get('link_token')
        return jsonify({'link_token': link_token}), 200
    except Exception as e:
        print('Plaid create link token error:', str(e))
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/connect/plaid/exchange_public_token', methods=['POST'])
def plaid_exchange_public_token():
    """Exchange a Plaid public_token for an access_token and persist encrypted credential.

    Expects JSON: { public_token, account_id, owner_addr }
    """
    data = request.json or {}
    public_token = data.get('public_token')
    account_id = data.get('account_id')
    owner = data.get('owner_addr')
    client_id = os.getenv('PLAID_CLIENT_ID')
    secret = os.getenv('PLAID_SECRET')
    env = os.getenv('PLAID_ENV', 'sandbox')
    if not public_token or not client_id or not secret or not _plaid_available:
        return jsonify({'status': 'plaid_not_configured'}), 400
    try:
        client = PlaidClient(client_id=client_id, secret=secret, environment=env)
        # Plaid client wrappers vary between versions; try common call patterns
        access_token = None
        item_id = None
        try:
            # fake client in tests may expose this
            resp = client.Item.public_token_exchange(public_token)
            access_token = resp.get('access_token')
            item_id = resp.get('item_id')
        except Exception:
            try:
                resp = client.Item.public_token.exchange(public_token)
                access_token = resp.get('access_token')
                item_id = resp.get('item_id')
            except Exception:
                try:
                    # some clients use client.item.public_token.exchange
                    resp = client.item.public_token.exchange(public_token)
                    access_token = resp.get('access_token')
                    item_id = resp.get('item_id')
                except Exception as e:
                    raise e
        if not access_token:
            raise RuntimeError('Could not obtain access_token from Plaid client')
    except Exception as e:
        print('Plaid exchange error:', str(e))
        return jsonify({'status': 'exchange_failed', 'error': str(e)}), 500

    # encrypt and store credential
    enc = _encrypt_value(access_token)
    cid = None
    try:
        # Optionally pin a minimal attestation to nft.storage to create an on-chain anchor (without sensitive data)
        try:
            att_obj = {'provider': 'plaid', 'owner': owner, 'account_id_hash': Web3.keccak(text=str(account_id or item_id)).hex(), 'ts': int(time.time())}
            cid = pin_to_nft_storage(att_obj)
        except Exception:
            cid = None

        cred = OAuthCredential(provider='plaid', account_id=account_id or item_id, owner_addr=owner, encrypted_token=enc, attestation_cid=cid)
        db.session.add(cred)
        db.session.commit()
    except Exception as e:
        print('DB store error for Plaid credential or pin:', str(e))
        return jsonify({'status': 'db_error', 'error': str(e)}), 500

    return jsonify({'status': 'ok', 'credential_id': cred.id, 'attestation_cid': cid}), 200


@app.route('/api/connect/plaid/accounts', methods=['POST'])
def plaid_accounts():
    """Return a small summary of accounts and recent transactions for a stored Plaid credential.

    Expects JSON: { owner_addr, account_id?, draft_id? }
    Returns: { balances: { available, current }, transactionsCount, avgMonthlyInflow, accountAgeDays }
    """
    data = request.json or {}
    owner = data.get('owner_addr')
    account_id = data.get('account_id')
    draft_id = data.get('draft_id')

    if not _plaid_available:
        return jsonify({'status': 'plaid_not_configured'}), 400


    # Locate credential: prefer explicit owner_addr, fall back to draft owner if provided
    cred = None
    try:
        if owner:
            # normalize owner address when possible
            try:
                owner_norm = to_checksum_address(owner)
            except Exception:
                owner_norm = owner
            cred = OAuthCredential.query.filter_by(provider='plaid', owner_addr=owner_norm).order_by(OAuthCredential.created_at.desc()).first()
        if not cred and draft_id:
            att = AttestationModel.query.get(draft_id)
            if att and att.issuer:
                try:
                    issuer_norm = to_checksum_address(att.issuer)
                except Exception:
                    issuer_norm = att.issuer
                cred = OAuthCredential.query.filter_by(provider='plaid', owner_addr=issuer_norm).order_by(OAuthCredential.created_at.desc()).first()
    except Exception:
        cred = None

    if not cred:
        return jsonify({'status': 'no_credential'}), 404

    # Authorization: only allow the session that created/bound the identity to fetch
    # the account summary, or allow admin sessions. This prevents arbitrary callers
    # from enumerating account summaries for stored credentials.
    try:
        if not session.get('admin'):
            # require bound identity matching the credential owner
            if not session.get('identity_bound'):
                return jsonify({'status': 'unauthorized', 'reason': 'not_bound'}), 401
            sess_owner = session.get('identity_owner')
            try:
                sess_owner_norm = to_checksum_address(sess_owner)
                cred_owner_norm = to_checksum_address(cred.owner_addr) if cred.owner_addr else None
            except Exception:
                sess_owner_norm = sess_owner
                cred_owner_norm = cred.owner_addr
            if not sess_owner_norm or not cred_owner_norm or (sess_owner_norm.lower() != cred_owner_norm.lower()):
                return jsonify({'status': 'unauthorized', 'reason': 'owner_mismatch'}), 401
    except Exception:
        return jsonify({'status': 'unauthorized', 'reason': 'auth_error'}), 401

    # Decrypt stored token
    try:
        access_token = _decrypt_value(cred.encrypted_token)
    except Exception as e:
        return jsonify({'status': 'decrypt_failed', 'error': str(e)}), 500

    # Build Plaid client
    client_id = os.getenv('PLAID_CLIENT_ID')
    secret = os.getenv('PLAID_SECRET')
    env = os.getenv('PLAID_ENV', 'sandbox')
    try:
        client = PlaidClient(client_id=client_id, secret=secret, environment=env)
    except Exception as e:
        return jsonify({'status': 'plaid_client_error', 'error': str(e)}), 500

    # Fetch accounts (balances) and transactions (last 90 days) with flexible client API calls
    accounts = []
    transactions = []
    try:
        # Accounts.get variants
        try:
            resp = client.Accounts.get(access_token)
            accounts = resp.get('accounts') if isinstance(resp, dict) else resp.accounts
        except Exception:
            try:
                resp = client.accounts.get(access_token)
                accounts = resp.get('accounts') if isinstance(resp, dict) else resp.accounts
            except Exception:
                try:
                    resp = client.AccountsGet(access_token)
                    accounts = resp.get('accounts') if isinstance(resp, dict) else getattr(resp, 'accounts', [])
                except Exception:
                    accounts = []

        # Transactions: last 90 days
        end = datetime.date.today()
        start = end - datetime.timedelta(days=90)
        try:
            tresp = client.Transactions.get(access_token, start_date=start.isoformat(), end_date=end.isoformat())
            transactions = tresp.get('transactions') if isinstance(tresp, dict) else getattr(tresp, 'transactions', [])
        except Exception:
            try:
                tresp = client.transactions.get(access_token, start_date=start.isoformat(), end_date=end.isoformat())
                transactions = tresp.get('transactions') if isinstance(tresp, dict) else getattr(tresp, 'transactions', [])
            except Exception:
                transactions = []
    except Exception as e:
        print('Plaid fetch error:', str(e))

    # Summarize balances and inflow
    total_available = 0.0
    total_current = 0.0
    account_age_days = None
    try:
        for a in accounts or []:
            bal = a.get('balances') if isinstance(a, dict) else getattr(a, 'balances', None)
            if bal:
                total_available += float(bal.get('available') or bal.get('current') or 0)
                total_current += float(bal.get('current') or 0)
            # account age: use reported account.opened_date if present
            opened = None
            if isinstance(a, dict):
                opened = a.get('open_date') or a.get('opened_date') or a.get('openDate')
            else:
                opened = getattr(a, 'open_date', None) or getattr(a, 'opened_date', None)
            if opened:
                try:
                    od = datetime.date.fromisoformat(opened)
                    account_age_days = (datetime.date.today() - od).days
                    break
                except Exception:
                    pass
    except Exception:
        pass

    # Compute avg monthly inflow: sum positive transactions and divide by ~3 months
    inflow = 0.0
    try:
        pos = [t for t in (transactions or []) if (isinstance(t, dict) and float(t.get('amount', 0)) > 0) or (not isinstance(t, dict) and getattr(t, 'amount', 0) > 0)]
        for t in pos:
            amt = float(t.get('amount') if isinstance(t, dict) else getattr(t, 'amount', 0))
            inflow += amt
        months = 3.0
        avg_monthly = inflow / months if months > 0 else 0.0
    except Exception:
        avg_monthly = 0.0

    summary = {
        'balances': {'available': total_available, 'current': total_current},
        'transactionsCount': len(transactions or []),
        'avgMonthlyInflow': round(avg_monthly, 2),
        'accountAgeDays': account_age_days
    }

    return jsonify(summary), 200


# Apply a conservative rate limit to the Plaid accounts endpoint when a limiter
# is configured to prevent abuse. Decorate at runtime so the app can start
# whether or not Flask-Limiter is installed.
try:
    if _limiter_available and limiter is not None:
        plaid_accounts = limiter.limit("10 per minute")(plaid_accounts)
except Exception:
    # If decorating fails for any reason, continue without rate-limiting.
    pass


@app.route('/api/credit/assess', methods=['POST'])
def credit_assess():
    """Simple credit assessment endpoint for frontend prototypes.

    Expects JSON: { draft_id?, draft?: {...}, bank_meta?: {...}, onchain?: {...} }
    Returns: { score: int, offers: [ {id, amount, interestRate, term, collateralRequired, collateralPct} ] }
    """
    data = request.json or {}
    # Attempt to read attestation draft or minimal income/bank metadata
    draft = data.get('draft') or {}
    bank = data.get('bank_meta') or draft.get('plaid_meta') or {}
    repayment = draft.get('repayment_history') or {}

    # Basic heuristic scoring (mirror of frontend heuristic)
    score = 300
    try:
        income = float(draft.get('verified_income') or draft.get('income') or 0)
        if income > 0:
            import math
            score += min(300, int(math.log10(income + 1) * 50))
        else:
            score += 50
    except Exception:
        pass

    try:
        bal = float(bank.get('balances', {}).get('available') or bank.get('balance') or 0)
        if bal > 0:
            import math
            score += min(250, int(math.log10(bal + 1) * 60))
    except Exception:
        pass

    try:
        txc = int(data.get('onchain', {}).get('txCount') or 0)
        if txc > 0:
            score += min(150, txc * 3)
    except Exception:
        pass

    try:
        ontime = int(repayment.get('onTimePayments') or 0)
        missed = int(repayment.get('missedPayments') or 0)
        if ontime > 0:
            score += min(200, ontime * 10)
        if missed > 0:
            score -= min(300, missed * 30)
    except Exception:
        pass

    score = max(0, min(1000, int(score)))

    # Generate simple offers
    offers = []
    tiers = [250, 500, 750]
    import time
    for i, tier in enumerate(tiers):
        base_amount = int((score / 1000.0) * (10000 * (i + 1))) or (500 * (i + 1))
        interest = max(3, int(15 - (score / 1000.0) * 12) + i * 2)
        collateral_pct = max(50, 150 - int((score / 1000.0) * 120) - i * 10)
        offers.append({
            'id': f'offer-{i}-{int(time.time())}',
            'amount': base_amount,
            'interestRate': interest,
            'term': 30 * (i + 1),
            'collateralRequired': int((base_amount * collateral_pct) / 100),
            'collateralPct': collateral_pct
        })

    # Persist the assessment for later lender review when possible
    try:
        import json
        att_id = None
        att_cid = None
        # Accept either numeric id or data_cid from the draft payload
        if isinstance(draft, dict):
            att_id = draft.get('id') or draft.get('attestation_id')
            att_cid = draft.get('data_cid') or draft.get('dataCID') or draft.get('cid') or None
            try:
                # normalize numeric id
                if att_id is not None:
                    att_id = int(att_id)
            except Exception:
                att_id = None

        ca = CreditAssessment(attestation_id=att_id, attestation_cid=att_cid, score=int(score), offers=json.dumps(offers))
        db.session.add(ca)
        db.session.commit()
    except Exception:
        # non-fatal; continue
        try:
            db.session.rollback()
        except Exception:
            pass

    return jsonify({'score': score, 'offers': offers}), 200


def _consume_nonce(nonce):
    if not nonce:
        return False
    if _redis:
        try:
            key = f'siwe:nonce:{nonce}'
            val = _redis.get(key)
            if val:
                _redis.delete(key)
                return True
            return False
        except Exception:
            pass
    with _nonce_lock:
        exp = _nonce_store.get(nonce)
        if not exp:
            return False
        if int(time.time()) > exp:
            del _nonce_store[nonce]
            return False
        # consume
        del _nonce_store[nonce]
        return True


def require_admin(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get('admin'):
            return jsonify({'status': 'unauthorized'}), 401
        # If this session was created via OIDC, and an allowlist is configured,
        # ensure the admin_email is in the allowlist. This defends against a
        # misconfigured IdP issuing tokens to unintended principals.
        admin_email = session.get('admin_email')
        oidc_allowlist = os.getenv('OIDC_ADMIN_ALLOWLIST')
        if admin_email and oidc_allowlist:
            allowed_list = [e.strip().lower() for e in oidc_allowlist.split(',') if e.strip()]
            if admin_email.lower() not in allowed_list:
                try:
                    msg = f"Session admin_email {admin_email} not in allowlist"
                    print(msg)
                    if SENTRY_DSN:
                        sentry_sdk.capture_message(msg)
                except Exception:
                    pass
                return jsonify({'status': 'forbidden'}), 403
        return fn(*args, **kwargs)
    return wrapped


def _get_roles_for_principal(principal_type: str, principal: str):
    """Return list of role names assigned to the given principal."""
    try:
        if not principal:
            return []
        assignments = RoleAssignment.query.filter_by(principal_type=principal_type, principal=principal).all()
        return [a.role for a in assignments]
    except Exception:
        return []


def _populate_session_roles_for_address(address: str):
    """Populate session['roles'] from DB assignments for an address principal."""
    try:
        roles = _get_roles_for_principal('address', to_checksum_address(address))
        session['roles'] = roles
    except Exception:
        session['roles'] = []


def _populate_session_roles_for_email(email: str):
    """Populate session['roles'] from DB assignments for an email principal."""
    try:
        roles = _get_roles_for_principal('email', email.lower())
        session['roles'] = roles
    except Exception:
        session['roles'] = []


def require_role(role_name: str):
    """Decorator that requires the current session to have role `role_name`.

    Admin sessions (session['admin'] == True) bypass role checks.
    Sessions with `session['roles']` that include the role will be allowed.
    Additionally, if the session has an admin_addr or admin_email, we also consult
    persistent RoleAssignment entries for that principal (useful when session wasn't
    populated earlier).
    """
    def decorator(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            # admin override
            if session.get('admin'):
                return fn(*args, **kwargs)
            # session roles
            roles = session.get('roles') or []
            try:
                if role_name in roles:
                    return fn(*args, **kwargs)
            except Exception:
                pass
            # consult persistent assignments if we have a principal
            admin_addr = session.get('admin_addr')
            admin_email = session.get('admin_email')
            try:
                if admin_addr:
                    rs = _get_roles_for_principal('address', to_checksum_address(admin_addr))
                    if role_name in rs:
                        return fn(*args, **kwargs)
                if admin_email:
                    rs = _get_roles_for_principal('email', admin_email.lower())
                    if role_name in rs:
                        return fn(*args, **kwargs)
            except Exception:
                pass
            return jsonify({'status': 'forbidden'}), 403
        return wrapped
    return decorator


def _session_has_role(role_name: str) -> bool:
    """Return True if current session has role_name via session, admin override, or persistent assignment."""
    try:
        if session.get('admin'):
            return True
        roles = session.get('roles') or []
        if role_name in roles:
            return True
        admin_addr = session.get('admin_addr')
        admin_email = session.get('admin_email')
        if admin_addr:
            rs = _get_roles_for_principal('address', to_checksum_address(admin_addr))
            if role_name in rs:
                return True
        if admin_email:
            rs = _get_roles_for_principal('email', admin_email.lower())
            if role_name in rs:
                return True
    except Exception:
        pass
    return False


@app.route('/api/admin/siwe', methods=['POST'])
@limiter.limit("10 per 10 minutes")
def admin_siwe():
    """Verify a SIWE-style message + signature and create an admin session.

    Expects JSON: { message: string, signature: string }
    """
    data = request.json or {}
    message = data.get('message')
    signature = data.get('signature')
    # Development override: when ADMIN_DEV_ALLOW_ANY is enabled in dev, allow
    # a caller to supply `dev_addr` to bypass signature verification. This is
    # strictly for local development and tests and is disabled in production.
    dev_override = False
    try:
        if (not _is_production) and (os.getenv('ADMIN_DEV_ALLOW_ANY', 'false').lower() in ('1', 'true', 'yes')):
            dev_addr = data.get('dev_addr')
            if dev_addr:
                try:
                    recovered = to_checksum_address(dev_addr)
                    dev_override = True
                except Exception:
                    dev_override = False
    except Exception:
        dev_override = False

    if not dev_override and (not message or not signature):
        return jsonify({'status': 'missing_fields'}), 400

    # Recover the signer from the signed message unless a dev override is used
    if not dev_override:
        try:
            recovered = Account.recover_message(encode_defunct(text=message), signature=signature)
            recovered = to_checksum_address(recovered)
        except Exception as e:
            # log invalid signature attempt
            try:
                msg = f"SIWE invalid_signature from {request.remote_addr}: {str(e)[:200]}"
                print(msg)
                if SENTRY_DSN:
                    sentry_sdk.capture_message(msg)
            except Exception:
                pass
            return jsonify({'status': 'invalid_signature', 'error': str(e)}), 400

    # Try to extract address from the SIWE message (second line typically contains the address)
    addr_match = re.search(r'0x[a-fA-F0-9]{40}', message)
    if addr_match:
        try:
            msg_addr = to_checksum_address(addr_match.group(0))
        except Exception:
            msg_addr = None
        if msg_addr and msg_addr != recovered:
            return jsonify({'status': 'address_mismatch'}), 400

    # Extract nonce from message (SIWE includes a 'Nonce: <nonce>' line)
    nonce_match = re.search(r'Nonce:\s*([A-Za-z0-9\-_.]+)', message, flags=re.IGNORECASE)
    if not nonce_match:
        try:
            msg = f"SIWE missing_nonce from {request.remote_addr}"
            print(msg)
            if SENTRY_DSN:
                sentry_sdk.capture_message(msg)
        except Exception:
            pass
        return jsonify({'status': 'missing_nonce'}), 400
    nonce = nonce_match.group(1)
    if not _consume_nonce(nonce):
        try:
            msg = f"SIWE invalid_or_expired_nonce from {request.remote_addr} (nonce={nonce})"
            print(msg)
            if SENTRY_DSN:
                sentry_sdk.capture_message(msg)
        except Exception:
            pass
        return jsonify({'status': 'invalid_or_expired_nonce'}), 400

    # Authorization: check configured admin addresses or on-chain owner
    admin_env = os.getenv('ADMIN_ADDRESS') or os.getenv('ADMIN_ADDRESSES')
    allowed = []
    if admin_env:
        for a in admin_env.split(','):
            a = a.strip()
            if not a:
                continue
            try:
                allowed.append(to_checksum_address(a))
            except Exception:
                pass
    if allowed:
        if recovered not in allowed:
            try:
                msg = f"SIWE forbidden: address {recovered} not in allowed list (from {request.remote_addr})"
                print(msg)
                if SENTRY_DSN:
                    sentry_sdk.capture_message(msg)
            except Exception:
                pass
            return jsonify({'status': 'forbidden'}), 403
    else:
        # Fallback: if CHECK_OWNER_CONTRACT_ADDR present, compare against on-chain owner()
        contract_addr = os.getenv('CHECK_OWNER_CONTRACT_ADDR') or os.getenv('CHECK_OWNER_CONTRACT_ADDR_ALT')
        rpc = os.getenv('CHECK_OWNER_RPC_URL') or 'http://127.0.0.1:8545'
        if contract_addr:
            try:
                w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={'timeout': 10}))
                abi = ['function owner() view returns (address)']
                c = w3.eth.contract(address=Web3.to_checksum_address(contract_addr), abi=abi)
                owner = c.functions.owner().call()
                if to_checksum_address(owner) != recovered:
                    try:
                        msg = f"SIWE forbidden: on-chain owner {owner} does not match recovered {recovered} (from {request.remote_addr})"
                        print(msg)
                        if SENTRY_DSN:
                            sentry_sdk.capture_message(msg)
                    except Exception:
                        pass
                    return jsonify({'status': 'forbidden'}), 403
            except Exception as e:
                return jsonify({'status': 'error', 'error': str(e)}), 500
        else:
            # No admin configuration available. In production we must deny.
            # During local development you can opt-in to allow any recovered
            # address to become an admin by setting ADMIN_DEV_ALLOW_ANY=true.
            admin_dev_allow = os.getenv('ADMIN_DEV_ALLOW_ANY', 'false').lower() == 'true'
            if not _is_production and admin_dev_allow:
                try:
                    print(f"DEV-allow: accepting SIWE from {recovered} (no admin config present)")
                except Exception:
                    pass
                    # continue to session creation below
                    pass
            else:
                try:
                    msg = f"SIWE forbidden_no_admin_config from {request.remote_addr}"
                    print(msg)
                    if SENTRY_DSN:
                        sentry_sdk.capture_message(msg)
                except Exception:
                    pass
                return jsonify({'status': 'forbidden_no_admin_config'}), 403

    # Success — rotate session to mitigate fixation, then create session and initialize csrf token
    _rotate_session()
    session['admin'] = True
    session['admin_addr'] = recovered
    session.permanent = True
    try:
        _ensure_csrf()
    except Exception:
        pass
    try:
        # populate roles for this address (if any assignments exist)
        _populate_session_roles_for_address(recovered)
    except Exception:
        pass
    return jsonify({'status': 'ok'}), 200


@app.route('/api/admin/oidc/login', methods=['GET'])
def admin_oidc_login():
    """Start OIDC login flow. Redirects to the IdP authorization endpoint.

    Requires OIDC to be configured. In development, if OIDC_DEV_ALLOW is true,
    this will return a dev-login hint.
    """
    oidc_dev_allow = os.getenv('OIDC_DEV_ALLOW', 'false').lower() == 'true'
    if oauth is None:
        # Only expose the dev-login hint when running in a non-production environment
        # and OIDC_DEV_ALLOW has been explicitly enabled. In production we must not
        # advertise or enable dev-only login flows.
        if (not _is_production) and oidc_dev_allow:
            return jsonify({'status': 'oidc_not_configured', 'dev_login': '/api/admin/oidc/dev-login?email=you@dev.local'}), 501
        return jsonify({'status': 'oidc_not_configured'}), 501

    redirect_uri = os.getenv('OIDC_REDIRECT_URI') or (request.url_root.rstrip('/') + '/api/admin/oidc/callback')
    try:
        return oauth.oidc.authorize_redirect(redirect_uri)
    except Exception as e:
        try:
            if SENTRY_DSN:
                sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/oidc/callback', methods=['GET'])
def admin_oidc_callback():
    """Handle OIDC callback: exchange code for tokens, validate, and create admin session."""
    if oauth is None:
        return jsonify({'status': 'oidc_not_configured'}), 501
    try:
        token = oauth.oidc.authorize_access_token()
    except Exception as e:
        try:
            if SENTRY_DSN:
                sentry_sdk.capture_exception(e)
        except Exception:
            pass
        return jsonify({'status': 'token_exchange_failed', 'error': str(e)}), 400

    userinfo = None
    try:
        try:
            userinfo = oauth.oidc.userinfo(token=token)
        except Exception:
            userinfo = oauth.oidc.parse_id_token(token)
    except Exception:
        userinfo = None

    if not userinfo:
        return jsonify({'status': 'no_userinfo'}), 400

    email = userinfo.get('email') or userinfo.get('preferred_username')
    if not email:
        return jsonify({'status': 'email_required'}), 400

    allowed = True
    oidc_allowlist = os.getenv('OIDC_ADMIN_ALLOWLIST')
    if oidc_allowlist:
        allowed_list = [e.strip().lower() for e in oidc_allowlist.split(',') if e.strip()]
        allowed = (email.lower() in allowed_list)

    if not allowed:
        try:
            msg = f"OIDC login forbidden for {email} from {request.remote_addr}"
            print(msg)
            if SENTRY_DSN:
                sentry_sdk.capture_message(msg)
        except Exception:
            pass
        return jsonify({'status': 'forbidden'}), 403

    # Successful OIDC authentication: rotate session to mitigate fixation and set admin session
    _rotate_session()
    session['admin'] = True
    session['admin_addr'] = None
    session['admin_email'] = email
    session.permanent = True
    try:
        _ensure_csrf()
    except Exception:
        pass
    try:
        _populate_session_roles_for_email(email)
    except Exception:
        pass

    redirect_after = os.getenv('OIDC_AFTER_LOGIN_REDIRECT') or '/admin'
    frontend_origin = os.getenv('FRONTEND_ORIGIN')
    if frontend_origin:
        redirect_target = frontend_origin.rstrip('/') + redirect_after
    else:
        redirect_target = redirect_after

    return ('', 302, {'Location': redirect_target})


@app.route('/api/admin/oidc/dev-login', methods=['GET'])
def admin_oidc_dev_login():
    """Development-only endpoint to simulate an OIDC login when OIDC is not available.

    Enabled when OIDC_DEV_ALLOW=true. Usage: /api/admin/oidc/dev-login?email=you@dev.local
    """
    oidc_dev_allow = os.getenv('OIDC_DEV_ALLOW', 'false').lower() == 'true'
    # Disallow dev-login in production even if OIDC_DEV_ALLOW is set for safety.
    # Allow it when running the test suite (app.config['TESTING']=True) so tests
    # can enable the dev-login flow via environment variables.
    if _is_production and not app.config.get('TESTING', False):
        return jsonify({'status': 'dev_login_disabled_in_production'}), 403
    if not oidc_dev_allow:
        return jsonify({'status': 'dev_login_disabled'}), 403
    email = request.args.get('email')
    if not email:
        return jsonify({'status': 'missing_email'}), 400
    oidc_allowlist = os.getenv('OIDC_ADMIN_ALLOWLIST')
    if oidc_allowlist:
        allowed_list = [e.strip().lower() for e in oidc_allowlist.split(',') if e.strip()]
        if email.lower() not in allowed_list:
            return jsonify({'status': 'forbidden'}), 403

    # rotate session to mitigate fixation, then set admin session info
    _rotate_session()
    session['admin'] = True
    session['admin_addr'] = None
    session['admin_email'] = email
    session.permanent = True
    try:
        _ensure_csrf()
    except Exception:
        pass
    try:
        _populate_session_roles_for_email(email)
    except Exception:
        pass
    redirect_after = os.getenv('OIDC_AFTER_LOGIN_REDIRECT') or '/admin'
    frontend_origin = os.getenv('FRONTEND_ORIGIN')
    if frontend_origin:
        redirect_target = frontend_origin.rstrip('/') + redirect_after
    else:
        redirect_target = redirect_after
    return ('', 302, {'Location': redirect_target})


def _ensure_csrf():
    """Ensure a csrf token exists in the session and return it."""
    import secrets
    if 'csrf_token' not in session:
        try:
            session['csrf_token'] = secrets.token_urlsafe(32)
        except Exception:
            # best-effort; if sessions can't be written here, callers will create it later
            pass
    return session.get('csrf_token')


# Readiness endpoint for orchestration and load-balancers
@app.route('/api/ready', methods=['GET'])
def api_ready():
    # Readiness probe: check DB access and optional Redis connectivity
    try:
        # quick DB check
        db.session.execute('SELECT 1')
    except Exception as e:
        return jsonify({'status': 'not_ready', 'reason': 'db_error', 'error': str(e)[:200]}), 503
    if REDIS_URL:
        try:
            if not _redis:
                raise RuntimeError('redis_client_missing')
            _redis.ping()
        except Exception as e:
            return jsonify({'status': 'not_ready', 'reason': 'redis_error', 'error': str(e)[:200]}), 503
    return jsonify({'status': 'ready'}), 200
    
def _rotate_session():
    """Rotate/clear the current session to mitigate session fixation on privilege elevation.

    This intentionally clears any existing session data and forces the creation of a
    fresh session when the caller writes new session keys (admin, roles, etc.).
    """
    try:
        # Clear any existing session data. For cookie-based sessions this effectively
        # replaces the cookie contents; for server-side sessions backed by Redis,
        # Flask-Session will create a new session key on subsequent writes.
        session.clear()
    except Exception:
        pass
    token = session.get('csrf_token')
    if not token:
        token = secrets.token_urlsafe(32)
        session['csrf_token'] = token
    return token


@app.route('/api/admin/csrf', methods=['GET'])
def admin_csrf():
    # only return token to an authenticated admin session
    if not session.get('admin'):
        return jsonify({'status': 'unauthorized'}), 401
    token = _ensure_csrf()
    return jsonify({'csrf_token': token}), 200


def require_csrf(fn):
    """Decorator to require X-CSRF-Token header matches session token for stateful admin actions."""
    @wraps(fn)
    def wrapped(*args, **kwargs):
        # Only check CSRF if there is an admin session
        if session.get('admin'):
            header = request.headers.get('X-CSRF-Token')
            token = session.get('csrf_token')
            if not token or not header or header != token:
                return jsonify({'status': 'csrf_failed'}), 403
        return fn(*args, **kwargs)
    return wrapped


@app.route('/api/admin/logout', methods=['POST'])
@require_csrf
def admin_logout():
    # Clear admin session flag
    session.pop('admin', None)
    # also clear csrf token and admin_addr
    session.pop('csrf_token', None)
    session.pop('admin_addr', None)
    return jsonify({'status': 'ok'}), 200

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    # Serve uploaded files with conservative caching headers. Filenames are
    # generated via secure_filename at upload time, but ensure the path is
    # safe before sending.
    try:
        resp = send_from_directory(UPLOAD_FOLDER, filename)
        # Encourage browsers to cache immutable uploaded assets for a short time
        # while still allowing quick updates if replaced by an operator.
        resp.headers.setdefault('Cache-Control', 'public, max-age=300, s-maxage=600')
        return resp
    except Exception:
        return jsonify({'status': 'not_found'}), 404


@app.route('/api/connect/credentials', methods=['GET'])
def list_credentials():
    """List credentials for a given owner_addr. Requires owner to provide
    a signed message and signature via query params: msg and sig.

    Query params: owner_addr, msg, sig
    """
    owner = request.args.get('owner_addr')
    msg = request.args.get('msg')
    sig = request.args.get('sig')
    # allow admins to list without signature; otherwise allow when owner action is allowed
    if session.get('admin'):
        creds = OAuthCredential.query.filter_by(owner_addr=owner).all() if owner else OAuthCredential.query.all()
    else:
        if not _owner_action_allowed(owner, msg, sig):
            return jsonify({'status': 'unauthorized'}), 401
        # If owner is provided, list only that owner's credentials; otherwise return empty list
        creds = OAuthCredential.query.filter_by(owner_addr=owner).all() if owner else []

    out = []
    for c in creds:
        out.append({'id': c.id, 'provider': c.provider, 'account_id': c.account_id, 'attestation_cid': c.attestation_cid, 'created_at': c.created_at})
    return jsonify(out), 200


@app.route('/api/connect/credentials/<int:cred_id>', methods=['DELETE'])
def delete_credential(cred_id):
    """Delete a credential by id. Requires signed message from owner or admin session."""
    data = request.json or {}
    owner = data.get('owner_addr')
    msg = data.get('msg')
    sig = data.get('sig')
    cred = OAuthCredential.query.get(cred_id)
    if not cred:
        return jsonify({'status': 'not_found'}), 404
    # admin or operator role may delete any credential
    if _session_has_role('operator') or session.get('admin'):
        try:
            db.session.delete(cred)
            db.session.commit()
            return jsonify({'status': 'deleted'}), 200
        except Exception as e:
            return jsonify({'status': 'db_error', 'error': str(e)}), 500
    # otherwise allow when owner action is allowed (either signed or operator override via ALLOW_OWNER_ACTIONS_NO_SIG)
    if not _owner_action_allowed(owner, msg, sig):
        return jsonify({'status': 'unauthorized'}), 401
    if to_checksum_address(owner) != (cred.owner_addr and to_checksum_address(cred.owner_addr)):
        return jsonify({'status': 'forbidden'}), 403
    try:
        db.session.delete(cred)
        db.session.commit()
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'status': 'db_error', 'error': str(e)}), 500

@app.route('/api/admin/login', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def admin_login():
    # Password-based admin login has been removed. Use SIWE or SSO (OIDC).
    # We keep this endpoint to return a clear response so old frontends
    # attempting to use it receive a deterministic 403.
    try:
        msg = f"Password admin login endpoint called but disabled from {request.remote_addr}"
        print(msg)
        if SENTRY_DSN:
            sentry_sdk.capture_message(msg)
    except Exception:
        pass
    return jsonify({"status": "disabled", "reason": "password_login_removed"}), 403

    # Log failed password attempts (non-sensitive info only)
    try:
        msg = f"Failed admin password login attempt from {request.remote_addr}"
        print(msg)
        if SENTRY_DSN:
            sentry_sdk.capture_message(msg)
    except Exception:
        pass

    return jsonify({"status": "fail"}), 401

@app.route('/api/admin/projects', methods=['GET'])
@require_admin
def admin_projects():
    return list_projects()


@app.route('/api/admin/verify-owner', methods=['POST'])
@require_admin
@require_csrf
def admin_verify_owner():

    data = request.json or {}
    rpc = data.get('rpc') or os.getenv('CHECK_OWNER_RPC_URL') or 'http://127.0.0.1:8545'
    contract_addr = data.get('contract') or os.getenv('CHECK_OWNER_CONTRACT_ADDR')
    expected = data.get('expected_owner') or os.getenv('CHECK_OWNER_EXPECTED_OWNER')

    if not contract_addr:
        return jsonify({'status': 'missing_contract'}), 400

    try:
        w3 = Web3(Web3.HTTPProvider(rpc, request_kwargs={'timeout': 10}))
        abi = ['function owner() view returns (address)']
        c = w3.eth.contract(address=Web3.to_checksum_address(contract_addr), abi=abi)
        owner = c.functions.owner().call()
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

    match = False
    try:
        if expected:
            match = (Web3.to_checksum_address(owner) == Web3.to_checksum_address(expected))
    except Exception:
        match = False

    # record audit
    try:
        audit = OwnerAudit(
            checked_at=int(time.time()),
            checked_by=request.remote_addr or 'unknown',
            rpc=rpc,
            contract_addr=contract_addr,
            owner_address=owner,
            expected_owner=expected,
            match=bool(match)
        )
        db.session.add(audit)
        db.session.commit()
    except Exception:
        pass

    return jsonify({'status': 'ok', 'owner': owner, 'match': match}), 200


@app.route('/api/admin/owner-audit', methods=['GET'])
@require_admin
def admin_owner_audit():
    audits = OwnerAudit.query.order_by(OwnerAudit.checked_at.desc()).limit(50).all()
    out = []
    for a in audits:
        out.append({
            'checked_at': a.checked_at,
            'checked_by': a.checked_by,
            'rpc': a.rpc,
            'contract_addr': a.contract_addr,
            'owner_address': a.owner_address,
            'expected_owner': a.expected_owner,
            'match': a.match,
        })
    return jsonify(out)


@app.route('/api/admin/roles', methods=['GET'])
@require_admin
def admin_list_roles():
    """List all role assignments."""
    try:
        assigns = RoleAssignment.query.order_by(RoleAssignment.id.desc()).all()
        return jsonify([a.as_dict() for a in assigns]), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/attestations', methods=['GET'])
@require_admin
def admin_list_attestations():
    """Return a paginated list of attestations for lender/admin review.

    Query params:
      - page (int, default 1)
      - per_page (int, default 25)
      - verified (optional: 'true'|'false')
      - subject (optional: exact match)
      - issuer (optional: exact match)
    """
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
        verified_q = request.args.get('verified')
        subject_q = request.args.get('subject')
        issuer_q = request.args.get('issuer')

        q = AttestationModel.query
        if verified_q is not None:
            if verified_q.lower() in ('1', 'true', 'yes'):
                q = q.filter_by(verified=True)
            else:
                q = q.filter_by(verified=False)
        if subject_q:
            q = q.filter(AttestationModel.subject == subject_q)
        if issuer_q:
            q = q.filter(AttestationModel.issuer == issuer_q)

        total = q.count()
        items = q.order_by(AttestationModel.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

        out = []
        for a in items:
            # attempt to parse plaid_meta if present
            plaid = None
            try:
                if a.plaid_meta:
                    import json
                    plaid = json.loads(a.plaid_meta)
            except Exception:
                plaid = None

            # attach last credit assessment if any
            last_assessment = None
            try:
                ca = CreditAssessment.query.filter(
                    (CreditAssessment.attestation_id == a.id) | (CreditAssessment.attestation_cid == a.data_cid)
                ).order_by(CreditAssessment.created_at.desc()).first()
                if ca:
                    import json as _json
                    last_assessment = {'score': ca.score, 'offers': _json.loads(ca.offers) if ca.offers else None, 'created_at': ca.created_at}
            except Exception:
                last_assessment = None

            out.append({
                'id': a.id,
                'issuer': a.issuer,
                'subject': a.subject,
                'schema_hash': a.schema_hash,
                'data_cid': a.data_cid,
                'pin_cid': a.pin_cid,
                'expires_at': a.expires_at,
                'verified': bool(a.verified),
                'created_at': a.created_at,
                'plaid_meta': plaid,
                'last_assessment': last_assessment,
            })

        return jsonify({'total': total, 'page': page, 'per_page': per_page, 'items': out}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/attestations/export', methods=['GET'])
@require_admin
def admin_export_attestations():
    """Export filtered attestations as CSV. Uses same filters as admin_list_attestations."""
    try:
        # support exporting a single attestation by id: ?id=123
        att_id_q = request.args.get('id') or request.args.get('attestation_id')
        if att_id_q:
            try:
                att_id_q = int(att_id_q)
            except Exception:
                att_id_q = None
        
        verified_q = request.args.get('verified')
        subject_q = request.args.get('subject')
        issuer_q = request.args.get('issuer')

        q = AttestationModel.query
        # If a single id is requested, return only that attestation (ignore paging)
        if att_id_q:
            q = q.filter(AttestationModel.id == att_id_q)
        if verified_q is not None:
            if verified_q.lower() in ('1', 'true', 'yes'):
                q = q.filter_by(verified=True)
            else:
                q = q.filter_by(verified=False)
        if subject_q:
            q = q.filter(AttestationModel.subject == subject_q)
        if issuer_q:
            q = q.filter(AttestationModel.issuer == issuer_q)

        items = q.order_by(AttestationModel.created_at.desc()).all()

        # Build CSV
        import csv, io, json
        si = io.StringIO()
        writer = csv.writer(si)
        writer.writerow(['id', 'issuer', 'subject', 'data_cid', 'pin_cid', 'verified', 'created_at', 'score'])
        for a in items:
            score = ''
            try:
                ca = CreditAssessment.query.filter(
                    (CreditAssessment.attestation_id == a.id) | (CreditAssessment.attestation_cid == a.data_cid)
                ).order_by(CreditAssessment.created_at.desc()).first()
                if ca:
                    score = ca.score
            except Exception:
                score = ''
            writer.writerow([a.id, a.issuer, a.subject, a.data_cid or '', a.pin_cid or '', int(bool(a.verified)), a.created_at or '', score or ''])

        output = make_response(si.getvalue())
        output.headers['Content-Disposition'] = 'attachment; filename=attestations.csv'
        output.headers['Content-Type'] = 'text/csv'
        return output
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/attestations/<int:att_id>/detail', methods=['GET'])
@require_admin
def admin_attestation_detail(att_id):
    """Return a detailed attestation record including credit assessment history.

    Response includes attestation fields and 'assessments': [ {score, offers, created_at}, ... ]
    """
    try:
        a = AttestationModel.query.get(att_id)
        if not a:
            return jsonify({'status': 'not_found'}), 404
        # parse plaid_meta
        plaid = None
        try:
            if a.plaid_meta:
                import json
                plaid = json.loads(a.plaid_meta)
        except Exception:
            plaid = None

        # fetch assessment history
        assessments = []
        try:
            cas = CreditAssessment.query.filter(
                (CreditAssessment.attestation_id == a.id) | (CreditAssessment.attestation_cid == a.data_cid)
            ).order_by(CreditAssessment.created_at.desc()).all()
            import json as _json
            for ca in cas:
                assessments.append({'score': ca.score, 'offers': _json.loads(ca.offers) if ca.offers else None, 'created_at': ca.created_at})
        except Exception:
            assessments = []

        out = {
            'id': a.id,
            'issuer': a.issuer,
            'subject': a.subject,
            'schema_hash': a.schema_hash,
            'data_cid': a.data_cid,
            'pin_cid': a.pin_cid,
            'expires_at': a.expires_at,
            'verified': bool(a.verified),
            'created_at': a.created_at,
            'plaid_meta': plaid,
            'assessments': assessments,
        }
        return jsonify(out), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/attestations/summary', methods=['GET'])
@require_admin
def admin_attestations_summary():
    """Return a small aggregation to help lenders: total, verified_count, unverified_count."""
    try:
        total = AttestationModel.query.count()
        verified = AttestationModel.query.filter_by(verified=True).count()
        unverified = total - verified
        # simple recent stats
        recent = AttestationModel.query.order_by(AttestationModel.created_at.desc()).limit(10).all()
        recent_out = [{'id': r.id, 'subject': r.subject, 'issuer': r.issuer, 'created_at': r.created_at, 'verified': bool(r.verified)} for r in recent]
        return jsonify({'total': total, 'verified': verified, 'unverified': unverified, 'recent': recent_out}), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/api/admin/roles', methods=['POST'])
@require_admin
@require_csrf
def admin_add_role():
    """Add a role assignment. JSON: { principal_type: 'email'|'address', principal: str, role: str }"""
    data = request.json or {}
    ptype = data.get('principal_type')
    principal = data.get('principal')
    role = data.get('role')
    if not ptype or not principal or not role:
        return jsonify({'status': 'missing_fields'}), 400
    if ptype not in ('email', 'address'):
        return jsonify({'status': 'invalid_principal_type'}), 400
    try:
        if ptype == 'address':
            principal = to_checksum_address(principal)
        else:
            principal = principal.lower()
    except Exception:
        return jsonify({'status': 'invalid_principal'}), 400
    try:
        existing = RoleAssignment.query.filter_by(principal_type=ptype, principal=principal, role=role).first()
        if existing:
            return jsonify({'status': 'exists'}), 200
        ra = RoleAssignment(principal_type=ptype, principal=principal, role=role)
        db.session.add(ra)
        db.session.commit()
        # record audit and metric
        try:
            audit = RoleAudit(changed_at=int(time.time()), changed_by=request.remote_addr or 'unknown', action='add', principal_type=ptype, principal=principal, role=role)
            db.session.add(audit)
            db.session.commit()
            try:
                _ROLE_CHANGE_COUNTER.labels(action='add', principal_type=ptype).inc()
            except Exception:
                pass
            if SENTRY_DSN:
                try:
                    sentry_sdk.capture_message(f"Role added: {ptype} {principal} -> {role} by {request.remote_addr}")
                except Exception:
                    pass
        except Exception:
            pass
        return jsonify({'status': 'ok', 'assignment': ra.as_dict()}), 200
    except Exception as e:
        return jsonify({'status': 'db_error', 'error': str(e)}), 500


@app.route('/api/admin/roles/<int:role_id>', methods=['DELETE'])
@require_admin
@require_csrf
def admin_remove_role(role_id):
    """Remove a role assignment by id."""
    try:
        ra = RoleAssignment.query.get(role_id)
        if not ra:
            return jsonify({'status': 'not_found'}), 404
        # record audit and metric
        try:
            audit = RoleAudit(changed_at=int(time.time()), changed_by=request.remote_addr or 'unknown', action='remove', principal_type=ra.principal_type, principal=ra.principal, role=ra.role)
            db.session.add(audit)
            db.session.delete(ra)
            db.session.commit()
            try:
                _ROLE_CHANGE_COUNTER.labels(action='remove', principal_type=ra.principal_type).inc()
            except Exception:
                pass
            if SENTRY_DSN:
                try:
                    sentry_sdk.capture_message(f"Role removed: {ra.principal_type} {ra.principal} -> {ra.role} by {request.remote_addr}")
                except Exception:
                    pass
        except Exception:
            # fall back to deleting without audit
            db.session.delete(ra)
            db.session.commit()
        return jsonify({'status': 'deleted'}), 200
    except Exception as e:
        return jsonify({'status': 'db_error', 'error': str(e)}), 500


@app.route('/api/admin/role-audit', methods=['GET'])
@require_admin
def admin_role_audit():
    """Return recent role audit entries for UI and inspection."""
    try:
        entries = RoleAudit.query.order_by(RoleAudit.changed_at.desc()).limit(100).all()
        return jsonify([e.as_dict() for e in entries]), 200
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500

@app.route('/api/admin/projects/<int:proj_id>', methods=['PATCH'])
@require_role('operator')
@require_csrf
def admin_update_project(proj_id):
    project = Project.query.get(proj_id)
    if not project:
        return jsonify({"status": "not found"}), 404
    project.status = request.json.get("status", project.status)
    db.session.commit()
    return jsonify({"status": "updated"})

@app.route('/api/admin/projects/<int:proj_id>', methods=['DELETE'])
@require_role('operator')
@require_csrf
def admin_delete_project(proj_id):
    project = Project.query.get(proj_id)
    if not project:
        return jsonify({"status": "not found"}), 404
    db.session.delete(project)
    db.session.commit()
    return jsonify({"status": "deleted"})

@app.route('/')
def home():
    return "VerityPass Launchpad API is running."


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200


@app.route('/metrics', methods=['GET'])
def metrics():
    try:
        data = generate_latest(_METRICS_REGISTRY)
        return data, 200, {'Content-Type': CONTENT_TYPE_LATEST}
    except Exception:
        return jsonify({'status': 'metrics_error'}), 500


# Development-only debug endpoint: list all registered routes for troubleshooting.
# Exposed only when not running in production to avoid information leakage.
if not _is_production:
    @app.route('/api/_debug/routes', methods=['GET'])
    def _debug_routes():
        try:
            routes = []
            for rule in app.url_map.iter_rules():
                routes.append({'rule': str(rule), 'methods': sorted(list(rule.methods))})
            return jsonify({'status': 'ok', 'routes': routes}), 200
        except Exception as e:
            return jsonify({'status': 'error', 'error': str(e)}), 500

if __name__ == '__main__':
    # When starting the server directly, enforce required environment variables
    # (this prevents accidental startup in production with missing secrets).
    try:
        enforce_required_envs_or_exit()
    except Exception:
        # If enforcement itself fails for some reason, print and continue to
        # allow local debugging; enforce_required_envs_or_exit will call sys.exit
        # when it needs to stop startup.
        pass
    app.run(debug=True)
