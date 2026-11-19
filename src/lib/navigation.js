import { useCallback, useEffect, useRef, useState } from 'react';
const initial = {page:'Home',batch:null,gallery:null,committee:null,panel:'overview',memberBatch:null,adminBatch:null,search:'',editMember:null,authMode:'choose',loginType:'member'};
export function normalizeRoute(value) {
  const next={...initial};
  if(!value || typeof value!=='object' || Array.isArray(value))return next;
  for(const key of Object.keys(initial)){
    if(key==='gallery'){
      const gallery=value.gallery;
      if(gallery && typeof gallery==='object' && typeof gallery.name==='string')next.gallery={name:gallery.name,...(['string','number'].includes(typeof gallery.id)?{id:gallery.id}:{})};
    } else if(typeof value[key]==='string')next[key]=value[key];
  }
  if(!['Home','About','Events','Alumni','Gallery','Committee','Login','Profile','Admin','ResetPassword'].includes(next.page))next.page='Home';
  if(!['overview','about','events','batches','members','gallery','committee','social','content'].includes(next.panel))next.panel='overview';
  if(!['choose','login','signup','forgot'].includes(next.authMode))next.authMode='choose';
  if(!['member','admin'].includes(next.loginType))next.loginType='member';
  return next;
}
export function useAppRoute() {
  const [route,setRoute] = useState(() => {
    if (typeof window === 'undefined') return initial;
    try { return normalizeRoute(JSON.parse(decodeURIComponent(location.hash.slice(1) || '{}'))); } catch { return initial; }
  });
  const current=useRef(route), pending=useRef(null), scheduled=useRef(false);
  current.current=route;
  useEffect(()=>{
    history.replaceState({...history.state,smsaRoute:current.current},'',location.href);
    const pop=e=>{
      pending.current=null;
      const next=normalizeRoute(e.state?.smsaRoute); current.current=next; setRoute(next);
      requestAnimationFrame(()=>window.scrollTo({top:e.state?.scrollY || 0,behavior:'instant'}));
    };
    window.addEventListener('popstate',pop); return()=>window.removeEventListener('popstate',pop);
  },[]);
  const go=useCallback((patch,replace=false)=>{
    pending.current={patch:{...pending.current?.patch,...patch},replace:(pending.current?.replace ?? true) && replace};
    if(scheduled.current)return; scheduled.current=true;
    queueMicrotask(()=>{
      scheduled.current=false; const change=pending.current; pending.current=null;if(!change)return;
      const next=normalizeRoute({...current.current,...change.patch});
      if(JSON.stringify(next)===JSON.stringify(current.current))return;
      history.replaceState({...history.state,smsaRoute:current.current,scrollY:window.scrollY},'',location.href);
      const shareable={...next,gallery:next.gallery ? {name:next.gallery.name}:null};
      const url='#'+encodeURIComponent(JSON.stringify(shareable));
      history[change.replace?'replaceState':'pushState']({smsaRoute:next,scrollY:0},'',url);
      current.current=next;setRoute(next);
      if(!change.replace)window.scrollTo({top:0,behavior:'instant'});
    });
  },[]);
  const back=useCallback(()=>{ if(history.state?.smsaRoute && history.length>1)history.back();else go(initial,true); },[go]);
  return {route,go,back};
}
