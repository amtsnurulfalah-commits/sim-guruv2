import {pageSession} from '@/server/auth/page-session';
import {ServiceState} from '@/components/feedback/service-state';
import {PersonalWorkspace} from '@/features/personal/workspace';
import {wibDate} from '@/lib/calendar/schemas';
export const metadata={title:'Riwayat perubahan'};
export const dynamic='force-dynamic';
export default async function Page(){const result=await pageSession('/riwayat-perubahan');if(result.state!=='ready')return <ServiceState embedded/>;return <PersonalWorkspace date={wibDate()} history={true} admin={result.session.role==='admin'}/>;}
