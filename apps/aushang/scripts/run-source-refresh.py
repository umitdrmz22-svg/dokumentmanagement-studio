#!/usr/bin/env python3
"""Refresh only the public legal sources. Read supported Site service access from stdin.
Use the exact current get_site.siwc_bypass_bearer_token for this project; never log it.
"""
import json,sys,urllib.request,urllib.error
BASE='https://gesetzesaushang-osi-demo.umitdrmz22.chatgpt.site'
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
try:
 import termios
 a=termios.tcgetattr(sys.stdin);a[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,a)
except Exception:pass
print('Ready for Site service access JSON on stdin (input hidden).',flush=True)
credentials=json.loads(sys.stdin.readline());token=credentials.get('token','')
if not isinstance(token,str) or len(token)<24:raise SystemExit('Supported service credential missing.')
opener=urllib.request.build_opener(NoRedirect)
def call(action,run_id=None):
 payload={'action':action}
 if run_id:payload['runId']=run_id
 request=urllib.request.Request(BASE+'/api/maintenance',data=json.dumps(payload).encode(),method='POST',headers={'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+token,'X-Aushang-Service-Key':token})
 try:
  response=opener.open(request,timeout=100);result=json.loads(response.read())
 except urllib.error.HTTPError as e:
  try:message=json.loads(e.read()).get('error','HTTP '+str(e.code))
  except Exception:message='HTTP '+str(e.code)
  raise RuntimeError(message) from None
 if result.get('error'):raise RuntimeError(result['error'])
 return result
try:
 before=call('status')
 if '--check' in sys.argv:
  print(json.dumps({'verifiedServiceAccess':True,'status':before}),flush=True);raise SystemExit(0)
 run=call('begin');run_id=run['runId'];print('Update started: '+run_id,flush=True)
 for _ in range(30):
  result=call('continue',run_id);print(json.dumps({'status':result.get('status'),'checked':result.get('cursor'),'total':result.get('total')}),flush=True)
  if result.get('status')!='running':raise RuntimeError('Update did not remain active; previous version retained.')
  if result.get('readyToPublish'):break
 else:raise RuntimeError('Update did not finish within the bounded number of batches.')
 published=call('publish',run_id);verified=call('status')
 if verified.get('activeRun')!=run_id or verified.get('lastSuccessfulCheck')==before.get('lastSuccessfulCheck'):raise RuntimeError('Published version could not be verified.')
 print(json.dumps({'success':True,'activeRun':verified['activeRun'],'lastSuccessfulCheck':verified['lastSuccessfulCheck'],'total':verified['total']}),flush=True)
except RuntimeError as e:print('Update failed; previous complete version stays active: '+str(e),file=sys.stderr);raise SystemExit(1)
