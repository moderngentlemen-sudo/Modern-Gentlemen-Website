/** Uses the existing Supabase project and RLS; never needs a service-role key. */
export class Cloud {
 constructor(config){this.base=(config.supabaseUrl||'').replace(/\/$/,'');this.key=config.supabasePublishableKey||'';this.session=null;this.user=null;this.refreshing=null;}
 get configured(){return /^https:\/\//.test(this.base)&&!!this.key;}
 async request(path,options={},retry=true){
  if(!this.configured)throw new Error('Cloud configuration is unavailable. Local projects remain available.');
  const headers={apikey:this.key,...(this.session?.access_token?{Authorization:'Bearer '+this.session.access_token}:{}),...options.headers};
  const r=await fetch(this.base+path,{...options,headers});
  if(r.status===401&&retry&&this.session?.refresh_token){await this.refresh();return this.request(path,options,false);}
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
  if(!r.ok)throw new Error(data?.error_description||data?.msg||data?.message||`Cloud request failed (${r.status}).`);
  return data;
 }
 keep(session){this.session=session;this.user=session?.user||null;try{if(session)localStorage.setItem('ss_session',JSON.stringify(session));else localStorage.removeItem('ss_session');}catch{}}
 async restore(){try{this.session=JSON.parse(localStorage.getItem('ss_session')||'null');if(this.session){if(this.session.expires_at&&this.session.expires_at*1000<Date.now()+60000)await this.refresh();this.user=await this.request('/auth/v1/user');}}catch{this.keep(null);}return this.user;}
 async refresh(){if(this.refreshing)return this.refreshing;this.refreshing=(async()=>{const token=this.session?.refresh_token;if(!token)throw new Error('Please sign in again.');const r=await fetch(this.base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:this.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:token})});if(!r.ok){this.keep(null);throw new Error('Your session expired. Please sign in again.');}this.keep(await r.json());})().finally(()=>this.refreshing=null);return this.refreshing;}
 async signIn(email,password){const session=await this.request('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})},false);this.keep(session);return this.user;}
 async signUp(email,password){return this.request('/auth/v1/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})},false);}
 async signOut(){try{await this.request('/auth/v1/logout',{method:'POST'});}finally{this.keep(null);}}
 async list(){return this.request('/rest/v1/signature_projects?select=id,name,data,updated_at&order=updated_at.desc');}
 async save(project,id=null,revision=null){
  if(!this.user)throw new Error('Sign in before saving to the cloud.');
  const body={name:project.name,data:project,updated_at:new Date().toISOString()};
  if(id){const rows=await this.request('/rest/v1/signature_projects?id=eq.'+encodeURIComponent(id)+(revision?'&updated_at=eq.'+encodeURIComponent(revision):''),{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});if(!rows?.length)throw new Error('This project changed elsewhere or was deleted. Save as a new project to keep your version.');return rows[0];}
  const rows=await this.request('/rest/v1/signature_projects',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({...body,id:crypto.randomUUID(),user_id:this.user.id})});return rows[0];
 }
 async remove(id){return this.request('/rest/v1/signature_projects?id=eq.'+encodeURIComponent(id),{method:'DELETE'});}
 async upload(dataUrl,key){
  if(!this.user)throw new Error('Sign in to publish signature images.');
  const blob=await (await fetch(dataUrl)).blob();if(blob.size>5*1024*1024)throw new Error('The processed image exceeds 5 MB.');
  const path=this.user.id+'/'+key+'.png';await this.request('/storage/v1/object/signature-assets/'+path,{method:'POST',headers:{'Content-Type':'image/png','x-upsert':'true'},body:blob});return this.base+'/storage/v1/object/public/signature-assets/'+path;
 }
}
