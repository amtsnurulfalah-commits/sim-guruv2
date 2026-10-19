"""HTTPS production checks without creating an account, session or sending email."""
import datetime
import http.cookiejar
import json
import secrets
import urllib.error
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
BASE='https://sim-guruv2.vercel.app'
jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,method='GET',data=None,headers=None):
    req=urllib.request.Request(BASE+path,method=method,data=None if data is None else json.dumps(data).encode(),headers=headers or {})
    try:r=opener.open(req,timeout=25)
    except urllib.error.HTTPError as e:r=e
    return r.status,r.headers,r.read().decode()
def main():
    checks=[]
    status,_,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='1.5';checks.append('Health phase1.5 HTTPS200')
    for path,needle in [('/login','Lupa kata sandi?'),('/lupa-password','Pemulihan akun'),('/aktivasi','Aktivasi akun')]:
        status,_,body=request(path);assert status==200 and needle in body;checks.append(path+' HTTPS200')
    status,headers,body=request('/api/auth/csrf');assert status==200;csrf=json.loads(body)['data']['csrfToken'];assert 'Secure' in headers.get('Set-Cookie','');checks.append('CSRF cookie Secure')
    headers={'Origin':BASE,'Content-Type':'application/json','X-CSRF-Token':csrf}
    payload={'username':'probe.'+secrets.token_hex(12),'method':'email'}
    status,_,body=request('/api/auth/forgot-password','POST',payload,{**headers,'Origin':'https://invalid.example'});assert status==403;checks.append('Foreign Origin403')
    status,response_headers,body=request('/api/auth/forgot-password','POST',payload,headers);value=json.loads(body);assert status==200 and value['data']['accepted'] is True and response_headers['Cache-Control']=='no-store';challenge=value['data']['challengeId'];checks.append('Unknown username generic recovery200 through database')
    status,_,body=request('/api/auth/reset-otp','POST',{'challengeId':challenge,'otp':'000000'},headers);assert status==422 and json.loads(body)['error']['code']=='CHALLENGE_INVALID';checks.append('Unknown OTP challenge422')
    status,_,body=request('/api/auth/profile');assert status==401;checks.append('Anonymous profile401')
    status,_,body=request('/api/auth/admin-recovery');assert status==401;checks.append('Anonymous admin recovery401')
    status,_,body=request('/api/auth/reset-password','POST',{'challengeId':challenge,'token':secrets.token_urlsafe(32),'newPassword':'Synthetic9!Value','confirmation':'Synthetic9!Value'},headers);assert status==422 and json.loads(body)['error']['code']=='CHALLENGE_INVALID';checks.append('Forged reset capability422')
    status,_,body=request('/api/auth/activation');assert status==405;checks.append('Activation GET405, cannot consume link via GET')
    report={'verifiedAt':datetime.datetime.now(ZoneInfo('Asia/Jakarta')).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'createsAppUser':False,'createsSession':False,'sendsEmail':False,'writesRateCounters':True,'browserInteractive':False}
    Path('docs/verification/stage-1.5-production-smoke.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':
    try:main()
    except Exception:print(json.dumps({'ok':False,'code':'STAGE_1_5_PRODUCTION_SMOKE_FAILED'}));raise SystemExit(1)
