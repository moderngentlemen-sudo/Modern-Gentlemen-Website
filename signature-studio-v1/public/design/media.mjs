import {safeUrl,renderSignature} from './engine.mjs';
import {collectRenderedImages} from '../shared/rendered-images.mjs';
import {classifyImageSource,downloadImageBlob,EMAIL_IMAGE_LIMITS} from '../shared/email-assets.mjs';
import {qrMatrix} from '../blocks/qr.mjs';
const imageCache=new Map(),rawCache=new Map();
export async function digest(value){const bytes=value instanceof Blob?await value.arrayBuffer():typeof value==='string'?new TextEncoder().encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function loadImage(src,{cache=true}={}){
 if(cache&&rawCache.has(src))return rawCache.get(src);
 const promise=new Promise((resolve,reject)=>{const im=new Image(),timer=setTimeout(()=>{im.src='';reject(new Error('Image processing timed out. Upload the image file and retry.'));},12000);if(!src.startsWith('data:'))im.crossOrigin='anonymous';im.referrerPolicy='no-referrer';im.onload=()=>{clearTimeout(timer);if(!im.naturalWidth||!im.naturalHeight||im.naturalWidth*im.naturalHeight>50e6)reject(new Error('Resize this image below 50 megapixels.'));else resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('This image cannot be processed. Upload the image file instead of its URL.'));};im.src=src;});
 if(cache){rawCache.set(src,promise);promise.catch(()=>rawCache.delete(src));if(rawCache.size>32)rawCache.delete(rawCache.keys().next().value);}return promise;
}
function validateSVG(text){
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('Use an SVG without external resources or active content.');
 const doc=new DOMParser().parseFromString(text,'image/svg+xml');
 if(doc.querySelector('parsererror,script,foreignObject,iframe,object,embed,style,animate,set,animateMotion,animateTransform'))throw new Error('This SVG contains unsupported active content. Use a PNG export.');
 for(const el of doc.querySelectorAll('*'))for(const a of el.attributes)if(/^on/i.test(a.name)||(/(?:href|src)$/i.test(a.name)&&!a.value.startsWith('#')&&!/^data:image\/(?:png|jpeg|webp);base64,/i.test(a.value))||/url\(\s*['"]?(?!#)/i.test(a.value))throw new Error('Use an SVG without external resources or active content.');
}
async function sourceBlob(source,origin){
 const classified=classifyImageSource(source,{origin});
 if(['missing','private-or-signed','unsupported','malformed'].includes(classified.kind))throw new Error('Use a local upload or a public image without access tokens.');
 if(source.length>7*1024*1024)throw new Error('Use an image under 5 MB.');
 const blob=await downloadImageBlob(classified.url||source,{allowSvg:true,source:true});
 if(blob.type==='image/svg+xml')validateSVG(await blob.text());return blob;
}
export async function readImage(file){
 if(!file||file.size>5*1024*1024)throw new Error('Use a PNG, JPEG, WebP or SVG under 5 MB.');
 if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))throw new Error('Please upload PNG, JPEG, WebP or SVG artwork. Animated images are not supported.');
 if(file.type==='image/svg+xml')validateSVG(await file.text());
 const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>resolve(r.result);r.readAsDataURL(file);});
 await loadImage(src);return src; // Preserve the editable source; derivatives are separate.
}
export function qrData(url){
 const clean=safeUrl(url);if(!clean)throw new Error('Enter a valid QR destination.');const matrix=qrMatrix(clean),n=matrix.length,cell=6,cv=document.createElement('canvas');cv.width=cv.height=(n+8)*cell;const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#000';matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)ctx.fillRect((x+4)*cell,(y+4)*cell,cell,cell);}));return cv.toDataURL('image/png');
}
async function bake(recipe,origin){
 const a={zoom:100,x:0,y:0,fit:'contain',shape:'square',background:'transparent',...recipe};
 const classification=classifyImageSource(a.src,{origin});
 if(['missing','private-or-signed','unsupported','malformed'].includes(classification.kind))throw new Error('Use a local upload or a public image without access tokens.');
 const src=classification.url||a.src;
 const width=Number(a.width),height=Number(a.height);if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*2>4096||height*2>4096)throw new Error('Choose image dimensions between 1 and 2048 pixels.');
 const local=src.startsWith('data:'),recipeKey=local?await digest(JSON.stringify([src,width,height,a.zoom,a.x,a.y,a.fit,a.shape,a.background])):null;
 if(recipeKey&&imageCache.has(recipeKey))return imageCache.get(recipeKey);
 // Remote URLs can change their bytes. Never reuse a derivative by URL alone.
 const input=await sourceBlob(src,origin),url=URL.createObjectURL(input);let im;try{im=await loadImage(url,{cache:false});}finally{URL.revokeObjectURL(url);}
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*2));canvas.height=Math.max(1,Math.round(height*2));const ctx=canvas.getContext('2d');ctx.scale(2,2);
 const radius=a.shape==='circle'?Math.min(width,height)/2:a.shape==='rounded'?Math.min(16,width/5):typeof a.shape==='number'?a.shape:0;
 if(radius){ctx.beginPath();ctx.roundRect(0,0,width,height,radius);ctx.clip();}
 if(/^#[a-f\d]{6}$/i.test(a.background)){ctx.fillStyle=a.background;ctx.fillRect(0,0,width,height);}
 const fit=(a.fit==='cover'?Math.max:Math.min)(width/im.naturalWidth,height/im.naturalHeight)*(a.zoom/100),w=im.naturalWidth*fit,h=im.naturalHeight*fit;
 ctx.drawImage(im,(width-w)/2+(a.x/100)*width/2,(height-h)/2+(a.y/100)*height/2,w,h);
 const output=canvas.toDataURL('image/png'),blob=await (await fetch(output)).blob();if(!blob.size||blob.size>5*1024*1024)throw new Error('The processed image exceeds 5 MB.');
 const result={key:await digest(blob),src:output};if(recipeKey){imageCache.set(recipeKey,result);if(imageCache.size>80)imageCache.delete(imageCache.keys().next().value);}return result;
}
export async function prepareImageDependencies(inventory,origin){
 const images={},keys={},errors=[],pending=new Map();
 if(inventory.length>EMAIL_IMAGE_LIMITS.maxImages)return {images,keys,errors:['This variant contains too many images. Remove artwork before preparing it for email.'],inventory};
 for(const asset of inventory){
  try{
   const recipe=asset.kind==='qr'?{src:qrData(asset.source),width:asset.width,height:asset.height,fit:'contain',zoom:100}:asset.recipe;
   const fingerprint=JSON.stringify(recipe);if(!pending.has(fingerprint))pending.set(fingerprint,bake(recipe,origin));
   const result=await pending.get(fingerprint);images[asset.id]=result.src;keys[asset.id]=result.key;
  }catch(e){errors.push(`${asset.label||asset.kind||'Image'}: ${e.message}`);}
 }
 return {images,keys,errors,inventory};
}
export async function prepareImages(project,origin=location.origin,variant=project.variant){
 const snapshot=structuredClone(project);snapshot.variant=variant;
 const {inventory}=collectRenderedImages(snapshot,{render:renderSignature,origin});
 const result=await prepareImageDependencies(inventory,origin);
 return {...result,errors:result.errors.map(text=>({kind:'image',text}))};
}
export async function signaturePNG(html,width,height){
 const wrapper=document.createElement('div');wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');wrapper.style.width=width+'px';wrapper.innerHTML=html;
 for(const im of wrapper.querySelectorAll('img'))if(!im.src.startsWith('data:')){const r=await fetch(im.src,{credentials:'omit'});if(!r.ok)throw new Error('An image could not be downloaded for PNG export.');const blob=await r.blob();im.src=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}
 const xml=new XMLSerializer().serializeToString(wrapper),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width*2}" height="${height*2}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
 const im=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)),canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;canvas.getContext('2d').drawImage(im,0,0);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export is not supported in this browser. Use HTML export.')),'image/png'));
}
