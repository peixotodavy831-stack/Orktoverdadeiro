import {useEffect,useState} from 'react';
import {productApi} from '../api';
import {subscribeInboxChanges,type InboxUpdateMode} from './inbox-realtime';

/** Default OFF until publication, RLS and real A/B delivery are verified for the candidate. */
export function useInboxUpdates(accessToken:string|null) {
  const [mode,setMode]=useState<InboxUpdateMode>('periodic');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true,unsubscribe:(()=>void)|undefined;
    const invalidate=()=>{if(active&&document.visibilityState==='visible'&&navigator.onLine)setRevision(value=>value+1);};
    document.addEventListener('visibilitychange',invalidate);window.addEventListener('online',invalidate);
    setMode('periodic');
    if(accessToken&&import.meta.env.VITE_ORKTO_INBOX_REALTIME==='ON') {
      setMode('connecting');
      void (async()=>{
        try {
          const result=await productApi<{workspace?:{id?:string}}>('/api/operational/workspace',accessToken);
          const {supabase}=await import('../../lib/supabase');
          if(!active)return;
          if(!result.workspace?.id)throw Error('Workspace unavailable');
          unsubscribe=subscribeInboxChanges(supabase,{workspaceId:result.workspace.id,accessToken,onChange:invalidate,onMode:value=>{if(active)setMode(value);}});
        } catch {if(active)setMode('periodic');}
      })();
    }
    return ()=>{active=false;unsubscribe?.();document.removeEventListener('visibilitychange',invalidate);window.removeEventListener('online',invalidate);};
  },[accessToken]);
  return {mode,revision};
}
