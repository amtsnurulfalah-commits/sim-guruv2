import 'server-only';
import {NextResponse} from 'next/server';
import {authResponse,handleModuleRequest} from '../auth/http';
import {AuthError,type LocalAuthService} from '../auth/service';
import {cookieNames,opaqueToken,rejectCrossSiteRead,requestCookie,type HttpAuthConfig} from '../auth/security';
import {calendarSchema} from '../../lib/personal/contracts';
import {renderCalendar} from './ics';
import type {PersonalService} from './service';
export function createPersonalHandler(deps:{config():HttpAuthConfig;auth():Promise<LocalAuthService>;service():Promise<PersonalService>}){
 return (kind:string,request:Request)=>handleModuleRequest('activities',async requestId=>{
  const config=deps.config();if(request.method!=='GET')throw new AuthError('FORBIDDEN',405);
  if(!['calendar','history','export'].includes(kind))throw new AuthError('NOT_FOUND',404);
  rejectCrossSiteRead(request,config);
  const token=requestCookie(request,cookieNames(config.production).session);if(!opaqueToken(token))throw new AuthError('UNAUTHENTICATED',401);
  const actor=await(await deps.auth()).requireSession(token,true);
  const result=await(await deps.service()).read(token,kind==='history'?'history':'calendar',Object.fromEntries(new URL(request.url).searchParams));
  if(kind==='export')return new NextResponse(renderCalendar(calendarSchema.parse(result),actor.user_id),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="kalender-pribadi.ics"','Cache-Control':'private, no-store, max-age=0','X-Request-Id':requestId,'X-Content-Type-Options':'nosniff'}});
  return authResponse(result,requestId);
 });
}
