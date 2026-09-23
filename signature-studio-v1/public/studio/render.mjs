import {renderSignature,preflight} from '../design/engine.mjs';
import {prepareImages} from '../design/media.mjs';
import {renderBlocks,checks as blockChecks} from '../blocks/render.mjs';
import {prepareBlocks} from '../blocks/media.mjs';
import {walk,clone} from '../blocks/model.mjs';
import {designProject} from './model.mjs';
function projectFor(doc,node){
 const p=designProject(doc),s=node.style;
 if(s.color){p.design.primary=s.color;p.design.secondary=s.color;p.design.link=s.color;}
 if(s.font)p.design.nameFont=p.design.bodyFont=s.font;
 if(s.size)p.design.nameSize=p.design.roleSize=p.design.bodySize=p.design.tagSize=s.size;
 if(s.weight)p.design.nameWeight=s.weight;
 if(s.tracking!==undefined)p.design.tracking=s.tracking;
 if(s.lineHeight)p.design.lineHeight=s.lineHeight;
 if(s.align)p.design.align=s.align;
 if(s.nowrap&&s.nowrap!=='inherit')p.design.nowrap=s.nowrap==='nowrap';
 return p;
}
function fragment(node,doc,ctx){
 const p=projectFor(doc,node);let part=node.props.part;
 if(node.props.role==='secondary-logo'&&!p.assets.portrait.src)return '';
 if(part==='portrait'&&!p.assets.portrait.src)part='logo';
 if(doc.variant==='reply'&&!['identity','identity-no-company','contact','name','title','company','pronouns'].includes(part))return '';
 if(['logo','portrait','partner'].includes(part)&&!p.design['show'+part[0].toUpperCase()+part.slice(1)])return '';
 if(p.sections.some(s=>s.type===part&&!s.enabled))return '';
 const images={};for(const [key,value] of Object.entries(ctx.images))if(key.startsWith('studio:'))images[key.slice(7)]=value;
 // Respect the actual column width for wrapping banners / long supporting copy.
 p.design.baseWidth=Math.max(240,Math.min(p.design.baseWidth,ctx.width));
 return renderSignature(p,{part,images,origin:ctx.origin,edit:ctx.edit});
}
export function render(doc,context={}){return renderBlocks(doc,{...context,fragment});}
export async function prepare(doc,origin){
 const result=await prepareBlocks(doc,origin);
 if(!doc.designData)return result;
 const p=designProject(doc),parts=new Set();walk(doc.children,n=>{if(n.type==='fragment')parts.add(n.props.part);});
 if(parts.has('portrait')&&!p.assets.portrait.src)parts.add('logo');
 for(const slot of Object.keys(p.assets))if(!parts.has(slot))p.assets[slot].src='';
 if(!parts.has('social'))p.socials=[];
 const out=await prepareImages(p,origin);
 for(const [key,value] of Object.entries(out.images)){result.images['studio:'+key]=value;if(out.keys[key])result.keys['studio:'+key]=out.keys[key];}
 result.errors.push(...out.errors.map(e=>e.text));return result;
}
export function checks(doc,html,width,errors=[]){
 const info=blockChecks(doc,html,width,errors),p=designProject(doc);
 for(const warning of preflight(p,html,width))if(!info.items.some(i=>i.text===warning.text)&&!['images','width'].includes(warning.kind))info.items.push({level:'warning',text:warning.text});
 return info;
}
