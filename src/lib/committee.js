export const DEFAULT_POSITIONS=['উপদেষ্টা','সভাপতি','সহ-সভাপতি','সাধারণ সম্পাদক','যুগ্ম সাধারণ সম্পাদক','সাংগঠনিক সম্পাদক','ছাত্রী বিষয়ক সম্পাদক'];
const aliases=[['advisor','adviser'],['president'],['vice president','vice-president'],['general secretary'],['joint general secretary'],['organizing secretary','organising secretary'],['female affairs secretary','ছাত্রী বিষয়ক সম্পাদক']];
export function positionKey(name){
  const key=String(name || '').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
  const index=DEFAULT_POSITIONS.findIndex((label,i)=>[label,...aliases[i]].some(alias=>alias.normalize('NFC').toLowerCase()===key));
  return index<0 ? key : DEFAULT_POSITIONS[index];
}
export function positionGroups(members,layout){
  const names=[...(layout?.positions || []),...DEFAULT_POSITIONS,...members.map(m=>m.position)];
  const groups=[];
  for(const name of names){const key=positionKey(name) || '__smsa_missing_position__';if(!groups.some(g=>g.key===key))groups.push({key,name:name || '',members:[]});}
  const memberOrder=new Map((layout?.member_ids || []).map((id,i)=>[String(id),i]));
  for(const member of members)groups.find(g=>g.key===(positionKey(member.position) || '__smsa_missing_position__'))?.members.push(member);
  const recordedOrder=member=>Number.isInteger(member.display_order) ? member.display_order : Infinity;
  for(const group of groups)group.members.sort((a,b)=>(memberOrder.get(String(a.id)) ?? Infinity)-(memberOrder.get(String(b.id)) ?? Infinity) || recordedOrder(a)-recordedOrder(b) || String(a.id).localeCompare(String(b.id),'en',{numeric:true}));
  return groups;
}
export function arrangedCommittee(members,layouts=[]){
  const yearOf=member=>Number(member.committee_year) || 0;
  const years=[...new Set(members.map(yearOf))].sort((a,b)=>b-a);
  return years.flatMap(year=>positionGroups(members.filter(member=>yearOf(member)===year),layouts.find(item=>item.year===year)).flatMap(group=>group.members));
}
export function moveEntry(items,index,direction){
  const target=index+direction;if(target<0 || target>=items.length)return items;
  const next=[...items];[next[index],next[target]]=[next[target],next[index]];return next;
}
export function committeeMemberSnapshot(members){
  return Object.fromEntries(members.map(member=>[String(member.id),{position:member.position,display_order:member.display_order ?? null}]));
}
export function applyCommitteeRanks(members,layout){
  const rank=new Map(layout.member_ids.map((id,index)=>[id,index+1]));
  return members.map(member=>Number(member.committee_year)===layout.year && rank.has(String(member.id)) ? {...member,display_order:rank.get(String(member.id))} : member);
}
export function layoutPayload(year,groups,members,revision=0){
  if(!Number.isInteger(Number(year)) || Number(year)<1900 || Number(year)>2200)throw new Error('Choose a committee year before arranging positions.');
  if(!members.length)throw new Error('Year selected. Add a verified member to publish this committee year.');
  if(!Number.isInteger(revision) || revision<0)throw new Error('Committee membership changed. Reload before saving the order.');
  const ids=groups.flatMap(group=>group.members.map(m=>String(m.id)));
  if(new Set(ids).size!==members.length || ids.length!==members.length || members.some(m=>!ids.includes(String(m.id))))throw new Error('Committee membership changed. Reload before saving the order.');
  if(members.some(member=>Number(member.committee_year)!==Number(year)))throw new Error('Committee membership changed. Reload before saving the order.');
  return {p_year:Number(year),p_positions:groups.map(g=>g.name),p_member_ids:ids,p_expected_revision:revision,p_expected_members:committeeMemberSnapshot(members)};
}
function validLayout(layout){
  return layout && Number.isInteger(layout.year) && layout.year>=1900 && layout.year<=2200
    && Number.isInteger(layout.revision) && layout.revision>=0
    && Array.isArray(layout.positions) && layout.positions.every(name=>typeof name==='string')
    && Array.isArray(layout.member_ids) && layout.member_ids.every(id=>typeof id==='string' && id.length>0)
    && new Set(layout.member_ids).size===layout.member_ids.length;
}
export async function readCommitteeLayouts(client){
  const {data,error}=await client.rpc('smsa_get_committee_layouts_v1',{}, {get:true});
  if(error)throw error;
  if(data?.version!==1 || !Array.isArray(data.layouts) || data.layouts.some(layout=>!validLayout(layout)) || new Set(data.layouts.map(layout=>layout.year)).size!==data.layouts.length)throw new Error('Committee ordering is not enabled yet.');
  return data.layouts;
}
export async function writeCommitteeLayout(client,payload){
  const {data,error}=await client.rpc('smsa_save_committee_layout_v1',payload);
  if(error)throw error;
  if(data?.version!==1 || !validLayout(data.layout) || data.layout.year!==payload.p_year
    || data.layout.revision!==payload.p_expected_revision+1
    || JSON.stringify(data.layout.positions)!==JSON.stringify(payload.p_positions)
    || JSON.stringify(data.layout.member_ids)!==JSON.stringify(payload.p_member_ids))throw new Error('Your changes could not be saved. Please refresh and try again.');
  return data.layout;
}
