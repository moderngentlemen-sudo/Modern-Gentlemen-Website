import {safeImage} from './engine.mjs';
const imageCache=new Map(),rawCache=new Map();
export async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function loadImage(src){if(rawCache.has(src))return rawCache.get(src);const promise=new Promise((resolve,reject)=>{const im=new Image();if(!src.startsWith('data:'))im.crossOrigin='anonymous';im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('This image cannot be processed. Upload the image file instead of its URL.'));im.src=src;});rawCache.set(src,promise);if(rawCache.size>32)rawCache.delete(rawCache.keys().next().value);return promise;}
export async function readImage(file){
 if(!file||file.size>5*1024*1024)throw new Error('Use a PNG, JPEG, WebP or SVG under 5 MB.');
 if(!['image/png','image/jpeg','image/webp','image/svg+xml'].includes(file.type))throw new Error('Please upload PNG, JPEG, WebP or SVG artwork. Animated images are not supported.');
 let src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=reject;r.onload=()=>resolve(r.result);r.readAsDataURL(file);});
 if(file.type==='image/svg+xml'){
  const text=await file.text(),doc=new DOMParser().parseFromString(text,'image/svg+xml');
  if(doc.querySelector('parsererror,script,foreignObject,iframe,object,embed'))throw new Error('This SVG contains unsupported active content. Use a PNG export.');
  for(const el of doc.querySelectorAll('*'))for(const a of el.attributes)if(/^on/i.test(a.name)||(/(?:href|src)$/i.test(a.name)&&!a.value.startsWith('#')&&!a.value.startsWith('data:image/'))||/url\(\s*['"]?(?:https?:|\/\/)/i.test(a.value))throw new Error('Use an SVG without external resources or active content.');
 }
 const im=await loadImage(src);if(im.naturalWidth*im.naturalHeight>50e6)throw new Error('This image is too large to process. Resize it below 50 megapixels.');
 const ratio=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(im.naturalHeight*ratio));canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/png');
}
async function bake(a,width,height,shape,background,origin){
 let src=safeImage(a.src,origin);if(/^data:image\/svg\+xml[;,]/i.test(a.src)){const blob=await (await fetch(a.src)).blob();src=await readImage(new File([blob],'imported.svg',{type:'image/svg+xml'}));}if(!src)throw new Error('Enter a valid image URL or upload artwork.');
 const key=await digest(JSON.stringify([src,width,height,a.zoom,a.x,a.y,a.fit,shape,background]));
 if(imageCache.has(key))return {key,src:imageCache.get(key)};
 // Unchanged built-in square artwork already has a public, Gmail-friendly PNG URL.
 if(src.includes('/design/media/')&&a.zoom===100&&!a.x&&!a.y&&shape==='square'&&width===height&&a.fit==='contain'){imageCache.set(key,src);return {key,src};}
 const im=await loadImage(src),canvas=document.createElement('canvas');canvas.width=Math.round(width*2);canvas.height=Math.round(height*2);const ctx=canvas.getContext('2d');ctx.scale(2,2);
 const radius=shape==='circle'?Math.min(width,height)/2:shape==='rounded'?Math.min(16,width/5):typeof shape==='number'?shape:0;
 if(radius){ctx.beginPath();ctx.roundRect(0,0,width,height,radius);ctx.clip();}
 if(background&&background!=='transparent'){ctx.fillStyle=background;ctx.fillRect(0,0,width,height);}
 const fit=(a.fit==='cover'?Math.max:Math.min)(width/im.naturalWidth,height/im.naturalHeight)*(a.zoom/100),w=im.naturalWidth*fit,h=im.naturalHeight*fit;
 ctx.drawImage(im,(width-w)/2+(a.x/100)*width/2,(height-h)/2+(a.y/100)*height/2,w,h);
 const output=canvas.toDataURL('image/png');imageCache.set(key,output);if(imageCache.size>80)imageCache.delete(imageCache.keys().next().value);return {key,src:output};
}
export async function prepareImages(project,origin=location.origin){
 const d=project.design,images={},keys={},errors=[];
 for(const [slot,a] of Object.entries(project.assets)){
  if(!a.src)continue;
  const width=slot==='logo'?d.logoWidth:slot==='portrait'?d.portraitWidth:slot==='partner'?d.partnerWidth:Math.min(d.bannerWidth,d.baseWidth-2*d.padding),height=slot==='banner'?d.bannerHeight:width;
  const shape=slot==='portrait'?d.portraitShape:slot==='banner'?d.bannerRadius:d.logoShape;
  try{const baked=await bake(a,width,height,shape,slot==='logo'?d.imageBackground:'transparent',origin);keys[slot]=baked.key;images[slot]=project.publishedAssets[baked.key]||baked.src;}catch(e){images[slot]=safeImage(a.src,origin);errors.push({kind:'image',text:`${slot}: ${e.message}`});}
 }
 for(const [index,s] of project.socials.entries())if(s.customIcon){try{const baked=await bake({src:s.customIcon,zoom:100,x:0,y:0,fit:'contain'},d.iconSize-6,d.iconSize-6,'square','transparent',origin);keys['social-'+index]=baked.key;images['social-'+index]=project.publishedAssets[baked.key]||baked.src;}catch(e){errors.push({kind:'image',text:`${s.label}: ${e.message}`});}}
 return {images,keys,errors};
}
export async function signaturePNG(html,width,height){
 const wrapper=document.createElement('div');wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml');wrapper.style.width=width+'px';wrapper.innerHTML=html;
 for(const im of wrapper.querySelectorAll('img'))if(!im.src.startsWith('data:')){const r=await fetch(im.src,{credentials:'omit'});if(!r.ok)throw new Error('An image could not be downloaded for PNG export.');const blob=await r.blob();im.src=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}
 const xml=new XMLSerializer().serializeToString(wrapper),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width*2}" height="${height*2}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
 const im=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)),canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;canvas.getContext('2d').drawImage(im,0,0);
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export is not supported in this browser. Use HTML export.')),'image/png'));
}
