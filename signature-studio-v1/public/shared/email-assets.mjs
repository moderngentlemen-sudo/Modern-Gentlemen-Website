/** Gmail image publication is separate from editable project sources and preview rendering. */
export const EMAIL_IMAGE_LIMITS=Object.freeze({maxBytes:5*1024*1024,maxDimension:4096,maxPixels:16*1024*1024,timeoutMs:12000,maxImages:120});
const MIME=new Set(['image/png','image/jpeg','image/webp']);
const HASH=/^[a-f\d]{64}$/;
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
export class EmailAssetError extends Error{constructor(code,message,inventory=[]){super(message);this.name='EmailAssetError';this.code=code;this.inventory=inventory;}}
const fail=(code,message)=>{throw new EmailAssetError(code,message);};
const cleanOrigin=value=>{try{return new URL(value).origin;}catch{return '';}};
function localHost(host){return host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.includes(':')||/^\d+(?:\.\d+){0,3}$/.test(host);}
function privateURL(url){return !!url.username||!!url.password||/\/(?:auth|private|authenticated|sign|signed)\//i.test(url.pathname)||[...url.searchParams.keys()].some(k=>/(?:token|signature|credential|expires|policy|authorization|api[_-]?key|x-amz-|x-goog-|^sig$|^key$|^auth$|^se$|^sp$|^sv$)/i.test(k));}
export function classifyImageSource(source,policy={}){
 if(typeof source!=='string'||!source.trim())return {kind:'missing',safe:false};
 const src=source.trim();if(/[\u0000-\u001f\u007f]/.test(src)||src.includes('\\'))return {kind:'malformed',safe:false};
 if(/^data:/i.test(src))return {kind:/^data:image\/(?:png|jpeg|webp|svg\+xml)[;,]/i.test(src)?'data':'unsupported',safe:false,src};
 if(/^blob:/i.test(src))return {kind:'blob',safe:false,src};
 let url;try{url=new URL(src,policy.origin||'https://invalid.local');}catch{return {kind:'malformed',safe:false};}
 if(privateURL(url))return {kind:'private-or-signed',safe:false};
 if(!['http:','https:'].includes(url.protocol))return {kind:'unsupported',safe:false};
 const relative=!/^[a-z][a-z\d+.-]*:/i.test(src)&&!src.startsWith('//');
 const sameOrigin=url.origin===cleanOrigin(policy.origin);
 if(relative)return {kind:'relative',safe:false,url:url.href};
 if(sameOrigin)return {kind:'same-origin',safe:false,url:url.href};
 if(url.protocol!=='https:'||localHost(url.hostname))return {kind:'unsupported',safe:false};
 if(url.search||url.hash)return {kind:'external',safe:false,url:url.href};
 const storageOrigin=cleanOrigin(policy.storageOrigin||policy.supabaseUrl);
 const match=url.pathname.match(/^\/storage\/v1\/object\/public\/signature-assets\/([A-Za-z0-9_-]{1,128})\/([a-f\d]{64})\.png$/);
 if(storageOrigin&&url.origin===storageOrigin&&match)return {kind:'signature-storage',safe:true,url:url.href,ownerId:match[1],hash:match[2]};
 if((policy.staticUrls||[]).includes(url.href))return {kind:'approved-static',safe:true,url:url.href};
 return {kind:'external',safe:false,url:url.href};
}
function decodeEntities(text){return text.replace(/&(?:amp|quot|apos|lt|gt|#(?:x[a-f\d]+|\d+));/gi,m=>{const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};if(named[m.toLowerCase()])return named[m.toLowerCase()];const n=m.slice(2,-1);return String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10));});}
function imgTags(html){const text=String(html),tags=text.match(/<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)||[];if(tags.length!==(text.match(/<img\b/gi)||[]).length)fail('IMAGE_INVALID','Malformed image markup cannot be copied.');return tags;}
// Attribute boundaries must be parsed before editing: labels may contain text such as "src=example".
function imageAttributes(tag){
 const attrs=Object.create(null),spans=Object.create(null);let at=4;
 while(at<tag.length){
  const gap=at;while(/\s/.test(tag[at]||'')&&at<tag.length)at++;
  if(tag[at]==='>'||tag.slice(at)==='/>')break;
  if(at===gap)fail('IMAGE_INVALID','Malformed image markup cannot be copied.');
  const start=at,name=/^[^\s=<>/"'`]+/.exec(tag.slice(at));if(!name)fail('IMAGE_INVALID','Malformed image markup cannot be copied.');
  at+=name[0].length;const key=name[0].toLowerCase();if(Object.hasOwn(attrs,key))fail('IMAGE_INVALID','Duplicate image attributes are not supported.');
  let value='',end=at,afterName=at;while(/\s/.test(tag[afterName]||'')&&afterName<tag.length)afterName++;
  if(tag[afterName]==='='){
   at=afterName+1;while(/\s/.test(tag[at]||'')&&at<tag.length)at++;
   const quote=tag[at];if(quote==='"'||quote==="'"){const valueStart=++at;const close=tag.indexOf(quote,at);if(close<0)fail('IMAGE_INVALID','Malformed image markup cannot be copied.');value=tag.slice(valueStart,close);at=close+1;}
   else{const raw=/^[^\s>]+/.exec(tag.slice(at));if(!raw||/["'`<=]/.test(raw[0]))fail('IMAGE_INVALID','Malformed image markup cannot be copied.');value=raw[0];at+=value.length;}
   end=at;
  }
  attrs[key]=decodeEntities(value);spans[key]={start,end};
 }
 return {attrs,spans};
}
function attributes(tag){return imageAttributes(tag).attrs;}
export function collectRenderedEmailImages(html){
 return imgTags(html).map((tag,index)=>{const attrs=attributes(tag);return {id:attrs['data-email-asset']||String(index),source:attrs.src||'',label:attrs.alt||'Signature image',width:Number(attrs.width)||null,height:Number(attrs.height)||null,srcset:attrs.srcset,attributes:attrs};});
}
function escapeAttr(value){return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
export function replaceEmailImageSources(html,replacements){imgTags(html);return String(html).replace(/<img\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi,tag=>{const {attrs,spans}=imageAttributes(tag),url=replacements.get(attrs.src);if(!url)return tag;const span=spans.src;return tag.slice(0,span.start)+'src="'+escapeAttr(url)+'"'+tag.slice(span.end);});}
export function assertEmailSafeMarkup(html,policy={}){
 if(/<(?:script|iframe|object|embed|svg|video|audio|form|input|button)\b|\son[a-z]+\s*=|\b(?:javascript|vbscript)\s*:/i.test(html))fail('UNSAFE_MARKUP','Remove unsupported interactive content before copying.');
 if(/\b(?:background|poster)\s*=|url\s*\(/i.test(html))fail('UNSAFE_MARKUP','Background images are not supported in Gmail signatures.');
 const verified=policy.verifiedUrls instanceof Set?policy.verifiedUrls:new Set(policy.verifiedUrls||[]),images=collectRenderedEmailImages(html);
 if(images.length>EMAIL_IMAGE_LIMITS.maxImages)fail('IMAGE_INVALID','This signature contains too many images.');
 for(const image of images){const type=classifyImageSource(image.source,policy);if(image.srcset!==undefined||!type.safe||!verified.has(type.url))fail('IMAGE_UNVERIFIED','Every signature image must have a verified public HTTPS address.');}
 return images;
}
export async function digestImageBytes(blob){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('');}
function dimensionCheck(width,height,limits){if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>limits.maxDimension||height>limits.maxDimension||width*height>limits.maxPixels)fail('IMAGE_INVALID','Resize the image below 4096 pixels per side and 16 megapixels.');}
function headerSize(bytes,mime){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(mime==='image/png'){
  if(bytes.length<33||[137,80,78,71,13,10,26,10].some((n,i)=>bytes[i]!==n)||v.getUint32(8)!==13||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')fail('IMAGE_INVALID','The image does not contain valid PNG data.');
  return {width:v.getUint32(16),height:v.getUint32(20)};
 }
 if(mime==='image/jpeg'){
  if(bytes[0]!==255||bytes[1]!==216)fail('IMAGE_INVALID','The image does not contain valid JPEG data.');
  let at=2;while(at+8<bytes.length){if(bytes[at++]!==255)break;let marker=bytes[at++];while(marker===255)marker=bytes[at++];if(marker===217||marker===218)break;const length=v.getUint16(at);if(length<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:v.getUint16(at+3),width:v.getUint16(at+5)};at+=length;}
  fail('IMAGE_INVALID','JPEG dimensions could not be validated.');
 }
 if(mime==='image/webp'){
  if(bytes.length<30||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')fail('IMAGE_INVALID','The image does not contain valid WebP data.');
  const kind=String.fromCharCode(...bytes.slice(12,16));
  if(kind==='VP8X')return {width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)};
  if(kind==='VP8 ')return {width:v.getUint16(26,true)&0x3fff,height:v.getUint16(28,true)&0x3fff};
  if(kind==='VP8L'&&bytes[20]===47)return {width:1+(v.getUint32(21,true)&0x3fff),height:1+((v.getUint32(21,true)>>14)&0x3fff)};
  fail('IMAGE_INVALID','WebP dimensions could not be validated.');
 }
 fail('IMAGE_INVALID','Use PNG, JPEG or WebP artwork.');
}
async function decodeBlob(blob){
 if(typeof createImageBitmap==='function'){const bitmap=await createImageBitmap(blob);return {width:bitmap.width,height:bitmap.height,image:bitmap,close:()=>bitmap.close()};}
 if(typeof Image==='undefined')fail('VERIFY_UNAVAILABLE','Image decoding is unavailable in this browser.');
 const url=URL.createObjectURL(blob);try{const img=new Image();img.src=url;await img.decode();return {width:img.naturalWidth,height:img.naturalHeight,image:img,close:()=>{}};}finally{URL.revokeObjectURL(url);}
}
function bounded(work,timeoutMs,message){let timer;return Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new EmailAssetError('VERIFY_UNAVAILABLE',message)),timeoutMs);})]).finally(()=>clearTimeout(timer));}
export async function validateImageBlob(blob,{mime=blob?.type,decodeImage=decodeBlob,limits={}}={}){
 limits={...EMAIL_IMAGE_LIMITS,...limits};mime=String(mime||'').split(';')[0].toLowerCase();
 if(!(blob instanceof Blob)||!blob.size||blob.size>limits.maxBytes||!MIME.has(mime))fail('IMAGE_INVALID','Use a nonempty PNG, JPEG or WebP image under 5 MB.');
 const declared=headerSize(new Uint8Array(await blob.arrayBuffer()),mime);dimensionCheck(declared.width,declared.height,limits);
 let decoded;try{decoded=await bounded(Promise.resolve(decodeImage(blob)),limits.timeoutMs,'Image verification timed out. Try a smaller image.');dimensionCheck(decoded.width,decoded.height,limits);if(decoded.width!==declared.width||decoded.height!==declared.height)fail('IMAGE_INVALID','Image dimensions did not match its contents.');}catch(e){if(e instanceof EmailAssetError)throw e;fail('IMAGE_INVALID','This image could not be decoded. Re-upload it as PNG.');}finally{decoded?.close?.();}
 return {...declared,mime,size:blob.size};
}
export async function downloadImageBlob(url,{fetch:fetcher=globalThis.fetch,limits={},source=true,allowSvg=false}={}){
 limits={...EMAIL_IMAGE_LIMITS,...limits};const controller=new AbortController();let reader,timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reader?.cancel().catch(()=>{});reject(new EmailAssetError('VERIFY_UNAVAILABLE','Image download timed out. Check hosting availability and retry.'));},limits.timeoutMs);});
 try{
  return await Promise.race([timeout,(async()=>{
  const response=await fetcher(url,{method:'GET',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal:controller.signal,headers:{Accept:'image/png,image/jpeg,image/webp'+(allowSvg?',image/svg+xml':'')}});
  if(!response.ok||response.redirected||response.type==='opaque')fail('VERIFY_UNAVAILABLE','The image host is unavailable. Retry or re-upload the image.');
  if(Number(response.headers.get('content-length'))>limits.maxBytes)fail('IMAGE_INVALID','The image exceeds 5 MB.');
  const mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!MIME.has(mime)&&!(allowSvg&&mime==='image/svg+xml'))fail('IMAGE_INVALID','The image host did not return supported image data.');
  reader=response.body?.getReader();if(!reader)fail('VERIFY_UNAVAILABLE','This browser cannot verify image downloads.');
  const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limits.maxBytes){await reader.cancel();fail('IMAGE_INVALID','The image exceeds 5 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
  if(!size)fail('IMAGE_INVALID','The image host returned an empty file.');
  return new Blob(chunks,{type:mime});
  })()]);
 }catch(e){if(e instanceof EmailAssetError)throw e;fail('VERIFY_UNAVAILABLE',source?'This image cannot be downloaded safely. Upload its PNG file instead of a URL.':'Public image verification failed. Check hosting availability and retry.');}finally{clearTimeout(timer);}
}
export async function verifyPublicImage(url,options={}){
 const classified=classifyImageSource(url,options.policy||{});if(!classified.safe)fail('IMAGE_UNVERIFIED','This image address is not an approved public image host.');
 const blob=await downloadImageBlob(classified.url,{...options,source:false,allowSvg:false}),details=await validateImageBlob(blob,options),hash=await digestImageBytes(blob);
 if(options.expectedHash&&hash!==options.expectedHash)fail('IMAGE_INVALID','The hosted image does not match the prepared image.');
 if(classified.hash&&hash!==classified.hash)fail('IMAGE_INVALID','The hosted image does not match its immutable address.');
 return {...details,hash,url:classified.url,verifiedAt:new Date().toISOString()};
}
export async function imageSourceBlob(src,options={}){
 if(typeof src==='string'&&src.length>EMAIL_IMAGE_LIMITS.maxBytes*1.4)fail('IMAGE_INVALID','The image exceeds 5 MB.');
 const type=classifyImageSource(src,options.policy||{});
 if(['missing','private-or-signed','unsupported','malformed'].includes(type.kind))fail('IMAGE_INVALID','Use a local image upload or a public image without access tokens.');
 const blob=await downloadImageBlob(type.url||src,{...options,source:true,allowSvg:false});await validateImageBlob(blob,options);
 if(blob.type==='image/png')return blob;
 const decoded=await (options.decodeImage||decodeBlob)(blob);try{if(typeof document==='undefined')fail('VERIFY_UNAVAILABLE','PNG conversion is unavailable.');const canvas=document.createElement('canvas');canvas.width=decoded.width;canvas.height=decoded.height;canvas.getContext('2d').drawImage(decoded.image,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(out=>out?resolve(out):reject(new EmailAssetError('IMAGE_INVALID','Could not convert the image to PNG.')),'image/png'));}finally{decoded.close?.();}
}
function storageURL(cloud,owner,hash){return cloud.base+'/storage/v1/object/public/signature-assets/'+owner+'/'+hash+'.png';}
/** Pure orchestration: all mutable project/account ownership is guarded by the caller's isCurrent. */
export async function prepareEmailAssets(snapshot,variants,dependencies){
 const {cloud,prepare,render,isCurrent,consent=false,onStatus=()=>{}}=dependencies;
 const ownerId=cloud?.user?.id||null,hostingOrigin=cloud?.base,policy={origin:dependencies.origin,storageOrigin:hostingOrigin,...dependencies.policy};
 const options={policy,fetch:dependencies.fetch,decodeImage:dependencies.decodeImage,limits:dependencies.limits};
 const guard=()=>{if(typeof isCurrent!=='function'||!isCurrent()||(cloud?.user?.id||null)!==ownerId||cloud?.base!==hostingOrigin)fail('STALE_EXPORT','The project or account changed. Prepare the current signature again.');};
 const inventory=[],contexts=[],bySource=new Map(),byHash=new Map(),verifiedUrls=new Set(),publishedAssets={},publicationMetadata={};
 const emit=()=>onStatus(inventory.map(row=>({...row})));
 try{
  guard();for(const variant of [...new Set(variants)]){
   if(!['full','reply'].includes(variant))fail('IMAGE_INVALID','Choose Full or Reply.');
   const doc=structuredClone(snapshot);doc.variant=variant;
   const prepared=await prepare(doc,dependencies.origin);guard();
   const preliminary=render(doc,{images:prepared.images||{},origin:dependencies.origin});
   const refs=collectRenderedEmailImages(preliminary);if(refs.length>EMAIL_IMAGE_LIMITS.maxImages)fail('IMAGE_INVALID','This signature contains too many images.');
   for(const ref of refs){const row={...ref,id:variant+':'+ref.id,variant,status:'Needs preparation'};inventory.push(row);if(!bySource.has(ref.source))bySource.set(ref.source,{source:ref.source,rows:[]});bySource.get(ref.source).rows.push(row);}
   if(prepared.errors?.length){for(let index=0;index<prepared.errors.length;index++)inventory.push({id:variant+':error:'+index,label:'Image preparation',variant,status:'Could not prepare'});fail('IMAGE_INVALID','An image could not be prepared. Re-upload it or remove it from this variant.');}
   contexts.push({doc,prepared});
  }
  emit();
  for(const asset of bySource.values()){
   guard();for(const row of asset.rows)row.status='Preparing';emit();const type=classifyImageSource(asset.source,policy);
   if(type.safe&&(!type.ownerId||type.ownerId===ownerId)){
    const verified=await verifyPublicImage(type.url,options);guard();asset.url=verified.url;verifiedUrls.add(asset.url);for(const row of asset.rows)Object.assign(row,verified,{status:'Ready'});emit();continue;
   }
   const blob=await (dependencies.toBlob||imageSourceBlob)(asset.source,options);guard();
   const details=await validateImageBlob(blob,options),hash=await digestImageBytes(blob);guard();
   if(byHash.has(hash)){asset.url=byHash.get(hash);for(const row of asset.rows)Object.assign(row,details,{hash,url:asset.url,status:'Ready'});emit();continue;}
   if(!ownerId||!OWNER.test(ownerId)||!cloud?.configured)fail('SIGN_IN_REQUIRED','Sign in to prepare publicly hosted signature images.');
   const expected=storageURL(cloud,ownerId,hash),stored=snapshot.emailAssetMetadata?.[hash];
   const metadataURL=stored?.hash===hash&&stored.ownerId===ownerId&&stored.hostingIdentity===hostingOrigin+'/signature-assets'?stored.url:null;
   const previous=snapshot.publishedAssets?.[hash]===expected?expected:metadataURL;
   if(previous===expected)asset.url=previous;
   else{
    if(!consent)fail('CONSENT_REQUIRED','Preparing images makes the artwork in these variants public to anyone with its URL. Previously sent emails may continue to use it.');
    guard();asset.url=await cloud.uploadBlob(blob,{hash,mime:'image/png',extension:'png',ownerId,isCurrent,decodeImage:dependencies.decodeImage});guard();
    if(asset.url!==expected)fail('IMAGE_UNVERIFIED','The image was published to an unexpected owner or host.');
   }
   const verified=await verifyPublicImage(asset.url,{...options,expectedHash:hash});guard();
   byHash.set(hash,asset.url);verifiedUrls.add(asset.url);publishedAssets[hash]=asset.url;publicationMetadata[hash]={...details,hash,url:asset.url,ownerId,hostingIdentity:cloud.base+'/signature-assets',verifiedAt:verified.verifiedAt};
   for(const row of asset.rows)Object.assign(row,verified,{status:'Ready'});emit();
  }
  const replacements=new Map([...bySource].map(([source,asset])=>[source,asset.url])),htmlByVariant={};
  for(const {doc,prepared}of contexts){guard();const fresh=render(doc,{images:prepared.images||{},origin:dependencies.origin});const html=replaceEmailImageSources(fresh,replacements);assertEmailSafeMarkup(html,{...policy,verifiedUrls});htmlByVariant[doc.variant]=html;}
  guard();return {htmlByVariant,publishedAssets,publicationMetadata,inventory,verifiedUrls};
 }catch(error){for(const row of inventory)if(row.status==='Preparing')row.status=error.code==='VERIFY_UNAVAILABLE'?'Verification unavailable':error.code==='CONSENT_REQUIRED'||error.code==='SIGN_IN_REQUIRED'?'Needs preparation':'Could not prepare';emit();if(error instanceof EmailAssetError){error.inventory=inventory;throw error;}const wrapped=new EmailAssetError('PUBLICATION_FAILED','Images could not be published. Check your session and image hosting, then retry.',inventory);wrapped.cause=error;throw wrapped;}
}
