import assert from 'node:assert/strict';
import {formatBatchName,batchUpdatePayload,compareDisplayOrder,validateImage,validatePhone,saveSiteContent,updateMemberProfile,deleteGalleryRecord} from '../src/lib/domain.js';
import {friendlyMessage} from '../src/lib/notifications.js';
import {normalizeRoute} from '../src/lib/navigation.js';
assert.equal(normalizeRoute({page:'Admin'}).search,'','Partial history entries keep route defaults');
assert.equal(normalizeRoute({page:'Alumni',search:{unsafe:true}}).search,'');
assert.equal(normalizeRoute({page:'unknown'}).page,'Home');
assert.equal(normalizeRoute({page:'Admin',isAdmin:true}).isAdmin,undefined,'URLs do not supply authorization');
assert.deepEqual(batchUpdatePayload({name:'Batch 2020'},'Dakhil-2020'),{name:'Batch 2020'},'Editing without ordering preserves existing name and database fields');
for(const input of ['Batch-20','Dakhil-20','Dakhil-2020',' batch 20 ','DAKHIL2020'])assert.equal(formatBatchName(input),'Dakhil-2020');
assert.equal(formatBatchName(null),'');assert.equal(formatBatchName('Custom batch'),'Custom batch');assert.equal(formatBatchName('Batch-99'),'Dakhil-2099');assert.equal(formatBatchName('Batch-1999'),'Dakhil-1999');
assert.equal(validateImage({type:'image/png',size:10*1024*1024}),'');assert.ok(validateImage({type:'image/png',size:10*1024*1024+1}));assert.ok(validateImage({type:'image/svg+xml',size:100}));
assert.ok(validatePhone(''));assert.ok(validatePhone('+880 1712-345678'));assert.ok(!validatePhone('abc'));
assert.deepEqual([{id:'z',display_order:2},{id:'b'},{id:'a',display_order:null}].sort(compareDisplayOrder).map(r=>r.id),['a','b','z']);
for(const msg of ['new row violates row-level security policy','relation private_records does not exist','Storage bucket not found','Could not find table in schema cache','password=secret https://internal.example/key']){
 const result=friendlyMessage(msg);assert.notEqual(result,msg);assert.ok(!result.includes('private_records'));assert.ok(!result.includes('secret'));
}
const calls=[];
const client={from(table){assert.equal(table,'site_content');return {update(payload){calls.push(['update',payload]);return {eq(column,id){calls.push(['eq',column,id]);return {select(){return {single:async()=>({data:{id},error:null})}}}}}},insert(payload){calls.push(['insert',payload]);return {select(){return {single:async()=>({data:{id:'new-id'},error:null})}}}}}}};
await saveSiteContent(client,{id:'original-id',kind:'carousel',key:'renamed-key',title:'A',description:'',image_url:'',url:'',enabled:true,display_order:0,created_at:'old'});
assert.equal(calls[0][0],'update');assert.ok(!('id' in calls[0][1]));assert.ok(!('created_at' in calls[0][1]));assert.deepEqual(calls[1],['eq','id','original-id']);assert.equal(calls[0][1].key,'renamed-key');
calls.length=0;await saveSiteContent(client,{kind:'official',key:'wrong',title:'SMSA'});assert.equal(calls[0][0],'insert');assert.equal(calls[0][1].key,'smsa');
const failed={from(){return {update(){return {eq(){return {select(){return {single:async()=>({error:{code:'23505',message:'duplicate key'}})}}}}}}}}};
await assert.rejects(()=>saveSiteContent(failed,{id:'original',kind:'carousel',key:'taken'}),e=>e.code==='23505');
console.log('PASS: legacy batch normalization, stable ordering, image/phone validation, safe errors, key-renaming identity, create and conflict handling');

assert.deepEqual(batchUpdatePayload({name:'Batch-20'},'Dakhil-2020',3),{name:'Batch-20',display_order:3});

const memberCalls=[];
const memberClient={from(table){assert.equal(table,'profiles');return {update(payload){memberCalls.push(payload);return {eq(column,id){assert.equal(column,'id');assert.equal(id,'member-123');return {select(){return {single:async()=>({data:{id},error:null})}}}}}}}}};
await updateMemberProfile(memberClient,{id:'member-123',full_name:' Member Name ',batch:'Batch-20',passing_year:1999,approval_status:'approved',role:'admin',photo_url:'private-old-photo'});
assert.equal(memberCalls[0].full_name,'Member Name');assert.equal(memberCalls[0].batch,'Dakhil-2020');
for(const key of ['id','approval_status','role','passing_year','photo_url'])assert.ok(!(key in memberCalls[0]),'Protected/unmodified field must be preserved: '+key);
await assert.rejects(()=>updateMemberProfile(memberClient,{full_name:'No ID',batch:'Batch-20'}));
console.log('PASS: admin member identity, editable allowlist and historical/protected-field preservation');

const deletionOrder=[];
function deleteClient(rowError=null,storageError=null){return {from(table){assert.equal(table,'gallery_photos');return {delete(){return {eq(){return {select(){return {single:async()=>{deletionOrder.push('row');return {data:rowError?null:{id:1},error:rowError};}}}}}}}}},storage:{from(bucket){assert.equal(bucket,'batch-gallery');return {remove:async()=>{deletionOrder.push('object');return {error:storageError};}}}}};}
await assert.rejects(()=>deleteGalleryRecord(deleteClient({code:'42501'}),{id:1,storage_path:'1/user/photo.png'}));
assert.deepEqual(deletionOrder,['row'],'Never delete an object if row deletion failed');deletionOrder.length=0;
const outcome=await deleteGalleryRecord(deleteClient(null,{code:'cleanup'}),{id:1,storage_path:'1/user/photo.png'});
assert.deepEqual(deletionOrder,['row','object']);assert.equal(outcome.cleanupError.code,'cleanup');
console.log('PASS: gallery delete ordering and explicit partial-cleanup result');
