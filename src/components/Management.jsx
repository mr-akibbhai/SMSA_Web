import { useState } from 'react';
import { BookOpen, CalendarDays, Layers, Users, Image, ShieldCheck, Link, Settings, ArrowUpRight } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { saveSiteContent } from '../lib/domain';
import { friendlyMessage, logDiagnostic } from '../lib/notifications';
import { ImageUpload, safeLink } from './ContentFeatures';

export const managementSections = [
  ['about', 'About Management', BookOpen, 'Tell our story and manage About images.'],
  ['events', 'Events Management', CalendarDays, 'Publish news, gatherings and community events.'],
  ['batches', 'Batch Management', Layers, 'Keep every generation connected.'],
  ['members', 'Alumni Management', Users, 'Review members and manage alumni profiles.'],
  ['gallery', 'Gallery Management', Image, 'Review photographs and celebrate shared memories.'],
  ['committee', 'Committee Management', ShieldCheck, 'Maintain current and historical committees.'],
  ['social', 'Social Links Management', Link, 'Update our Facebook and Messenger communities.'],
  ['content', 'Brand & Highlights', Settings, 'Manage the logo, association profile and legacy highlights.']
];

export function DashboardNavigation({ panel, onSelect }) {
  const { t } = useLanguage();
  return <nav className="cms-navigation" aria-label={t('Management sections')}>
    <button className={panel === 'overview' ? 'selected' : ''} onClick={() => onSelect('overview')}>{t('Overview')}</button>
    {managementSections.map(([id, title, Icon]) => <button className={panel === id ? 'selected' : ''} aria-current={panel === id ? 'page' : undefined} key={id} onClick={() => onSelect(id)}><Icon size={17} />{t(title)}</button>)}
  </nav>;
}

export function DashboardOverview({ onSelect }) {
  const { t } = useLanguage();
  return <div className="dashboard-grid">{managementSections.map(([id,title,Icon,description]) => <button className="dashboard-card" key={id} onClick={() => onSelect(id)}><span className="dashboard-card-icon"><Icon size={25} /></span><h3>{t(title)}</h3><p>{t(description)}</p><span className="dashboard-card-link">{t('Open management')}<ArrowUpRight size={18} /></span></button>)}</div>;
}

const newContent = (kind, key) => ({ kind, key, title:'', description:'', image_url:'', url:'', enabled:true });

export function AboutManager({ content, userId }) {
  const { t } = useLanguage();
  const story = content.items.find(item => item.kind === 'about' && item.key === 'story');
  const images = content.items.filter(item => item.kind === 'about' && item.key !== 'story');
  const [draft, setDraft] = useState(null);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const value = draft || story || newContent('about','story');
  async function save(e, record, reset) {
    e.preventDefault();
    if (busy || uploading) return;
    setBusy(true); setMessage('');
    try {
      await saveSiteContent(supabase, record);
      await content.reload(); reset(); setMessage(t('Content saved.'));
    } catch(error) { logDiagnostic(error); setMessage(t(friendlyMessage(error))); }
    finally { setBusy(false); }
  }
  async function remove(record) {
    if (busy || uploading || !window.confirm(t('Remove this About image? The stored file will be preserved.'))) return;
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('site_content').delete().eq('id',record.id).select('id').single();
      if(error) throw error;
      await content.reload(); if(image?.id === record.id) setImage(null); setMessage(t('Your changes have been saved.'));
    } catch(error) { logDiagnostic(error); setMessage(t(friendlyMessage(error))); }
    finally { setBusy(false); }
  }
  return <div className="about-management">
    <div className="content-card"><span className="eyebrow">{t('OUR STORY')}</span><h2>{t('About Management')}</h2>
      {content.error && <p role="alert">{t(content.error)}</p>}
      <form onSubmit={e => save(e,value,() => setDraft(null))}><fieldset disabled={busy || uploading}>
        <label>{t('About title')}<input required value={value.title} onChange={e => setDraft({...value,title:e.target.value})} /></label>
        <label>{t('About description')}<textarea required rows={6} value={value.description} onChange={e => setDraft({...value,description:e.target.value})} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={value.enabled} onChange={e => setDraft({...value,enabled:e.target.checked})} />{t('Publicly visible')}</label>
        <div className="form-actions"><button className="btn-primary">{t(busy ? 'Saving...' : 'Save Changes')}</button><button type="button" className="btn-outline" onClick={() => setDraft(null)}>{t('Cancel')}</button></div>
      </fieldset></form>
    </div>
    <div className="content-card"><h3>{t('About images')}</h3><p>{t('Add up to four images. Public images fade every two seconds. Existing files are preserved when an image is replaced or removed.')}</p>
      <div className="cms-image-grid">{images.map(item => <article key={item.id}>{safeLink(item.image_url) && <img src={item.image_url} alt={item.title} />}<h4>{item.title}</h4><span>{t(item.enabled ? 'Visible' : 'Hidden')}</span><div className="form-actions"><button className="btn-outline" disabled={busy || uploading} onClick={() => setImage(item)}>{t('Edit')}</button><button className="reject-btn" disabled={busy || uploading} onClick={() => remove(item)}>{t('Remove image')}</button></div></article>)}</div>
      {!image && <button className="btn-primary" disabled={images.length >= 4 || busy || uploading} onClick={() => setImage(newContent('about','image-'+crypto.randomUUID()))}>{t('Add About image')}</button>}
      {image && <form key={image.id || image.key} onSubmit={e => save(e,image,() => setImage(null))}><fieldset disabled={busy || uploading}>
        <label>{t('Image caption')}<input required value={image.title} onChange={e => setImage({...image,title:e.target.value})} /></label>
        <ImageUpload userId={userId} admin onBusy={setUploading} onUploaded={image_url => setImage(current => ({...current,image_url}))} />
        {safeLink(image.image_url) && <img className="image-preview" src={image.image_url} alt={t('Selected upload')} />}
        <label className="checkbox-label"><input type="checkbox" checked={image.enabled} onChange={e => setImage({...image,enabled:e.target.checked})} />{t('Publicly visible')}</label>
        <div className="form-actions"><button className="btn-primary" disabled={!image.image_url}>{t(busy ? 'Saving...' : 'Save image')}</button><button type="button" className="btn-outline" onClick={() => setImage(null)}>{t('Cancel')}</button></div>
      </fieldset></form>}
    </div><p role="status">{message}</p>
  </div>;
}

function SocialLinkEditor({ item, community, content }) {
  const { t } = useLanguage();
  const [draft,setDraft] = useState(null), [busy,setBusy] = useState(false), [message,setMessage] = useState('');
  const value = draft || item || {...newContent('social',community),title:community === 'facebook' ? 'Facebook Group' : 'Messenger Group'};
  async function save(e) {
    e.preventDefault(); if(busy) return;
    if(value.url && !safeLink(value.url)) {setMessage(t('Use a complete HTTPS community URL.'));return;}
    setBusy(true); setMessage('');
    try {
      await saveSiteContent(supabase,{...value,enabled:Boolean(value.url.trim()) && value.enabled});
      await content.reload();setDraft(null);setMessage(t('Content saved.'));
    } catch(error){logDiagnostic(error);setMessage(t(friendlyMessage(error)));}
    finally{setBusy(false);}
  }
  return <form className="content-card" onSubmit={save}><h3>{t(community === 'facebook' ? 'Facebook Group' : 'Messenger Group')}</h3><fieldset disabled={busy}>
    <label>{t('Group URL')}<input type="url" value={value.url} placeholder="https://" onChange={e => setDraft({...value,url:e.target.value})} /></label>
    <label className="checkbox-label"><input type="checkbox" checked={value.enabled} onChange={e => setDraft({...value,enabled:e.target.checked})} />{t('Publicly visible')}</label>
    <div className="form-actions"><button className="btn-primary">{t(busy ? 'Saving...' : 'Save Changes')}</button><button type="button" className="btn-outline" onClick={() => setDraft(null)}>{t('Cancel')}</button></div></fieldset><p role="status">{message}</p>
  </form>;
}

export function SocialLinksManager({ content }) {
  const { t } = useLanguage();
  return <><h2>{t('Social Links Management')}</h2><p>{t('Empty or hidden links will not appear in the footer.')}</p>{content.error && <p role="alert">{t(content.error)}</p>}<div className="social-management">{['facebook','messenger'].map(community => <SocialLinkEditor key={community} community={community} item={content.items.find(item => item.kind === 'social' && item.key === community)} content={content} />)}</div></>;
}
