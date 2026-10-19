"""Production shell and access checks, without an app account or business writes."""
import datetime,json,urllib.request,urllib.error
from pathlib import Path
from zoneinfo import ZoneInfo
BASE='https://sim-guruv2.vercel.app'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
opener=urllib.request.build_opener(NoRedirect)
def request(path,headers=None):
 try:r=opener.open(urllib.request.Request(BASE+path,headers=headers or {}),timeout=25)
 except urllib.error.HTTPError as e:r=e
 return r.status,r.headers,r.read().decode()
def main():
 checks=[]
 status,_,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='1.6';checks.append('Health phase1.6 HTTPS200')
 status,_,body=request('/kesiapan');assert status==200 and 'Status pengembangan' in body and 'Ciutkan sidebar' in body and 'Buka navigasi' in body and 'Belum tersedia' in body;checks.append('Public status shell200, accessible sidebar controls and module states')
 status,_,body=request('/login');assert status==200 and 'current-password' in body;checks.append('Login form200')
 for path in ['/dashboard','/akun','/modul/jadwal','/modul/pengguna','/admin/pemulihan']:
  status,headers,body=request(path)
  assert (status in [307,308] and '/login' in headers.get('Location','')) or (status==200 and '/login' in body and ('NEXT_REDIRECT' in body or 'http-equiv="refresh"' in body))
  assert 'Selamat datang,' not in body
  checks.append(path+' anonymous redirect, no protected dashboard body')
 status,headers,body=request('/api/dashboard?role=admin&actorId=00000000-0000-0000-0000-000000000001');assert status==401 and json.loads(body)['error']['code']=='UNAUTHENTICATED' and headers['Cache-Control']=='no-store';checks.append('Anonymous/forged role dashboard API401 no-store')
 status,_,body=request('/api/dashboard',{'Origin':'https://invalid.example'});assert status==403;checks.append('Cross-origin dashboard API403')
 report={'verifiedAt':datetime.datetime.now(ZoneInfo('Asia/Jakarta')).isoformat(),'baseUrl':BASE,'ok':True,'checks':checks,'createsAppUser':False,'createsSession':False,'writesBusinessData':False,'browserInteractive':False}
 Path('docs/verification/stage-1.6-production-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'ok':False,'code':'STAGE_1_6_SMOKE_FAILED'}));raise SystemExit(1)
