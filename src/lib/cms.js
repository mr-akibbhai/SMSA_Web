import { formatBatchName } from './domain.js';

const missingRow = () => new Error('Your changes could not be saved. Please refresh and try again.');
export async function saveRecord(client, table, payload, id) {
  const query = id == null ? client.from(table).insert(payload) : client.from(table).update(payload).eq('id', id);
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  if (data?.id == null || id != null && String(data.id) !== String(id)) throw missingRow();
  return data;
}
export async function deleteRecord(client, table, id) {
  const { data, error } = await client.from(table).delete().eq('id',id).select('id').single();
  if (error) throw error;
  if (data?.id == null || String(data.id) !== String(id)) throw missingRow();
  return data;
}
export function eventPayload(draft,extended=true) {
  if(!extended)draft={...draft,image_url:null};
  if(![draft.title,draft.description,draft.event_date,draft.location,draft.image_url].some(value=>String(value || '').trim()))throw new Error('Add event information or an image before saving.');
  return {title:draft.title?.trim() || '',description:draft.description || '',location:draft.location || '',event_date:draft.event_date || null,...(extended ? {image_url:draft.image_url || null,enabled:draft.enabled !== false} : {})};
}
export function committeePayload(draft) {
  if (!draft.name?.trim() || !draft.position?.trim()) throw new Error('Member name and position are required.');
  const year=draft.committee_year === '' || draft.committee_year == null ? null : Number(draft.committee_year);
  if(year !== null && (!Number.isInteger(year) || year < 1900 || year > 2200)) throw new Error('Please enter a valid committee year.');
  return {name:draft.name.trim(),position:draft.position.trim(),batch:formatBatchName(draft.batch) || null,photo_url:draft.photo_url || null,introduction:draft.introduction || '',committee_year:year,is_current:draft.is_current !== false};
}
export function committeeYears(members, currentYear=new Date().getFullYear(), selectedYear) {
  const years=Array.from({length:Math.max(0,currentYear-2005)},(_,i)=>2006+i);
  return [...new Set([...years,...members.map(m=>Number(m.committee_year)),Number(selectedYear)].filter(y=>Number.isInteger(y) && y>=1900 && y<=2200))].sort((a,b)=>a-b);
}
export function committeeForGroup(members, group) {
  if(group === 'current')return members.filter(m=>m.is_current !== false);
  if(group === 'undated')return members.filter(m=>!m.committee_year);
  if(!/^\d{4}$/.test(String(group)) || Number(group)<1900 || Number(group)>2200)return [];
  return members.filter(m=>m.committee_year != null && String(m.committee_year) === String(group));
}
export function visibleGalleryRows(rows, batchId, userId, admin=false) {
  return rows.filter(row=>String(row.batch_id) === String(batchId) && (row.status === 'approved' || admin || Boolean(userId && row.uploader_id === userId)));
}
export function resolveBatch(batches, selection) {
  if(!selection)return null;
  if(selection.id != null)return batches.find(batch=>String(batch.id)===String(selection.id)) || null;
  return batches.find(batch=>formatBatchName(batch.name)===formatBatchName(selection.name)) || null;
}
export function galleryInsert(batch, profile, userId, path, caption) {
  if(!userId || !batch?.is_active || formatBatchName(profile?.batch) !== formatBatchName(batch.name))throw new Error('You can upload photos only to your own active batch.');
  if(!path.startsWith(`${batch.id}/${userId}/`))throw new Error('Invalid gallery upload association.');
  return {batch_id:batch.id,uploader_id:userId,storage_path:path,caption:caption?.trim() || null,status:'pending'};
}

export const REFRESH_WARNING='Saved, but refreshing failed. Please retry loading the latest records.';

export async function signedGalleryImages(client,photos,cache,scope,now=Date.now()) {
  return Promise.all(photos.map(async photo=>{
    const key=JSON.stringify([scope,photo.storage_path]);
    const cached=cache.get(key);
    if(cached?.expiresAt>now)return {...photo,image_url:cached.url};
    const {data,error}=await client.storage.from('batch-gallery').createSignedUrl(photo.storage_path,3600);
    const url=error ? null : data?.signedUrl || null;
    if(url){cache.set(key,{url,expiresAt:now+3540000});if(cache.size>600)cache.delete(cache.keys().next().value);}
    return {...photo,image_url:url};
  }));
}
