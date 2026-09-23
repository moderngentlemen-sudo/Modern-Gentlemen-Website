/** A single document for templates, style controls and independently placed blocks. */
import {freshProject,TEMPLATES,applyTemplate as applyDesign} from '../design/catalog.mjs';
import {normalizeProject} from '../design/engine.mjs';
import {block,clone,normalize as validate,freshDocument,walk,uid} from '../blocks/model.mjs';
export const STORE='signature-studio.unified.v1';
export function designProject(doc){
 return normalizeProject({...freshProject(),...(doc.designData||{}),schemaVersion:2,name:doc.name,variant:doc.variant,identity:doc.identity,design:doc.design,publishedAssets:doc.publishedAssets});
}
function keepData(doc,p){
 doc.designData={};for(const k of ['templateId','visible','assets','socials','content','extras','sections'])doc.designData[k]=clone(p[k]);
}
function fragment(part,label=part){return block('fragment',{part,managed:true},{},[],label);}
function container(type,label,kids,style={}){return block(type,{managed:true},style,kids.filter(Boolean),label);}
function stack(label,kids,style={}){return container('group',label,kids,style);}
function cols(label,left,right,ratios=[25,75],style={}){return block('columns',{ratios,managed:true},style,[container('column','Left column',left),container('column','Right column',right)],label);}
function rule(d){return block('divider',{orientation:'horizontal',length:d.ruleLength,thickness:d.ruleWidth,line:d.borderStyle,managed:true},{},[],'Accent rule');}
/** Compositions remain a tree of movable elements. A template is not an opaque card. */
export function compose(project){
 const p=normalizeProject(project),d=p.design;
 const f=(part,label)=>fragment(part,label),logo=()=>f('logo','Logo'),portrait=()=>f('portrait','Portrait'),partner=()=>f('partner','Partner logo'),brand=()=>f('brand','Brand label');
 const identity=(omit=false)=>f(omit?'identity-no-company':'identity','Identity');
 const body=(exclude=[])=>p.sections.filter(s=>!exclude.includes(s.type)).map(s=>{const n=f(s.type,({contact:'Contact details',social:'Social links',cta:'Calls to action',custom:'Custom fields',banner:'Campaign banner'})[s.type]||s.type[0].toUpperCase()+s.type.slice(1));if(!s.enabled)n.visibility='hidden';return n;});
 const main=(exclude=[],omit=false)=>[identity(omit),...body(exclude)];
 const pairing=(reverse=false,border=false,portraitFirst=false)=>{
  const node=cols('Identity & details',reverse?main():[portraitFirst?portrait():logo()],reverse?[logo()]:[identity(),...(portraitFirst?[Object.assign(logo(),{props:{part:'logo',managed:true,role:'secondary-logo'}})]:[]),...body()],reverse?[76,24]:[24,76]);
  if(border)node.children[0].style.borderRight=d.ruleWidth;
  return node;
 };
 const marks=()=>cols('Partner brands',[logo()],[partner()],[50,50]);
 const mast=()=>cols('Brand masthead',[brand()],[logo()],[80,20]);
 const section=(label,kids,style={})=>container('section',label,kids,style);
 let kids=[];
 switch(d.layout){
  case 'text':case 'reply':kids=main();break;
  case 'portrait':kids=[pairing(false,false,true)];break;
  case 'mirrored':case 'micromark':kids=[pairing(true)];break;
  case 'vertical-rule':kids=[pairing(false,true)];break;
  case 'centered':case 'seal':kids=[logo(),...main()];break;
  case 'banner-led':kids=[f('banner','Campaign banner'),cols('Identity & details',[logo()],main(['banner']))];break;
  case 'masthead':kids=[mast(),rule(d),...main([],true)];break;
  case 'byline':kids=[identity(),...body(),rule(d),cols('Brand footer',[logo()],[brand()])];break;
  case 'split':kids=[cols('Magazine split',[logo(),identity()],[f('contact','Contact details')],[50,50]),...body(['contact'])];kids[0].children[1].style.borderLeft=d.ruleWidth;break;
  case 'footer-mark':kids=[...main(),rule(d),mast()];break;
  case 'ledger':kids=[identity(),rule(d),cols('Contact ledger',[f('contact','Contact details')],[logo()],[80,20]),...body(['contact'])];break;
  case 'letterhead':kids=[mast(),...main([],true)];break;
  case 'frame':kids=[pairing()];break;
  case 'rail':{const c=pairing();c.children[0].style={padding:18,background:d.tint,valign:'top'};c.children[1].style.padding=18;kids=[c];break;}
  case 'maison':kids=[logo(),brand(),rule(d),...main([],true)];break;
  case 'gallery':kids=[cols('Gallery heading',[logo()],[brand()]),rule(d),...main()];break;
  case 'nameplate':kids=[container('panel','Nameplate',[identity()],{padding:14,background:d.tint}),cols('Contact desk',[logo()],body())];break;
  case 'poster':kids=[identity(),rule(d),cols('Details & signing mark',body(),[logo()],[82,18])];break;
  case 'portfolio':kids=[cols('Portfolio heading',[identity()],[portrait()],[80,20]),rule(d),...body()];break;
  case 'dual':kids=[marks(),rule(d),...main()];break;
  case 'colorblock':{const c=cols('Colorblock identity',[logo(),identity()],[f('contact','Contact details')],[48,52]);c.children[0].style={padding:18,background:d.tint};kids=[c,...body(['contact'])];break;}
  case 'social-first':kids=[f('social','Social links'),cols('Identity & details',[logo()],main(['social']))];break;
  case 'offset':kids=[pairing(true),rule(d)];break;
  case 'residence':kids=[cols('Residence masthead',[logo()],[brand()]),rule(d),container('panel','Introduction',main([],true),{padding:12,background:d.tint})];break;
  case 'invitation':kids=[rule(d),logo(),...main(),rule(d)];break;
  case 'credits':kids=[brand(),rule({...d,ruleWidth:3}),cols('Credits',[logo()],main([],true))];break;
  case 'property':kids=[cols('Property advisor',[portrait()],[identity(),logo(),...body(['banner'])]),f('banner','Property banner')];break;
  case 'guest':kids=[cols('Guest relations masthead',[logo()],[brand()]),...main([],true)];break;
  case 'partners':kids=[marks(),rule(d),cols('Partnership desk',[identity()],[f('contact','Contact details')],[50,50]),...body(['contact'])];break;
  case 'inline':kids=[identity(),f('contact','Contact details')];break;
  case 'clean':kids=[cols('Signature heading',[logo()],[identity()]),...body()];break;
  default:kids=[pairing()];
 }
 const root=section(TEMPLATES.find(t=>t.id===p.templateId)?.name||'Signature layout',kids,{gap:d.sectionGap});
 // Global spacing and colors must continue to inherit after applying a template.
 delete root.style.gap;
 if(d.border){root.style.border=d.border;root.style.radius=d.radius;}
 return root;
}
export function fromDesign(input){
 const p=normalizeProject(input.project||input),doc=freshDocument(true);
 doc.name=p.name;doc.variant=p.variant;doc.identity=clone(p.identity);doc.design=clone(p.design);doc.publishedAssets=clone(p.publishedAssets||{});keepData(doc,p);doc.children=[compose(p)];return validate(doc);
}
/** Upgrade only the in-memory/local copy; old storage and remote records stay intact. */
export function upgrade(input){
 const raw=input?.project||input;
 if(raw?.schemaVersion!==3)return fromDesign(raw);
 const doc=validate(raw);
 if(!doc.designData){const p=freshProject();p.identity=clone(doc.identity);p.design=clone(doc.design);keepData(doc,p);}
 // Older preserved template nodes become selectable template elements automatically.
 let convertedPrimary=false;
 const replace=nodes=>nodes.flatMap(n=>{
  if(n.type==='template'){if(convertedPrimary)return [n];convertedPrimary=true;const p=n.props.project;keepData(doc,p);doc.identity=clone(p.identity);doc.design={...clone(p.design),scale:doc.design.scale};const root=compose(p);root.visibility=n.visibility;return [root];}
  n.children=replace(n.children||[]);return [n];
 });
 doc.children=replace(doc.children);return validate(doc);
}
export function normalize(input){return input?.schemaVersion===3&&input.designData?validate(input):upgrade(input);}
export function newSignature(){return fromDesign(freshProject());}
/** Preserve added modules when changing the template's layout. */
export function changeTemplate(doc,template,keepBrand=false){
 let p=applyDesign(designProject(doc),template,keepBrand);p.variant=doc.variant;
 const out=clone(doc),extras=[];
 const gather=nodes=>{for(const n of nodes){if(!n.props.managed){extras.push(clone(n));}else gather(n.children||[]);}};
 gather(doc.children);out.design=clone(p.design);keepData(out,p);out.children=[compose(p),...extras];return validate(out);
}
export function normalizeLocalLibrary(raw){
 return {active:raw?.active||null,projects:(Array.isArray(raw?.projects)?raw.projects:[]).flatMap(r=>{try{return [{...r,doc:upgrade(r.doc||r.project)}];}catch{return [];}})};
}
/** Non-destructive, once-per-source import of both browser libraries. */
export function migrateStorage(storage){
 const read=(key,f)=>{try{return JSON.parse(storage.getItem(key)||'null')||f;}catch{return f;}};
 const existing=read(STORE,null);if(existing)return normalizeLocalLibrary(existing);
 const result={active:null,projects:[]},seen=new Set();
 for(const [key,kind] of [['signature-studio.design.v2','design'],['signature-studio.blocks.v3','blocks']]){
  const old=read(key,{});for(const row of old.projects||[]){try{
   const doc=upgrade(row.doc||row.project);const id=uid();const meta=row.meta||{id:row.cloudId,revision:row.cloudRevision,owner:row.cloudOwner};
   const token=kind+':'+row.id;if(seen.has(token))continue;seen.add(token);
   result.projects.push({id,doc,meta,updatedAt:row.updatedAt||new Date().toISOString(),migratedFrom:token});
   if(row.id===old.active)result.active=id;
  }catch{/* A bad legacy record must not prevent the other signatures opening. */}}
 }
 if(!result.projects.length){const old=read('signatureStudioV1.1',null)||read('signatureStudioV1',null);if(old){try{const id=uid();result.projects=[{id,doc:fromDesign(old),meta:{},updatedAt:new Date().toISOString()}];result.active=id;}catch{}}}
 if(!result.projects.length){const id=uid();result.projects=[{id,doc:newSignature(),meta:{},updatedAt:new Date().toISOString()}];result.active=id;}
 if(!result.active)result.active=result.projects[0].id;
 storage.setItem(STORE,JSON.stringify(result));return result;
}
export function connectedParts(doc){const parts=[];walk(doc.children,n=>{if(n.type==='fragment')parts.push(n.props.part);});return parts;}
