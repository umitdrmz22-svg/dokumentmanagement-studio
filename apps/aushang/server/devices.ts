import {clean,enc,HttpError,randomToken} from './security';
import {createSession} from './accounts';
export const deviceIdPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function deviceId(value:unknown){if(typeof value!=='string'||!deviceIdPattern.test(value))throw new HttpError(400,'Ungültiger Gerätezugang.');return value;}
export async function publicDeviceKey(value:any){
 if(!value||value.kty!=='EC'||value.crv!=='P-256'||value.d!==undefined||!(/^[A-Za-z0-9_-]{43}$/.test(value.x))||!(/^[A-Za-z0-9_-]{43}$/.test(value.y)))throw new HttpError(400,'Ungültiger öffentlicher Geräteschlüssel.');
 const jwk={kty:'EC',crv:'P-256',x:value.x,y:value.y,ext:true};
 try{await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);}catch{throw new HttpError(400,'Ungültiger öffentlicher Geräteschlüssel.');}
 return JSON.stringify(jwk);
}
export async function enrollDevice(db:D1Database,accountId:string,body:Record<string,unknown>){
 const key=await publicDeviceKey(body.publicKey),label=clean(body.label,'Gerätename',80),now=Math.floor(Date.now()/1000);
 const count=await db.prepare('SELECT COUNT(*) AS count FROM devices WHERE account_id=? AND revoked_at IS NULL').bind(accountId).first<{count:number}>();
 if((count?.count||0)>=20)throw new HttpError(409,'Bitte zuerst einen nicht mehr benötigten Gerätezugang widerrufen.');
 const id=crypto.randomUUID();await db.prepare('INSERT INTO devices (id,account_id,public_key,label,created_at) VALUES (?,?,?,?,?)').bind(id,accountId,key,label,now).run();
 return {id,label,path:'/geraet/'+id};
}
export async function challengeDevice(db:D1Database,request:Request,id:string){
 const active=await db.prepare('SELECT d.id FROM devices d JOIN accounts a ON a.id=d.account_id WHERE d.id=? AND d.revoked_at IS NULL AND a.access_status=? AND (a.license_permanent=1 OR a.license_valid_until>?)').bind(id,'active',Math.floor(Date.now()/1000)).first();
 if(!active)throw new HttpError(403,'Dieser Gerätezugang ist nicht freigeschaltet.');
 const now=Math.floor(Date.now()/1000),challengeId=crypto.randomUUID();
 const message=`aushang-device-v1|${new URL(request.url).origin}|${id}|${challengeId}|${randomToken()}`;
 await db.batch([db.prepare('DELETE FROM device_challenges WHERE expires_at<=?').bind(now),db.prepare('INSERT INTO device_challenges (id,device_id,message,expires_at) VALUES (?,?,?,?)').bind(challengeId,id,message,now+120)]);
 return {challengeId,message};
}
export async function unlockDevice(db:D1Database,request:Request,body:Record<string,unknown>){
 const id=deviceId(body.deviceId),challengeId=deviceId(body.challengeId),now=Math.floor(Date.now()/1000);
 const signature=body.signature;if(typeof signature!=='string'||!(/^[A-Za-z0-9_-]{86}$/.test(signature)))throw new HttpError(401,'Der Gerätenachweis ist ungültig.');
 const row=await db.prepare('SELECT c.message,d.public_key,d.account_id FROM device_challenges c JOIN devices d ON d.id=c.device_id JOIN accounts a ON a.id=d.account_id WHERE c.id=? AND c.device_id=? AND c.expires_at>? AND d.revoked_at IS NULL AND a.access_status=? AND (a.license_permanent=1 OR a.license_valid_until>?)').bind(challengeId,id,now,'active',now).first<{message:string;public_key:string;account_id:string}>();
 if(!row)throw new HttpError(401,'Der Gerätenachweis ist abgelaufen oder nicht mehr gültig.');
 const key=await crypto.subtle.importKey('jwk',JSON.parse(row.public_key),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const bytes=Uint8Array.from(atob(signature.replace(/-/g,'+').replace(/_/g,'/')+'=='),c=>c.charCodeAt(0));
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytes,enc.encode(row.message)))throw new HttpError(401,'Dieser Browser besitzt nicht den passenden Geräteschlüssel.');
 // Atomic consumption prevents concurrent replay of the same signed challenge.
 const used=await db.prepare('DELETE FROM device_challenges WHERE id=? AND device_id=? AND expires_at>? RETURNING id').bind(challengeId,id,now).first();
 if(!used)throw new HttpError(401,'Dieser Gerätenachweis wurde bereits verwendet.');
 await db.prepare('UPDATE devices SET last_used_at=? WHERE id=? AND revoked_at IS NULL').bind(now,id).run();
 const cookie=await createSession(db,request,row.account_id,false,id);
 return {cookie};
}
export async function revokeDevice(db:D1Database,accountId:string,id:string){
 const device=await db.prepare('SELECT id FROM devices WHERE id=? AND account_id=?').bind(id,accountId).first();if(!device)throw new HttpError(404,'Gerätezugang nicht gefunden.');
 await db.batch([db.prepare('UPDATE devices SET revoked_at=? WHERE id=? AND account_id=?').bind(Math.floor(Date.now()/1000),id,accountId),db.prepare('DELETE FROM sessions WHERE device_id=?').bind(id),db.prepare('DELETE FROM device_challenges WHERE device_id=?').bind(id)]);
}
