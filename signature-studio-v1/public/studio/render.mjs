import {renderSignature,preflight} from '../design/engine.mjs';
import {prepareImageDependencies} from '../design/media.mjs';
import {renderBlocks,checks as blockChecks} from '../blocks/render.mjs';
import {collectRenderedImages} from '../shared/rendered-images.mjs';
import {walk,clone} from '../blocks/model.mjs';
import {designProject} from './model.mjs';
function projectFor(doc,node,inherited={}){
 const p=designProject(doc),s=node.style;
 if(s.color){p.design.primary=s.color;p.design.secondary=s.color;p.design.link=s.color;}
 if(s.font)p.design.nameFont=p.design.bodyFont=s.font;
 if(s.size)p.design.nameSize=p.design.roleSize=p.design.bodySize=p.design.tagSize=s.size;
 if(s.weight)p.design.nameWeight=s.weight;
 if(s.tracking!==undefined)p.design.tracking=s.tracking;
 if(s.lineHeight)p.design.lineHeight=s.lineHeight;
 if(s.align||inherited.align)p.design.align=s.align||inherited.align;
 if(s.nowrap&&s.nowrap!=='inherit')p.design.nowrap=s.nowrap==='nowrap';
 return p;
}
function fragment(node,doc,ctx){
 const p=projectFor(doc,node,ctx.style);let part=node.props.part;
 if(node.props.role==='secondary-logo'&&!p.assets.portrait.src)return '';
 if(part==='portrait'&&!p.assets.portrait.src)part='logo';
 if(['logo','portrait','partner'].includes(part)&&!p.design['show'+part[0].toUpperCase()+part.slice(1)])return '';
 if(p.sections.some(s=>s.type===part&&!s.enabled))return '';
 const prefix='studio:'+node.id+':',images={};for(const [key,value] of Object.entries(ctx.images))if(key.startsWith(prefix))images[key.slice(prefix.length)]=value;
 // Respect the actual column width for wrapping banners / long supporting copy.
 p.design.baseWidth=Math.max(240,Math.min(p.design.baseWidth,ctx.width));
 return renderSignature(p,{part,images,origin:ctx.origin,edit:ctx.edit,explicitVisibility:true,inventory:ctx.inventory,imagePrefix:prefix});
}
export function render(doc,context={}){return renderBlocks(doc,{...context,fragment});}
export async function prepare(doc,origin=location.origin,variant=doc.variant){
 const snapshot=clone(doc);snapshot.variant=variant;
 const {inventory}=collectRenderedImages(snapshot,{render,origin});
 return prepareImageDependencies(inventory,origin);
}
export function checks(doc,html,width,errors=[]){
 const info=blockChecks(doc,html,width,errors),p=designProject(doc);
 for(const warning of preflight(p,html,width))if(!info.items.some(i=>i.text===warning.text)&&!['images','width'].includes(warning.kind))info.items.push({level:'warning',text:warning.text});
 return info;
}
