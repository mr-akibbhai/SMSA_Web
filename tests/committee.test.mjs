import assert from 'node:assert/strict';
import { DEFAULT_POSITIONS,positionGroups,arrangedCommittee,moveEntry,layoutPayload,readCommitteeLayouts,writeCommitteeLayout,committeeMemberSnapshot,applyCommitteeRanks } from '../src/lib/committee.js';
const members=[{id:'z',name:'Z',position:'সভাপতি',committee_year:2026},{id:'a',name:'A',position:'উপদেষ্টা',committee_year:2026},{id:'b',name:'B',position:'সভাপতি',committee_year:2026},{id:'c',name:'C',position:'ক্রীড়া সম্পাদক',committee_year:2026}];
assert.deepEqual(arrangedCommittee(members).map(m=>m.id),['a','b','z','c']);
const layout={year:2026,positions:['ক্রীড়া সম্পাদক','সভাপতি','উপদেষ্টা'],member_ids:['c','z','b','a'],revision:4};
assert.deepEqual(arrangedCommittee(members,[layout]).map(m=>m.id),['c','z','b','a'],'Configured position/member order overrides names and default hierarchy');
assert.equal(positionGroups([{id:1,position:'President'},{id:2,position:'সভাপতি'}]).find(g=>g.key==='সভাপতি').members.length,2);
assert.deepEqual(moveEntry(['a','b'],1,-1),['b','a']);assert.deepEqual(moveEntry(['a','b'],0,-1),['a','b']);
assert.equal(DEFAULT_POSITIONS.length,7);
assert.equal(arrangedCommittee([{id:'legacy',name:'Legacy member',position:null}]).length,1,'Legacy members without a recorded position are preserved');
assert.deepEqual(arrangedCommittee([{id:'a',position:'President',display_order:null},{id:'b',position:'President',display_order:2},{id:'c',position:'President',display_order:1}]).map(m=>m.id),['c','b','a'],'Reuse confirmed integer display_order; NULL sorts last');
assert.deepEqual(arrangedCommittee([
 {id:'new-advisor',position:'উপদেষ্টা',committee_year:2026},
 {id:'new-president',position:'সভাপতি',committee_year:2026},
 {id:'old-advisor',position:'উপদেষ্টা',committee_year:2025},
 {id:'old-president',position:'সভাপতি',committee_year:2025},
 {id:'undated',position:'সভাপতি',committee_year:null}
],[{year:2026,positions:['সভাপতি','উপদেষ্টা'],member_ids:[]},{year:2025,positions:['উপদেষ্টা','সভাপতি'],member_ids:[]}]).map(m=>m.id),['new-president','new-advisor','old-advisor','old-president','undated'],'Each year retains its own position order and undated members remain visible');
assert.deepEqual(layoutPayload(2026,positionGroups(members,layout),members,4).p_member_ids,['c','z','b','a']);
assert.throws(()=>layoutPayload(2026,positionGroups(members.slice(1)),members));
assert.equal((await readCommitteeLayouts({rpc:async(name,args,options)=>{assert.equal(options.get,true);return {data:{version:1,layouts:[layout]}};}}))[0].revision,4);
await assert.rejects(()=>readCommitteeLayouts({rpc:async()=>({data:[]})}));
for(const invalid of [{...layout,revision:-1},{...layout,member_ids:['a','a']},{...layout,year:'2026'}]){
 await assert.rejects(()=>readCommitteeLayouts({rpc:async()=>({data:{version:1,layouts:[invalid]}})}));
}
await assert.rejects(()=>readCommitteeLayouts({rpc:async()=>({data:{version:1,layouts:[layout,layout]}})}));
const request=layoutPayload(2026,positionGroups(members,layout),members,4);
assert.deepEqual(request.p_expected_members.z,{position:'সভাপতি',display_order:null});
assert.notDeepEqual(committeeMemberSnapshot(members),committeeMemberSnapshot(members.map(m=>m.id==='z'?{...m,position:'Advisor'}:m)),'Same IDs with changed position must have a different snapshot');
assert.notDeepEqual(committeeMemberSnapshot(members),committeeMemberSnapshot(members.map(m=>m.id==='z'?{...m,display_order:3}:m)),'Direct rank edits must have a different snapshot');
const otherYear={id:'older',position:'President',committee_year:2025,display_order:33};
const ranked=applyCommitteeRanks([...members,otherYear],{year:2026,member_ids:['c','z','b','a']});
assert.strictEqual(ranked.at(-1),otherYear,'Other year is not mutated');
assert.equal(ranked.find(m=>m.id==='z').display_order,2);
assert.equal(members.find(m=>m.id==='z').display_order,undefined,'Original input is not mutated');
assert.equal(layoutPayload(2026,positionGroups(ranked.slice(0,-1),layout),ranked.slice(0,-1),5).p_expected_members.z.display_order,2,'Second save uses freshly confirmed ranks');
assert.throws(()=>layoutPayload(2025,positionGroups(members),members),/membership changed/);
const saved={...layout,positions:request.p_positions,member_ids:request.p_member_ids,revision:5};
assert.equal((await writeCommitteeLayout({rpc:async()=>({data:{version:1,layout:saved}})},request)).revision,5);
for(const invalid of [{year:2026},{...saved,revision:4},{...saved,revision:6},{...saved,member_ids:[...saved.member_ids].reverse()}]){
 await assert.rejects(()=>writeCommitteeLayout({rpc:async()=>({data:{version:1,layout:invalid}})},request));
}
assert.throws(()=>layoutPayload(2026,positionGroups(members),members,-1));
assert.throws(()=>layoutPayload(2027,positionGroups([]),[]),/Add a verified member/);
await assert.rejects(()=>writeCommitteeLayout({rpc:async()=>({error:{code:'40001'}})},{}),e=>e.code==='40001');
console.log('PASS: Bengali priority, confirmed display_order fallback, per-year position/member ordering, legacy preservation, membership checks, RPC contract and conflict handling. Live RPC deployment remains pending.');
