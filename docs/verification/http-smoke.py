"""Smoke production build tanpa database; proses server dan client pada namespace yang sama."""
import urllib.request, urllib.error, json, uuid, subprocess, time, os
from pathlib import Path
base='http://127.0.0.1:3100'
origin='https://127.0.0.1:3100'
env=dict(os.environ,APP_URL=origin,APP_TIMEZONE='Asia/Jakarta',SESSION_SECRET='s'*48,AUTH_CHALLENGE_HMAC_SECRET='h'*48,AUTH_OUTBOX_ENCRYPTION_KEY='a'*64)
# Tidak memberi URL database; handler auth wajib fail closed dan tidak membocorkan konfigurasi.
env.pop('DATABASE_URL',None);env.pop('AUTH_DATABASE_URL',None)
server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def request(path,method='GET',data=None,headers=None):
 req=urllib.request.Request(base+path,data=data,method=method,headers=headers or {})
 try:r=opener.open(req,timeout=10)
 except urllib.error.HTTPError as e:r=e
 return r.status,dict((k.lower(),v) for k,v in r.headers.items()),r.read().decode()
try:
 for attempt in range(60):
  try:request('/api/health');break
  except urllib.error.URLError:time.sleep(.2)
 else:raise RuntimeError('Server tidak siap')
 checks=[]
 status,headers,body=request('/')
 assert status==200 and '<html lang="id"' in body and 'Administrasi tertata.' in body
 checks.append('Beranda200, bahasa Indonesia, status fitur jujur')
 assert headers['x-content-type-options']=='nosniff' and headers['x-frame-options']=='DENY' and headers['referrer-policy']=='no-referrer'
 checks.append('Header keamanan dasar')
 status,_,body=request('/kesiapan');assert status==200 and 'Status pengembangan' in body;checks.append('Kesiapan200')
 status,_,body=request('/alamat-tidak-ada');assert status==404 and 'Halaman tidak ditemukan' in body;checks.append('404 Indonesia')
 status,headers,body=request('/api/health');data=json.loads(body)
 assert status==200 and data['ok'] and data['data']=={'service':'sim-guru','status':'alive','phase':'8.5'}
 assert uuid.UUID(data['requestId']) and headers['cache-control']=='no-store';checks.append('Liveness200 no-store, phase8.5')
 status,headers,body=request('/login');assert status==200 and 'Username' in body and 'current-password' in body;checks.append('Login200 form nyata dan password autocomplete')
 status,_,body=request('/akun');assert status==200 and ('Masuk ke SiM-Guru' in body or 'NEXT_REDIRECT;replace;/login;307;' in body);checks.append('Akun anonim redirect login, termasuk streaming redirect Next.js')
 status,headers,body=request('/api/auth/csrf');csrf=json.loads(body)['data']['csrfToken'];cookie=headers['set-cookie'].split(';')[0]
 assert status==200 and 'HttpOnly' in headers['set-cookie'] and 'Secure' in headers['set-cookie'] and headers['cache-control']=='no-store';checks.append('Prelogin CSRF dan secure cookie tanpa database')
 assert request('/api/auth/login','POST',b'{}',{'Origin':'https://evil.example','Content-Type':'application/json'})[0]==403;checks.append('Origin jahat403')
 assert request('/api/auth/login','POST',b'{}',{'Origin':origin,'Content-Type':'application/json'})[0]==403;checks.append('CSRF hilang403')
 status,_,body=request('/api/auth/login','POST',b'{"username":"operator","password":"Synthetic9!"}',{'Origin':origin,'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':csrf})
 assert status==503 and json.loads(body)['error']['code']=='UNAVAILABLE' and 'postgresql' not in body;checks.append('Database belum ada fail closed503 tanpa rahasia')
 assert request('/api/auth/logout')[0]==405;checks.append('Logout GET ditolak405')
 report={'kind':'HTTP smoke against next start production build','phase':'8.5','result':'passed','checks':checks,'browser_qa':False,'database_integration':False}
 Path('docs/verification/http-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print({'http_checks':len(checks),'result':'passed'})
finally:
 server.terminate()
 try:output=server.communicate(timeout=5)[0];Path('/tmp/simguru-smoke-server.log').write_bytes(output)
 except subprocess.TimeoutExpired:server.kill();server.communicate()
