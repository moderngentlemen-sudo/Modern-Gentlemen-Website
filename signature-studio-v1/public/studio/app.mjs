/** Shared workspace controller. There is only one document, history, save and export path. */
import {TEMPLATES,CATEGORIES,PALETTES,FONTS,NETWORKS,freshProject,applyTemplate as applyDesign} from '../design/catalog.mjs';
import {esc,renderSignature,normalizeProject} from '../design/engine.mjs';
import {readImage} from '../design/media.mjs';
import {block,clone,find,locationOf,walk,insert,uid} from '../blocks/model.mjs';
import {STORE,migrateStorage,normalize,newSignature,designProject,changeTemplate,fromDesign} from './model.mjs';
import {render,prepare,checks} from './render.mjs';
import {globalControls,inspect} from './controls.mjs';
const $=id=>document.getElementById(id);
const read=(key,f)=>{try{return JSON.parse(localStorage.getItem(key)||'null')||f;}catch{return f;}};
const keep=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
let migrationIssue='';try{migrateStorage(localStorage);}catch{migrationIssue='Browser storage is full. Older signatures are untouched. Export a backup before clearing storage.';}
let api,activePanel='templates',stylePanel='type',contentPanel='content',query='',filter='All',keepBrand=true,pendingAsset=null;
let favorites=read('signature-studio.favorites.v2',[]),styles=read('signature-studio.styles.v2',[]);
if(!Array.isArray(favorites))favorites=[];if(!Array.isArray(styles))styles=[];
const titles={templates:['A place to begin.','Apply a template to this signature. All its elements stay editable.'],blocks:['Build on your design.','Drag a block onto the canvas, or click + to add it.'],content:['Your introduction.','One profile. Connected everywhere in this signature.'],style:['Set the tone.','Whole-signature styling. Individual elements can override it.'],images:['An image, considered.','Brand artwork shared by the template and canvas.'],social:['Stay connected.','Your channels, linked to the social elements on the canvas.'],visibility:['Choose what appears.','Control profile fields, artwork, sections, and per-block Full/Reply visibility.'],layers:['Everything in its place.','Select, move and organize every element in your signature.']};
function get(doc,path){const [root,...rest]=path.split('.');return rest.reduce((v,k)=>v?.[k],['design','identity'].includes(root)?doc[root]:doc.designData?.[root]);}
function set(obj,path,value){const keys=path.split('.');if(keys.some(k=>['__proto__','constructor','prototype'].includes(k)))throw new Error('Invalid field.');for(const k of keys.slice(0,-1)){if(!obj[k]||typeof obj[k]!=='object')obj[k]={};obj=obj[k];}obj[keys.at(-1)]=value;}
function sync(doc){
 if(!api)return;
 document.querySelectorAll('[data-u-path]').forEach(el=>{if(document.activeElement===el)return;const v=get(doc,el.dataset.uPath);if(el.type==='checkbox')el.checked=!!v;else el.value=el.type==='url'&&String(v||'').startsWith('data:')?'':v??'';});
 document.querySelectorAll('[data-output]').forEach(el=>{el.value=get(doc,el.dataset.output);});
 const selectedTemplate=doc.designData?.templateId;document.querySelectorAll('.u-template').forEach(el=>el.classList.toggle('selected',el.dataset.template===selectedTemplate));
 const n=find(doc,api.getSelection());const crumbs=[];let current=n;while(current){crumbs.unshift(current);current=locationOf(doc,current.id)?.parent;}
 $('breadcrumbs').innerHTML='<button data-u-action="deselect">Signature</button>'+crumbs.map(n=>'<span>›</span><button data-select="'+n.id+'">'+esc(n.label)+'</button>').join('');
}
function listTemplates(){return [...TEMPLATES,...styles.filter(t=>t?.id&&t.design).map(t=>({...t,category:'My styles'}))];}
function templateCards(){
 const doc=api.getDocument();let list=listTemplates();
 if(filter==='Favorites')list=list.filter(t=>favorites.includes(t.id));else if(filter!=='All')list=list.filter(t=>t.category===filter);
 list=list.filter(t=>(t.name+' '+t.category+' '+(t.description||'')).toLowerCase().includes(query.toLowerCase()));
 const out=list.map(t=>{
  const p=applyDesign(designProject(doc),t,false);p.design.scale=100;
  // Thumbnail URLs are display-only; exported artwork uses the same processing pipeline as the canvas.
  const preview=renderSignature(p,{origin:location.origin});
  return `<div class="u-template${doc.designData?.templateId===t.id?' selected':''}" data-template="${esc(t.id)}"><button class="u-template-apply" data-u-action="template" data-id="${esc(t.id)}" aria-label="Apply ${esc(t.name)}"><div class="u-thumb" aria-hidden="true" inert><div class="u-thumb-inner">${preview}</div></div><span class="u-template-info"><strong>${esc(t.name)}</strong><small>${esc(t.category)}</small></span></button><button class="u-star${favorites.includes(t.id)?' on':''}" data-u-action="favorite" data-id="${esc(t.id)}" aria-label="Favorite ${esc(t.name)}" aria-pressed="${favorites.includes(t.id)}">${favorites.includes(t.id)?'★':'☆'}</button></div>`;
 }).join('');
 $('unifiedControls').innerHTML=`<div class="studio-template-controls"><input id="uSearch" type="search" placeholder="Search the collection…" value="${esc(query)}" aria-label="Search templates"><select id="uCategory" aria-label="Template category">${['All',...CATEGORIES,'Favorites','My styles'].map(c=>`<option${c===filter?' selected':''}>${esc(c)}</option>`).join('')}</select><label><input id="uKeepBrand" type="checkbox" ${keepBrand?'checked':''}>Keep my colors & fonts</label></div><span class="u-count">${list.length} DESIGNS · EDITABLE ON YOUR CANVAS</span><div id="uTemplateList">${out||'<p class="hint">No matching styles. Try another category.</p>'}</div>`;
}
function showPanel(panel){
 activePanel=panel;$('toolTitle').textContent=titles[panel][0];$('toolDescription').textContent=titles[panel][1];
 $('libraryView').hidden=panel!=='blocks';$('structureView').hidden=panel!=='layers';$('unifiedControls').hidden=['blocks','layers'].includes(panel);
 document.querySelectorAll('.studio-rail [data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
 if(panel==='templates')templateCards();
 else if(panel==='style')$('unifiedControls').innerHTML=`<div class="style-tabs">${[['type','Type'],['layout','Layout'],['color','Color']].map(([id,name])=>`<button data-u-action="style-tab" data-panel="${id}" class="${id===stylePanel?'active':''}">${name}</button>`).join('')}</div>`+globalControls(api.getDocument(),stylePanel);
 else if(panel==='content')$('unifiedControls').innerHTML=`<div class="style-tabs">${[['content','Profile'],['blocks','Links & notes']].map(([id,name])=>`<button data-u-action="content-tab" data-panel="${id}" class="${id===contentPanel?'active':''}">${name}</button>`).join('')}</div>`+globalControls(api.getDocument(),contentPanel);
 else if(panel==='visibility')$('unifiedControls').innerHTML=globalControls(api.getDocument(),'visibility');
 else if(!['blocks','layers'].includes(panel))$('unifiedControls').innerHTML=globalControls(api.getDocument(),panel);
 if(panel==='layers')api.renderTree();
}
function ensurePart(d,part){let exists=false;walk(d.children,n=>{if(n.type==='fragment'&&n.props.part===part)exists=true;});if(!exists)d.children.push(block('fragment',{part,managed:false},{},[],part[0].toUpperCase()+part.slice(1)));}
function update(path,value){
 if(path==='design.layout'){
  const template=TEMPLATES.find(t=>t.layout===value);if(template){api.commit(changeTemplate(api.getDocument(),template,keepBrand));api.refresh();sync(api.getDocument());}return;
 }
 api.mutate(d=>{
  const old=clone(d.design),[root,...rest]=path.split('.');
  if(['design','identity'].includes(root))set(d[root],rest.join('.'),value);else set(d.designData,root+'.'+rest.join('.'),value);
  if(root==='design'){
   walk(d.children,n=>{if(!n.props.managed)return;if(path==='design.tint'&&n.style.background===old.tint)n.style.background=value;if(path==='design.border'&&n===d.children[0])n.style.border=value;if(path==='design.radius'&&n===d.children[0])n.style.radius=value;if(n.type==='divider'){if(path==='design.ruleWidth')n.props.thickness=value;if(path==='design.ruleLength')n.props.length=value;if(path==='design.borderStyle')n.props.line=value;}});
  }
  if(value&&root==='content'){const key=rest[0],part=key.startsWith('cta')?'cta':key.startsWith('announcement')?'announcement':key;ensurePart(d,part);}
  if(value&&root==='assets'&&rest[1]==='src')ensurePart(d,rest[0]);
  if(value&&path==='identity.tagline')ensurePart(d,'tagline');
 },'global:'+path,false);
 sync(api.getDocument());
}
function input(e){
 const el=e.target,path=el.dataset.uPath;if(el.dataset.nodeProjectPath){api.mutate(d=>{const n=find(d,api.getSelection());if(n?.type==='template')set(n.props.project,el.dataset.nodeProjectPath,el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value);},'legacy:'+el.dataset.nodeProjectPath,false);return true;}if(!path)return false;
 if(el.dataset.color&& !/^#[\da-f]{6}$/i.test(el.value))return true;
 const v=el.type==='checkbox'?el.checked:['number','range'].includes(el.type)?Number(el.value):el.value;
 update(path,v);return true;
}
function showStyleSave(){api.modal('Save reusable style','<p class="modal-note">Save your current layout and global typography, palette and spacing. Contact details and artwork are not copied into the style.</p><div class="field"><label for="uStyleName">Style name</label><input id="uStyleName" value="My signature style"></div><button class="primary" data-u-action="save-style-confirm">Save style</button>');}
function applyChosen(id){
 const t=listTemplates().find(t=>t.id===id);if(!t)return;
 const next=changeTemplate(api.getDocument(),t,keepBrand);api.replaceSelection(next,null);api.close();api.toast(t.name+' applied. Added blocks retained; Undo restores your previous layout.');sync(next);
}
function separate(){
 const doc=api.getDocument(),n=find(doc,api.getSelection());if(n?.type!=='fragment')return;
 let items=[];
 if(n.props.part==='contact')items=['phone','mobile','email','website','address','availability'].filter(k=>doc.identity[k]&&doc.designData.visible[k]!==false).map(k=>block('contact',{bind:k,kind:k},{} ,[],k[0].toUpperCase()+k.slice(1)));
 else items=['kicker','name','title','pronouns','company','department'].filter(k=>doc.identity[k]&&doc.designData.visible[k]!==false&&!(n.props.part==='identity-no-company'&&k==='company')).map(k=>block(k==='name'?'heading':'text',{bind:k},k==='name'?{}:{size:doc.design.roleSize},[],k[0].toUpperCase()+k.slice(1)));
 api.mutate(d=>{const l=locationOf(d,n.id),g=block('group',{}, {gap:doc.design.contactGap},items,n.label);g.visibility=n.visibility;l.nodes.splice(l.index,1,g);});api.toast('Fields separated into an editable group. Undo restores the connected group.');
}
function palette(index){const p=PALETTES[index];if(!p)return;api.mutate(d=>{const before=d.design.tint;Object.assign(d.design,{primary:p[1],secondary:p[2],accent:p[3],link:p[3],tint:p[4],background:p[5],transparent:false,ctaColor:p[3]});walk(d.children,n=>{if(n.props.managed&&n.style.background===before)n.style.background=p[4];});});sync(api.getDocument());}
function brandExport(){const d=api.getDocument().design;const keys=['primary','secondary','accent','link','tint','background','ctaColor','ctaText','nameFont','bodyFont'];api.download('signature-brand-kit.json',JSON.stringify({kind:'signature-studio-brand',version:1,design:Object.fromEntries(keys.map(k=>[k,d[k]]))},null,2),'application/json');}
const handlers={
 nav:b=>showPanel(b.dataset.panel),'content-tab':b=>{contentPanel=b.dataset.panel;showPanel('content');},'style-tab':b=>{stylePanel=b.dataset.panel;showPanel('style');},template:b=>applyChosen(b.dataset.id),gallery:()=>showPanel('templates'),
 favorite:b=>{const id=b.dataset.id;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];keep('signature-studio.favorites.v2',favorites);templateCards();},
 'save-style':showStyleSave,'save-template':showStyleSave,
 'save-style-confirm':()=>{const d=api.getDocument();styles.push({id:'style-'+uid(),name:$('uStyleName').value.slice(0,80)||'My style',category:'My styles',layout:d.design.layout,design:clone(d.design)});if(!keep('signature-studio.styles.v2',styles))throw new Error('Browser storage is full. Export a project backup instead.');api.close();filter='My styles';query='';showPanel('templates');api.toast('Style saved in this browser.');},
 'export-brand':brandExport,'import-brand':()=>{$('studioBrandInput').value='';$('studioBrandInput').click();},
 density:b=>{const v={compact:[6,12,6,2],balanced:[12,24,12,5],airy:[24,36,18,8]}[b.dataset.value];api.mutate(d=>{[d.design.padding,d.design.gap,d.design.sectionGap,d.design.contactGap]=v;});sync(api.getDocument());},
 palette:b=>palette(+b.dataset.index),autofit:()=>api.fit(),'mobile-fit':async()=>{update('design.targetWidth',360);await api.fit();},
 'upload-image':b=>{pendingAsset={slot:b.dataset.slot};$('studioImageInput').value='';$('studioImageInput').click();},
 'remove-image':b=>update('assets.'+b.dataset.slot+'.src',''),
 'reset-crop':b=>{api.mutate(d=>Object.assign(d.designData.assets[b.dataset.slot],{zoom:100,x:0,y:0,fit:'contain'}));sync(api.getDocument());},
 'add-social':()=>{const select=document.querySelector('#networkSelect'),id=select?.value||'custom';api.mutate(d=>{if(d.designData.socials.length>=20)throw new Error('Use at most 20 social channels.');d.designData.socials.push({id,label:NETWORKS.find(x=>x[0]===id)?.[1]||'Link',url:'',enabled:true,customIcon:''});ensurePart(d,'social');});showPanel(activePanel);},
 'move-social':b=>{api.mutate(d=>{const a=d.designData.socials,i=+b.dataset.index,j=i+(+b.dataset.dir);if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];});if(activePanel==='social')showPanel(activePanel);},
 'delete-social':b=>{api.mutate(d=>d.designData.socials.splice(+b.dataset.index,1));if(activePanel==='social')showPanel(activePanel);},
 'upload-social':b=>{pendingAsset={social:+b.dataset.index};$('studioImageInput').value='';$('studioImageInput').click();},
 'clear-social':b=>update('socials.'+b.dataset.index+'.customIcon',''),
 'add-extra':()=>{api.mutate(d=>{if(d.designData.extras.length>=12)throw new Error('Use at most 12 custom fields.');d.designData.extras.push({label:'',value:'',url:'',enabled:true});ensurePart(d,'custom');});if(activePanel==='content')showPanel(activePanel);},
 'remove-extra':b=>{api.mutate(d=>d.designData.extras.splice(+b.dataset.index,1));if(activePanel==='content')showPanel(activePanel);},
 'move-section':b=>{api.mutate(d=>{const a=d.designData.sections,i=+b.dataset.index,j=i+(+b.dataset.dir);if(j>=0&&j<a.length)[a[i],a[j]]=[a[j],a[i]];});},
 'visibility-preset':b=>{const group=b.dataset.group,on=b.dataset.value==='show';api.mutate(d=>{if(group==='identity')for(const k of ['name','title','company','kicker','pronouns','department'])d.designData.visible[k]=on;if(group==='contact')for(const k of ['email','phone','mobile','website','address','availability'])d.designData.visible[k]=on;if(group==='artwork')Object.assign(d.design,{showLogo:on,showPortrait:on,showPartner:on});if(group==='sections')for(const s of d.designData.sections)s.enabled=on;});showPanel('visibility');},
 'ungroup-fragment':separate,deselect:()=>{api.select(null);api.refresh();},
};
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-u-action]');if(b){e.preventDefault();e.stopImmediatePropagation();try{await handlers[b.dataset.uAction]?.(b);}catch(err){api.toast(err.message,true);}return;}
 const legacy=e.target.closest('[data-action]');if(legacy&&['templates','template','import-designer','recompose'].includes(legacy.dataset.action)){e.preventDefault();e.stopImmediatePropagation();showPanel('templates');}
},true);
document.addEventListener('input',e=>{if(e.target.id==='uSearch'){query=e.target.value;const selection=e.target.selectionStart;templateCards();$('uSearch').focus();$('uSearch').setSelectionRange(selection,selection);return;}if(e.target.tagName!=='SELECT'&&e.target.type!=='checkbox')input(e);},true);
document.addEventListener('change',e=>{if(e.target.id==='uCategory'){filter=e.target.value;templateCards();return;}if(e.target.id==='uKeepBrand'){keepBrand=e.target.checked;return;}if(e.target.tagName==='SELECT'||e.target.type==='checkbox')input(e);},true);
document.addEventListener('dblclick',e=>{
 const el=e.target.closest('#canvas [data-u-bind]');if(!el||!api)return;e.preventDefault();e.stopImmediatePropagation();const key=el.dataset.uBind,original=api.getDocument().identity[key]||'';el.textContent=original;el.contentEditable='true';el.focus();let cancel=false;
 el.addEventListener('blur',()=>{if(!cancel)update('identity.'+key,el.innerText.slice(0,4000));api.paint();},{once:true});
 el.addEventListener('paste',ev=>{ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));});
 el.addEventListener('keydown',ev=>{if(ev.key==='Escape'){cancel=true;ev.stopPropagation();el.blur();}if(ev.key==='Enter'&&(ev.ctrlKey||ev.metaKey)){ev.preventDefault();el.blur();}});
},true);
$('studioImageInput').onchange=async e=>{const file=e.target.files[0],target=pendingAsset;if(!file||!target)return;const start=api.local().active;try{const src=await readImage(file);if(api.local().active!==start)throw new Error('Signature changed during upload. Select the artwork again.');if(target.slot)update('assets.'+target.slot+'.src',src);else update('socials.'+target.social+'.customIcon',src);api.renderInspector();if(activePanel==='images'||activePanel==='social')showPanel(activePanel);api.toast('Artwork updated in this signature.');}catch(err){api.toast(err.message,true);}};
$('studioBrandInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('This brand file is too large.');const data=JSON.parse(await file.text()),d=data.design||data.brand||data;api.mutate(doc=>{for(const key of ['primary','secondary','link','accent','tint','background','ctaColor','ctaText','nameFont','bodyFont'])if(d[key]!==undefined)doc.design[key]=d[key];});sync(api.getDocument());api.toast('Brand kit applied.');}catch(err){api.toast(err.message,true);}};
$('viewport').onchange=()=>{$('stage').classList.toggle('mobile-viewport',$('viewport').value==='mobile');api.paint();};
window.signatureWorkspace={store:STORE,normalize,fresh:newSignature,render,prepare,checks,inspect,makeBlock:(kind)=>['identity','contacts','social'].includes(kind)?block('fragment',{part:kind==='contacts'?'contact':kind,managed:false},{},[],({identity:'Identity',contacts:'Contact details',social:'Social links'})[kind]):null,onPaint:sync,onInspector:doc=>sync(doc),start:instance=>{api=instance;window.signatureStudio=instance;showPanel('templates');sync(api.getDocument());if(migrationIssue)api.toast(migrationIssue,true);}};
await import('../blocks/app.mjs?v=1.5.1');
