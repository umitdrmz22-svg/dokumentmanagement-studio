import { env } from 'cloudflare:workers';
import { createAPI } from '../../server/api';
export const dynamic='force-dynamic';export const POST=(r:Request)=>createAPI(env).mcp(r);
