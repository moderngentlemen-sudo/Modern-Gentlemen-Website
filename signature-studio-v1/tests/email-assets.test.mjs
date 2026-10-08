import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyImageSource,collectRenderedEmailImages,assertEmailSafeMarkup,replaceEmailImageSources,digestImageBytes,validateImageBlob,verifyPublicImage,prepareEmailAssets,EMAIL_IMAGE_LIMITS} from '../public/shared/email-assets.mjs';
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const OTHER='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT3sAAAAASUVORK5CYII=';
const blob=()=>new Blob([Buffer.from(PNG,'base64')],{type:'image/png'});
const otherBlob=()=>new Blob([Buffer.from(OTHER,'base64')],{type:'image/png'});
const data='data:image/png;base64,'+PNG,otherData='data:image/png;base64,'+OTHER;
const decodeImage=async()=>({width:1,height:1});
const policy={origin:'https://studio.example.com',storageOrigin:'https://store.supabase.co',staticUrls:['https://static.example.com/v1/logo.png']};
const url=hash=>'https://store.supabase.co/storage/v1/object/public/signature-assets/owner-1/'+hash+'.png';
function response(value=blob(),options={}){return new Response(value,{status:200,headers:{'content-type':'image/png'},...options});}
function fixture(extra={}){
 const uploads=[],fetches=[],images=new Map(),cloud={base:policy.storageOrigin,configured:true,user:{id:'owner-1'},async uploadBlob(value,{hash}){uploads.push(hash);images.set(url(hash),value);return url(hash);}};
 const deps={origin:policy.origin,cloud,isCurrent:()=>true,consent:true,decodeImage,prepare:async doc=>({images:{logo:doc.variant==='reply'&&doc.replySource?doc.replySource:data},errors:[]}),render:(doc,{images:prepared})=>doc.empty?'Text':`<table><tr><td><img alt="Logo" src="${prepared.logo}"></td></tr></table>`,toBlob:async src=>src===otherData?otherBlob():blob(),fetch:async address=>{fetches.push(address);return images.has(address)?response(images.get(address)):response(blob());},...extra};
 return {deps,uploads,fetches,cloud};
}

test('classification distinguishes local, approved, external and credential-bearing sources',()=>{
 const cases=[['','missing'],[data,'data'],['blob:https://studio.example.com/123','blob'],['/design/media/mg-logo.png','relative'],['https://studio.example.com/design/media/mg-logo.png','same-origin'],[policy.staticUrls[0],'approved-static'],[url('a'.repeat(64)),'signature-storage'],['https://other.supabase.co/storage/v1/object/public/signature-assets/owner-1/'+('a'.repeat(64))+'.png','external'],['https://remote.example/image.png','external'],['https://remote.example/private/image.png','private-or-signed'],['https://store.supabase.co/storage/v1/object/sign/bucket/image.png?token=secret','private-or-signed'],['https://remote.example/a.png?X-Amz-Credential=secret','private-or-signed'],['https://user:password@remote.example/image.png','private-or-signed'],['http://remote.example/a.png','unsupported'],['javascript:alert(1)','unsupported'],['https://127.0.0.1/a.png','unsupported'],['https://localhost/a.png','unsupported'],['https://[::1]/a.png','unsupported'],['https://bad\nhost/a','malformed'],['https://[bad/a','malformed']];
 for(const [source,expected]of cases)assert.equal(classifyImageSource(source,policy).kind,expected,source);
});
test('public-looking paths without a final hash and URL query cannot be assumed immutable',()=>{
 assert.equal(classifyImageSource('https://store.supabase.co/storage/v1/object/public/signature-assets/owner-1/logo.png',policy).safe,false);
 assert.equal(classifyImageSource(url('a'.repeat(64))+'?download',policy).safe,false);
});
test('rendered inventory reads every img including single and unquoted attributes and decodes entities',()=>{
 const inventory=collectRenderedEmailImages(`<a>Letters</a><img alt='Portrait &amp; company' src='https://a.example/img.png'><img src=/design/media/x-dark.png alt=X><img alt="Broken">`);
 assert.equal(inventory.length,3);assert.equal(inventory[0].label,'Portrait & company');assert.equal(inventory[1].source,'/design/media/x-dark.png');assert.equal(inventory[2].source,'');
});
test('duplicate src and alternate srcset references are refused',()=>{
 assert.throws(()=>collectRenderedEmailImages('<img src="a" src="b">'),/Duplicate/);
 assert.throws(()=>assertEmailSafeMarkup(`<img src="${policy.staticUrls[0]}" srcset="data:image/png,secret">`,{...policy,verifiedUrls:new Set(policy.staticUrls)}),/verified/);
});
test('final markup requires verified approved HTTPS references and keeps links and layout',()=>{
 const html=`<table><tr><td><a href="https://example.com"><img src="${policy.staticUrls[0]}" alt="Company"></a></td></tr></table>`;
 assert.equal(assertEmailSafeMarkup(html,{...policy,verifiedUrls:new Set(policy.staticUrls)}).length,1);
 for(const source of [data,'blob:a','/logo.png','https://random.example/logo.png',policy.staticUrls[0]])assert.throws(()=>assertEmailSafeMarkup(`<img src="${source}">`,policy),/verified/);
 assert.throws(()=>assertEmailSafeMarkup('<script>alert(1)</script>'),/unsupported/);
 assert.throws(()=>assertEmailSafeMarkup('<table background="https://a.example/private"></table>'),/Background/);
});
test('rewriting image sources does not alter unrelated hyperlinks or editable input objects',()=>{
 const html=`<a href="${data}">Link</a><img src='${data}' alt='Logo'>`;
 const output=replaceEmailImageSources(html,new Map([[data,policy.staticUrls[0]]]));
 assert.match(output,/href="data:/);assert.ok(output.includes('src="'+policy.staticUrls[0]+'"'));
});
test('content addresses are based on final bytes and change with changed artwork',async()=>{
 assert.equal(await digestImageBytes(blob()),await digestImageBytes(blob()));assert.notEqual(await digestImageBytes(blob()),await digestImageBytes(otherBlob()));
});
test('blob validation checks MIME, magic bytes, dimensions, file limits and actual decode',async()=>{
 assert.equal((await validateImageBlob(blob(),{decodeImage})).width,1);
 await assert.rejects(()=>validateImageBlob(new Blob(['<html>error</html>'],{type:'image/png'}),{decodeImage}),/valid PNG/);
 await assert.rejects(()=>validateImageBlob(blob(),{decodeImage:async()=>{throw new Error('bad');}}),/decoded/);
 await assert.rejects(()=>validateImageBlob(blob(),{decodeImage:async()=>({width:5000,height:1})}),/4096/);
 await assert.rejects(()=>validateImageBlob(blob(),{decodeImage,limits:{maxBytes:1}}),/5 MB/);
 const huge=new Uint8Array(await blob().arrayBuffer());new DataView(huge.buffer).setUint32(16,100000);let decoded=false;
 await assert.rejects(()=>validateImageBlob(new Blob([huge],{type:'image/png'}),{decodeImage:async()=>{decoded=true;return {width:1,height:1};}}),/4096/);assert.equal(decoded,false);
});
test('public verification uses bounded anonymous GET without cookies, bearer keys, referrer or redirects',async()=>{
 const hash=await digestImageBytes(blob());let request;
 const result=await verifyPublicImage(url(hash),{policy,decodeImage,expectedHash:hash,fetch:async(address,options)=>{request={address,options};return response();}});
 assert.equal(result.hash,hash);assert.equal(request.options.method,'GET');assert.equal(request.options.credentials,'omit');assert.equal(request.options.redirect,'error');assert.equal(request.options.referrerPolicy,'no-referrer');assert.ok(request.options.signal);assert.equal(request.options.headers.Authorization,undefined);assert.equal(request.options.headers.apikey,undefined);
});
test('public verification blocks unavailable hosts and unreadable or mislabelled responses',async()=>{
 const hash=await digestImageBytes(blob());
 for(const fetch of [async()=>{throw new TypeError('DNS');},async()=>response(blob(),{status:503}),async()=>response('<html>login</html>',{headers:{'content-type':'text/html'}}),async()=>response(new Blob([])),async()=>({...response(),ok:true,redirected:true})])await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,fetch}));
});
test('public verification rejects mismatched immutable bytes and redirects',async()=>{
 const hash=await digestImageBytes(blob());
 await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,fetch:async()=>response(otherBlob())}),/immutable address/);
 await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,fetch:async()=>{throw new TypeError('redirect');}}),/verification failed/);
});
test('streamed limits do not trust content-length',async()=>{
 const hash=await digestImageBytes(blob());let cancelled=false;
 const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(100));},cancel(){cancelled=true;}});
 await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,limits:{maxBytes:50},fetch:async()=>new Response(body,{headers:{'content-type':'image/png','content-length':'1'}})}),/5 MB/);assert.equal(cancelled,true);
});
test('image decoding timeouts prevent unbounded readiness waits',async()=>{
 await assert.rejects(()=>validateImageBlob(blob(),{decodeImage:()=>new Promise(()=>{}),limits:{timeoutMs:10}}),/timed out/);
});
test('Full and Reply union prepares shared rendered bytes once and retains source assets',async()=>{
 const {deps,uploads}=fixture();const snapshot={assets:{logo:{src:data}},publishedAssets:{}};const before=structuredClone(snapshot);
 const result=await prepareEmailAssets(snapshot,['full','reply'],deps);
 assert.equal(uploads.length,1);assert.equal(result.inventory.length,2);assert.equal(result.inventory.every(row=>row.status==='Ready'),true);assert.deepEqual(snapshot,before);assert.equal(result.htmlByVariant.full,result.htmlByVariant.reply);assert.doesNotMatch(result.htmlByVariant.full,/src="(?:data:|blob:|\/)/);assert.equal(Object.values(result.publicationMetadata)[0].ownerId,'owner-1');
});
test('only requested variant output is published and changed image bytes receive distinct URLs',async()=>{
 const {deps,uploads}=fixture();const result=await prepareEmailAssets({replySource:otherData},['reply'],deps);assert.equal(uploads.length,1);assert.equal(uploads[0],await digestImageBytes(otherBlob()));assert.equal(result.htmlByVariant.full,undefined);
 const full=await prepareEmailAssets({},['full'],deps);assert.notEqual(full.htmlByVariant.full,result.htmlByVariant.reply);
});
test('distinct source references with identical processed bytes deduplicate across variants',async()=>{
 const {deps,uploads}=fixture({toBlob:async()=>blob()});const result=await prepareEmailAssets({replySource:otherData},['full','reply'],deps);assert.equal(uploads.length,1);assert.equal(result.htmlByVariant.full,result.htmlByVariant.reply);
});
test('unused raw document artwork cannot cause publication and text-only export needs no account',async()=>{
 const {deps,uploads,cloud}=fixture();cloud.user=null;
 const result=await prepareEmailAssets({empty:true,assets:{hidden:{src:otherData}}},['full'],deps);assert.equal(uploads.length,0);assert.equal(result.inventory.length,0);assert.equal(result.htmlByVariant.full,'Text');
});
test('required image preparation errors block export even when no img can be rendered',async()=>{
 const {deps,uploads}=fixture({prepare:async()=>({images:{},errors:['QR: invalid URL']}),render:()=>''});
 await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.code==='IMAGE_INVALID'&&e.inventory.some(row=>row.status==='Could not prepare'));assert.equal(uploads.length,0);
});
test('publication consent and authentication are required before upload',async()=>{
 const {deps,uploads,cloud}=fixture({consent:false});
 await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.code==='CONSENT_REQUIRED'&&e.inventory.length===1);assert.equal(uploads.length,0);
 cloud.user=null;await assert.rejects(()=>prepareEmailAssets({},['full'],{...deps,consent:true}),e=>e.code==='SIGN_IN_REQUIRED');assert.equal(uploads.length,0);
});
test('existing final-byte object is reused only with current owner and public verification',async()=>{
 const hash=await digestImageBytes(blob()),{deps,uploads,fetches}=fixture({consent:false});
 const result=await prepareEmailAssets({publishedAssets:{[hash]:url(hash)}},['full'],deps);assert.equal(uploads.length,0);assert.equal(fetches.length,1);assert.equal(result.publishedAssets[hash],url(hash));
 await assert.rejects(()=>prepareEmailAssets({publishedAssets:{[hash]:url(hash).replace('owner-1','owner-2')}},['full'],deps),e=>e.code==='CONSENT_REQUIRED');
});
test('stored publication strings are hints and do not bypass failed public verification',async()=>{
 const hash=await digestImageBytes(blob()),{deps,uploads}=fixture({fetch:async()=>response(blob(),{status:404})});
 await assert.rejects(()=>prepareEmailAssets({publishedAssets:{[hash]:url(hash)}},['full'],deps),e=>e.code==='VERIFY_UNAVAILABLE');assert.equal(uploads.length,0);
});
test('a host upload success without verified public availability cannot yield ready HTML',async()=>{
 const {deps,uploads}=fixture({fetch:async()=>response(blob(),{status:503})});let states=[];deps.onStatus=rows=>states=rows;
 await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.code==='VERIFY_UNAVAILABLE');assert.equal(uploads.length,1);assert.equal(states[0].status,'Verification unavailable');
});
test('stale revision, changed account and newer preparation block async publication results',async()=>{
 for(const change of ['revision','account','host']){
  let current=true;const {deps,cloud}=fixture({isCurrent:()=>current});const upload=cloud.uploadBlob;
  cloud.uploadBlob=async(...args)=>{const value=await upload(...args);if(change==='revision')current=false;else if(change==='account')cloud.user={id:'owner-2'};else cloud.base='https://different.supabase.co';return value;};
  await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.code==='STALE_EXPORT');
 }
});
test('fresh final render is checked again so newly introduced unsafe images cannot be copied',async()=>{
 let renders=0;const {deps}=fixture({render:(doc,{images})=>++renders===1?`<img src="${images.logo}">`:`<img src="${images.logo}"><img src="data:image/png;base64,bad">`});
 await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.code==='IMAGE_UNVERIFIED');
});

test('public download timeouts cover both stalled headers and stalled bodies',async()=>{
 const hash=await digestImageBytes(blob());
 await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,limits:{timeoutMs:10},fetch:()=>new Promise(()=>{})}),/timed out/);
 let cancelled=false;const body=new ReadableStream({start(){},cancel(){cancelled=true;}});
 await assert.rejects(()=>verifyPublicImage(url(hash),{policy,decodeImage,limits:{timeoutMs:10},fetch:async()=>new Response(body,{headers:{'content-type':'image/png'}})}),/timed out/);assert.equal(cancelled,true);
});
test('scoped metadata reuse survives old publication-map truncation and never trusts another owner',async()=>{
 const hash=await digestImageBytes(blob()),{deps,uploads}=fixture({consent:false});
 const metadata={hash,url:url(hash),hostingIdentity:policy.storageOrigin+'/signature-assets',ownerId:'owner-1'};
 await prepareEmailAssets({emailAssetMetadata:{[hash]:metadata}},['full'],deps);assert.equal(uploads.length,0);
 await assert.rejects(()=>prepareEmailAssets({emailAssetMetadata:{[hash]:{...metadata,ownerId:'owner-2'}}},['full'],deps),e=>e.code==='CONSENT_REQUIRED');
});
test('technical preparation failures cannot leak credential-bearing error details into readiness labels',async()=>{
 const {deps}=fixture({prepare:async()=>({images:{},errors:['HTTP https://example.com/file?token=do-not-show']})});
 await assert.rejects(()=>prepareEmailAssets({},['full'],deps),e=>e.inventory.every(row=>!row.label.includes('token=')));
});

test('image replacement only edits the actual src attribute, never src-looking alternative text',()=>{
 const source=data,target=policy.staticUrls[0];
 for(const label of ['Photo src=word','Social src=&quot;example&quot;','Photo src=word &amp; src=other']){
  const original=`<img alt="${label}" src="${source}">`,result=replaceEmailImageSources(original,new Map([[source,target]]));
  assert.equal(result,`<img alt="${label}" src="${target}">`);
  const inventory=assertEmailSafeMarkup(result,{...policy,verifiedUrls:new Set([target])});assert.equal(inventory.length,1);assert.equal(inventory[0].source,target);
 }
});
test('malformed image quoting cannot bypass final validation by appearing to contain zero images',()=>{
 const target=policy.staticUrls[0];
 for(const html of [`<img alt="Photo src="${target}" src="${data}">`,`<img src="${target}>`,`<img alt=x" src="${target}">`])assert.throws(()=>assertEmailSafeMarkup(html,{...policy,verifiedUrls:new Set([target])}),/Malformed/);
});
