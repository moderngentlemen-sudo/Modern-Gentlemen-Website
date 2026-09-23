import {loadImage,digest,prepareImages,readImage} from '../design/media.mjs';
import {safeImage,safeUrl} from '../design/engine.mjs';
import {walk} from './model.mjs';
import {qrMatrix} from './qr.mjs';
export {readImage};
const cache=new Map();
async function bake(p,origin){
 const source=safeImage(p.src,origin);if(!source)throw new Error('Upload artwork or enter a valid image URL.');
 const width=p.width||92,height=p.height||92,key=await digest(JSON.stringify([source,width,height,p.zoom,p.x,p.y,p.fit,p.shape,p.background]));
 if(cache.has(key))return {key,src:cache.get(key)};
 if(source.includes('/design/media/') && width===height && (!p.zoom||p.zoom===100) && !p.x && !p.y && (!p.shape||p.shape==='square') && p.fit!=='cover' && (!p.background||p.background==='transparent'))return {key,src:source};
 const im=await loadImage(source);const cv=document.createElement('canvas');cv.width=width*2;cv.height=height*2;const ctx=cv.getContext('2d');ctx.scale(2,2);
 const radius=p.shape==='circle'?Math.min(width,height)/2:p.shape==='rounded'?Math.min(16,width/5):0;
 if(radius){ctx.beginPath();ctx.roundRect(0,0,width,height,radius);ctx.clip();}
 if(/^#[a-f\d]{6}$/i.test(p.background)){ctx.fillStyle=p.background;ctx.fillRect(0,0,width,height);}
 const r=(p.fit==='cover'?Math.max:Math.min)(width/im.naturalWidth,height/im.naturalHeight)*(p.zoom||100)/100,w=im.naturalWidth*r,h=im.naturalHeight*r;
 ctx.drawImage(im,(width-w)/2+(p.x||0)*width/200,(height-h)/2+(p.y||0)*height/200,w,h);
 const src=cv.toDataURL('image/png');cache.set(key,src);if(cache.size>100)cache.delete(cache.keys().next().value);return {key,src};
}
export function qrData(url){
 const clean=safeUrl(url);if(!clean)throw new Error('Enter a valid QR destination.');const matrix=qrMatrix(clean),n=matrix.length,cell=6,cv=document.createElement('canvas');cv.width=cv.height=(n+8)*cell;const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#000';matrix.forEach((row,y)=>row.forEach((v,x)=>{if(v)ctx.fillRect((x+4)*cell,(y+4)*cell,cell,cell);}));return cv.toDataURL('image/png');
}
export async function prepareBlocks(doc,origin=location.origin){const images={},keys={},errors=[];const nodes=[];walk(doc.children,n=>nodes.push(n));
 for(const n of nodes){try{
  if(n.type==='image'&&n.props.src){const out=await bake(n.props,origin);keys[n.id]=out.key;images[n.id]=doc.publishedAssets[out.key]||out.src;}
  if(n.type==='qr'&&n.props.url){const src=qrData(n.props.url),key=await digest(src);keys[n.id]=key;images[n.id]=doc.publishedAssets[key]||src;}
  if(n.type==='social')for(const [j,s]of n.props.items.entries())if(s.customIcon){const out=await bake({src:s.customIcon,width:n.props.size||24,height:n.props.size||24,zoom:100},origin);keys[n.id+':'+j]=out.key;images[n.id+':'+j]=doc.publishedAssets[out.key]||out.src;}
  if(n.type==='template'){const out=await prepareImages(n.props.project,origin);for(const [k,v]of Object.entries(out.images)){const hash=out.keys[k];images[n.id+':'+k]=doc.publishedAssets[hash]||v;if(hash)keys[n.id+':'+k]=hash;}errors.push(...out.errors.map(e=>e.text));}
 }catch(e){errors.push(`${n.label}: ${e.message}`);}}
 return {images,keys,errors};
}
