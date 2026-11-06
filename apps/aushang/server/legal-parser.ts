import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { unzipSync,strFromU8 } from 'fflate';
import { digest } from './security';
const xmlParser=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'@_',trimValues:false,parseTagValue:false,processEntities:true,allowBooleanAttributes:true});
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function children(node:any,key:string):any[]{return node?.[key]||[];}
function find(nodes:any[],name:string):any|undefined{return nodes?.find(n=>Object.hasOwn(n,name));}
function allText(nodes:any[]):string{return (nodes||[]).map(n=>Object.entries(n).filter(([k])=>k!==':@').map(([k,v])=>k==='#text'?String(v):Array.isArray(v)?allText(v):'').join('')).join('');}
function value(nodes:any[],key:string){return allText(children(find(nodes,key),key)).trim();}
const allowed:Record<string,string>={p:'div',dl:'dl',dt:'dt',dd:'dd',la:'div',table:'table',tgroup:'tbody',thead:'thead',tbody:'tbody',row:'tr',entry:'td',tr:'tr',td:'td',th:'th',sup:'sup',sub:'sub',pre:'pre',b:'strong',i:'em',u:'u',strong:'strong',em:'em',li:'li',ul:'ul',ol:'ol'};
function render(nodes:any[]):string{return (nodes||[]).map(n=>Object.entries(n).filter(([key])=>key!==':@').map(([key,v])=>{if(key==='#text')return escape(v);const tag=key.toLowerCase();if(['script','style'].includes(tag))return '';if(tag==='img')return '<span class="law-image-note">[Grafik in der Original-PDF]</span>';if(tag==='br')return '<br>';const body=Array.isArray(v)?render(v):'';const safe=allowed[tag];return safe?`<${safe}>${body}</${safe}>`:body;}).join('')).join('');}
export function parseLegalXML(xml:string,item:any,retrieved:string,sourceHash:string){
 // The official DTD is a declaration only; no external entities are loaded.
 if(xml.length>18_000_000||/<!ENTITY\s/i.test(xml))throw Error('XML source exceeds limits or declares entities');
 const validated=XMLValidator.validate(xml);if(validated!==true)throw Error('Invalid source XML');
 const nodes=xmlParser.parse(xml),document=find(nodes,'dokumente');if(!document)throw Error('Official legal document missing');
 if(item.sourceFile&&document[':@']?.['@_doknr']+'.xml'!==item.sourceFile)throw Error('Unexpected legal source identifier');
 const norms=children(document,'dokumente').filter((n:any)=>n.norm);if(!norms.length)throw Error('Empty source document');
 const meta=children(find(norms[0].norm,'metadaten'),'metadaten');const fullTitle=value(meta,'langue');if(!fullTitle)throw Error('Source title missing');
 const versions=meta.filter((n:any)=>n.standangabe).map((n:any)=>n.standangabe.map((x:any)=>allText((Object.values(x).find(Array.isArray)||[]) as any[]).trim()).filter(Boolean).join(' '));
 const sections:any[]=[];const seen=new Set<string>();
 norms.forEach((norm:any,i:number)=>{
  const m=children(find(norm.norm,'metadaten'),'metadaten');const en=value(m,'enbez'),title=value(m,'titel');if(item.select&&!item.select.includes(en))return;seen.add(en);
  const group=find(m,'gliederungseinheit');if(group){const c=group.gliederungseinheit;const heading=[value(c,'gliederungsbez'),value(c,'gliederungstitel')].filter(Boolean).join(' · ');if(heading)sections.push({id:`g${i}`,kind:'heading',label:heading,html:''});return;}
  const td=children(find(norm.norm,'textdaten'),'textdaten');const text=find(td,'text'),notes=find(td,'fussnoten');const html=render(children(find(children(text,'text'),'Content'),'Content'));const foot=render(children(find(children(notes,'fussnoten'),'Content'),'Content'));if(!html&&!foot)return;
  sections.push({id:`n${i}`,kind:'norm',label:[en,title].filter(Boolean).join(' ')||(i===0?'Hinweise und Textnachweis':`Bestimmung ${i}`),html,notes:foot});
 });
 if(item.select?.some((s:string)=>!seen.has(s)))throw Error('A selected statutory provision is missing');if(sections.filter(s=>s.kind==='norm').length<1)throw Error('No legal provisions extracted');
 const url=`https://www.gesetze-im-internet.de/${item.slug}/`;return {source:{id:item.id,url,xmlUrl:url+'xml.zip',sourceFile:document[':@']?.['@_doknr']+'.xml',sha256:sourceHash,retrieved,sourceBuildDate:document[':@']?.['@_builddate'],version:versions,fullTitle,abbreviation:value(meta,'amtabk')||value(meta,'jurabk'),excerpt:item.select||null,pdfUrl:item.pdfUrl||null},sections,hasGraphics:/<IMG\b/i.test(xml)};
}
export async function fetchOfficialLaw(item:any,pdfUrl?:string){
 const url=`https://www.gesetze-im-internet.de/${item.slug}/xml.zip`;const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(24000)});if(!response.ok)throw Error(`Source HTTP ${response.status}`);const zipped=new Uint8Array(await response.arrayBuffer());if(zipped.length>6_000_000)throw Error('Source archive too large');
 const files=unzipSync(zipped,{filter:file=>file.name.endsWith('.xml')&&file.originalSize<=18_000_000});const name=Object.keys(files).find(n=>n.endsWith('.xml'));if(!name)throw Error('Source XML missing from archive');const raw=files[name];return parseLegalXML(strFromU8(raw),{...item,pdfUrl},new Date().toISOString(),await digest(raw));
}

export async function parseOfficialArchive(item:any,archive:Uint8Array,pdfUrl?:string){
 const expected=item.sourceFile;
 const files=unzipSync(archive,{filter:file=>file.name===expected&&file.originalSize<=18_000_000});
 const raw=files[expected];if(!raw)throw Error('Expected official XML file is missing');
 return parseLegalXML(strFromU8(raw),{...item,pdfUrl},new Date().toISOString(),await digest(raw));
}
