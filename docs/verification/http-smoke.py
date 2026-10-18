import urllib.request,urllib.error,json,uuid,subprocess,time
from pathlib import Path
server=subprocess.Popen(['node','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
def get(path):
 try:r=opener.open('http://127.0.0.1:3100'+path,timeout=3)
 except urllib.error.HTTPError as e:r=e
 return r.status,dict((k.lower(),v) for k,v in r.headers.items()),r.read().decode()
try:
 for attempt in range(60):
  try:get('/api/health');break
  except urllib.error.URLError:time.sleep(.2)
 else:raise RuntimeError('Server tidak siap')
 checks=[]
 status,headers,body=get('/')
 assert status==200 and '<html lang="id"' in body and 'Login dan pencatatan kegiatan belum tersedia' in body
 checks.append('Beranda200, bahasa Indonesia, status fitur jujur')
 assert headers['x-content-type-options']=='nosniff' and headers['x-frame-options']=='DENY' and headers['referrer-policy']=='no-referrer'
 checks.append('Header keamanan dasar pada halaman')
 status,headers,body=get('/kesiapan');assert status==200 and 'Status pengembangan' in body
 checks.append('Halaman kesiapan200')
 status,headers,body=get('/alamat-tidak-ada');assert status==404 and 'Halaman tidak ditemukan' in body
 checks.append('Halaman404 berbahasa Indonesia')
 status,headers,body=get('/api/health');data=json.loads(body)
 assert status==200 and data['ok'] and data['data']=={'service':'sim-guru','status':'alive','phase':'1.3'}
 assert uuid.UUID(data['requestId']) and headers['cache-control']=='no-store'
 checks.append('Health liveness200, UUID requestId, no-store')
 assert set(data['data'])=={'service','status','phase'}
 checks.append('Health tidak mengekspos URL/secret/hasil database')
 status,_,_=get('/login');assert status==404
 checks.append('Login belum dibuat tidak menampilkan form palsu')
 p=Path('docs/verification/http-smoke.json');p.write_text(json.dumps({'kind':'HTTP smoke on next start production build','result':'passed','checks':checks,'browser_qa':False,'database_integration':False},ensure_ascii=False,indent=2)+'\n')
 print({'http_checks':len(checks),'result':'passed'})
finally:
 server.terminate()
 try:server.communicate(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.communicate()
