export function formatBatchName(name) {
  if (!name) return '';
  const value = String(name).trim();
  const match = value.match(/^(?:batch|dakhil)[-\s]*(\d{2}|\d{4})$/i);
  if (!match) return value;
  return `Dakhil-${match[1].length === 2 ? '20' + match[1] : match[1]}`;
}
export function compareDisplayOrder(a, b) {
  const order = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  return order(a.display_order) - order(b.display_order)
    || String(a.created_at || '').localeCompare(String(b.created_at || ''))
    || String(a.id || a.key || a.name || '').localeCompare(String(b.id || b.key || b.name || ''));
}
export function validateImage(file) {
  if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type)) return 'Please choose a JPEG, PNG or WebP image.';
  if (file.size > 10 * 1024 * 1024) return 'Please select an image smaller than 10 MB.';
  return '';
}
export function validatePhone(phone) {
  return !phone?.trim() || /^[+\d][\d\s()-]{5,19}$/.test(phone.trim());
}
export const CONTENT_KINDS=['official','batch','social','carousel','about'];
export async function saveSiteContent(client, draft) {
  if(!CONTENT_KINDS.includes(draft.kind))throw new Error('Unsupported content type. Please reload the editor.');
  const payload = Object.fromEntries(['kind','key','title','description','image_url','url','enabled','display_order'].map(key => [key,draft[key]]));
  if (payload.kind === 'official') payload.key = 'smsa';
  const table = client.from('site_content');
  // Existing identity never depends on an editable natural key.
  const query = draft.id ? table.update(payload).eq('id', draft.id) : table.insert(payload);
  const {data,error} = await query.select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Your changes could not be saved. Please refresh and try again.');
  return data;
}
export function batchUpdatePayload(batch,name,order){
 const canonical=formatBatchName(name);
 if(!canonical)throw new Error('Please enter a batch name.');
 if(order !== undefined && !Number.isInteger(Number(order)))throw new Error('Please enter a whole number for display order.');
 return {name:canonical===formatBatchName(batch.name)?batch.name:canonical,...(order === undefined ? {} : {display_order:Number(order)})};
}
export async function updateMemberProfile(client,person){
 if(!person?.id)throw new Error('Please refresh the member list and try again.');
 if(!person.full_name?.trim() || !person.batch)throw new Error('Full Name and Batch are required.');
 if(!validatePhone(person.phone))throw new Error('Please enter a valid phone number.');
 const payload={full_name:person.full_name.trim(),address:person.address||null,batch:formatBatchName(person.batch),phone:person.phone||null,blood_group:person.blood_group||null,bio:person.bio||null};
 const {data,error}=await client.from('profiles').update(payload).eq('id',person.id).select('id').single();
 if(error)throw error;
 if(!data)throw new Error('Your changes could not be saved. Please refresh and try again.');
 return data;
}
export async function deleteGalleryRecord(client,photo){
 const row=await client.from('gallery_photos').delete().eq('id',photo.id).select('id').single();
 if(row.error)throw row.error;
 if(!row.data)throw new Error('Your changes could not be saved. Please refresh and try again.');
 try {const cleanup=await client.storage.from('batch-gallery').remove([photo.storage_path]);return {cleanupError:cleanup.error||null};}
 catch(error){return {cleanupError:error};}
}
