import { env } from 'cloudflare:workers';
import { createAPI } from '../../../server/api';
export const dynamic='force-dynamic';
const handler=(r:Request)=>createAPI(env).api(r);
export const GET=handler;export const POST=handler;export const PUT=handler;export const PATCH=handler;export const DELETE=handler;
