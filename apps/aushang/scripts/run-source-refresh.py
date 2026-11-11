#!/usr/bin/env python3
"""Fetch only approved official sources and stage a complete, verified legal collection.
Read the existing supported Site service credential from hidden stdin. Never log it.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import base64,hashlib,io,json,sys,urllib.request,urllib.error,zipfile
BASE='https://gesetzesaushang-osi-demo.umitdrmz22.chatgpt.site'
ROOT=Path(__file__).resolve().parent.parent
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
try:
 import termios
 a=termios.tcgetattr(sys.stdin);a[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin,termios.TCSANOW,a)
except Exception:pass
print('Ready for Site service access JSON on stdin (input hidden).',flush=True)
credentials=json.loads(sys.stdin.readline());token=credentials.get('token','')
if not isinstance(token,str) or len(token)<24:raise SystemExit('Supported service credential missing.')
def call(action,**values):
 request=urllib.request.Request(BASE+'/api/maintenance',data=json.dumps({'action':action,**values}).encode(),method='POST',headers={'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+token,'X-Aushang-Service-Key':token})
 try:
  with urllib.request.build_opener(NoRedirect).open(request,timeout=100) as response:result=json.loads(response.read())
 except urllib.error.HTTPError as e:
  try:message=json.loads(e.read()).get('error','HTTP '+str(e.code))
  except Exception:message='HTTP '+str(e.code)
  raise RuntimeError(message) from None
 if result.get('error'):raise RuntimeError(result['error'])
 return result

def source(item):
 url=item['url']
 allowed=url.startswith('https://www.gesetze-im-internet.de/') or url.startswith('https://www.bgn.de/praevention-arbeitshilfen/praxishilfen-service/vorschriften-und-arbeitssicherheitsinformationen/unfallverhuetungsvorschriften/')
 if not allowed:raise RuntimeError('Source host is not approved.')
 req=urllib.request.Request(url,headers={'User-Agent':'aushang-source-refresh/1.0'})
 try:
  with urllib.request.build_opener(NoRedirect).open(req,timeout=35) as r:data=r.read(3_000_001)
 except Exception as e:raise RuntimeError(item['id']+': '+str(e)) from None
 if len(data)>3_000_000:raise RuntimeError(item['id']+': source file too large')
 if item.get('xml'):
  with zipfile.ZipFile(io.BytesIO(data)) as z:
   info=z.getinfo(item['xml'])
   if info.file_size>18_000_000:raise RuntimeError('XML exceeds size limit')
   hash_value=hashlib.sha256(z.read(info)).hexdigest()
 else:
  if not data.startswith(b'%PDF-'):raise RuntimeError(item['id']+': invalid PDF')
  hash_value=hashlib.sha256(data).hexdigest()
 return {**item,'data':base64.b64encode(data).decode(),'hash':hash_value}
try:
 before=call('status')
 if '--check' in sys.argv:print(json.dumps({'verifiedServiceAccess':True,'status':before}),flush=True);raise SystemExit(0)
 if '--diagnose' in sys.argv:print(json.dumps(before),flush=True);raise SystemExit(0)
 collection=json.loads((ROOT/'legal/collection.json').read_text())
 groups=['Aushang & Bekanntmachung','Weitere Arbeitsgesetze','Arbeitsschutz & Prävention','Branchenspecifische Texte','BGN · Unfallverhütung']
 # The order is identical to scripts/prepare-assets.mjs and the server catalog.
 groups[3]='Branchenspezifische Texte'
 collection.sort(key=lambda x:groups.index(x['group']))
 manifest={s['id']:s for s in json.loads((ROOT/'legal/source-manifest.json').read_text())['sources']}
 items=[{'id':s['id'],'url':'https://www.gesetze-im-internet.de/'+s['slug']+'/xml.zip','xml':manifest[s['id']]['sourceFile']} for s in collection]
 items.extend({'id':s['id'],'url':s['source']} for s in sorted(json.loads((ROOT/'legal/bgn-manifest.json').read_text()),key=lambda s:s['id']))
 print('Fetching '+str(len(items))+' approved official source files.',flush=True)
 with ThreadPoolExecutor(max_workers=4) as pool:prepared=list(pool.map(source,items))
 run=call('begin');run_id=run['runId'];cursor=run['cursor'];print('Update started: '+run_id,flush=True)
 for item in prepared[cursor:]:
  result=call('stage',runId=run_id,lawId=item['id'],data=item['data'])
  if result.get('sourceHash')!=item['hash']:raise RuntimeError('Readback hash mismatch for '+item['id'])
  print(json.dumps({'checked':result['cursor'],'total':result['total'],'source':item['id']}),flush=True)
  cursor=result['cursor']
 if cursor!=len(prepared):raise RuntimeError('Not all source files were processed.')
 call('publish',runId=run_id);verified=call('status')
 if verified.get('activeRun')!=run_id or verified.get('lastSuccessfulCheck')==before.get('lastSuccessfulCheck'):raise RuntimeError('Published version could not be verified.')
 print(json.dumps({'success':True,'activeRun':verified['activeRun'],'lastSuccessfulCheck':verified['lastSuccessfulCheck'],'total':verified['total']}),flush=True)
except Exception as e:print('Update failed; previous complete version stays active: '+str(e),file=sys.stderr);raise SystemExit(1)
