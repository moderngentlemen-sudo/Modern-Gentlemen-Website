/** Image references are selected from the finished render, never a raw tree walk.
 * Renderers may evaluate unused branches while building tables; only markers that
 * survive into that final HTML are dependencies. Markers never leave this helper.
 */
export function imageMarker(context,asset,{missing=false}={}){
 if(!Array.isArray(context?.inventory))return '';
 const index=context.inventory.push({...asset,id:(context.imagePrefix||'')+asset.id})-1;
 return ` data-ss-${missing?'required':'image'}="${index}"`;
}

export function missingImage(context,asset){
 const marker=imageMarker(context,asset,{missing:true});
 return marker?`<span${marker}></span>`:'';
}

export function collectRenderedImages(project,{render,origin='https://example.com',images={}}={}){
 if(typeof render!=='function')throw new Error('An email renderer is required.');
 const candidates=[],output=render(project,{origin,images,inventory:candidates,edit:false});
 const used=new Set();
 for(const match of output.matchAll(/ data-ss-(?:image|required)="(\d+)"/g))used.add(Number(match[1]));
 const inventory=[...used].map(index=>candidates[index]).filter(Boolean);
 return {html:output.replace(/<span data-ss-required="\d+"><\/span>/g,'').replace(/ data-ss-image="\d+"/g,''),inventory};
}

/** Persist diagnostics only; every stored URL still needs fresh public verification. */
export function normalizeEmailAssetMetadata(input){
 const out={};
 for(const [hash,value] of Object.entries(input&&typeof input==='object'?input:{}).slice(0,300)){
  if(!/^[a-f\d]{64}$/.test(hash)||!value||typeof value!=='object'||value.hash!==hash||typeof value.url!=='string'||value.url.length>2048)continue;
  let url;try{url=new URL(value.url);}catch{continue;}
  if(url.protocol!=='https:'||url.username||url.password||!/^https:\/\//.test(value.hostingIdentity||'')||value.hostingIdentity.length>300||!/^[A-Za-z0-9_-]{1,128}$/.test(value.ownerId||'')||value.mime!=='image/png')continue;
  if(!['width','height','size'].every(key=>Number.isSafeInteger(value[key])&&value[key]>0)||value.width>4096||value.height>4096||value.size>5*1024*1024||!Number.isFinite(Date.parse(value.verifiedAt)))continue;
  out[hash]={hash,url:url.href,hostingIdentity:value.hostingIdentity,ownerId:value.ownerId,mime:'image/png',width:value.width,height:value.height,size:value.size,verifiedAt:new Date(value.verifiedAt).toISOString()};
 }
 return out;
}
