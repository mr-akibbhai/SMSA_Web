import { useLanguage } from "../lib/i18n";
import { friendlyMessage, logDiagnostic } from '../lib/notifications';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { saveSiteContent, validateImage, compareDisplayOrder } from '../lib/domain';
export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
export function ImageUpload({
  userId,
  admin = false,
  onUploaded
}) {
  const {
    t
  } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="upload-field"><label>{t("Upload image (JPEG, PNG or WebP, maximum 10 MB)")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');
        setBusy(true);
        try {
          if (!userId) throw new Error('Please sign in first.');
          const validation = validateImage(file);
          if (validation) throw new Error(validation);
          const path = `${admin ? 'admin' : userId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`;
          const {
            error
          } = await supabase.storage.from('site-media').upload(path, file, {
            contentType: file.type
          });
          if (error) throw error;
          const {
            data
          } = supabase.storage.from('site-media').getPublicUrl(path);
          onUploaded(data.publicUrl);
        } catch (err) {
          logDiagnostic(err), setError(friendlyMessage(err));
        } finally {
          setBusy(false);
          e.target.value = '';
        }
      }} /></label>{busy && <p role="status">{t("Uploading\u2026")}</p>}{error && <p role="alert">{t(error)}</p>}</div>;
}
export function useSiteContent() {
  const sequence = useRef(0);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  async function reload() {
    const request = ++sequence.current;
    if (!supabase) return;
    const {
      data,
      error
    } = await supabase.from('site_content').select('*').order('display_order').order('created_at').order('id');
    if (request !== sequence.current) return;
    if (error) {
      setError('Additional website content is unavailable. Please retry; the database setup may be pending.');
      return;
    }
    setError('');
    setItems((data || []).sort(compareDisplayOrder));
  }
  return {
    items,
    error,
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
export function CommunityLinks({
  items
}) {
  const {
    t
  } = useLanguage();
  return <div className="community-links">{items.filter(i => i.kind === 'social' && i.enabled && safeLink(i.url)).map(i => <a className="btn-outline" href={safeLink(i.url)} key={i.id} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">{i.key === 'facebook' ? t("\u24D5") : t("\u2709")}</span> {i.title || (i.key === 'facebook' ? t("Facebook Group") : t("Messenger Group"))}</a>)}</div>;
}
export function Carousel({
  items
}) {
  const {
    t
  } = useLanguage();
  const slides = items.filter(i => i.kind === 'carousel' && i.enabled && safeLink(i.image_url));
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides.length ? index % slides.length : 0;
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);
  if (!slides.length) return null;
  return <section className="home-carousel container" aria-label={t("SMSA highlights")} aria-roledescription="carousel" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)}>
    <div className="carousel-window"><div className="carousel-track" style={{
        transform: `translateX(-${current * 100}%)`
      }}>{slides.map((s, i) => <figure key={s.id} aria-hidden={i !== current}><img src={s.image_url} alt={s.title || t("SMSA community highlight")} /><figcaption>{s.title}</figcaption></figure>)}</div></div>
    <div className="carousel-controls"><button onClick={() => setIndex((current + slides.length - 1) % slides.length)} aria-label={t("Previous slide")}>{t("\u2190")}</button><span>{current + 1}{t("/") + " "}{slides.length}</span><button onClick={() => setIndex((current + 1) % slides.length)} aria-label={t("Next slide")}>{t("\u2192")}</button><button onClick={() => setPaused(!paused)}>{paused ? t("Play") : t("Pause")}</button></div>
  </section>;
}
const blank = {
  kind: 'official',
  key: 'smsa',
  title: '',
  description: '',
  image_url: '',
  url: '',
  enabled: true,
  display_order: 0
};
export function ContentManager({
  content,
  userId,
  batchNames
}) {
  const {
    t
  } = useLanguage();
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (draft.kind === 'social' && draft.url && !safeLink(draft.url)) throw new Error('Use a complete HTTPS community URL.');
      await saveSiteContent(supabase, draft);
      setDraft(blank);
      await content.reload();
      setMessage('Content saved.');
    } catch (err) {
      logDiagnostic(err), setMessage(friendlyMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return <div className="content-card"><h3>{t("Website Content Management")}</h3><p>{t("Official SMSA Profile \xB7 Batch Profiles \xB7 Social Media & Community Links \xB7 Homepage Carousel \xB7 About Images")}</p>
    {content.error && <p role="alert">{t(content.error)}</p>}<form onSubmit={save}>
    <label>{t("Content type")}<select value={draft.kind} onChange={e => setDraft({
          ...blank,
          id: draft.id,
          kind: e.target.value,
          key: e.target.value === 'official' ? 'smsa' : ''
        })}><option value="official">{t("Official SMSA Profile")}</option><option value="batch">{t("Batch Profile")}</option><option value="social">{t("Social Media & Community Links")}</option><option value="carousel">{t("Homepage Carousel")}</option><option value="about">{t("About Images")}</option></select></label>
    {draft.kind === 'batch' ? <label>{t("Batch")}<select required value={draft.key} onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })}><option value="">{t("Select batch")}</option>{batchNames.map(n => <option key={n}>{n}</option>)}</select></label> : draft.kind === 'social' ? <label>{t("Community")}<select value={draft.key} required onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })}><option value="">{t("Choose community")}</option><option value="facebook">{t("Facebook Group")}</option><option value="messenger">{t("Messenger Group")}</option></select></label> : ['carousel', 'about'].includes(draft.kind) ? <label>{t("Unique slide name")}<input required value={draft.key} onChange={e => setDraft({
          ...draft,
          key: e.target.value
        })} /></label> : null}
    <label>{t("Title")}<input required value={draft.title} onChange={e => setDraft({
          ...draft,
          title: e.target.value
        })} /></label>
    {draft.kind === 'social' ? <label>{t("Group URL")}<input type="url" required value={draft.url} onChange={e => setDraft({
          ...draft,
          url: e.target.value
        })} /></label> : <><label>{t("Introduction / information")}<textarea value={draft.description} onChange={e => setDraft({
            ...draft,
            description: e.target.value
          })} /></label><ImageUpload userId={userId} admin onUploaded={image_url => setDraft(d => ({
          ...d,
          image_url
        }))} />{draft.image_url && <img className="image-preview" src={draft.image_url} alt={t("Selected upload")} />}<button type="button" onClick={() => setDraft({
          ...draft,
          image_url: ''
        })}>{t("Remove image from content")}</button></>}
    <label>{t("Display order")}<input type="number" value={draft.display_order} onChange={e => setDraft({
          ...draft,
          display_order: Number(e.target.value)
        })} /></label>
    <label className="checkbox-label"><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({
          ...draft,
          enabled: e.target.checked
        })} />{t("Publicly visible")}</label>
    <button className="btn-primary" disabled={busy}>{t("Save content")}</button> <button type="button" className="btn-outline" onClick={() => setDraft(blank)}>{t("Cancel / New")}</button></form><p role="status">{t(message)}</p>
    {content.items.map(item => <div className="pending-row" key={item.id}><span>{t(item.kind)}{t(":") + " "}{item.title}{t("(")}{item.enabled ? t("Visible") : t("Hidden")}{t(")")}</span><div className="pending-actions"><button onClick={() => setDraft(item)}>{t("Edit")}</button><button disabled={busy} onClick={async () => {
          if (!window.confirm(t('Delete this content record?'))) return;
          setBusy(true);
          const {
            error
          } = await supabase.from('site_content').delete().eq('id', item.id);
          if (error) logDiagnostic(error), setMessage(friendlyMessage(error));else {
            await content.reload();
            setDraft(blank);
          }
          setBusy(false);
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
