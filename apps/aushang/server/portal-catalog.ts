import {catalog as imported} from './generated-legal';
import research from '../legal/portal-research.json';

type Entry=Record<string,any> & {id:string;title:string;short:string;url:string;type:string;hosted:boolean;legalIndex:boolean;topics:string[];noticeRules:any[]};
const kind=(x:any)=>x.localPdf?'Unfallverhütungsvorschrift':/verordnung|\bMiLoV/i.test(x.title)?'Verordnung':'Gesetz';
const identity=(url:string)=>{try{const u=new URL(url);return u.hostname==='www.gesetze-im-internet.de'?u.hostname+'/'+u.pathname.split('/')[1]:u.origin+u.pathname.replace(/\/$/,'');}catch{return url;}};
const entries:Entry[]=imported.map(x=>({...x,type:kind(x),hosted:true,legalIndex:true,topics:[],noticeRules:[]}));
const coreById=new Map(entries.map(x=>[x.id,x])),byUrl=new Map(entries.map(x=>[identity(x.url),x]));
function add(x:any,topic?:string){
 const local=coreById.get(x.catalogId||'')||byUrl.get(identity(x.url))||(x.id==='dguv-v1'?coreById.get('dguv1'):undefined);
 let entry=local||entries.find(e=>e.id===x.id);
 if(!entry){const created:Entry={...x,id:x.id,title:x.title,short:x.short||x.abbreviation||x.id.toUpperCase(),url:x.url,type:x.type,hosted:false,legalIndex:/Gesetz|Verordnung|Unfallverhütungsvorschrift/i.test(x.type),topics:[],noticeRules:[],group:x.classification?.startsWith('Bedingt')?'Bedingte Bekanntmachungen':'Weitere Rechtsgrundlagen',provider:x.provider||'Offizielle Quelle',description:x.description||x.note||x.classification||''};entries.push(created);byUrl.set(identity(x.url),created);entry=created;}
 if(topic&&!entry!.topics.includes(topic))entry!.topics.push(topic);
 return entry!;
}
for(const x of research.extraEntries)add(x);
export const portalTopics=research.topics.map(t=>({...t,items:t.items.map(x=>({...x,recordId:add(x,t.id).id}))}));
for(const rule of research.aushangRules)for(const id of rule.catalogIds){const entry=entries.find(e=>e.id===id);if(entry)entry.noticeRules.push(rule);}
export const portalCatalog=entries;
export const portalMetadata={checkedAt:research.checkedAt,scope:research.scope,copyright:research.copyright,aushangRules:research.aushangRules};
