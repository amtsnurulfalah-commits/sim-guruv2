"""Read-only public guards; no user credentials, domain writes or email sends."""
import urllib.request, urllib.error, json, datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
BASE='https://sim-guruv2.vercel.app'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect)
def check(item):
 path,method,expected=item
 request=urllib.request.Request(BASE+path,method=method,headers={'Origin':BASE,'Content-Type':'application/json'},data=b'{}' if method=='POST' else None)
 try:r=opener.open(request,timeout=40)
 except urllib.error.HTTPError as e:r=e
 body=r.read().decode();status=r.status
 if expected=='login':assert(status in [307,308] and '/login' in r.headers.get('Location',''))or(status==200 and '/login' in body and ('NEXT_REDIRECT' in body or 'http-equiv="refresh"' in body))
 else:assert status==expected,(path,status)
 if path=='/api/health':assert json.loads(body)['data']['phase']=='6.5'
 if '/api/' in path:assert r.headers.get('Cache-Control')=='no-store'
 result={'path':path,'method':method,'status':status,'ok':True};print(json.dumps(result),flush=True);return result
items=[('/api/health', 'GET', 200), ('/api/honorarium/read?kind=estimate&period=2026-10', 'GET', 401), ('/api/honorarium/read?kind=recap&period=2026-10', 'GET', 401), ('/api/honorarium/read?kind=history&period=2026-10', 'GET', 401), ('/api/honorarium/read?kind=statement&period=2026-10', 'GET', 401), ('/api/honorarium/read?kind=operations&period=2026-10', 'GET', 401), ('/api/honorarium/pdf', 'GET', 401), ('/api/honorarium/excel', 'GET', 401), ('/api/honorarium/preview', 'POST', 403), ('/api/honorarium/commit', 'POST', 403), ('/api/honorarium/holiday', 'POST', 403), ('/api/honorarium/block', 'POST', 403), ('/api/honorarium/request', 'POST', 403), ('/api/honorarium/token', 'POST', 403), ('/api/honorarium/pdf', 'POST', 403), ('/api/honorarium/verify', 'POST', 422), ('/honorarium', 'GET', 'login'), ('/honorarium/riwayat', 'GET', 'login'), ('/admin/honorarium', 'GET', 'login'), ('/admin/honorarium/riwayat', 'GET', 'login'), ('/admin/honorarium/operasi', 'GET', 'login'), ('/verifikasi-dokumen', 'GET', 200)]
with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(check,items))
Path('docs/verification/stage-6-production-smoke.json').write_text(json.dumps({'ok':True,'baseUrl':BASE,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':results,'usesProductionCredentials':False,'changesDomainData':False,'sendsEmail':False},indent=2)+'\n')
