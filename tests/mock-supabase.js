// Browser-test adapter only. The test Vite server substitutes this module; production never imports it.
const image = 'https://smsa-fixture.invalid/photo.svg';
const member = {id:'member-1',email:'member@local.test',user_metadata:{full_name:'Ayesha Rahman'}};
const admin = {id:'admin-1',email:'admin@local.test',user_metadata:{full_name:'SMSA Test Administrator'}};
let session=null, listener=()=>{};
const tables={
  profiles:[{id:member.id,full_name:'Ayesha Rahman Mobile Member',batch:'Batch 2020',approval_status:'approved'},{id:admin.id,full_name:admin.user_metadata.full_name,batch:'Dakhil-2020',approval_status:'approved'}],
  public_alumni:[{id:member.id,full_name:'Ayesha Rahman Mobile Member',batch:'Batch 2020'}],
  user_roles:[{user_id:admin.id,role:'admin'}],
  batches:[{id:'batch-20',name:'Batch 2020',is_active:true},{id:'batch-21',name:'Dakhil-2021',is_active:false},{id:'batch-27',name:'Dakhil-2027',is_active:true}],
  events:[{id:'event-1',title:'Fixture reunion',description:'Only event content',enabled:true,event_date:'2027-01-01',image_url:image},{id:'hidden-event',title:'Hidden fixture event',enabled:false}],
  committee_members:[{id:'committee-1',name:'Fixture Chair',position:'Chair',batch:'Batch 2020',introduction:'Current committee',committee_year:2026,is_current:true}],
  site_content:[{id:'story',kind:'about',key:'story',title:'Our fixture story',description:'Independent About description',enabled:true},{id:'image-1',kind:'about',key:'image-one',title:'First About image',image_url:image+'?one',enabled:true},{id:'image-2',kind:'about',key:'image-two',title:'Second About image',image_url:image+'?two',enabled:true},{id:'facebook',kind:'social',key:'facebook',title:'Facebook Group',url:'https://www.facebook.com/groups/fixture',enabled:true}],
  gallery_photos:['pending','approved','rejected'].map((status,i)=>({id:'photo-'+i,batch_id:'batch-20',uploader_id:member.id,storage_path:'batch-20/member-1/'+i+'.png',caption:'Fixture '+status,status}))
};
const state={tables,mutations:[],uploads:[],failRole:false,confirmation:false,notify:event=>listener(event,session)};
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
    if(this.table === 'user_roles' && state.failRole)return {data:null,error:{message:'Fixture role failure'}};
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
    if(this.table === 'events' && session?.user.id !== admin.id)result=result.filter(row=>row.enabled !== false);
    return {data:clone(this.one ? result[0] || null : result),error:null,count:result.length};
  }
  then(resolve,reject){return this.execute().then(resolve,reject);}
}
export const supabase={
  from:table=>new Query(table),
  auth:{
    getSession:async()=>({data:{session},error:null}),
    onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe(){listener=()=>{};}}}};},
    async signInWithPassword({email}){const user=email.startsWith('admin') ? admin : member;session={user};listener('SIGNED_IN',session);return {data:{user,session},error:null};},
    async signUp({email,options}){const user={id:'new-member',email,user_metadata:options.data};if(state.confirmation)return {data:{user,session:null},error:null};session={user};listener('SIGNED_IN',session);return {data:{user,session},error:null};},
    async signOut(){session=null;listener('SIGNED_OUT',null);return {error:null};},
    resetPasswordForEmail:async()=>({error:null}),updateUser:async()=>({error:null})
  },
  storage:{from:bucket=>({
    async upload(path,file){state.uploads.push({bucket,path,type:file.type,size:file.size});return {data:{path},error:null};},
    getPublicUrl:path=>({data:{publicUrl:image+'?path='+encodeURIComponent(path)}}),
    createSignedUrl:async()=>({data:{signedUrl:image},error:null}),
    async remove(paths){state.mutations.push({bucket,action:'remove',paths});return {error:null};}
  })},
  async rpc(name,args){
    if(name==='smsa_gallery_uploader_names')return {data:args.photo_ids.map(photo_id=>({photo_id,full_name:'Ayesha Rahman Mobile Member'})),error:null};
    if(name==='smsa_batch_has_content')return {data:true,error:null};
    return {error:{message:'Fixture RPC unavailable'}};
  },
  functions:{invoke:async()=>({error:{message:'Fixture account operation disabled'}})}
};
