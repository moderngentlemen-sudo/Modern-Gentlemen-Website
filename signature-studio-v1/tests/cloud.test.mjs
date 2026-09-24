import test from 'node:test';
import assert from 'node:assert/strict';
import {Cloud} from '../public/design/cloud.mjs';

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
  const cloud=new Cloud({supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'pk'});cloud.user={id:'user-42'};
  let requested=null;cloud.request=async(path,options={})=>{requested={path,options};return {};};
  const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const url=await cloud.upload(data,'a'.repeat(64));
  assert.equal(requested.path,'/storage/v1/object/signature-assets/user-42/'+('a'.repeat(64))+'.png');
  assert.equal(requested.options.headers['x-upsert'],'true');assert.equal(requested.options.headers['Content-Type'],'image/png');
  assert.equal(url,'https://example.supabase.co/storage/v1/object/public/signature-assets/user-42/'+('a'.repeat(64))+'.png');
 }finally{globalThis.localStorage=previous;}
});
