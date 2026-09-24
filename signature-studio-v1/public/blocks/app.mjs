import {LIBRARY,CONTAINERS,clone,uid,block,makeBlock,freshDocument,normalize as baseNormalize,walk,find,locationOf,newIds,transact,insert,move,remove,duplicate,ungroup,beside,preservedProject,recompose} from './model.mjs';
import {renderBlocks,checks,valueOf} from './render.mjs';
import {prepareBlocks,readImage} from './media.mjs';
import {inspector} from './inspector.mjs';
import {TEMPLATES,PALETTES,freshProject,applyTemplate,NETWORKS} from '../design/catalog.mjs';
import {esc,safeUrl} from '../design/engine.mjs';
import {signaturePNG} from '../design/media.mjs';
import {Cloud} from '../design/cloud.mjs';
import {snapValue,designDelta,resizeArtwork,resizeColumnRatios,resizePadding} from './alignment.mjs';
import {CanvasTools,hitBlock} from './canvas-tools.mjs';
const U=window.signatureWorkspace||null;const normalize=U?.normalize||baseNormalize;
const $=id=>document.getElementById(id),STORE=U?.store||'signature-studio.blocks.v3',SAVED='signature-studio.blocks.saved.v3';
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k)||'null')||f;}catch{return f;}};
let library=read(STORE,{active:null,projects:[]});if(!Array.isArray(library.projects))library={active:null,projects:[]};
let saved=read(SAVED,[]);if(!Array.isArray(saved))saved=[];
let activeId=library.active||uid(),row=library.projects.find(r=>r.id===activeId),doc,meta=row?.meta||{};
try{doc=row?normalize(row.doc):(U?.fresh?.()||freshDocument());}catch{doc=U?.fresh?.()||freshDocument();meta={};activeId=uid();}
const handoff=read('signature-studio.blocks.handoff',null);if(handoff){try{doc=U?normalize(handoff.project):handoff.project?.schemaVersion===3?normalize(handoff.project):preservedProject(handoff.project);activeId=uid();meta=handoff.project?.schemaVersion===3?handoff.meta||{}:{};localStorage.removeItem('signature-studio.blocks.handoff');}catch{}}
let selected=null,mode='block',category='Core',leftTab='library',viewOnly=false,zoom=1,history=[],future=[],lastGroup='',lastAt=0,toastTimer,saveTimer,renderVersion=0,prepared={images:{},keys:{},errors:[]},ready=Promise.resolve(),pendingImage=null,pendingConfirm=null,pendingRows=[],drag=null,resizing=null,lastClick=0,pointerSelection=false;
const config=window.SIGNATURE_STUDIO_CONFIG||{},cloud=new Cloud(config);
function toast(text,error=false){$('toast').textContent=text;$('toast').className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',error?7000:3500);}
function saveLocal(){clearTimeout(saveTimer);const value={id:activeId,doc:clone(doc),meta:clone(meta),updatedAt:new Date().toISOString()};const at=library.projects.findIndex(r=>r.id===activeId);if(at<0)library.projects.unshift(value);else library.projects[at]=value;library.active=activeId;try{localStorage.setItem(STORE,JSON.stringify(library));$('saveState').textContent='Saved in this browser';}catch{$('saveState').textContent='Storage full · export a backup';}}
function scheduleSave(){clearTimeout(saveTimer);$('saveState').textContent='Saving…';saveTimer=setTimeout(saveLocal,300);}
function commit(next,group='',refresh=true){try{const checked=normalize(next),now=Date.now();if(JSON.stringify(checked)===JSON.stringify(doc))return;if(!group||lastGroup!==group||now-lastAt>700){history.push(JSON.stringify(doc));if(history.length>45)history.shift();}lastGroup=group;lastAt=now;future=[];doc=checked;if(selected&&!find(doc,selected))selected=null;render();if(refresh)renderInspector();renderTree();scheduleSave();}catch(e){toast(e.message,true);}}
function mutate(fn,group='',refresh=true){try{commit(transact(doc,fn),group,refresh);}catch(e){toast(e.message,true);}}
function restore(direction){const from=direction==='undo'?history:future,to=direction==='undo'?future:history;if(!from.length)return;to.push(JSON.stringify(doc));doc=normalize(JSON.parse(from.pop()));lastGroup='';if(selected&&!find(doc,selected))selected=null;render();renderInspector();renderTree();scheduleSave();}
function select(id){if(viewOnly&&id)return;selected=id&&find(doc,id)?id:null;if(!selected&&$('canvas').contains(document.activeElement)&&!document.activeElement.isContentEditable)document.activeElement.blur();mode='block';renderInspector();renderTree();markSelection();}
function measure(html){const root=$('measure');root.innerHTML=html;const t=root.firstElementChild;return {width:Math.max(t?.getBoundingClientRect().width||0,t?.scrollWidth||0),height:t?.getBoundingClientRect().height||0};}
function html(edit=false){return (U?.render||renderBlocks)(doc,{edit,images:prepared.images,origin:location.origin});}
function paint(){
 if(document.activeElement?.isContentEditable&&$('canvas').contains(document.activeElement))return;
 $('canvas').innerHTML=html(!viewOnly);$('scaleWrap').style.transform=`scale(${zoom})`;const size=measure(html());$('scaleWrap').style.marginRight=(size.width*(zoom-1))+'px';$('scaleWrap').style.marginBottom=(size.height*(zoom-1))+'px';
 $('dimensions').textContent=Math.ceil(size.width)+' × '+Math.ceil(size.height)+' px';$('fitStatus').textContent=size.width>doc.design.targetWidth+1?'Wider than target · fit or simplify':'Within the '+doc.design.targetWidth+' px target';
 $('projectName').value=doc.name;$('target').value=doc.design.targetWidth;$('undo').disabled=!history.length;$('redo').disabled=!future.length;
 $('full').classList.toggle('active',doc.variant==='full');$('reply').classList.toggle('active',doc.variant==='reply');$('previewButton').textContent=viewOnly?'Back to editing':'Preview only';$('canvasHint').textContent=viewOnly?'Export preview · editing outlines removed':'Click to select · double-click text to edit';
 const info=(U?.checks||checks)(doc,html(),size.width,prepared.errors);$('checks').innerHTML=info.items.map(i=>`<p class="${i.level}">${esc(i.text)}</p>`).join('');$('blockCount').textContent=info.count+' blocks';$('charCount').textContent=info.characters.toLocaleString()+' HTML chars';markSelection();U?.onPaint?.(doc,selected);
}
function render(){const version=++renderVersion;paint();ready=(U?.prepare||prepareBlocks)(clone(doc),location.origin).then(p=>{if(version!==renderVersion)return;prepared=p;paint();}).catch(e=>{if(version===renderVersion){prepared.errors=[e.message];paint();}});return ready;}
function renderInspector(){const n=find(doc,selected);$('inspector').innerHTML=(U?.inspect||inspector)(doc,n,mode);U?.onInspector?.(doc,n,mode);document.querySelectorAll('.inspector-tabs button').forEach(b=>b.classList.toggle('active',mode==='block'?b.dataset.action==='selection':b.dataset.action===mode));}
function markSelection(){
 document.querySelectorAll('#canvas [data-selected]').forEach(x=>x.removeAttribute('data-selected'));
 const el=selected?$('canvas').querySelector(`[data-bid="${selected}"]`):null,bar=$('selectionBar');
 bar.hidden=viewOnly||!el||!!drag?.started||!!resizing||$('modal').open;
 if(el&&!viewOnly){el.setAttribute('data-selected','true');if(!bar.hidden){const r=el.getBoundingClientRect(),sr=$('stage').getBoundingClientRect();
  if(r.bottom<sr.top||r.top>sr.bottom||r.right<sr.left||r.left>sr.right)bar.hidden=true;
  else{$('selectionLabel').textContent=find(doc,selected)?.label||'Block';bar.style.left=Math.max(sr.left+3,Math.min(r.left,innerWidth-340))+'px';bar.style.top=Math.max(sr.top+3,r.top-40)+'px';}
 }}
 canvasTools.update();
}
function renderLibrary(){const cats=['Core','Layout','Modules','Saved'];$('categories').innerHTML=cats.map(c=>`<button data-category="${c}" class="${category===c?'active':''}">${c}</button>`).join('');const q=$('search').value.toLowerCase();const entries=category==='Saved'?saved.map(s=>({id:s.id,name:s.name,description:'Your independent reusable composition.',icon:'◇',saved:true})):LIBRARY.filter(x=>x.category===category);
 $('blockLibrary').innerHTML=entries.filter(e=>(e.name+' '+e.description).toLowerCase().includes(q)).map(e=>`<div class="block-card"><button class="glyph grip" ${e.saved?`data-drag-saved="${e.id}"`:`data-drag-kind="${e.id}"`} aria-label="Drag ${esc(e.name)}">${e.icon}</button><div><strong>${esc(e.name)}</strong><small>${esc(e.description)}</small></div><button class="add" data-action="${e.saved?'add-saved':'add'}" data-kind="${e.id}" aria-label="Add ${esc(e.name)}">+</button></div>`).join('')||'<div class="empty">No blocks here yet.</div>';
 if(category==='Saved'&&saved.length)$('blockLibrary').innerHTML+='<div class="mini-actions"><button data-action="export-saved">Back up saved blocks</button><button data-action="import">Import</button></div>';
}
function renderTree(){let out='';walk(doc.children,(n,parent,depth)=>{const visible=n.visibility!=='hidden',tag=n.visibility==='both'?'':n.visibility==='full'?'Full':n.visibility==='reply'?'Reply':'Hidden';out+=`<div class="tree-row${n.id===selected?' active':''}" style="margin-left:${depth*10}px"><button class="grip" data-drag-id="${n.id}" aria-label="Drag ${esc(n.label)}">⠿</button><button class="tree-select" data-select="${n.id}">${esc(n.label)}</button><button data-action="toggle-visibility" data-id="${n.id}" aria-label="${visible?'Hide':'Show'} ${esc(n.label)}" title="${visible?'Hide':'Show'} ${esc(n.label)}">${visible?'◉':'○'}</button><small>${tag||n.type==='column'?'cell':''}</small></div>`;});$('structure').innerHTML=out||'<div class="empty">Your canvas is empty.<br>Add a block from the library.</div>';}
function nodeFrom(spec){if(spec.saved){const s=saved.find(s=>s.id===spec.saved);if(!s)throw new Error('Saved block not found.');return newIds(s.node);}return U?.makeBlock?.(spec.kind,doc)||makeBlock(spec.kind,doc);}
function insertionPoint(){const loc=locationOf(doc,selected);if(!loc)return {parentId:null,index:doc.children.length};if(CONTAINERS.includes(loc.node.type)&&loc.node.type!=='columns')return {parentId:loc.node.id,index:loc.node.children.length};if(loc.node.type==='columns')return {parentId:loc.node.children[0].id,index:loc.node.children[0].children.length};return {parentId:loc.parent?.id,index:loc.index+1};}
function add(spec,destination=insertionPoint()){try{const n=nodeFrom(spec),next=insert(doc,n,destination.parentId,destination.index);selected=n.id;mode='block';commit(next);toast(n.label+' added.');}catch(e){toast(e.message,true);}}
function modal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;if(!$('modal').open)$('modal').showModal();markSelection();}
function close(){$('modal').close();pendingConfirm=null;markSelection();}
function confirmAction(title,message,callback){pendingConfirm=callback;modal(title,`<p class="modal-note">${esc(message)}</p><div class="modal-actions"><button data-action="confirm" class="primary">Continue</button><button data-action="close">Cancel</button></div>`);}
function download(name,body,type){const url=URL.createObjectURL(body instanceof Blob?body:new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function newDocument(next,cloudMeta={}){if(drag)cancelDrag();if(resizing)endResize(false);lastClick=0;saveLocal();doc=normalize(next);meta=cloudMeta;activeId=uid();selected=null;history=[];future=[];lastGroup='';mode='block';prepared={images:{},keys:{},errors:[]};render();renderInspector();renderTree();saveLocal();}
function showProjects(){saveLocal();modal('Your signatures',`<p class="modal-note">Local signatures save automatically in this browser. Back up important designs. Cloud saves are available after sign-in.</p><div class="mini-actions"><button data-action="blank">New blank signature</button><button data-action="import">Import JSON</button><button data-action="cloud-projects">Browse cloud projects</button></div>${library.projects.map(r=>`<div class="project-row"><div><strong>${esc(r.doc.name)}</strong><small>${r.id===activeId?'Current · ':''}${new Date(r.updatedAt).toLocaleString()}</small></div><div><button data-action="open-local" data-id="${r.id}">Open</button><button data-action="duplicate-local" data-id="${r.id}">Copy</button><button data-action="delete-local" data-id="${r.id}">Delete</button></div></div>`).join('')}`);}
function showTemplates(){modal('Bring a design into the canvas',`<p class="modal-note">A design is inserted as a preserved template block using its original renderer. You can add, move and style blocks around it. Use “Make individually editable” only when you are ready to recompose its internal layout. Original designs are never overwritten.</p><div class="mini-actions"><button data-action="import-designer">Copy my current designer project</button></div><div class="template-list">${TEMPLATES.map(t=>`<button data-action="template" data-kind="${t.id}"><strong>${esc(t.name)}</strong><span>${esc(t.category)} · preserved composition</span></button>`).join('')}</div>`);}
function moveDialog(){const n=find(doc,selected);if(!n)return;const excluded=new Set();walk([n],b=>excluded.add(b.id));const targets=[['','Root of signature']];walk(doc.children,(b,p,depth)=>{if(CONTAINERS.includes(b.type)&&b.type!=='columns'&&!excluded.has(b.id))targets.push([b.id,'— '.repeat(depth)+b.label]);});modal('Move '+n.label,`<p class="modal-note">Choose a destination without dragging. All of this block’s contents move with it.</p><div class="field"><label for="moveTarget">Destination</label><select id="moveTarget">${targets.map(([id,l])=>`<option value="${id}">${esc(l)}</option>`).join('')}</select></div><div class="field"><label for="movePlacement">Placement</label><select id="movePlacement"><option value="end">At the end</option><option value="start">At the beginning</option></select></div><div class="modal-actions"><button data-action="move-confirm" class="primary">Move block</button><button data-action="close">Cancel</button></div>`);}
function account(){modal(cloud.user?'Cloud account':'Sign in to save across devices',cloud.user?`<p class="modal-note">Signed in as ${esc(cloud.user.email)}. Signature Studio uses your own project records and public signature artwork.</p><div class="modal-actions"><button data-action="cloud-projects">Cloud signatures</button><button data-action="signout">Sign out</button></div>`:`<p class="modal-note">Local editing works without an account. Sign in to save projects and publish image URLs for email signatures.</p><form id="authForm"><div class="field"><label for="authEmail">Email</label><input id="authEmail" type="email" autocomplete="email" required></div><div class="field"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" minlength="8" required></div><div class="modal-actions"><button type="submit" class="primary">Sign in</button><button type="button" data-action="signup">Create account</button></div></form>`);}
let cloudBusy=false;
async function cloudSave(asNew=false){if(!cloud.user){account();return;}if(cloudBusy)return;cloudBusy=true;try{saveLocal();const version=JSON.stringify(doc),targetId=activeId,result=await cloud.save(clone(doc),asNew||meta.owner!==cloud.user.id?null:meta.id,asNew?null:meta.revision);if(activeId===targetId){meta={id:result.id,revision:result.updated_at,owner:cloud.user.id};saveLocal();toast(version===JSON.stringify(doc)?'Saved to your cloud account.':'Saved the earlier version; your latest local edits are still here.');}}catch(e){toast(e.message,true);}finally{cloudBusy=false;}}
async function cloudProjects(){if(!cloud.user){account();return;}try{pendingRows=await cloud.list();modal('Cloud signatures',`<p class="modal-note">Templates and block designs open together in this workspace. Older records are upgraded locally; the cloud copy changes only when you save. Deleting a project does not remove artwork used in sent emails.</p>${pendingRows.map(r=>`<div class="project-row"><div><strong>${esc(r.name)}</strong><small>${'Signature'} · ${new Date(r.updated_at).toLocaleString()}</small></div><div><button data-action="open-cloud" data-id="${r.id}">Open</button><button data-action="duplicate-cloud" data-id="${r.id}">Copy</button><button data-action="delete-cloud" data-id="${r.id}">Delete</button></div></div>`).join('')||'<div class="empty">No cloud projects yet.</div>'}<div class="modal-actions"><button data-action="cloud-save">Save current</button><button data-action="cloud-save-new">Save as new</button></div>`);}catch(e){toast(e.message,true);}}
async function publish(){if(!cloud.user){account();return false;}await ready;if(prepared.errors.length)throw new Error(prepared.errors[0]);const batch=clone(prepared),start=activeId;let count=0;for(const [id,src]of Object.entries(batch.images))if(src.startsWith('data:')&&batch.keys[id]){const key=batch.keys[id];const url=await cloud.upload(src,key);if(start!==activeId)throw new Error('Project changed during upload. Return to it and publish again.');doc.publishedAssets[key]=url;count++;}await render();saveLocal();toast(count?`${count} image(s) published. Anyone with these URLs can load them.`:'Images already use hosted URLs.');return true;}
function variantHtml(variant){
 const version=clone(doc);version.variant=variant;
 return (U?.render||renderBlocks)(version,{edit:false,images:prepared.images,origin:location.origin});
}
function variantName(variant){return (doc.name||'Signature').replace(/\s+[—-]\s+(Full|Reply)$/i,'')+' — '+(variant==='reply'?'Reply':'Full');}
async function copyMarkup(markup,label='Signature'){
 await ready;if(prepared.errors.length)throw new Error(prepared.errors[0]);
 if(/src="data:/.test(markup))throw new Error('Publish local artwork before copying to Gmail, or use portable HTML export.');
 const plain=document.createElement('div');plain.innerHTML=markup;
 try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([markup],{type:'text/html'}),'text/plain':new Blob([plain.textContent],{type:'text/plain'})})]);toast(label+' copied. Paste it in Gmail’s signature editor.');}
 catch{plain.style.position='fixed';plain.style.left='-9000px';document.body.append(plain);const range=document.createRange();range.selectNodeContents(plain);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);const ok=document.execCommand('copy');selection.removeAllRanges();plain.remove();if(!ok)throw new Error('Clipboard permission was denied. Download HTML, open it in your browser, then select and copy the rendered signature.');toast(label+' copied.');}
}
async function copyVariant(variant){return copyMarkup(variantHtml(variant),variant==='reply'?'Reply signature':'Full signature');}
async function gmailDualSetup(){
 await ready;const full=variantHtml('full'),reply=variantHtml('reply'),local=/src="data:/.test(full)||/src="data:/.test(reply);
 const same=full===reply,fullSize=measure(full),replySize=measure(reply),fullName=variantName('full'),replyName=variantName('reply');
 modal('Set up Full + Reply in Gmail',`<p class="modal-note">One Signature Studio project, two Gmail signatures. Elements marked Full only or Reply only are applied automatically when these variants are generated.</p>
 ${same?'<div class="warning-box">Your Full and Reply variants currently render the same. Use Visibility to mark larger elements “Full only” before installing if you want a more compact reply signature.</div>':''}
 ${local?'<div class="warning-box">Some artwork is still local. Publish images before copying either signature so Gmail recipients can load them.</div>':''}
 <div class="steps">
  <div><b>1</b><span>In Gmail Settings → General → Signature, create <strong>${esc(fullName)}</strong>. Click “Copy Full” here and paste it there.</span></div>
  <div><b>2</b><span>Create <strong>${esc(replyName)}</strong>. Click “Copy Reply” and paste that version.</span></div>
  <div><b>3</b><span>Under Signature defaults, set <strong>FOR NEW EMAILS USE</strong> to ${esc(fullName)} and <strong>ON REPLY/FORWARD USE</strong> to ${esc(replyName)}.</span></div>
  <div><b>4</b><span>Save changes, then send yourself a new message and a reply to verify both versions.</span></div>
 </div>
 <div class="modal-actions">${local?'<button data-action="publish-dual">Publish images</button>':''}<button data-action="copy-full" class="primary">Copy Full</button><button data-action="copy-reply">Copy Reply</button><a href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a></div>
 <div class="two"><div><p class="hint"><strong>${esc(fullName)}</strong> · ${Math.ceil(fullSize.width)} × ${Math.ceil(fullSize.height)} px</p><div class="export-preview">${full}</div></div><div><p class="hint"><strong>${esc(replyName)}</strong> · ${Math.ceil(replySize.width)} × ${Math.ceil(replySize.height)} px</p><div class="export-preview">${reply}</div></div></div>
 <p class="hint">Gmail’s public API can update the signature attached to a send-as address, but it does not expose the web UI’s two named-signature default selectors. Signature Studio therefore prepares both variants and takes you directly to the one Gmail screen where those final defaults can be assigned.</p>`);
}
async function exportDialog(){await ready;modal('Export & install',`<p class="modal-note">Text and links remain live in HTML. PNG is a flat visual. Selection outlines and drag controls are never exported.</p><div class="export-preview">${html()}</div>${/src="data:/.test(html())?'<div class="warning-box">Some artwork is local. Publish it before using Gmail. Published signature images are public, so recipients can load them.</div>':''}${prepared.errors.length?'<div class="warning-box">'+prepared.errors.map(esc).join('<br>')+'</div>':''}<div class="steps"><div><b>1</b><span>Prepare your artwork. ${/src="data:/.test(html())?'Publish images below.':'Hosted images are ready.'}</span></div><div><b>2</b><span>For the simplest Gmail setup, generate both Full and Reply signatures from this one project.</span></div><div><b>3</b><span>Or copy/download only the currently previewed variant.</span></div></div><div class="modal-actions"><button data-action="gmail-dual" class="primary">Set up Full + Reply in Gmail</button><button data-action="publish">Publish images</button><button data-action="copy">Copy current variant</button><a href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a></div><div class="mini-actions"><button data-action="export-html">Download HTML</button><button data-action="export-png">PNG · 2×</button><button data-action="backup">Editable project</button></div><p class="hint">Saving or moving blocks never changes an installed Gmail signature. Full and Reply are generated from the same master project.</p>`);}
async function copySignature(){return copyMarkup(html(),doc.variant==='reply'?'Reply signature':'Full signature');}
async function fit(){await ready;const next=clone(doc);next.design.scale=100;const w=measure((U?.render||renderBlocks)(next,{images:prepared.images,origin:location.origin})).width;next.design.scale=Math.max(30,Math.min(100,Math.floor(doc.design.targetWidth/w*1000)/10));commit(next);await ready;toast('Applied actual export scaling. Review the small-text warnings.');}
function setPath(obj,path,value){const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))return;for(const k of keys.slice(0,-1)){if(obj[k]===undefined)obj[k]={};obj=obj[k];}const key=keys.at(-1);if(value===''&&path.startsWith('style.'))delete obj[key];else obj[key]=value;}
function inputChange(e){const el=e.target;if(el.id==='search'){renderLibrary();return;}if(el.id==='projectName'){mutate(d=>d.name=el.value,'name',false);return;}if(el.id==='target'){const v=Number(el.value);if(v>=280)mutate(d=>d.design.targetWidth=v,'target',false);return;}
 if(el.dataset.social){const n=find(doc,selected);if(n?.type!=='social')return;const index=+el.dataset.index,key=el.dataset.social,value=el.type==='checkbox'?el.checked:el.value;mutate(d=>{const item=find(d,selected).props.items[index];item[key]=value;if(key==='id')item.label=NETWORKS.find(n=>n[0]===value)?.[1]||'Link';},'social-'+index+'-'+key,key==='id');return;}
 const scope=el.dataset.scope,path=el.dataset.path;if(!scope)return;const value=el.type==='checkbox'?el.checked:el.type==='number'?el.value===''?'':Number(el.value):el.value;
 if(scope==='columns'){mutate(d=>{const n=find(d,selected),num=Number(value);if(n.type!=='columns')return;if(num<n.children.length)n.children[num-1].children.push(...n.children.slice(num).flatMap(c=>c.children));n.children=n.children.slice(0,num);while(n.children.length<num)n.children.push(block('column',{}, {},[],'Column '+(n.children.length+1)));n.props.ratios=Array(num).fill(100/num);});return;}
 mutate(d=>{if(scope==='node'){const n=find(d,selected);if(!n)return;if(path==='props.bind'&&!value){n.props[n.type==='contact'?'value':'text']=valueOf(n,d);}setPath(n,path,value);}else setPath(d[scope],path,value);},scope+':'+selected+':'+path,path==='props.bind');
}
const actions={
 undo:()=>restore('undo'),redo:()=>restore('redo'),document:()=>{mode='document';renderInspector();},profile:()=>{mode='profile';renderInspector();},selection:()=>{mode='block';renderInspector();},
 add:b=>add({kind:b.dataset.kind}),'add-saved':b=>add({saved:b.dataset.kind}),
 preview:()=>{viewOnly=!viewOnly;if(viewOnly){selected=null;renderInspector();renderTree();}paint();},'variant-full':()=>mutate(d=>d.variant='full'),'variant-reply':()=>mutate(d=>d.variant='reply'),
 fit,compact:()=>mutate(d=>{d.design.padding=6;d.design.gap=12;d.design.sectionGap=6;}),palette:b=>mutate(d=>{const p=PALETTES[+b.dataset.index];Object.assign(d.design,{primary:p[1],secondary:p[2],accent:p[3],link:p[3],tint:p[4],background:p[5],transparent:false});}),
 duplicate:()=>{const r=duplicate(doc,selected);selected=r.id;commit(r.document);},delete:()=>{if(!selected)return;commit(remove(doc,selected));},'toggle-visibility':b=>{const id=b.dataset.id||selected;if(!id)return;mutate(d=>{const n=find(d,id);if(n)n.visibility=n.visibility==='hidden'?'both':'hidden';},'visibility:'+id);},
 up:()=>{const l=locationOf(doc,selected);if(l&&l.index>0)commit(move(doc,selected,l.parent?.id,l.index-1));},down:()=>{const l=locationOf(doc,selected);if(l&&l.index<l.nodes.length-1)commit(move(doc,selected,l.parent?.id,l.index+2));},
 move:moveDialog,'move-confirm':()=>{commit(move(doc,selected,$('moveTarget').value||null,$('movePlacement').value==='start'?0:Infinity));close();},
 beside:()=>{const r=beside(doc,selected);selected=r.id;commit(r.document);toast('Drop blocks into the new column.');},
 group:()=>mutate(d=>{const l=locationOf(d,selected);if(!l||l.node.type==='column')throw new Error('Select a content block first.');const kids=l.nodes.splice(l.index,Math.min(2,l.nodes.length-l.index));const g=block('group',{}, {},kids,'New group');l.nodes.splice(l.index,0,g);selected=g.id;}),
 ungroup:()=>{const l=locationOf(doc,selected);const next=ungroup(doc,selected);selected=l?.node.children[0]?.id||null;commit(next);},
 'reset-style':()=>mutate(d=>find(d,selected).style={}),
 'save-block':()=>{const n=find(doc,selected);if(!n||n.type==='column')throw new Error('Select a content block or group.');modal('Save reusable block',`<p class="modal-note">Inserting a saved block creates an independent copy. Profile-connected fields use the destination signature’s profile. Saved blocks stay in this browser and can be exported.</p><div class="field"><label for="presetName">Name</label><input id="presetName" value="${esc(n.label)}"></div><div class="modal-actions"><button data-action="save-block-confirm" class="primary">Save block</button></div>`);},
 'save-block-confirm':()=>{const n=find(doc,selected);saved.push({id:uid(),name:$('presetName').value||n.label,node:newIds(n)});try{localStorage.setItem(SAVED,JSON.stringify(saved));close();category='Saved';renderLibrary();toast('Saved as a reusable block.');}catch{toast('Browser storage is full. Export the project instead.',true);}},
 'export-saved':()=>download('signature-studio-saved-blocks.json',JSON.stringify({kind:'signature-block-presets',version:1,blocks:saved},null,2),'application/json'),
 'test-link':()=>{const n=find(doc,selected);if(!n)return;const val=valueOf(n,doc),kind=n.props.kind||n.props.bind;const url=n.type==='contact'?kind==='email'?safeUrl(val,{email:true}):['phone','mobile'].includes(kind)?safeUrl(val,{phone:true}):safeUrl(n.props.url||val):safeUrl(n.props.url);if(!url)throw new Error('Add a valid destination first.');window.open(url,'_blank','noopener,noreferrer');},
 'image-upload':()=>{pendingImage={id:selected};$('fileInput').value='';$('fileInput').click();},'image-clear':()=>mutate(d=>find(d,selected).props.src=''),'crop-reset':()=>mutate(d=>Object.assign(find(d,selected).props,{zoom:100,x:0,y:0,fit:'contain'})),
 'social-add':()=>mutate(d=>{const n=find(d,selected);if(n.props.items.length>=16)throw new Error('Use at most 16 links per social block.');n.props.items.push({id:'custom',label:'Custom link',url:'',enabled:true,customIcon:''});}),
 'social-remove':b=>mutate(d=>find(d,selected).props.items.splice(+b.dataset.index,1)),
 'social-up':b=>mutate(d=>{const a=find(d,selected).props.items,i=+b.dataset.index;if(i>0)[a[i-1],a[i]]=[a[i],a[i-1]];}),'social-down':b=>mutate(d=>{const a=find(d,selected).props.items,i=+b.dataset.index;if(i<a.length-1)[a[i+1],a[i]]=[a[i],a[i+1]];}),
 'social-upload':b=>{pendingImage={id:selected,index:+b.dataset.index};$('fileInput').value='';$('fileInput').click();},'social-clear':b=>mutate(d=>find(d,selected).props.items[+b.dataset.index].customIcon=''),
 blank:()=>confirmAction('Start a blank signature?','Your current signature remains saved in this browser. A new, empty project will be created.',()=>{newDocument(freshDocument(true));close();}),
 templates:showTemplates,template:b=>{const base=freshProject();base.identity=clone(doc.identity);const t=TEMPLATES.find(t=>t.id===b.dataset.kind),p=applyTemplate(base,t,false);const n=preservedProject(p).children[0];selected=n.id;commit(insert(doc,n));close();},
 'import-designer':()=>{const s=read('signature-studio.design.v2',{}),r=s.projects?.find(r=>r.id===s.active);if(!r)throw new Error('No current template-designer project was found. Open a design there, or import its JSON.');newDocument(preservedProject(r.project));close();},
 recompose:()=>confirmAction('Recompose as individual blocks?','This replaces the preserved layout with an editable arrangement. Contact details, artwork and content are carried over, but positioning and some template-specific treatments may differ. The original designer project stays intact. You can undo this step.',()=>{const id=selected;commit(recompose(doc,id));selected=null;close();}),
 projects:showProjects,'open-local':b=>{const r=library.projects.find(r=>r.id===b.dataset.id);if(!r)return;saveLocal();activeId=r.id;doc=normalize(r.doc);meta=r.meta||{};selected=null;history=[];future=[];prepared={images:{},keys:{},errors:[]};render();renderInspector();renderTree();saveLocal();close();},
 'duplicate-local':b=>{const r=library.projects.find(r=>r.id===b.dataset.id),copy=clone(r.doc);copy.name+=' · Copy';newDocument(copy);close();},
 'delete-local':b=>confirmAction('Delete local project?','This removes only this browser copy. Its cloud record and published artwork are not deleted.',()=>{const id=b.dataset.id;library.projects=library.projects.filter(r=>r.id!==id);if(id===activeId){activeId=uid();doc=freshDocument(true);meta={};selected=null;history=[];future=[];render();renderInspector();renderTree();}saveLocal();showProjects();}),
 account,signup:async()=>{const email=$('authEmail').value,password=$('authPassword').value;if(!email||password.length<8)throw new Error('Enter an email and a password with at least eight characters.');const r=await cloud.signUp(email,password);if(r?.access_token)cloud.keep(r);toast(r?.access_token?'Account created and signed in.':'Check your email to confirm the account, then sign in.');close();updateAccount();},signout:async()=>{await cloud.signOut();meta={};saveLocal();close();updateAccount();toast('Signed out. Your local project is still here.');},
 'cloud-save':()=>cloudSave(false),'cloud-save-new':()=>cloudSave(true),'cloud-projects':cloudProjects,
 'open-cloud':b=>{const r=pendingRows.find(r=>r.id===b.dataset.id);if(U||r.data?.schemaVersion===3)newDocument(normalize(r.data),{id:r.id,revision:r.updated_at,owner:cloud.user.id});else newDocument(preservedProject(r.data));close();},
 'duplicate-cloud':b=>{const r=pendingRows.find(r=>r.id===b.dataset.id),d=r.data?.schemaVersion===3?clone(r.data):preservedProject(r.data);d.name+=' · Copy';newDocument(d);close();},
 'delete-cloud':b=>confirmAction('Delete cloud signature?','This cannot be undone in the cloud. Your local project and published artwork will not be deleted.',async()=>{await cloud.remove(b.dataset.id);if(meta.id===b.dataset.id){meta={};saveLocal();}await cloudProjects();}),
 export:exportDialog,'gmail-dual':gmailDualSetup,'copy-full':()=>copyVariant('full'),'copy-reply':()=>copyVariant('reply'),'publish-dual':async()=>{if(await publish())await gmailDualSetup();},publish:async()=>{if(await publish())await exportDialog();},copy:copySignature,
 'export-html':async()=>{await ready;if(prepared.errors.length)throw new Error(prepared.errors[0]);download('signature.html','<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email signature</title></head><body>'+html()+'</body></html>','text/html');},
 'export-png':async()=>{await ready;if(prepared.errors.length)throw new Error(prepared.errors[0]);const size=measure(html());download('signature-2x.png',await signaturePNG(html(),Math.ceil(size.width),Math.ceil(size.height)),'image/png');},
 backup:()=>download('signature-block-project.json',JSON.stringify(doc,null,2),'application/json'),import:()=>{$('importInput').value='';$('importInput').click();},
 close,confirm:async()=>{const fn=pendingConfirm;if(fn){pendingConfirm=null;await fn();}},
 help:()=>modal('A few useful shortcuts','<p class="modal-note">Use the on-canvas grip to move between rows and columns. Size handles resize artwork or a block’s content width; Spacing handles adjust its four insets. Column divider handles redistribute adjacent cells. Snap uses the chosen design-pixel increment. Hold Alt for unsnapped adjustments; Shift unlocks independent image dimensions. Arrow keys work on a focused handle. Grid visibility does not change exports. Click empty canvas space to clear selection.</p><p class="modal-note">Drag from a grip or use the + button. Move up/down and Move to… provide alternatives to dragging. Touch users can tap +, select a block and choose a destination.</p><div class="steps"><div><b>↶</b><span>Ctrl / Cmd + Z: undo. Ctrl / Cmd + Shift + Z: redo.</span></div><div><b>↕</b><span>Alt + Up / Down: move selected block among siblings.</span></div><div><b>⧉</b><span>Ctrl / Cmd + D: duplicate a selected block.</span></div><div><b>×</b><span>Delete: remove a selected block. Escape: cancel a drag or selection.</span></div></div><p class="modal-note">Double-click a heading or text block to edit inline. Enter inserts a new line; Escape cancels; Ctrl / Cmd + Enter commits. Use **bold**, *italic* and [label](https://…) in text.</p><div class="callout">Saved reusable blocks insert as independent copies. Full/reply visibility is an export choice, not automatic behavior inside an email thread. No block contains executable scripts or raw HTML.</div>')
};
function updateAccount(){$('accountButton').textContent=cloud.user?'Cloud · signed in':'Cloud account';}
document.addEventListener('click',async e=>{if(Date.now()<lastClick&&e.target.closest('#stage,#canvasTools,[data-drag-kind],[data-drag-id],[data-drag-selected]'))return;const a=e.target.closest('[data-action]');if(a){e.preventDefault();if(a.disabled)return;try{await actions[a.dataset.action]?.(a);}catch(err){toast(err.message||String(err),true);}return;}
 const selectButton=e.target.closest('[data-select]');if(selectButton){select(selectButton.dataset.select);renderTree();return;}
 const tab=e.target.closest('[data-tab]');if(tab){leftTab=tab.dataset.tab;$('libraryView').hidden=leftTab!=='library';$('structureView').hidden=leftTab!=='structure';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===tab));renderTree();return;}
 const cat=e.target.closest('[data-category]');if(cat){category=cat.dataset.category;renderLibrary();return;}
 if(e.target.closest('#stage')&&!viewOnly){
  if(e.target.isContentEditable||e.target.closest('[contenteditable="true"]'))return;
  const node=hitBlock(e.target,e.clientX,e.clientY,$('canvas'));
  e.preventDefault();select(node?.dataset.bid||null);
 }else if(selected&&e.target.closest('.main,.topbar,.workspace')&&!e.target.closest('.left-pane,.right-pane,.studio-rail,input,textarea,select,button,a,label,[data-canvas-control],#selectionBar,dialog'))select(null);
});
$('canvas').addEventListener('pointermove',e=>{
 if(drag||resizing||viewOnly)return;
 const hit=hitBlock(e.target,e.clientX,e.clientY,$('canvas'));
 $('canvas').querySelectorAll('.canvas-hover').forEach(el=>{if(el!==hit)el.classList.remove('canvas-hover');});
 if(hit)hit.classList.add('canvas-hover');
});
$('canvas').addEventListener('pointerleave',()=>$('canvas').querySelectorAll('.canvas-hover').forEach(el=>el.classList.remove('canvas-hover')));
document.addEventListener('input',e=>{if(e.target.tagName!=='SELECT'&&e.target.type!=='checkbox')inputChange(e);});document.addEventListener('change',e=>{if(e.target.tagName==='SELECT'||e.target.type==='checkbox')inputChange(e);});
document.addEventListener('submit',async e=>{if(e.target.id==='authForm'){e.preventDefault();try{await cloud.signIn($('authEmail').value,$('authPassword').value);close();updateAccount();toast('Signed in.');}catch(err){toast(err.message,true);}}});
$('environment').onchange=()=>{$('stage').className='stage '+($('environment').value==='light'?'':$('environment').value);};$('zoom').onchange=()=>{zoom=Number($('zoom').value);paint();};$('search').oninput=renderLibrary;
$('fileInput').onchange=async e=>{const f=e.target.files[0],target=pendingImage;if(!f||!target)return;try{const src=await readImage(f);mutate(d=>{const n=find(d,target.id);if(!n)throw new Error('The selected image block was removed.');if(target.index!==undefined)n.props.items[target.index].customIcon=src;else n.props.src=src;});toast('Artwork added. Crop and zoom in the inspector.');}catch(err){toast(err.message,true);}};
$('importInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>18000000)throw new Error('Project files must be smaller than 18 MB.');const p=JSON.parse(await f.text());if(p.kind==='signature-block-presets'){for(const item of (p.blocks||[]).slice(0,40)){const trial=freshDocument(true);trial.children=[item.node];const good=normalize(trial).children[0];saved.push({id:uid(),name:String(item.name||good.label).slice(0,80),node:newIds(good)});}localStorage.setItem(SAVED,JSON.stringify(saved));category='Saved';renderLibrary();}else newDocument(p.schemaVersion===3?normalize(p):preservedProject(p));close();toast('Imported as a separate copy.');}catch(err){toast(err.message,true);}};
document.addEventListener('pointerdown',()=>{pointerSelection=true;lastClick=0;},true);
document.addEventListener('pointerup',()=>{setTimeout(()=>{pointerSelection=false;},0);},true);
document.addEventListener('pointercancel',()=>{pointerSelection=false;},true);
$('canvas').addEventListener('focusin',e=>{const host=e.target.closest('[data-bid]');if(host&&!pointerSelection&&!e.target.isContentEditable&&!viewOnly){select(host.dataset.bid);renderTree();}});
$('canvas').addEventListener('dblclick',e=>{if(viewOnly)return;const el=e.target.closest('[data-edit]'),host=el?.closest('[data-bid]'),n=host?find(doc,host.dataset.bid):null;if(!n||!['text','heading'].includes(n.type))return;const before=valueOf(n,doc),id=n.id;el.textContent=before;el.contentEditable='true';el.focus();let cancel=false;
 const finish=()=>{el.removeEventListener('blur',finish);if(cancel){paint();return;}const value=el.innerText.slice(0,4000);mutate(d=>{const b=find(d,id);if(b.props.bind)d.identity[b.props.bind]=value;else b.props.text=value;},'inline-'+id);};
 el.addEventListener('blur',finish,{once:true});el.addEventListener('paste',ev=>{ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));});el.addEventListener('keydown',ev=>{if(ev.key==='Escape'){cancel=true;ev.stopPropagation();el.blur();}if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();el.blur();}});
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&resizing){endResize(false);e.preventDefault();return;}if(e.key==='Escape'&&drag){cancelDrag();e.preventDefault();return;}if(e.target.matches('input,textarea,select')||e.target.isContentEditable)return;if(e.target.closest('[data-canvas-resize]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;if($('modal').open)return;
 if(e.key==='Escape'){select(null);}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();restore(e.shiftKey?'redo':'undo');}
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='d'&&selected){e.preventDefault();try{actions.duplicate();}catch(err){toast(err.message,true);}}
 if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)&&selected){e.preventDefault();actions[e.key==='ArrowUp'?'up':'down']();}
 if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();actions.delete();}
});
function targetAt(x,y){const cv=$('canvas').getBoundingClientRect(),sr=$('stage').getBoundingClientRect();if(x<sr.left||x>sr.right||y<sr.top||y>sr.bottom)return null;
 const el=document.elementFromPoint(x,y)?.closest('#canvas [data-bid]');if(!el){if(x<cv.left-15||x>cv.right+15)return null;return {parentId:null,index:y<cv.top+cv.height/2?0:doc.children.length,rect:{left:cv.left,top:y<cv.top+cv.height/2?cv.top:cv.bottom,width:cv.width,height:3},label:'Insert in signature'};}
 const n=find(doc,el.dataset.bid);if(!n)return null;const r=el.getBoundingClientRect(),loc=locationOf(doc,n.id);if(drag?.spec.id){let cycle=false;walk([find(doc,drag.spec.id)],b=>{if(b.id===n.id)cycle=true;});if(cycle)return null;}
 const inside=n.type==='column'||CONTAINERS.includes(n.type)&&n.type!=='columns'&&(n.children.length===0||y>r.top+r.height*.25&&y<r.bottom-r.height*.25);
 if(inside)return {parentId:n.id,index:n.children.length,rect:r,label:'Inside '+n.label};
 const after=y>r.top+r.height/2;return {parentId:loc.parent?.id||null,index:loc.index+(after?1:0),rect:{left:r.left,top:after?r.bottom:r.top,width:r.width,height:3},label:(after?'After ':'Before ')+n.label};
}
function cancelDrag(){const active=drag;drag=null;if(active?.source?.hasPointerCapture?.(active.pointerId))try{active.source.releasePointerCapture(active.pointerId);}catch{}$('dropGuide').hidden=true;$('dragGhost').hidden=true;document.body.classList.remove('dragging');canvasTools.clearMeasurement();markSelection();}
function resizeStart(source,e){
 const node=find(doc,selected);if(!node||viewOnly)return null;
 const [kind,edge]=source.dataset.canvasResize.split(':'),factor=zoom*doc.design.scale/100;
 const el=$('canvas').querySelector(`[data-bid="${selected}"]`);if(!el)return null;
 const box=canvasTools.contentBox(el,node).getBoundingClientRect(),cell=el.getBoundingClientRect();
 const pads=(node.style.paddingLeft??node.style.padding??0)+(node.style.paddingRight??node.style.padding??0);
 let available=Math.max(24,cell.width/factor-pads);
 if(kind==='column')available=node.children.reduce((sum,col)=>{const c=el.querySelector(`[data-bid="${col.id}"]`);return sum+(c?.getBoundingClientRect().width||0)/factor;},0);
 return {before:clone(doc),id:selected,type:node.type,kind,edge,x:e.clientX,y:e.clientY,original:clone(node),pointerId:e.pointerId,source,
  initialWidth:node.style.width??Math.max(24,box.width/factor-pads),available,factor,started:false};
}
function resizeNext(r,dx,dy,e){
 const step=canvasTools.prefs.step,snap=canvasTools.prefs.snap&&!e.altKey;
 return transact(r.before,d=>{const n=find(d,r.id);if(!n)return;
  if(r.kind==='padding'){n.style['padding'+r.edge]=resizePadding(r.original.style,r.edge,['Top','Bottom'].includes(r.edge)?dy:dx,step,snap);return;}
  if(r.kind==='width'){n.style.width=snapValue(r.initialWidth+(r.edge==='w'?-dx:dx),step,snap,24,Math.min(900,r.available));return;}
  if(r.kind==='column'){n.props.ratios=resizeColumnRatios(r.original.props.ratios,Number(r.edge),dx,r.available,step,snap);return;}
  if(U&&r.type==='fragment'){
   let part=r.original.props.part;if(part==='portrait'&&!d.designData?.assets.portrait.src)part='logo';
   const key=part+'Width',width=r.before.design[key],height=part==='banner'?r.before.design.bannerHeight:width;
   const max={logo:190,portrait:180,partner:150,banner:820}[part];
   const size=resizeArtwork({width,height,dx,dy,edge:r.edge,step,snap,free:part==='banner'&&e.shiftKey,minW:part==='banner'?180:24,maxW:max,minH:part==='banner'?36:24,maxH:part==='banner'?220:max});
   d.design[key]=size.width;if(part==='banner')d.design.bannerHeight=size.height;
  }else if(r.type==='qr'){
   n.props.size=resizeArtwork({width:r.original.props.size||100,height:r.original.props.size||100,dx,dy,edge:r.edge,step,snap,minW:16,maxW:240,minH:16,maxH:240}).width;
  }else{
   const size=resizeArtwork({width:r.original.props.width||92,height:r.original.props.height||92,dx,dy,edge:r.edge,step,snap,free:r.type==='spacer'||e.shiftKey,minH:r.type==='spacer'?0:1});Object.assign(n.props,size);
  }
 });
}
function resizeFeedback(r,e){
 const n=find(doc,r.id);let label='';
 if(r.kind==='column')label='Columns '+n.props.ratios.map(x=>Math.round(x*10)/10+'%').join(' / ');
 else if(r.kind==='padding')label=r.edge+' inset '+n.style['padding'+r.edge]+' px';
 else if(r.kind==='width')label='Block width '+Math.round(n.style.width*10)/10+' px';
 else if(n.type==='fragment'){let p=n.props.part;if(p==='portrait'&&!doc.designData?.assets.portrait.src)p='logo';label=p[0].toUpperCase()+p.slice(1)+' '+Math.round(doc.design[p+'Width']*10)/10+' px';}
 else if(n.type==='qr')label='QR '+n.props.size+' px';else label=Math.round(n.props.width*10)/10+' × '+Math.round(n.props.height*10)/10+' px';
 const el=$('canvas').querySelector(`[data-bid="${r.id}"]`),box=canvasTools.contentBox(el,n)?.getBoundingClientRect();
 let x=null,y=null;if(box){if(r.kind==='column'){const c=el.querySelector(`[data-bid="${n.children[Number(r.edge)].id}"]`);x=c?.getBoundingClientRect().right??null;}
 else if(r.kind==='width'||/[ew]/.test(r.edge)){x=r.edge.includes('w')?box.left:box.right;}
 if(r.kind==='size'&&/[ns]/.test(r.edge))y=r.edge.includes('n')?box.top:box.bottom;
 if(r.kind==='padding'){const cr=el.getBoundingClientRect(),value=n.style['padding'+r.edge]*r.factor;if(r.edge==='Left')x=cr.left+value;if(r.edge==='Right')x=cr.right-value;if(r.edge==='Top')y=cr.top+value;if(r.edge==='Bottom')y=cr.bottom-value;}}
 canvasTools.measurement(label+(canvasTools.prefs.snap&&!e.altKey?' · '+canvasTools.prefs.step+' px grid':' · Free'),x,y);
}
function endResize(apply){
 if(!resizing)return;const r=resizing,next=doc;resizing=null;doc=r.before;
 if(r.source.hasPointerCapture?.(r.pointerId))try{r.source.releasePointerCapture(r.pointerId);}catch{}
 canvasTools.clearMeasurement();document.body.classList.remove('resizing');
 if(apply&&r.started)commit(next);else render();renderInspector();markSelection();lastClick=Date.now()+300;
}
document.addEventListener('pointerdown',e=>{
 const source=e.target.closest('[data-canvas-resize]');if(!source||e.button!==0||viewOnly)return;
 e.preventDefault();e.stopPropagation();resizing=resizeStart(source,e);if(!resizing)return;
 try{source.setPointerCapture(e.pointerId);}catch{}
});
document.addEventListener('pointermove',e=>{
 if(!resizing||e.pointerId!==resizing.pointerId)return;const r=resizing;
 if(!r.started&&Math.hypot(e.clientX-r.x,e.clientY-r.y)<2)return;
 r.started=true;document.body.classList.add('resizing');const delta=designDelta(e.clientX-r.x,e.clientY-r.y,zoom,doc.design.scale);
 try{doc=resizeNext(r,delta.dx,delta.dy,e);paint();resizeFeedback(r,e);}catch(err){endResize(false);toast(err.message,true);}
});
document.addEventListener('pointerup',e=>{if(resizing&&e.pointerId===resizing.pointerId)endResize(true);});
document.addEventListener('pointercancel',e=>{if(resizing&&e.pointerId===resizing.pointerId)endResize(false);});
document.addEventListener('lostpointercapture',e=>{if(resizing&&e.pointerId===resizing.pointerId)endResize(false);});
document.addEventListener('keydown',e=>{
 const source=e.target.closest('[data-canvas-resize]');if(!source||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||resizing||viewOnly)return;
 e.preventDefault();e.stopPropagation();const r=resizeStart(source,{clientX:0,clientY:0,pointerId:-1});if(!r)return;
 const step=e.altKey||!canvasTools.prefs.snap?1:canvasTools.prefs.step;
 const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
 commit(resizeNext(r,dx,dy,e),'handle-key:'+r.id+':'+source.dataset.canvasResize);source.focus({preventScroll:true});
});
document.addEventListener('pointerdown',e=>{if(e.button!==0||viewOnly)return;const source=e.target.closest('[data-drag-kind],[data-drag-id],[data-drag-saved],[data-drag-selected]');if(!source)return;const spec=source.dataset.dragKind?{kind:source.dataset.dragKind}:source.dataset.dragSaved?{saved:source.dataset.dragSaved}:{id:source.dataset.dragId||selected};if(spec.id&&find(doc,spec.id)?.type==='column'){toast('Move column contents or drag the whole columns block.');return;}if(spec.id&&!find(doc,spec.id))return;e.preventDefault();drag={source,spec,x:e.clientX,y:e.clientY,pointerId:e.pointerId,started:false,target:null};try{source.setPointerCapture(e.pointerId);}catch{}});
document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;if(!drag.started&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;drag.started=true;document.body.classList.add('dragging');markSelection();$('selectionBar').hidden=true;const ghost=$('dragGhost');ghost.hidden=false;ghost.textContent=drag.spec.id?find(doc,drag.spec.id)?.label:drag.spec.saved?saved.find(s=>s.id===drag.spec.saved)?.name:LIBRARY.find(s=>s.id===drag.spec.kind)?.name;ghost.style.left=e.clientX+16+'px';ghost.style.top=e.clientY+16+'px';
 const sr=$('stage').getBoundingClientRect();if(e.clientX>sr.left&&e.clientX<sr.right){if(e.clientY<sr.top+32)$('stage').scrollTop-=10;if(e.clientY>sr.bottom-32)$('stage').scrollTop+=10;if(e.clientX<sr.left+32)$('stage').scrollLeft-=10;if(e.clientX>sr.right-32)$('stage').scrollLeft+=10;}
 drag.target=targetAt(e.clientX,e.clientY);const guide=$('dropGuide');guide.hidden=!drag.target;if(drag.target){const r=drag.target.rect;guide.style.left=r.left+'px';guide.style.top=r.top+'px';guide.style.width=Math.max(30,r.width)+'px';guide.style.height=Math.max(3,r.height)+'px';guide.dataset.label=drag.target.label;$('dragStatus').textContent=drag.target.label;}
});
document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;const d=drag;cancelDrag();if(d.started){lastClick=Date.now()+300;if(d.target){try{if(d.spec.id){selected=d.spec.id;commit(move(doc,d.spec.id,d.target.parentId,d.target.index));toast('Block moved.');}else add(d.spec,d.target);}catch(err){toast(err.message,true);}}else toast('Drag cancelled. Choose a highlighted drop target.');}});
document.addEventListener('pointercancel',e=>{if(drag&&e.pointerId===drag.pointerId)cancelDrag();});document.addEventListener('lostpointercapture',e=>{if(drag&&e.pointerId===drag.pointerId)cancelDrag();});window.addEventListener('blur',()=>{if(drag)cancelDrag();if(resizing)endResize(false);});window.addEventListener('resize',markSelection);document.addEventListener('scroll',markSelection,true);window.addEventListener('beforeunload',saveLocal);
const canvasTools=new CanvasTools(()=>({doc,selected,zoom,viewOnly,dragging:!!drag?.started,resizing}),align=>{if(selected)mutate(d=>{const n=find(d,selected);if(n)n.style.align=align;});});
$('modal').addEventListener('close',markSelection);
renderLibrary();renderTree();renderInspector();render();saveLocal();cloud.restore().then(updateAccount);
window.blocksStudio={variantHtml:variant=>variantHtml(variant),canvasPreferences:()=>({...canvasTools.prefs}),setCanvasPreferences:p=>canvasTools.set(p),getDocument:()=>clone(doc),ready:()=>ready,html:()=>html(),measure:()=>measure(html()),select,id:()=>selected,add:(kind,parentId=null,index=Infinity)=>add({kind},{parentId,index}),load:p=>newDocument(normalize(p)),move:(id,parentId,index)=>commit(move(doc,id,parentId,index)),set:(id,path,v)=>{selected=id;mutate(d=>setPath(find(d,id),path,v));},fit,checks:()=>(U?.checks||checks)(doc,html(),measure(html()).width,prepared.errors),history:()=>({undo:history.length,redo:future.length})};

if(U){Object.assign(window.blocksStudio,{
 mutate,commit,newDocument,showProjects,showTemplates,renderInspector,renderTree,paint,render,toast,modal,close,download,
 save:saveLocal,run:(action,button={dataset:{}})=>actions[action]?.(button),
 selectMode:value=>{mode=value;renderInspector();},local:()=>clone(library),meta:()=>clone(meta),
 ready:()=>ready,prepared:()=>clone(prepared),getSelection:()=>selected,
 replaceSelection:(next,id)=>{selected=id;commit(next);},
 refresh:()=>{renderInspector();renderTree();paint();}
 });U.start?.(window.blocksStudio);}
