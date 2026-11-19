// Browser-test adapter only. The test Vite server substitutes this module; production never imports it.
const image = 'https://smsa-fixture.invalid/photo.svg';
const member = {id:'member-1',email:'member@local.test',user_metadata:{full_name:'Ayesha Rahman'}};
const admin = {id:'admin-1',email:'admin@local.test',user_metadata:{full_name:'SMSA Test Administrator'}};
let session=null, listener=()=>{};
const tables={
  __committeeLayouts:[], // Synthetic RPC state, not a real database table.
  profiles:[{id:member.id,full_name:'Ayesha Rahman Mobile Member',batch:'Batch 2020',approval_status:'approved'},{id:admin.id,full_name:admin.user_metadata.full_name,batch:'Dakhil-2020',approval_status:'approved'}],
  public_alumni:[{id:member.id,full_name:'Ayesha Rahman Mobile Member',batch:'Batch 2020'}],
  user_roles:[{user_id:admin.id,role:'admin'}],
  batches:[{id:'batch-20',name:'Batch 2020',is_active:true},{id:'batch-21',name:'Dakhil-2021',is_active:false},{id:'batch-27',name:'Dakhil-2027',is_active:true}],
  events:[{id:'event-1',title:'Fixture reunion',description:'Only event content',enabled:true,event_date:'2027-01-01',image_url:image},{id:'hidden-event',title:'Hidden fixture event',enabled:false}],
  committee_members:[{id:'committee-1',name:'Fixture Chair',position:'Chair',batch:'Batch 2020',introduction:'Current committee',committee_year:2026,is_current:true}],
  site_content:[{id:'story',kind:'about',key:'story',title:'Our fixture story',description:'Independent About description',enabled:true},{id:'image-1',kind:'about',key:'image-one',title:'First About image',image_url:image+'?one',enabled:true},{id:'image-2',kind:'about',key:'image-two',title:'Second About image',image_url:image+'?two',enabled:true},{id:'facebook',kind:'social',key:'facebook',title:'Facebook Group',url:'https://www.facebook.com/groups/fixture',enabled:true}],
  gallery_photos:['pending','approved','rejected'].map((status,i)=>({id:'photo-'+i,batch_id:'batch-20',uploader_id:member.id,storage_path:'batch-20/member-1/'+i+'.png',caption:'Fixture '+status,status}))
};
const state={tables,mutations:[],uploads:[],failures:[],storageFailure:false,requireEventTitle:false,orderingUnavailable:false,failRole:false,confirmation:false,notify:event=>listener(event,session)};
try {const saved=JSON.parse(sessionStorage.getItem('smsa-offline-fixture') || 'null');if(saved){Object.assign(tables,saved.tables);session=saved.session;state.mutations=saved.mutations;state.uploads=saved.uploads;}} catch {}
state.persist=()=>sessionStorage.setItem('smsa-offline-fixture',JSON.stringify({tables,session,mutations:state.mutations,uploads:state.uploads}));
window.__smsaMock=state;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const clone=value=>structuredClone(value);
class Query {
  constructor(table){this.table=table;this.filters=[];this.action='select';}
  select(columns,options){this.options=options;return this;}
  order(){return this;}
  eq(key,value){this.filters.push(row=>String(row[key])===String(value));return this;}
  update(payload){this.action='update';this.payload=payload;return this;}
  insert(payload){this.action='insert';this.payload=payload;return this;}
  upsert(payload){this.action='upsert';this.payload=payload;return this;}
  delete(){this.action='delete';return this;}
  single(){this.one=true;return this;}
  maybeSingle(){this.one=true;return this;}
  async execute(){
    await delay(this.table === 'profiles' ? 80 : 15);
    const failureIndex=state.failures.findIndex(f=>f.table===this.table && f.action===this.action);
    if(failureIndex>=0){const failure=state.failures.splice(failureIndex,1)[0];return {data:failure.empty ? null : [],error:failure.error || null};}
    if(this.table === 'user_roles' && state.failRole)return {data:null,error:{message:'Fixture role failure'}};
    if(this.table==='events' && this.action!=='select' && this.action!=='delete' && state.requireEventTitle && !this.payload.title?.trim())return {data:null,error:{code:'23514',message:'Fixture title constraint'}};
    const rows=tables[this.table] || [];
    let result=rows.filter(row=>this.filters.every(filter=>filter(row)));
    if(this.action !== 'select'){
      if(!session)return {error:{message:'permission denied'}};
      if(this.table !== 'profiles' && session.user.id !== admin.id && this.table !== 'gallery_photos')return {error:{message:'permission denied'}};
      state.mutations.push({table:this.table,action:this.action,payload:clone(this.payload || {})});
      if(this.action === 'insert' || this.action === 'upsert'){
        const existing=this.action === 'upsert' && rows.find(row=>row.id === this.payload.id);
        if(existing){Object.assign(existing,this.payload);result=[existing];}
        else {const row={id:crypto.randomUUID(),approval_status:'pending',...this.payload};rows.push(row);result=[row];}
      } else if(this.action === 'update') result.forEach(row=>Object.assign(row,this.payload));
      else if(this.action === 'delete') tables[this.table]=rows.filter(row=>!result.includes(row));
    }
    if(this.action==='select'){
      if(this.table === 'events' && session?.user.id !== admin.id)result=result.filter(row=>row.enabled !== false);
      if(this.table === 'site_content' && session?.user.id !== admin.id)result=result.filter(row=>row.enabled);
      if(this.table === 'gallery_photos' && session?.user.id !== admin.id)result=result.filter(row=>row.status==='approved' || session?.user.id && row.uploader_id===session.user.id);
      if(this.table === 'profiles' && session?.user.id !== admin.id)result=result.filter(row=>row.id===session?.user.id);
    }
    state.persist();
    return {data:clone(this.one ? result[0] || null : result),error:null,count:result.length};
  }
  then(resolve,reject){return this.execute().then(resolve,reject);}
}
export const supabase={
  from:table=>new Query(table),
  auth:{
    getSession:async()=>({data:{session},error:null}),
    onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe(){listener=()=>{};}}}};},
    async signInWithPassword({email}){const user=email.startsWith('admin') ? admin : member;session={user};state.persist();listener('SIGNED_IN',session);return {data:{user,session},error:null};},
    async signUp({email,options}){const user={id:'new-member',email,user_metadata:options.data};if(state.confirmation)return {data:{user,session:null},error:null};session={user};listener('SIGNED_IN',session);return {data:{user,session},error:null};},
    async signOut(){session=null;state.persist();listener('SIGNED_OUT',null);return {error:null};},
    resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null})
  },
  storage:{from:bucket=>({
    async upload(path,file){if(state.storageFailure){state.storageFailure=false;return {error:{message:'Fixture storage failure'}};}state.uploads.push({bucket,path,type:file.type,size:file.size});state.persist();return {data:{path},error:null};},
    getPublicUrl:path=>({data:{publicUrl:image+'?path='+encodeURIComponent(path)}}),
    async createSignedUrl(path){const photo=tables.gallery_photos.find(row=>row.storage_path===path);if(!photo || photo.status!=='approved' && session?.user.id!==admin.id && photo.uploader_id!==session?.user.id)return {error:{message:'permission denied'}};return {data:{signedUrl:image+'?signed='+encodeURIComponent(path)},error:null};},
    async remove(paths){state.mutations.push({bucket,action:'remove',paths});return {error:null};}
  })},
  async rpc(name,args,options){
    if(name==='smsa_get_committee_layouts_v1'){
      if(state.orderingUnavailable)return {error:{code:'PGRST202',message:'Fixture ordering backend unavailable'}};
      if(!options?.get)return {error:{message:'Expected read-only ordering request'}};
      return {data:{version:1,layouts:clone(tables.__committeeLayouts)},error:null};
    }
    if(name==='smsa_save_committee_layout_v1'){
      if(session?.user.id!==admin.id)return {error:{code:'42501',message:'permission denied'}};
      if(state.orderingLockTimeout)return {error:{code:'55P03',message:'Fixture lock timeout'}};
      const existing=tables.__committeeLayouts.find(l=>l.year===args.p_year);
      const members=tables.committee_members.filter(m=>m.committee_year===args.p_year);
      if((existing?.revision || 0)!==args.p_expected_revision || new Set(args.p_member_ids).size!==members.length || args.p_member_ids.length!==members.length || members.some(m=>!args.p_member_ids.includes(String(m.id)) || args.p_expected_members?.[m.id]?.position!==m.position || args.p_expected_members?.[m.id]?.display_order!==(m.display_order ?? null)))return {error:{code:'40001',message:'Fixture concurrent ordering conflict'}};
      const layout={year:args.p_year,positions:clone(args.p_positions),member_ids:clone(args.p_member_ids),revision:(existing?.revision || 0)+1};
      members.forEach(member=>{member.display_order=args.p_member_ids.indexOf(String(member.id))+1;});
      tables.__committeeLayouts=tables.__committeeLayouts.filter(l=>l.year!==args.p_year);tables.__committeeLayouts.push(layout);state.persist();
      return {data:{version:1,layout:clone(layout)},error:null};
    }
    if(name==='smsa_gallery_uploader_names')return {data:args.photo_ids.map(photo_id=>({photo_id,full_name:'Ayesha Rahman Mobile Member'})),error:null};
    if(name==='smsa_batch_has_content')return {data:true,error:null};
    return {error:{message:'Fixture RPC unavailable'}};
  },
  functions:{invoke:async()=>({error:{message:'Fixture account operation disabled'}})}
};
