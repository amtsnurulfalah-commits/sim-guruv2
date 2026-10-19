"""Read-only production checks without admin credentials or writes to domain data."""
import datetime,json,urllib.request,urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
BASE='https://sim-guruv2.vercel.app'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect)
def request(path,method='GET',headers=None,data=None):
 try:r=opener.open(urllib.request.Request(BASE+path,method=method,headers=headers or {},data=data),timeout=30)
 except urllib.error.HTTPError as e:r=e
 return r.status,r.headers,r.read().decode()
def main():
 checks=[]
 def record(v):checks.append(v);print(json.dumps({'ok':True,'check':v}),flush=True)
 status,_,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='2.3';record('Health phase2.3 HTTPS200')
 status,_,body=request('/kesiapan');assert status==200 and 'Kalender akademik' in body and 'Tersedia' in body;record('Public calendar availability200')
 def read(path):
  status,headers,body=request(path);assert status==401 and headers['Cache-Control']=='no-store' and json.loads(body)['error']['code']=='UNAUTHENTICATED';record(path+' anonymous401 no-store')
 with ThreadPoolExecutor(max_workers=4) as p:list(p.map(read,['/api/settings/calendar?dateStart=2026-10-01&dateEnd=2026-10-31','/api/settings/day-context?date=2026-10-19','/api/day-context?date=2026-10-19','/api/settings/calendar/history?kind=calendar&date=2026-10-19','/api/dashboard']))
 def mutation(pair):
  path,method=pair;status,_,_=request(path,method,{'Origin':BASE,'Content-Type':'application/json'},b'{}');assert status==403;record(path+' '+method+' without CSRF403')
 with ThreadPoolExecutor(max_workers=4) as p:list(p.map(mutation,[('/api/settings/calendar/preview','POST'),('/api/settings/day-context/preview','POST'),('/api/settings/day-context/commit','POST'),('/api/settings/calendar/range','POST'),('/api/settings/calendar','POST'),('/api/settings/calendar','PATCH'),('/api/settings/calendar','DELETE')]))
 status,_,_=request('/api/day-context?date=2026-10-19',headers={'Origin':'https://invalid.example'});assert status==403;record('Cross-origin day context403')
 for path in ['/admin/kalender','/modul/kalender']:
  status,h,b=request(path);assert (status in [307,308] and '/login' in h.get('Location','')) or(status==200 and '/login' in b and('NEXT_REDIRECT' in b or 'http-equiv="refresh"' in b));assert 'calendar-preview-title' not in b;record(path+' anonymous login redirect')
 report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'usesAdminCredentials':False,'changesDomainData':False,'authenticatedBrowserCRUD':False}
 Path('docs/verification/stage-2.3-production-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'ok':False,'code':'STAGE_2_3_SMOKE_FAILED'}));raise SystemExit(1)
