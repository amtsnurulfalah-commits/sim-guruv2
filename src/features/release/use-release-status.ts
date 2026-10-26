'use client';
import {useCallback,useSyncExternalStore} from 'react';
import {currentRelease,releaseSeenKey} from '@/lib/release/notes';
import {preferenceEvent} from '@/lib/preferences/storage';
const releaseEvent='sim-guru:release-read';
function subscribe(notify:()=>void){
 window.addEventListener(releaseEvent,notify);
 window.addEventListener(preferenceEvent,notify);
 window.addEventListener('storage',notify);
 return()=>{window.removeEventListener(releaseEvent,notify);window.removeEventListener(preferenceEvent,notify);window.removeEventListener('storage',notify);};
}
export function useReleaseStatus(scope:string|null,version=currentRelease){
 const snapshot=useCallback(()=>{
  if(!scope||!version)return 'anonymous';
  try{return sessionStorage.getItem(releaseSeenKey)===scope+':'+version?'read':'unread';}catch{return 'unavailable';}
 },[scope,version]);
 const status=useSyncExternalStore(subscribe,snapshot,()=> 'unknown');
 const mark=()=>{
  if(!scope||!version)return false;
  try{sessionStorage.setItem(releaseSeenKey,scope+':'+version);const saved=sessionStorage.getItem(releaseSeenKey)===scope+':'+version;window.dispatchEvent(new Event(releaseEvent));return saved;}catch{return false;}
 };
 return {status,mark};
}
