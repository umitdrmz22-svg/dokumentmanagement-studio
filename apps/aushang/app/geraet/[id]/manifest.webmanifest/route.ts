import {deviceIdPattern} from '../../../../server/devices';
import {json} from '../../../../server/security';
export const dynamic='force-dynamic';
export function GET(request:Request){
 const id=new URL(request.url).pathname.split('/')[2];
 if(!deviceIdPattern.test(id||''))return new Response('Not found',{status:404});
 const path='/geraet/'+id;
 const r=json({id:path,name:'aushang. – Firmencomputer',short_name:'aushang.',start_url:path,scope:path,display:'standalone',background_color:'#f7f8f5',theme_color:'#173e38',lang:'de',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'}]});
 r.headers.set('Content-Type','application/manifest+json');return r;
}
