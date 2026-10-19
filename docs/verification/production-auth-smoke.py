"""Pemeriksaan HTTPS aplikasi produksi tanpa membuat akun atau sesi pengguna."""
import datetime
import http.cookiejar
import json
import secrets
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = 'https://sim-guruv2.vercel.app'
ORIGIN = BASE
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def request(path, method='GET', data=None, headers=None):
    req = urllib.request.Request(BASE+path, method=method, data=data, headers=headers or {})
    try:
        response = opener.open(req, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    body = response.read().decode()
    return response.status, response.headers, body

def main():
    checks = []
    status, _, body = request('/api/health')
    assert status == 200 and json.loads(body)['data']['phase'] == '1.4'
    checks.append('Health HTTPS200 fase1.4')
    status, headers, body = request('/api/auth/csrf')
    assert status == 200 and headers['Cache-Control'] == 'no-store'
    cookie = headers.get('Set-Cookie', '')
    assert 'Secure' in cookie and 'HttpOnly' in cookie
    csrf = json.loads(body)['data']['csrfToken']
    checks.append('CSRF production200 dan cookie Secure/HttpOnly')
    payload = json.dumps({'username': 'probe.'+secrets.token_hex(12), 'password': 'Synthetic9!'+secrets.token_urlsafe(24)}).encode()
    status, _, body = request('/api/auth/login', 'POST', payload, {'Origin':'https://invalid.example','Content-Type':'application/json','X-CSRF-Token':csrf})
    assert status == 403 and json.loads(body)['error']['code'] == 'FORBIDDEN'
    checks.append('Origin asing ditolak403')
    status, _, body = request('/api/auth/login', 'POST', payload, {'Origin':ORIGIN,'Content-Type':'application/json','X-CSRF-Token':csrf})
    result = json.loads(body)
    if status != 401 or result.get('error',{}).get('code') != 'INVALID_CREDENTIALS':
        print(json.dumps({'stage':'login-database','status':status,'code':result.get('error',{}).get('code')}))
        raise AssertionError('AUTH_DATABASE_RUNTIME_NOT_VERIFIED')
    checks.append('Username acak ditolak401 melalui fungsi Vercel dan database auth')
    assert not any(cookie.name == '__Host-sim_guru_session' for cookie in jar)
    checks.append('Login gagal tidak menerbitkan cookie sesi')
    status, _, body = request('/api/auth/session')
    assert status == 401 and json.loads(body)['error']['code'] == 'UNAUTHENTICATED'
    checks.append('Sesi anonim ditolak401')
    status, _, body = request('/login')
    assert status == 200 and 'current-password' in body
    checks.append('Halaman login HTTPS200')
    report = {'kind':'HTTPS production auth smoke, bukan browser interaktif','verifiedAt':datetime.datetime.now(ZoneInfo('Asia/Jakarta')).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'createsAppUser':False,'createsSession':False,'writesFailureAuditAndRateCounters':True,'loginFailureRequestId':result['requestId']}
    Path('docs/verification/production-auth-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'ok':True,'checks':len(checks),'createsAppUser':False}))

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'ok':False,'code':'PRODUCTION_AUTH_SMOKE_FAILED'}))
        raise SystemExit(1)
