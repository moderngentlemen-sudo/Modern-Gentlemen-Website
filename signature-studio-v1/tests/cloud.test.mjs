import test from 'node:test';
import assert from 'node:assert/strict';
import {Cloud} from '../public/design/cloud.mjs';
import {digestImageBytes} from '../public/shared/email-assets.mjs';
const png=()=>new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],{type:'image/png'});
const decodeImage=async()=>({width:1,height:1});
function signedIn(){const cloud=new Cloud({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pk'});cloud.user={id:'user-42'};cloud.session={access_token:'token',user:cloud.user};return cloud;}

function storage(){
 const data=new Map();
 return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};
}

test('cloud save creates owner-scoped rows and uses optimistic revisions for updates',async()=>{
 const previous=globalThis.localStorage;globalThis.localStorage=storage();
 try{
  const cloud=new Cloud({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pk'});
  cloud.user={id:'user-1'};cloud.session={access_token:'token',user:cloud.user};
  const calls=[];
  cloud.request=async(path,options={})=>{calls.push({path,options});return path.includes('id=eq.')?[{id:'p1',updated_at:'new-revision'}]:[{id:'p1',updated_at:'first-revision'}];};
  await cloud.save({name:'One',schemaVersion:3});
  const created=JSON.parse(calls[0].options.body);
  assert.equal(created.user_id,'user-1');assert.equal(created.name,'One');assert.match(created.id,/^[0-9a-f-]{36}$/i);

  await cloud.save({name:'Two',schemaVersion:3},'p1','2026-09-24T00:00:00Z');
  assert.match(calls[1].path,/id=eq\.p1/);assert.match(calls[1].path,/updated_at=eq\.2026-09-24T00%3A00%3A00Z/);
  assert.equal(calls[1].options.method,'PATCH');
 }finally{globalThis.localStorage=previous;}
});

test('cloud optimistic update refuses a stale or deleted revision',async()=>{
 const previous=globalThis.localStorage;globalThis.localStorage=storage();
 try{
  const cloud=new Cloud({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pk'});
  cloud.user={id:'user-1'};cloud.request=async()=>[];
  await assert.rejects(()=>cloud.save({name:'Stale'},'p1','old'),/changed elsewhere or was deleted/);
 }finally{globalThis.localStorage=previous;}
});

test('restore refreshes an expiring session before resolving the signed-in user',async()=>{
 const previousStorage=globalThis.localStorage,previousFetch=globalThis.fetch;
 const store=storage();store.setItem('ss_session',JSON.stringify({access_token:'old',refresh_token:'refresh',expires_at:1,user:{id:'user-1'}}));globalThis.localStorage=store;
 const seen=[];
 globalThis.fetch=async(url,options={})=>{
  seen.push({url:String(url),options});
  if(String(url).includes('/auth/v1/token?grant_type=refresh_token'))return new Response(JSON.stringify({access_token:'new',refresh_token:'refresh2',expires_at:9999999999,user:{id:'user-1'}}),{status:200});
  if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'user-1'}),{status:200});
  return new Response('{}',{status:404});
 };
 try{
  const cloud=new Cloud({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pk'});
  const user=await cloud.restore();assert.equal(user.id,'user-1');assert.equal(cloud.session.access_token,'new');
  assert.equal(seen.length,2);assert.match(seen[0].url,/grant_type=refresh_token/);assert.match(seen[1].url,/auth\/v1\/user$/);
  assert.equal(seen[1].options.headers.Authorization,'Bearer new');
 }finally{globalThis.localStorage=previousStorage;globalThis.fetch=previousFetch;}
});

test('asset publication writes only to the signed-in user folder and returns the public URL',async()=>{
 const previous=globalThis.localStorage;globalThis.localStorage=storage();
 try{
  const cloud=signedIn();
  let requested=null;cloud.request=async(path,options={})=>{requested={path,options};return {};};
  const hash=await digestImageBytes(png()),url=await cloud.uploadBlob(png(),{hash,decodeImage});
  assert.equal(requested.path,'/storage/v1/object/signature-assets/user-42/'+hash+'.png');
  assert.equal(requested.options.headers['x-upsert'],'false');assert.equal(requested.options.headers['Content-Type'],'image/png');
  assert.equal(requested.options.expectedOwner,'user-42');assert.match(requested.options.headers['cache-control'],/immutable/);
  assert.equal(url,'https://example.supabase.co/storage/v1/object/public/signature-assets/user-42/'+hash+'.png');
 }finally{globalThis.localStorage=previous;}
});

test('asset publication refuses mismatched hashes, MIME, extension, unsafe owner and sessionless callers',async()=>{
 const cloud=signedIn();let writes=0;cloud.request=async()=>{writes++;};
 for(const options of [{hash:'a'.repeat(64)},{mime:'image/jpeg'},{extension:'svg'},{ownerId:'../other'},{ownerId:'another-user'}])await assert.rejects(()=>cloud.uploadBlob(png(),{...options,decodeImage}));
 cloud.session=null;await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage}),/Sign in/);assert.equal(writes,0);
});

test('create-only object collision is accepted only after anonymous byte and decode verification',async()=>{
 const cloud=signedIn(),previousFetch=globalThis.fetch,hash=await digestImageBytes(png());let requests=0;
 cloud.request=async()=>{const error=new Error('Asset Already Exists');error.status=400;throw error;};
 globalThis.fetch=async(address,options)=>{requests++;assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,undefined);assert.ok(String(address).endsWith('/'+hash+'.png'));return new Response(png(),{headers:{'content-type':'image/png'}});};
 try{assert.match(await cloud.uploadBlob(png(),{hash,decodeImage}),new RegExp(hash+'\\.png$'));assert.equal(requests,1);
  globalThis.fetch=async()=>new Response('wrong',{headers:{'content-type':'image/png'}});await assert.rejects(()=>cloud.uploadBlob(png(),{hash,decodeImage}),/valid PNG/);
 }finally{globalThis.fetch=previousFetch;}
});

test('permission errors and ordinary invalid requests do not become successful collision reuse',async()=>{
 const cloud=signedIn();for(const status of [400,401,403,409,500]){cloud.request=async()=>{const error=new Error('Permission denied');error.status=status;throw error;};await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage}),/Permission denied/);}
});

test('newer edits or account changes cannot apply an in-flight upload result',async()=>{
 const cloud=signedIn();let current=true;cloud.request=async()=>{current=false;return {};};
 await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage,isCurrent:()=>current}),/account or project changed/);
 cloud.request=async()=>{cloud.user={id:'other-owner'};return {};};await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage}),/account or project changed/);
});

test('expired upload session cannot retry with a different account',async()=>{
 const cloud=signedIn(),previousFetch=globalThis.fetch;cloud.session.refresh_token='refresh';let requests=0;
 globalThis.fetch=async()=>{requests++;return new Response('{}',{status:401});};
 cloud.refresh=async()=>{cloud.user={id:'other-owner'};cloud.session.access_token='other-token';};
 try{await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage}),/account.*changed/i);assert.equal(requests,1);}finally{globalThis.fetch=previousFetch;}
});

test('late refresh response does not sign a switched account back in',async()=>{
 const cloud=signedIn(),previousFetch=globalThis.fetch;cloud.session.refresh_token='old-refresh';let finish;
 globalThis.fetch=()=>new Promise(resolve=>{finish=resolve;});
 try{const pending=cloud.refresh();cloud.session={access_token:'new-token',refresh_token:'new-refresh'};cloud.user={id:'new-owner'};finish(new Response(JSON.stringify({access_token:'old-token',refresh_token:'old-refresh-2',user:{id:'user-42'}}),{status:200}));await assert.rejects(()=>pending,/account changed/);assert.equal(cloud.user.id,'new-owner');assert.equal(cloud.session.access_token,'new-token');}finally{globalThis.fetch=previousFetch;}
});

test('legacy upload accepts only bounded PNG data and no arbitrary fetch URL',async()=>{
 const cloud=signedIn();await assert.rejects(()=>cloud.upload('https://private.example/image.png','key'),/prepared PNG/);await assert.rejects(()=>cloud.upload('data:image/svg+xml,<svg/>','key'),/prepared PNG/);
 let handedOff;cloud.uploadBlob=async blob=>{handedOff=blob;return 'new-public-url';};const value=await cloud.upload('data:image/png;base64,'+Buffer.from(await png().arrayBuffer()).toString('base64'),'old-parameter-hash');assert.equal(value,'new-public-url');assert.equal(handedOff.type,'image/png');
});

test('a pending restored account cannot overwrite a newer authenticated account',async()=>{
 const oldStorage=globalThis.localStorage,store=storage(),cloud=signedIn();store.setItem('ss_session',JSON.stringify({access_token:'old-token',user:{id:'user-42'}}));globalThis.localStorage=store;
 let finish;cloud.request=()=>new Promise(resolve=>{finish=resolve;});
 try{const restoring=cloud.restore();cloud.keep({access_token:'new-token',user:{id:'new-owner'}});finish({id:'user-42'});await restoring;assert.equal(cloud.user.id,'new-owner');assert.equal(cloud.session.access_token,'new-token');}finally{globalThis.localStorage=oldStorage;}
});

test('expired upload session cannot retry an obsolete document after refresh',async()=>{
 const cloud=signedIn(),previousFetch=globalThis.fetch;cloud.session.refresh_token='refresh';let requests=0,current=true;
 globalThis.fetch=async()=>{requests++;return new Response('{}',{status:401});};cloud.refresh=async()=>{current=false;};
 try{await assert.rejects(()=>cloud.uploadBlob(png(),{decodeImage,isCurrent:()=>current}),/account or project changed/);assert.equal(requests,1);}finally{globalThis.fetch=previousFetch;}
});
