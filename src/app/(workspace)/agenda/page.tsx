import {pageSession} from '@/server/auth/page-session';
import {ServiceState} from '@/components/feedback/service-state';
import {PersonalWorkspace} from '@/features/personal/workspace';
import {wibDate} from '@/lib/calendar/schemas';
export const dynamic='force-dynamic';
export default async function Page(){const result=await pageSession('/agenda');if(result.state!=='ready')return <ServiceState embedded/>;return <PersonalWorkspace date={wibDate()} history={false} admin={result.session.role==='admin'}/>;}
