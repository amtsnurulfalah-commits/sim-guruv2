import { getAuthService,getBusinessDatabase } from '@/server/auth/runtime';
import {requireEnvironment} from '@/server/env';
import {PersonalService} from '@/server/personal/service';
import {createPersonalHandler} from '@/server/personal/http';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const handler=createPersonalHandler({auth:getAuthService,service:async()=>new PersonalService(getBusinessDatabase()),config:()=>({appUrl:requireEnvironment('core').APP_URL,sessionSecret:requireEnvironment('auth').SESSION_SECRET,production:process.env.NODE_ENV==='production',vercel:process.env.VERCEL==='1'})});
export async function GET(request:Request,context:{params:Promise<{action:string}>}){return handler((await context.params).action,request);}
