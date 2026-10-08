import {digestImageBytes,validateImageBlob,verifyPublicImage,EmailAssetError,EMAIL_IMAGE_LIMITS} from '../shared/email-assets.mjs';
/** Uses the existing Supabase project and RLS; never needs a service-role key. */
export class Cloud {
 constructor(config){this.base=(config.supabaseUrl||'').replace(/\/$/,'');this.key=config.supabasePublishableKey||'';this.session=null;this.user=null;this.refreshing=null;}
 get configured(){try{const url=new URL(this.base);return url.protocol==='https:'&&url.origin===this.base&&!!this.key;}catch{return false;}}
 async request(path,options={},retry=true){
  if(!this.configured)throw new Error('Cloud configuration is unavailable. Local projects remain available.');
  const {expectedOwner,expectedCurrent,...requestOptions}=options;if(options.signal?.aborted)throw new EmailAssetError('VERIFY_UNAVAILABLE','Image publication timed out. Retry when hosting is reachable.');if((expectedOwner&&this.user?.id!==expectedOwner)||(expectedCurrent&&!expectedCurrent()))throw new EmailAssetError('STALE_EXPORT','The account or project changed. Prepare images again.');
  const headers={apikey:this.key,...(this.session?.access_token?{Authorization:'Bearer '+this.session.access_token}:{}),...options.headers};
  const r=await fetch(this.base+path,{...requestOptions,headers,credentials:'omit',redirect:'error'});
  if(r.status===401&&retry&&this.session?.refresh_token){await this.refresh(options.signal);return this.request(path,options,false);}
  const text=await r.text();let data;try{data=text?JSON.parse(text):null;}catch{data=null;}
  if(!r.ok){const error=new Error(data?.error_description||data?.msg||data?.message||`Cloud request failed (${r.status}).`);error.status=r.status;error.code=data?.error||data?.code;throw error;}
  return data;
 }
 keep(session){this.session=session;this.user=session?.user||null;try{if(session)localStorage.setItem('ss_session',JSON.stringify(session));else localStorage.removeItem('ss_session');}catch{}}
 async restore(){let restoring;try{this.session=JSON.parse(localStorage.getItem('ss_session')||'null');if(this.session){if(this.session.expires_at&&this.session.expires_at*1000<Date.now()+60000)await this.refresh();restoring=this.session;const user=await this.request('/auth/v1/user');if(this.session!==restoring)throw new EmailAssetError('STALE_EXPORT','The account changed while restoring the session.');this.user=user;}}catch(error){if(error.code!=='STALE_EXPORT'&&(!restoring||this.session===restoring))this.keep(null);}return this.user;}
 async refresh(signal){if(this.refreshing)return this.refreshing;this.refreshing=(async()=>{const token=this.session?.refresh_token;if(!token)throw new Error('Please sign in again.');const r=await fetch(this.base+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:this.key,'Content-Type':'application/json'},credentials:'omit',redirect:'error',signal,body:JSON.stringify({refresh_token:token})});const session=r.ok?await r.json():null;if(this.session?.refresh_token!==token)throw new EmailAssetError('STALE_EXPORT','The account changed while the session refreshed.');if(!r.ok){this.keep(null);throw new Error('Your session expired. Please sign in again.');}this.keep(session);})().finally(()=>this.refreshing=null);return this.refreshing;}
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
 async uploadBlob(blob,{hash,mime='image/png',extension='png',ownerId=this.user?.id,isCurrent=()=>true,decodeImage}={}){
  const hostingOrigin=this.base,guard=()=>{if(!ownerId||!/^[A-Za-z0-9_-]{1,128}$/.test(ownerId)||!this.session?.access_token)throw new EmailAssetError('SIGN_IN_REQUIRED','Sign in to publish signature images.');if(this.user?.id!==ownerId||this.base!==hostingOrigin||!isCurrent())throw new EmailAssetError('STALE_EXPORT','The account or project changed. Prepare images again.');};
  guard();if(mime!=='image/png'||extension!=='png'||blob?.type!==mime)throw new EmailAssetError('IMAGE_INVALID','Publish a prepared PNG image.');
  await validateImageBlob(blob,{mime,decodeImage});guard();const actual=await digestImageBytes(blob);guard();
  if(hash&&hash!==actual)throw new EmailAssetError('IMAGE_INVALID','The prepared image hash did not match its bytes.');hash=actual;
  const path=ownerId+'/'+hash+'.png',url=this.base+'/storage/v1/object/public/signature-assets/'+path;
  const controller=new AbortController();let timer;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new EmailAssetError('VERIFY_UNAVAILABLE','Image publication timed out. Retry when hosting is reachable.'));},EMAIL_IMAGE_LIMITS.timeoutMs);});
  try{await Promise.race([timeout,this.request('/storage/v1/object/signature-assets/'+path,{method:'POST',expectedOwner:ownerId,expectedCurrent:isCurrent,signal:controller.signal,headers:{'Content-Type':mime,'x-upsert':'false','cache-control':'public, max-age=31536000, immutable'},body:blob})]);}
  catch(error){guard();if(!([400,409].includes(error.status)&&/already exists|duplicate|resourcealreadyexists/i.test((error.code||'')+' '+error.message)))throw error;await verifyPublicImage(url,{policy:{storageOrigin:this.base},expectedHash:hash,decodeImage});}
  finally{clearTimeout(timer);}
  guard();return url;
 }
 // Compatibility for existing callers: the historical processing key is intentionally ignored.
 async upload(dataUrl,_key){
  if(typeof dataUrl!=='string'||!/^data:image\/png;base64,/i.test(dataUrl)||dataUrl.length>EMAIL_IMAGE_LIMITS.maxBytes*1.4)throw new EmailAssetError('IMAGE_INVALID','Publish a prepared PNG image.');
  const response=await fetch(dataUrl,{credentials:'omit',redirect:'error'}),blob=await response.blob();return this.uploadBlob(blob);
 }
}
