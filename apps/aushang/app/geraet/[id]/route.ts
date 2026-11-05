import {staticAsset} from '../../../server/static';
export const dynamic='force-dynamic';
export function GET(){return staticAsset('/index.html');}
