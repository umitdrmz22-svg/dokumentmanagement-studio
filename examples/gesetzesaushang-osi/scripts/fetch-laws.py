#!/usr/bin/env python3
"""Build readable legal texts from the official Gesetze-im-Internet XML files.
No publisher commentary or commercially edited text is copied.
Run manually, inspect resulting source/version diffs, then commit the changes.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import argparse, datetime, hashlib, html, io, json, re, urllib.request, zipfile
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent
COLLECTION=json.loads((ROOT/'scripts/collection.json').read_text())
OUT=ROOT/'dist/texts';OUT.mkdir(parents=True,exist_ok=True)
TODAY=datetime.date.today().isoformat()

def text(e):return ''.join(e.itertext()).strip() if e is not None else ''
def render(e):
 if e is None:return ''
 tag=e.tag.split('}')[-1].lower()
 if tag=='img':return '<span class="law-image-note">[Grafik in der amtlichen PDF-Fassung]</span>'
 if tag=='br':return '<br>'
 # Preserve visible text; ignore source attributes, scripts and external resources.
 tags={'p':'div','dl':'dl','dt':'dt','dd':'dd','la':'div','table':'table','tgroup':'tbody','thead':'thead','tbody':'tbody','row':'tr','entry':'td','tr':'tr','td':'td','th':'th','sup':'sup','sub':'sub','pre':'pre','b':'strong','i':'em','u':'u','strong':'strong','em':'em','li':'li','ul':'ul','ol':'ol'}
 inside=html.escape(e.text or '')+''.join(render(c)+html.escape(c.tail or '') for c in e)
 if tag in ['script','style']:return ''
 if tag in tags:
  t=tags[tag];return f'<{t}>{inside}</{t}>'
 return inside

def fetch(item):
 target=OUT/(item['id']+'.json')
 if target.exists() and not args.refresh:return json.loads(target.read_text())['source']
 base='https://www.gesetze-im-internet.de/'+item['slug']+'/'
 req=urllib.request.Request(base+'xml.zip',headers={'User-Agent':'Aushang-Demo/1.0 (manual legal text snapshot)'})
 with urllib.request.urlopen(req,timeout=30) as response:raw=response.read()
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  name=next(n for n in z.namelist() if n.endswith('.xml')); xml=z.read(name)
 root=ET.fromstring(xml); norms=root.findall('norm'); meta=norms[0].find('metadaten')
 fullTitle=text(meta.find('langue'));abbr=text(meta.find('amtabk')) or text(meta.find('jurabk'))
 versions=[' '.join(text(c) for c in x) for x in meta.findall('standangabe')]
 sections=[];selected=item.get('select')
 for i,n in enumerate(norms):
  m=n.find('metadaten');en=text(m.find('enbez'));title=text(m.find('titel'));group=m.find('gliederungseinheit')
  if selected and en not in selected:continue
  if group is not None:
   heading=' · '.join(filter(None,[text(group.find('gliederungsbez')),text(group.find('gliederungstitel'))]))
   if heading:sections.append({'id':f'g{i}','kind':'heading','label':heading,'html':''})
   continue
  content=n.find('textdaten/text/Content');notes=n.find('textdaten/fussnoten/Content')
  body=render(content);foot=render(notes)
  if not body and not foot:continue
  label=' '.join(filter(None,[en,title])) or ('Hinweise und Textnachweis' if i==0 else f'Bestimmung {i}')
  sections.append({'id':f'n{i}','kind':'norm','label':label,'html':body,'notes':foot})
 if selected:
  present=[text(n.find('metadaten/enbez')) for n in norms]
  missing=set(selected)-set(present)
  if missing:raise ValueError(f'{item["id"]}: Missing requested sections: {missing}')
 source={'id':item['id'],'url':base,'xmlUrl':base+'xml.zip','sourceFile':name,'sha256':hashlib.sha256(xml).hexdigest(),'retrieved':TODAY,'sourceBuildDate':root.attrib.get('builddate'),'version':versions,'fullTitle':fullTitle,'abbreviation':abbr,'excerpt':selected or None}
 result={'source':source,'sections':sections,'hasGraphics':any(e.tag.lower()=='img' for e in root.iter())}
 # Keep official PDF accessible for authoritative page layout, complex tables and graphics.
 with urllib.request.urlopen(base,timeout=30) as r:index=r.read().decode('iso-8859-1')
 pdf=re.search(r'href="([^\"]+\.pdf)"',index,re.I)
 source['pdfUrl']=base+pdf.group(1) if pdf else None
 target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 return source

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--refresh',action='store_true',help='Fetch all sources again; inspect version diffs before publishing.');args=parser.parse_args()
 sources=[];errors=[]
 with ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(fetch,it):it for it in COLLECTION}
  for f in as_completed(futures):
   it=futures[f]
   try:
    s=f.result();sources.append(s);print('OK',it['id'],flush=True)
   except Exception as e:errors.append((it['id'],str(e)));print('ERROR',it['id'],str(e),flush=True)
 sources.sort(key=lambda s:next(i for i,x in enumerate(COLLECTION) if x['id']==s['id']))
 (ROOT/'dist/source-manifest.json').write_text(json.dumps({'retrieved':TODAY,'sources':sources},ensure_ascii=False,indent=2))
 (ROOT/'dist/collection.js').write_text('window.AUSHANG_COLLECTION = '+json.dumps(COLLECTION,ensure_ascii=False,separators=(',',':'))+';\n')
 print(f'{len(sources)} sources; {len(errors)} errors.',flush=True)
 if errors:raise SystemExit(1)
