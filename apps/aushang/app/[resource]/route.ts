import { staticAsset } from '../../server/static';
export const dynamic='force-dynamic';export function GET(request:Request){return staticAsset(new URL(request.url).pathname);}
