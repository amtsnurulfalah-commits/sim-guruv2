"""Read-only HTTP guards: no user credentials, OTP requests, or email sends."""
import json,datetime,urllib.request,urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
BASE='https://sim-guruv2.vercel.app'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
opener=urllib.request.build_opener(NoRedirect)
def request(path,method='GET',origin=None):
 headers={'Origin':origin or BASE,'Content-Type':'application/json'}
 try:r=opener.open(urllib.request.Request(BASE+path,method=method,headers=headers,data=b'{}' if method=='POST' else None),timeout=30)
 except urllib.error.HTTPError as e:r=e
 return r.status,r.headers,r.read().decode()
def main():
 checks=[]
 def record(x):checks.append(x);print(json.dumps({'ok':True,'check':x}),flush=True)
 status,headers,body=request('/api/health');assert status==200 and json.loads(body)['data']['phase']=='2.4';record('health200 phase2.4')
 status,headers,_=request('/api/auth/csrf');assert status==200 and headers['Cache-Control']=='no-store';record('prelogin csrf200 no-store')
 def guard(item):
  path,method,expected=item;s,h,_=request(path,method);assert s==expected and h['Cache-Control']=='no-store';record(path+' '+method+' '+str(s)+' no-store')
 with ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(guard,[('/api/auth/profile','GET',401),('/api/auth/email-request','POST',403),('/api/auth/email-verify','POST',403),('/api/auth/change-password','POST',403)]))
 status,_,_=request('/api/auth/csrf',origin='https://invalid.example');assert status==403;record('cross-origin csrf403')
 status,h,b=request('/akun');assert (status in [307,308] and '/login' in h.get('Location','')) or(status==200 and '/login' in b and ('NEXT_REDIRECT' in b or 'http-equiv="refresh"' in b));record('akun anonymous login redirect')
 report=dict(ok=True,checks=checks,baseUrl=BASE,verifiedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),usesUserCredentials=False,changesDomainData=False,sendsEmail=False,realInboxDeliveryVerified=False)
 Path('docs/verification/otp-fix-production-smoke.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'ok':True,'checks':len(checks)}))
if __name__=='__main__':main()
