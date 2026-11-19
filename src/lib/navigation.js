import { useCallback, useEffect, useRef, useState } from 'react';
const initial = {page:'Home',batch:null,gallery:null,committee:null,panel:'overview',memberBatch:null,adminBatch:null,search:'',editMember:null,authMode:'choose',loginType:'member'};
// Scrolling order is independent of the existing navbar presentation order.
export const HOMEPAGE_SECTIONS=['Home','About','Events','Alumni','Committee'];
export function isHomepageRoute(route){
  return HOMEPAGE_SECTIONS.includes(route.page) && !(route.page==='Alumni' && route.batch) && !(route.page==='Committee' && route.committee);
}
export function activeHomepageSection(tops,offset,atBottom=false){
  let active='Home';
  for(const name of HOMEPAGE_SECTIONS)if(Number.isFinite(tops[name]) && tops[name]<=offset)active=name;
  return atBottom ? HOMEPAGE_SECTIONS.filter(name=>Number.isFinite(tops[name])).at(-1) || active : active;
}
export function routeFromHash(hash){
  try {
    const decoded=decodeURIComponent(hash.replace(/^#/,''));
    const section=HOMEPAGE_SECTIONS.find(name=>name.toLowerCase()===decoded.toLowerCase());
    return normalizeRoute(section ? {page:section} : JSON.parse(decoded || '{}'));
  } catch {return normalizeRoute(null);}
}
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
  if(['Home','About','Events','Committee'].includes(next.page)){next.batch=null;next.gallery=null;}
  return next;
}
export function useAppRoute() {
  const [route,setRoute] = useState(() => {
    if (typeof window === 'undefined') return initial;
    return routeFromHash(location.hash);
  });
  const current=useRef(route), pending=useRef(null), scheduled=useRef(false);
  current.current=route;
  useEffect(()=>{
    let frame;
    const restoration=history.scrollRestoration;
    history.scrollRestoration='manual';
    history.replaceState({...history.state,smsaRoute:current.current},'',location.href);
    const pop=e=>{
      if(e.type==='hashchange' && history.state?.smsaRoute)return;
      pending.current=null;
      const state=e.type==='popstate' ? e.state : null;
      const next=state?.smsaRoute ? normalizeRoute(state.smsaRoute) : routeFromHash(location.hash);
      current.current=next; setRoute(next);
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        if(Number.isFinite(state?.scrollY))window.scrollTo({top:state.scrollY,behavior:'instant'});
        else if(isHomepageRoute(next))document.getElementById(next.page.toLowerCase())?.scrollIntoView({behavior:'instant'});
        else window.scrollTo({top:0,behavior:'instant'});
      });
    };
    window.addEventListener('popstate',pop);window.addEventListener('hashchange',pop);
    return()=>{cancelAnimationFrame(frame);history.scrollRestoration=restoration;window.removeEventListener('popstate',pop);window.removeEventListener('hashchange',pop);};
  },[]);
  const go=useCallback((patch,replace=false,parent=null)=>{
    pending.current={parent:parent || pending.current?.parent,patch:{...pending.current?.patch,...patch},replace:(pending.current?.replace ?? true) && replace};
    if(scheduled.current)return; scheduled.current=true;
    queueMicrotask(()=>{
      scheduled.current=false; const change=pending.current; pending.current=null;if(!change)return;
      const next=normalizeRoute({...current.current,...change.patch});
      if(JSON.stringify(next)===JSON.stringify(current.current))return;
      const previous=change.parent ? normalizeRoute(change.parent.route) : current.current;
      history.replaceState({...history.state,...change.parent?.state,smsaRoute:previous,scrollY:change.parent ? 0 : window.scrollY},'',change.parent ? '#'+encodeURIComponent(JSON.stringify(previous)) : location.href);
      const shareable={...next,gallery:next.gallery ? {name:next.gallery.name,...(next.gallery.id == null ? {} : {id:next.gallery.id})}:null};
      const url='#'+encodeURIComponent(JSON.stringify(shareable));
      const continuous=isHomepageRoute(current.current) && isHomepageRoute(next);
      history[change.replace?'replaceState':'pushState']({smsaRoute:next,returnToCommitteeArchive:Boolean(change.parent),scrollY:isHomepageRoute(next)?null:0},'',url);
      current.current=next;setRoute(next);
      if(!change.replace && !continuous)window.scrollTo({top:0,behavior:'instant'});
    });
  },[]);
  const back=useCallback(()=>{ if(history.state?.smsaRoute && history.length>1)history.back();else go(initial,true); },[go]);
  return {route,go,back};
}
