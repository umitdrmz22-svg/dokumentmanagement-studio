import { digest,getSessionToken,HttpError,randomToken,sessionCookie } from './security';
export type Account={id:string;username:string;company:string;work:string;street:string;houseNumber:string;postalCode:string;city:string;country:string;accessStatus:string;licenseValidUntil:number|null};
export async function sessionFor(db:D1Database,request:Request){
 const token=getSessionToken(request);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await db.prepare('SELECT a.id,a.username,a.company,a.work,a.street,a.house_number AS houseNumber,a.postal_code AS postalCode,a.city,a.country,a.access_status AS accessStatus,a.license_valid_until AS licenseValidUntil,s.device_id AS sessionDeviceId FROM accounts a JOIN sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires_at>? AND (s.device_id IS NULL OR EXISTS (SELECT 1 FROM devices d WHERE d.id=s.device_id AND d.account_id=a.id AND d.revoked_at IS NULL))').bind(await digest(token),Math.floor(Date.now()/1000)).first<Account & {sessionDeviceId:string|null}>();
 if(!row||row.accessStatus==='suspended')return null;
 const {sessionDeviceId,...account}=row;
 return {account,deviceId:sessionDeviceId,kind:sessionDeviceId?'device':'password'};
}
export function canRead(account:Account){return account.accessStatus==='active'&&!!account.licenseValidUntil&&account.licenseValidUntil>Math.floor(Date.now()/1000);}
export function requireLicense(account:Account){if(!canRead(account))throw new HttpError(402,'Ihr Standortzugang wartet auf die Zahlungsbestätigung und zeitliche Freischaltung durch den Anbieter.');}
export async function accountFor(db:D1Database,request:Request){return (await sessionFor(db,request))?.account??null;}
export async function requireAccount(db:D1Database,request:Request){const a=await accountFor(db,request);if(!a)throw new HttpError(401,'Bitte erneut anmelden.');return a;}
export async function requirePasswordSession(db:D1Database,request:Request){const session=await sessionFor(db,request);if(!session||session.kind!=='password')throw new HttpError(403,'Die Zugangsverwaltung benötigt Ihre Anmeldung mit Benutzername und Passwort.');return session.account;}
export async function createSession(db:D1Database,request:Request,accountId:string,remember=false,deviceId:string|null=null){
 const token=randomToken(),now=Math.floor(Date.now()/1000),seconds=remember?604800:43200;
 await db.prepare('INSERT INTO sessions (token_hash,account_id,expires_at,created_at,device_id) VALUES (?,?,?,?,?)').bind(await digest(token),accountId,now+seconds,now,deviceId).run();
 return sessionCookie(request,token,seconds);
}
