"""Read-only HTTPS checks; does not use admin credentials or modify master data."""
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
 def record(value):checks.append(value);print(json.dumps({'ok':True,'check':value}),flush=True)
 status,_,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='2.2';record('Health HTTPS phase2.2')
 status,_,body=request('/kesiapan');assert status==200 and 'Data master' in body and 'Tersedia' in body;record('Public master module availability200')
 def check_group(group):
  status,headers,body=request('/api/settings/'+group);assert status==401 and headers['Cache-Control']=='no-store' and json.loads(body)['error']['code']=='UNAUTHENTICATED';record(group+' anonymous401 no-store')
 with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(check_group,['school','academic-years','academic-periods','classes','subjects','rates','allowances']))
 status,_,_=request('/api/settings/subjects/history/00000000-0000-4000-8000-000000000001');assert status==401;record('History anonymous401')
 for method in ['POST','PATCH','DELETE']:
  status,_,_=request('/api/settings/subjects',method,{'Origin':BASE,'Content-Type':'application/json'},b'{}');assert status==403;record(method+' without session CSRF403')
 status,_,_=request('/api/settings/rates',headers={'Origin':'https://invalid.example'});assert status==403;record('Cross-origin403')
 for path in ['/admin/master','/modul/master']:
  status,headers,body=request(path);assert (status in [307,308] and '/login' in headers.get('Location','')) or (status==200 and '/login' in body and ('NEXT_REDIRECT' in body or 'http-equiv="refresh"' in body));assert 'master-editor-title' not in body;record(path+' anonymous login redirect')
 report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'changesMasterData':False,'usesAdminCredentials':False,'authenticatedBrowserCRUD':False}
 Path('docs/verification/stage-2.2-production-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'ok':False,'code':'STAGE_2_2_SMOKE_FAILED'}));raise SystemExit(1)
