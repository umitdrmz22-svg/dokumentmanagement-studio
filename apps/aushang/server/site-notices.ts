import {type Account,requireLicense} from './accounts';
import {bodyJSON,HttpError,json} from './security';
export const noticeDefinitions=[
 {id:'agg',title:'Beschwerdestelle nach AGG',basis:'§ 12 Abs. 5 AGG',url:'https://www.gesetze-im-internet.de/agg/__12.html',condition:'Für den Betrieb bekanntzumachende Beschwerdestelle: Zuständigkeit und erreichbarer Kontakt.',always:true},
 {id:'youth-authority',title:'Aufsichtsbehörde für Jugendliche',basis:'§ 47 JArbSchG',url:'https://www.gesetze-im-internet.de/jarbschg/__47.html',condition:'Bei regelmäßig mindestens einem Beschäftigten unter 18 Jahren: Anschrift der zuständigen Aufsichtsbehörde.',always:false},
 {id:'youth-hours',title:'Arbeitszeiten und Pausen Jugendlicher',basis:'§ 48 JArbSchG',url:'https://www.gesetze-im-internet.de/jarbschg/__48.html',condition:'Bei regelmäßig mindestens drei Jugendlichen: Beginn und Ende der regelmäßigen täglichen Arbeitszeit und Pausen.',always:false},
 {id:'agreements',title:'Tarifverträge und Betriebsvereinbarungen',basis:'§ 16 Abs. 1 ArbZG · § 8 TVG · § 77 Abs. 2 BetrVG',url:'https://www.gesetze-im-internet.de/arbzg/__16.html',condition:'Betriebliche Anwendbarkeit prüfen. Hier den tatsächlichen Zugang zu geltenden Texten beschreiben; erforderliche Volltexte und vorgeschriebene Bekanntmachungsform gesondert sicherstellen.',always:false}
];
type Notice={status:'applicable'|'not_applicable'|'unconfirmed';text:string};
export type NoticeSet=Record<string,Notice>;
export const emptyNotices=():NoticeSet=>Object.fromEntries(noticeDefinitions.map(d=>[d.id,{status:d.always?'applicable':'unconfirmed',text:''}]));
function validate(value:unknown,publishing=false):NoticeSet{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400,'Bitte gültige Werkangaben übermitteln.');
 const input=value as Record<string,any>,result=emptyNotices();if(Object.keys(input).some(k=>!noticeDefinitions.some(d=>d.id===k)))throw new HttpError(400,'Unbekannte Werkangabe.');
 for(const d of noticeDefinitions){const n=input[d.id];if(!n)continue;if(!['applicable','not_applicable','unconfirmed'].includes(n.status)||typeof n.text!=='string'||n.text.length>2500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(n.text))throw new HttpError(400,'Ungültige Werkangabe: '+d.title);if(d.always&&n.status!=='applicable')throw new HttpError(400,'Die AGG-Beschwerdestelle muss bekanntgemacht werden.');result[d.id]={status:n.status,text:n.text.trim()};}
 if(publishing)for(const d of noticeDefinitions){const n=result[d.id];if(n.status!=='unconfirmed'&&n.text.length<3)throw new HttpError(400,d.title+': Bitte Inhalt bzw. Begründung hinterlegen.');}
 return result;
}
export async function siteNotices(db:D1Database,accountId:string,manager=false){
 const r=await db.prepare('SELECT draft,published,revision,published_at AS publishedAt,updated_at AS updatedAt FROM site_notices WHERE account_id=?').bind(accountId).first<any>();
 return {definitions:noticeDefinitions,published:r?.published?JSON.parse(r.published):emptyNotices(),publishedAt:r?.publishedAt||null,...(manager?{draft:r?JSON.parse(r.draft):emptyNotices(),revision:r?.revision||0,updatedAt:r?.updatedAt||null,canManage:true}:{canManage:false})};
}
export async function noticesAPI(db:D1Database,request:Request,session:{account:Account;kind:string}){
 requireLicense(session.account);const manager=session.kind==='password',path=new URL(request.url).pathname;
 if(path==='/api/site-notices'&&request.method==='GET')return json(await siteNotices(db,session.account.id,manager));
 if(!manager)throw new HttpError(403,'Werkangaben können nur nach Passwortanmeldung verwaltet werden.');
 const b=await bodyJSON(request,18000);if(!Number.isInteger(b.revision)||b.revision<0)throw new HttpError(400,'Ungültiger Bearbeitungsstand.');
 const row=await db.prepare('SELECT revision,draft FROM site_notices WHERE account_id=?').bind(session.account.id).first<any>();if((row?.revision||0)!==b.revision)throw new HttpError(409,'Werkangaben wurden inzwischen geändert. Bitte neu laden.');
 const now=Math.floor(Date.now()/1000);let changed=0;
 if(path==='/api/site-notices'&&request.method==='PUT'){
  const payload=JSON.stringify(validate(b.notices));
  const r=row?await db.prepare('UPDATE site_notices SET draft=?,revision=revision+1,updated_at=? WHERE account_id=? AND revision=?').bind(payload,now,session.account.id,b.revision).run():await db.prepare('INSERT INTO site_notices (account_id,draft,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(account_id) DO NOTHING').bind(session.account.id,payload,now).run();changed=r.meta.changes;
 }else if(path==='/api/site-notices/publish'&&request.method==='POST'){
  if(b.authorized!==true)throw new HttpError(400,'Bitte die betriebliche Freigabe bestätigen.');if(!row)throw new HttpError(400,'Bitte zuerst einen Entwurf speichern.');validate(JSON.parse(row.draft),true);
  const r=await db.prepare('UPDATE site_notices SET published=draft,published_at=?,updated_at=?,revision=revision+1 WHERE account_id=? AND revision=?').bind(now,now,session.account.id,b.revision).run();changed=r.meta.changes;
 }else throw new HttpError(405,'Werkangaben-Aktion nicht unterstützt.');
 if(changed!==1)throw new HttpError(409,'Werkangaben wurden inzwischen geändert. Bitte neu laden.');return json(await siteNotices(db,session.account.id,true));
}
