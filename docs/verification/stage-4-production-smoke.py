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
 if path=='/api/health':assert json.loads(body)['data']['phase']=='4.4'
 if '/api/' in path:assert r.headers.get('Cache-Control')=='no-store'
 result={'path':path,'method':method,'status':status,'ok':True};print(json.dumps(result),flush=True);return result
items=[('/api/health','GET',200),('/api/duties/board','GET',401),('/api/duties/preview','POST',403),('/api/duties/commit','POST',403),('/api/duties/schedule','POST',403),('/api/activities/attendance?from=2026-10-01&to=2026-10-20','GET',401),('/piket','GET','login'),('/upacara','GET','login'),('/admin/piket','GET','login'),('/admin/upacara','GET','login')]
with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(check,items))
Path('docs/verification/stage-4-production-smoke.json').write_text(json.dumps({'ok':True,'baseUrl':BASE,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checks':results,'usesProductionCredentials':False,'changesDomainData':False,'sendsEmail':False},indent=2)+'\n')
