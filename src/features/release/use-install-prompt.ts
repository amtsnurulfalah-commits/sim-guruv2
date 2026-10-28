'use client';
import {useEffect,useRef,useState} from 'react';
interface InstallEvent extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
export function useInstallPrompt(){
 const [checked,setChecked]=useState(false),[offer,setOffer]=useState<InstallEvent|null>(null),[standalone,setStandalone]=useState(false),[installed,setInstalled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const active=useRef(false),pending=useRef(false),generation=useRef<symbol|null>(null),current=useRef<InstallEvent|null>(null);
 useEffect(()=>{
  active.current=true;const media=window.matchMedia('(display-mode: standalone)');
  const update=()=>{if(active.current){setStandalone(media.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);setChecked(true);}};
  queueMicrotask(update);
  const before=(event:Event)=>{const candidate=event as InstallEvent;if(typeof candidate.prompt!=='function'||!candidate.userChoice||typeof candidate.userChoice.then!=='function')return;event.preventDefault();void Promise.resolve(candidate.userChoice).catch(()=>{});current.current=candidate;setOffer(candidate);setMessage('');};
  const done=()=>{generation.current=null;pending.current=false;current.current=null;setInstalled(true);setOffer(null);setBusy(false);setMessage('Aplikasi telah dipasang. Buka SiM-Guru melalui ikon pada perangkat Anda.');};
  window.addEventListener('beforeinstallprompt',before);window.addEventListener('appinstalled',done);
  const modern=typeof media.addEventListener==='function';
  if(modern)media.addEventListener('change',update);else if(typeof media.addListener==='function')media.addListener(update);
  return()=>{active.current=false;generation.current=null;pending.current=false;current.current=null;window.removeEventListener('beforeinstallprompt',before);window.removeEventListener('appinstalled',done);if(modern)media.removeEventListener('change',update);else if(typeof media.removeListener==='function')media.removeListener(update);};
 },[]);
 async function install(){
  if(!offer||current.current!==offer||pending.current||installed||standalone)return;
  const candidate=offer,attempt=Symbol('install');generation.current=attempt;pending.current=true;setBusy(true);setMessage('');
  // Attach rejection handling before invoking the browser API, while user activation is live.
  const choice=Promise.resolve(candidate.userChoice);void choice.catch(()=>{});
  try{await candidate.prompt();const result=await choice;if(active.current&&generation.current===attempt&&current.current===candidate)setMessage(result.outcome==='accepted'?'Permintaan diterima. Selesaikan pemasangan pada perangkat Anda.':'Pemasangan dibatalkan. Anda dapat menggunakan menu pemasangan pada browser.');}
  catch{if(active.current&&generation.current===attempt&&current.current===candidate)setMessage('Pemasangan belum dapat dimulai. Gunakan menu pemasangan pada browser.');}
  finally{if(active.current&&generation.current===attempt){pending.current=false;setBusy(false);if(current.current===candidate){current.current=null;setOffer(null);}}}
 }
 return {checked,available:!!offer&&!installed&&!standalone,standalone,installed,busy,message,install};
}
