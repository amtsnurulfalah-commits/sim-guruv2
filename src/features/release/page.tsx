'use client';
import {PublicWorkspace,usePublicWorkspaceSession} from '@/components/shell/public-workspace';
import {PageHeader} from '@/components/ui/page-header';
import {ReleaseNotes} from './experience';
function Content({pending=false}:{pending?:boolean}){const session=usePublicWorkspaceSession();return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]"><PageHeader context="SiM-Guru" title="Catatan pembaruan" description="Ringkasan perubahan dan panduan pemasangan SiM-Guru."/><ReleaseNotes includeInstall={!pending} scope={session?session.user.id+':'+session.user.role:null}/></div>;}
export function ReleasePage(){return <PublicWorkspace pendingFallback={<main id="konten-utama" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6"><Content pending/></main>} unavailableMessage="Catatan pembaruan tetap dapat dibaca."><Content/></PublicWorkspace>;}
