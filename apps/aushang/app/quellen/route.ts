import {env} from 'cloudflare:workers';
import {sourceIndexPage} from '../../server/source-index';
export const dynamic='force-dynamic';
export function GET(request:Request){if(!env.DB)return new Response('Quellenverzeichnis momentan nicht verfügbar',{status:503});return sourceIndexPage(env.DB,request);}
