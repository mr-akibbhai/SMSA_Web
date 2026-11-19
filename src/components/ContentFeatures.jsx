import { useLanguage } from "../lib/i18n";
import { friendlyMessage, logDiagnostic } from '../lib/notifications';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { saveSiteContent, validateImage } from '../lib/domain';
import { useReducedMotion } from './Experience';
import { deleteRecord, REFRESH_WARNING } from '../lib/cms';
export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
export function ImageUpload({userId,admin=false,onUploaded,onBusy=()=>{},multiple=false,maxFiles=1,label}) {
  const {t}=useLanguage();
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [previews,setPreviews]=useState([]);
  const locked=useRef(false);
  useEffect(()=>()=>previews.forEach(url=>URL.revokeObjectURL(url)),[previews]);
  async function upload(e){
    const input=e.currentTarget, files=Array.from(input.files || []);
    if(!files.length || locked.current)return;
    setError('');
    try {
      if(!userId)throw new Error('Please sign in first.');
      if(files.length>maxFiles)throw new Error('Please choose no more than the available image slots.');
      for(const file of files){const error=validateImage(file);if(error)throw new Error(error);}
      setPreviews(files.map(file=>URL.createObjectURL(file)));
      locked.current=true;setBusy(true);onBusy(true);
      for(const file of files){
        const path=`${admin ? 'admin' : userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
        const {error}=await supabase.storage.from('site-media').upload(path,file,{contentType:file.type,upsert:false});
        if(error)throw error;
        const {data}=supabase.storage.from('site-media').getPublicUrl(path);
        if(!data?.publicUrl)throw new Error('Your changes could not be saved. Please refresh and try again.');
        await onUploaded(data.publicUrl);
      }
      setPreviews([]);
    } catch(error){logDiagnostic(error);setError(friendlyMessage(error));}
    finally {locked.current=false;setBusy(false);onBusy(false);input.value='';}
  }
  return <div className="upload-field"><label>{t(label || 'Upload image (JPEG, PNG or WebP, maximum 10 MB)')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={busy || maxFiles<1} onChange={upload}/></label>
    <div className="local-previews">{previews.map(url=><img key={url} className="image-preview" src={url} alt={t('Selected upload')}/>)}</div>{busy && <p role="status">{t('Uploading…')}</p>}{error && <p role="alert">{t(error)}</p>}
  </div>;
}
export function useSiteContent() {
  const sequence = useRef(0);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [ready,setReady] = useState(false);
  async function reload() {
    const request=++sequence.current;
    try {
      if(!supabase)throw new Error('Supabase configuration is missing.');
      const {data,error}=await supabase.from('site_content').select('*').order('created_at').order('id');
      if(error)throw error;
      if(request!==sequence.current)return {ok:false,stale:true};
      setError('');setItems(data || []);setReady(true);return {ok:true};
    } catch(error){
      if(request===sequence.current){setError('Additional website content is unavailable. Please retry; the database setup may be pending.');setReady(true);}
      return {ok:false,error};
    }
  }

  return {
    items,
    error,
    ready,
    reload
  };
}
export function ContentCard({
  item
}) {
  if (!item) return null;
  return <article className="content-card managed-card">{safeLink(item.image_url) && <img loading="lazy" src={item.image_url} alt={item.title || 'SMSA'} />}
    <h3>{item.title}</h3><p className="preserve-lines">{item.description}</p></article>;
}
function SocialIcon({ messenger }) {
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">{messenger ? <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.5 5.5 3.8 7.2V22l3.5-1.9c.9.2 1.8.3 2.7.3 5.5 0 10-4.1 10-9.2S17.5 2 12 2Zm1 12.4-2.6-2.8-5.1 2.8 5.6-6 2.7 2.8 5-2.8-5.6 6Z" /> : <path d="M14 22v-9h3l.5-3.5H14V7.3c0-1 .3-1.7 1.7-1.7h1.9V2.5c-.3 0-1.5-.2-2.8-.2-2.8 0-4.6 1.7-4.6 4.8v2.4H7V13h3.2v9H14Z" />}</svg>;
}
export function CommunityLinks({
  items
}) {
  const {
    t
  } = useLanguage();
  return <div className="community-links">{items.filter(i => i.kind === 'social' && ['facebook','messenger'].includes(i.key) && i.enabled && safeLink(i.url)).map(i => <a className="social-link" href={safeLink(i.url)} key={i.id} target="_blank" rel="noopener noreferrer"><SocialIcon messenger={i.key === 'messenger'} />{i.title || (i.key === 'facebook' ? t("Facebook Group") : t("Messenger Group"))}</a>)}</div>;
}
export const HOMEPAGE_SLIDE_MS=1500;
export const HOMEPAGE_MANUAL_PAUSE_MS=5000;
export function Carousel({items}) {
  const {t}=useLanguage();
  const slides=items.filter(i=>i.kind==='carousel' && i.enabled && safeLink(i.image_url));
  const [index,setIndex]=useState(0), [paused,setPaused]=useState(false), [manualUntil,setManualUntil]=useState(0);
  const reducedMotion=useReducedMotion();
  const current=slides.length ? index % slides.length : 0;
  useEffect(()=>{
    if(paused || reducedMotion || slides.length<2)return;
    const delay=manualUntil>Date.now() ? manualUntil-Date.now() : HOMEPAGE_SLIDE_MS;
    const timer=setTimeout(()=>{setIndex(i=>(i+1)%slides.length);setManualUntil(0);},delay);
    return ()=>clearTimeout(timer);
  },[index,slides.length,manualUntil,paused,reducedMotion]);
  function manual(delta){setIndex((current+delta+slides.length)%slides.length);setManualUntil(Date.now()+HOMEPAGE_MANUAL_PAUSE_MS);}
  if(!slides.length)return null;
  return <section className="home-carousel container" aria-label={t('SMSA highlights')} aria-roledescription="carousel">
    <div className="carousel-window"><div className="carousel-track" style={{transform:`translateX(-${current*100}%)`}}>{slides.map((slide,i)=><figure key={slide.id} aria-hidden={i!==current}><img src={slide.image_url} alt={slide.title || t('SMSA community highlight')}/>{slide.title && <figcaption>{slide.title}</figcaption>}</figure>)}</div></div>
    {slides.length>1 && <div className="carousel-controls"><button onClick={()=>manual(-1)} aria-label={t('Previous slide')}>←</button><span>{current+1}/{slides.length}</span><button onClick={()=>manual(1)} aria-label={t('Next slide')}>→</button><button onClick={()=>{setPaused(!paused);setManualUntil(0);}}>{t(paused ? 'Play' : 'Pause')}</button></div>}
  </section>;
}

const blank = {
  kind: 'official',
  key: 'smsa',
  title: '',
  description: '',
  image_url: '',
  url: '',
  enabled: true
};
export function ContentManager({
  content,
  userId,
  batchNames,
  kinds = ['official', 'batch', 'social', 'carousel', 'about']
}) {
  const {
    t
  } = useLanguage();
  const fresh = () => ({...blank, kind:kinds[0], key:kinds[0] === 'official' ? 'smsa' : ''});
  const [draft, setDraft] = useState(fresh);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setMessage('');
    try {
      if (draft.kind === 'social' && draft.url && !safeLink(draft.url)) throw new Error('Use a complete HTTPS community URL.');
      const record={...draft,key:draft.key?.trim() || (draft.kind==='carousel' ? 'slide-' : 'image-')+crypto.randomUUID()};
      setDraft(record);
      const saved=await saveSiteContent(supabase, record);
      setDraft({...record,id:saved.id});
      const refreshed=await content.reload();
      if(refreshed?.ok===false){setMessage(REFRESH_WARNING);return;}
      setDraft(fresh());
      setMessage('Content saved.');
    } catch (err) {
      logDiagnostic(err), setMessage(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return <div className="content-card"><h3>{t(kinds[0] === "batch" ? "Batch Profiles" : "Brand & Highlights")}</h3>
    {content.error && <p role="alert">{t(content.error)}</p>}<form onSubmit={save}>
    <fieldset disabled={busy || uploading}><label>{t("Content type")}<select value={draft.kind} onChange={e => setDraft({
          ...blank,
          kind: e.target.value,
          key: e.target.value === 'official' ? 'smsa' : ''
        })}>{kinds.map(kind => <option key={kind} value={kind}>{t({official:'Official SMSA Profile',batch:'Batch Profile',social:'Social Media & Community Links',carousel:'Homepage Carousel',about:'About Images'}[kind])}</option>)}</select></label>
    {draft.kind === 'batch' ? <label>{t("Batch")}<select required value={draft.key} onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })}><option value="">{t("Select batch")}</option>{batchNames.map(n => <option key={n}>{n}</option>)}</select></label> : draft.kind === 'social' ? <label>{t("Community")}<select value={draft.key} required onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })}><option value="">{t("Choose community")}</option><option value="facebook">{t("Facebook Group")}</option><option value="messenger">{t("Messenger Group")}</option></select></label> : ['carousel', 'about'].includes(draft.kind) ? <label>{t("Slide name (optional)")}<input value={draft.key} onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })} /></label> : null}
    <label>{t("Title")}<input required={!["carousel","about"].includes(draft.kind)} value={draft.title} onChange={e => setDraft({
          ...draft,
          title: e.target.value
        })} /></label>
    {draft.kind === 'social' ? <label>{t("Group URL")}<input type="url" required value={draft.url} onChange={e => setDraft({
          ...draft,
          url: e.target.value
        })} /></label> : <><label>{t("Introduction / information")}<textarea value={draft.description} onChange={e => setDraft({
            ...draft,
            description: e.target.value
          })} /></label><ImageUpload userId={userId} admin onUploaded={async image_url => {
          const record={...draft,image_url,key:draft.key?.trim() || 'slide-'+crypto.randomUUID()};setDraft(record);
          if(draft.kind!=='carousel')return;
          const saved=await saveSiteContent(supabase,record);setDraft({...record,id:saved.id});
          const refreshed=await content.reload();if(refreshed?.ok===false)throw new Error(REFRESH_WARNING);
          setMessage('Content saved.');
        }} onBusy={active=>{setUploading(active);if(active)setMessage('');}} />{draft.image_url && <img className="image-preview" src={draft.image_url} alt={t("Selected upload")} />}<button type="button" onClick={() => setDraft({
          ...draft,
          image_url: ''
        })}>{t("Remove image from content")}</button></>}
    <label className="checkbox-label"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({
          ...draft,
          enabled: e.target.checked
        })} />{t("Publicly visible")}</label>
    <button className="btn-primary" disabled={busy || uploading}>{t(busy ? 'Saving...' : 'Save content')}</button> <button type="button" className="btn-outline" onClick={() => setDraft(fresh())}>{t("Cancel / New")}</button></fieldset></form><p role="status">{t(message)}</p>
    {content.items.filter(item => kinds.includes(item.kind)).map(item => <div className="pending-row" key={item.id}><span>{t(item.kind)}{t(":") + " "}{item.title || t("Untitled content")}{t("(")}{item.enabled ? t("Visible") : t("Hidden")}{t(")")}</span><div className="pending-actions"><button disabled={busy || uploading} onClick={() => setDraft(item)}>{t("Edit")}</button><button disabled={busy || uploading} onClick={async () => {
          if (!window.confirm(t('Delete this content record?'))) return;
          setBusy(true);
          try {
            await deleteRecord(supabase,'site_content',item.id);
            const refreshed=await content.reload();
            setDraft(fresh());
            setMessage(refreshed?.ok===false ? REFRESH_WARNING : 'Your changes have been saved.');
          } catch(error){logDiagnostic(error);setMessage(friendlyMessage(error));}
          finally{setBusy(false);}
        }}>{t("Delete")}</button></div></div>)}
  </div>;
}
export function CommitteeHistory({
  members
}) {
  const {
    t
  } = useLanguage();
  const years = [...new Set(members.filter(m => m.is_current === false).map(m => m.committee_year).filter(Boolean))].sort((a, b) => b - a);
  return <>{years.map(year => <details className="content-card committee-history" key={year}><summary>{t("Committee of") + " "}{year}</summary><div className="committee-grid">{members.filter(m => m.is_current === false && m.committee_year === year).map(m => <article className="committee-card" key={m.id}>{m.photo_url && <img className="image-preview" src={m.photo_url} alt={m.name} />}<h3>{m.name}</h3><strong>{m.position}</strong><p>{m.batch}</p><p>{m.introduction}</p></article>)}</div></details>)}</>;
}
