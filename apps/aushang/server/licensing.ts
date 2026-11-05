import {clean,HttpError,username} from './security';
export async function customerRequests(db:D1Database){
 const rows=await db.prepare('SELECT username,company,work,postal_code AS postalCode,city,access_status AS status,license_valid_until AS validUntil,created_at AS createdAt FROM accounts ORDER BY created_at DESC LIMIT 200').all();return {customers:rows.results||[]};
}
export function licenseDeadline(value:unknown){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new HttpError(400,'Bitte ein vereinbartes Gültigkeitsdatum als JJJJ-MM-TT angeben.');
 const noon=new Date(value+'T12:00:00Z');if(!Number.isFinite(noon.getTime())||noon.toISOString().slice(0,10)!==value)throw new HttpError(400,'Ungültiges Gültigkeitsdatum.');
 const localHour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',hour12:false}).format(noon));
 const seconds=Math.floor(Date.parse(value+'T23:59:59Z')/1000)-(localHour-12)*3600;
 if(seconds<=Math.floor(Date.now()/1000))throw new HttpError(400,'Das vereinbarte Gültigkeitsdatum muss in der Zukunft liegen.');return seconds;
}
export async function activateCustomer(db:D1Database,body:Record<string,unknown>,actor:string){
 if(body.paymentConfirmed!==true)throw new HttpError(400,'Eine ausdrückliche Zahlungsbestätigung des Anbieters ist erforderlich. Es wird keine Zahlung eingezogen.');
 const user=username(body.username),reference=clean(body.reference,'Zahlungs-/Rechnungsreferenz',100),until=licenseDeadline(body.validUntil);
 const account=await db.prepare('SELECT id FROM accounts WHERE username=?').bind(user).first<{id:string}>();if(!account)throw new HttpError(404,'Kundenkonto nicht gefunden.');
 await db.batch([db.prepare('UPDATE accounts SET access_status=?,license_valid_until=? WHERE id=?').bind('active',until,account.id),db.prepare('INSERT INTO access_events (id,account_id,action,reference,actor,created_at,valid_until) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),account.id,'activate',reference,actor,Math.floor(Date.now()/1000),until)]);
 return {username:user,status:'active',validUntil:body.validUntil,timeZone:'Europe/Berlin',paymentCaptured:false,message:'Vorhandenen Zahlungseingang und vereinbarte Laufzeit manuell bestätigt; keine Zahlung eingezogen.'};
}
export async function suspendCustomer(db:D1Database,body:Record<string,unknown>,actor:string){
 const user=username(body.username),reference=clean(body.reference,'Grund/Referenz',100);
 const account=await db.prepare('SELECT id FROM accounts WHERE username=?').bind(user).first<{id:string}>();if(!account)throw new HttpError(404,'Kundenkonto nicht gefunden.');
 const now=Math.floor(Date.now()/1000);
 await db.batch([db.prepare('UPDATE accounts SET access_status=? WHERE id=?').bind('suspended',account.id),db.prepare('DELETE FROM sessions WHERE account_id=?').bind(account.id),db.prepare('UPDATE devices SET revoked_at=? WHERE account_id=? AND revoked_at IS NULL').bind(now,account.id),db.prepare('INSERT INTO access_events (id,account_id,action,reference,actor,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),account.id,'suspend',reference,actor,now)]);
 return {username:user,status:'suspended'};
}
