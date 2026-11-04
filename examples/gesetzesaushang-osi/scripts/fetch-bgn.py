#!/usr/bin/env python3
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,urllib.request
ROOT=Path(__file__).resolve().parent.parent
BASE='https://www.bgn.de/praevention-arbeitshilfen/praxishilfen-service/vorschriften-und-arbeitssicherheitsinformationen/unfallverhuetungsvorschriften/'
FILES={'dguv1':'DGUV-Vorschrift-1.pdf','dguv2':'DGUV_Vorschrift_2.pdf','dguv3':'DGUV_Vorschrift_3-1.pdf'}
def download(it):
 name,file=it;p=ROOT/'dist/texts'/(name+'.pdf')
 if not p.exists():
  with urllib.request.urlopen(BASE+file,timeout=30) as r:raw=r.read()
  if not raw.startswith(b'%PDF-'):raise ValueError('No PDF: '+name)
  p.write_bytes(raw)
 return {'id':name,'source':BASE+file,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
if __name__=='__main__':
 entries=list(ThreadPoolExecutor(max_workers=3).map(download,FILES.items()))
 (ROOT/'dist/bgn-manifest.json').write_text(json.dumps(entries,indent=2))
 print('Verified BGN PDFs:',len(entries))
