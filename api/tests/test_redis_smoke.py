import os
import pytest


@pytest.mark.skipif('REDIS_URL' not in os.environ, reason='REDIS_URL not configured')
def test_redis_ping_and_set_get():
    import redis
    url = os.environ['REDIS_URL']
    r = redis.from_url(url)
    try:
        r.ping()
    except Exception as e:
        pytest.skip(f"Redis not available: {e}")
    # set/get
    key = 'realmint_smoke_test_key'
    r.set(key, 'ok')
    assert r.get(key).decode('utf-8') == 'ok'
    r.delete(key)
