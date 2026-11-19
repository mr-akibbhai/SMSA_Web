import { useRef, useState } from 'react';
import { ArrowUp,ArrowDown } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { positionGroups,positionKey,moveEntry,layoutPayload,writeCommitteeLayout } from '../lib/committee';
import { friendlyMessage,logDiagnostic } from '../lib/notifications';
import { supabase } from '../lib/supabase';

export default function CommitteeOrdering({year,members,layout,available,onSaved}){
  const {t}=useLanguage();
  const [groups,setGroups]=useState(()=>positionGroups(members,layout));
  const [newPosition,setNewPosition]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const lock=useRef(false);
  function addPosition(e){
    e.preventDefault();const name=newPosition.trim();if(!name)return;
    if(groups.some(g=>g.key===positionKey(name))){setMessage(t('This position already exists.'));return;}
    setGroups([...groups,{key:positionKey(name),name,members:[]}]);setNewPosition('');setMessage('');
  }
  async function save(){
    if(!available || lock.current)return;
    lock.current=true;setBusy(true);setMessage('');
    try {const saved=await writeCommitteeLayout(supabase,layoutPayload(year,groups,members,layout?.revision || 0));await onSaved(saved);setMessage(t('Committee order saved.'));}
    catch(error){logDiagnostic(error);setMessage(t(friendlyMessage(error)));}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className="committee-ordering content-card" aria-label={t('Committee ordering')}><h3>{t('Arrange positions and members')}</h3>
    <p>{t('Move positions up or down, then arrange members within each position. Public pages show only the final order.')}</p>
    {!available && <p role="status">{t('Committee ordering is not enabled yet.')}</p>}
    <form onSubmit={addPosition}><fieldset disabled={busy}><label>{t('New position')}<input value={newPosition} onChange={e=>setNewPosition(e.target.value)}/></label><button className="btn-outline">{t('Add position')}</button></fieldset></form>
    <fieldset disabled={busy}>{groups.map((group,index)=><div className="position-order-group" key={group.key}><div className="position-order-heading"><strong>{group.name || t('Position not recorded')}</strong><div className="order-actions"><button type="button" disabled={!index} aria-label={t('Move position up')+' '+(group.name || t('Position not recorded'))} onClick={()=>setGroups(moveEntry(groups,index,-1))}><ArrowUp size={17}/></button><button type="button" disabled={index===groups.length-1} aria-label={t('Move position down')+' '+(group.name || t('Position not recorded'))} onClick={()=>setGroups(moveEntry(groups,index,1))}><ArrowDown size={17}/></button></div></div>
      {group.members.map((member,memberIndex)=><div className="member-order-row" key={member.id}><span>{member.name}</span><div className="order-actions"><button type="button" disabled={!memberIndex} aria-label={t('Move member up')+' '+member.name} onClick={()=>setGroups(groups.map(g=>g.key===group.key ? {...g,members:moveEntry(g.members,memberIndex,-1)} : g))}><ArrowUp size={17}/></button><button type="button" disabled={memberIndex===group.members.length-1} aria-label={t('Move member down')+' '+member.name} onClick={()=>setGroups(groups.map(g=>g.key===group.key ? {...g,members:moveEntry(g.members,memberIndex,1)} : g))}><ArrowDown size={17}/></button></div></div>)}
    </div>)}</fieldset><div className="form-actions"><button className="btn-primary" disabled={!available || busy || !members.length} onClick={save}>{t(busy ? 'Saving...' : 'Save committee order')}</button><button className="btn-outline" disabled={busy} onClick={()=>{setGroups(positionGroups(members,layout));setMessage('');}}>{t('Reset changes')}</button></div><p role="status">{message}</p>
  </section>;
}
