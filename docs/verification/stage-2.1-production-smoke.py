"""Read-only production checks; does not create users, sessions or send email."""
import datetime,json,urllib.request,urllib.error
from pathlib import Path
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
 class Checks(list):
  def append(self,value):
   super().append(value);print(json.dumps({'check':value,'ok':True}),flush=True)
 checks=Checks()
 status,_,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='2.1';checks.append('Health HTTPS phase2.1')
 status,_,body=request('/kesiapan');assert status==200 and 'Tersedia' in body and 'pengguna' in body.lower();checks.append('Public module availability200')
 for path in ['/api/users','/api/users/00000000-0000-4000-8000-000000000001','/api/users/reset-requests','/api/users?role=admin&actorId=00000000-0000-4000-8000-000000000001']:
  status,headers,body=request(path);assert status==401 and headers['Cache-Control']=='no-store' and json.loads(body)['error']['code']=='UNAUTHENTICATED';checks.append(path+' anonymous401 no-store')
 for path,method in [('/api/users','POST'),('/api/users/00000000-0000-4000-8000-000000000001','PATCH'),('/api/users/00000000-0000-4000-8000-000000000001','DELETE'),('/api/users/reset-requests','POST')]:
  status,_,_=request(path,method,{'Origin':BASE,'Content-Type':'application/json'},b'{}');assert status==403;checks.append(path+' '+method+' without session CSRF403')
 status,_,_=request('/api/users',headers={'Origin':'https://invalid.example'});assert status==403;checks.append('Cross-origin read403')
 for path in ['/admin/pengguna','/modul/pengguna','/admin/pemulihan']:
  status,headers,body=request(path);assert (status in [307,308] and '/login' in headers.get('Location','')) or (status==200 and '/login' in body and ('NEXT_REDIRECT' in body or 'http-equiv="refresh"' in body));assert 'user-editor-title' not in body;checks.append(path+' anonymous login redirect')
 report={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'appUsersCreated':False,'emailsSent':False,'authenticatedBrowserCRUD':False}
 Path('docs/verification/stage-2.1-production-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'ok':False,'code':'STAGE_2_1_SMOKE_FAILED'}));raise SystemExit(1)
