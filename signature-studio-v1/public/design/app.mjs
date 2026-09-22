import {TEMPLATES,CATEGORIES,PALETTES,FONTS,NETWORKS,SECTIONS,SECTION_LABELS,BASE_DESIGN,freshProject,applyTemplate} from './catalog.mjs';
import {esc,clamp,normalizeProject,renderSignature,preflight,safeUrl,safeImage} from './engine.mjs';
import {prepareImages,readImage,signaturePNG} from './media.mjs';
import {Cloud} from './cloud.mjs';

const $=id=>document.getElementById(id),clone=x=>structuredClone(x),config=window.SIGNATURE_STUDIO_CONFIG||{},cloud=new Cloud(config);
const STORE='signature-studio.design.v2',STYLE_STORE='signature-studio.styles.v2',FAV_STORE='signature-studio.favorites.v2';
function readStored(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback;}catch{return fallback;}}
let library=readStored(STORE,{active:null,projects:[]}),savedStyles=readStored(STYLE_STORE,[]),favorites=readStored(FAV_STORE,[]);
if(!Array.isArray(library.projects))library={active:null,projects:[]};if(!Array.isArray(savedStyles))savedStyles=[];if(!Array.isArray(favorites))favorites=[];
let activeId=library.active,p=null,cloudId=null,cloudRevision=null,cloudOwner=null;
try{const row=library.projects.find(r=>r.id===activeId);if(row){p=normalizeProject(row.project);cloudId=row.cloudId||null;cloudRevision=row.cloudRevision||null;cloudOwner=row.cloudOwner||null;}}catch{}
if(!p){let legacy=readStored('signatureStudioV1.1',null)||readStored('signatureStudioV1',null);try{p=legacy?normalizeProject(legacy):freshProject();}catch{p=freshProject();}activeId=crypto.randomUUID();}
let panel='content',undo=[],redo=[],lastGroup='',lastEdit=0,saveTimer,toastTimer,renderVersion=0,prepared={images:{},keys:{},errors:[]},latestHTML='',latestWidth=0,latestHeight=0,keepBrand=false,viewZoom=1,pendingImage=null,renderPromise=Promise.resolve(),cloudBusy=false;
let galleryFilter='All',gallerySearch='';
const origin=location.origin;
const titles={content:['Your details','The right introduction, in your own words.'],type:['Typography','Tune hierarchy, rhythm and the smallest details.'],layout:['Composition','Choose your structure. Set the space around it.'],color:['Color & brand','A palette with purpose. Or make your own.'],images:['Image atelier','Logos, portraits, partner marks and campaign banners.'],social:['Social presence','Choose the channels that matter. Set their order and style.'],blocks:['Beyond the basics','Add a conversation starter, announcement or personal touch.'],order:['Section order','Show, hide and rearrange the elements below your identity.']};
const get=path=>path.split('.').reduce((o,k)=>o?.[k],p);
function set(path,value){const parts=path.split('.');if(parts.some(k=>['__proto__','prototype','constructor'].includes(k)))return;let obj=p;for(const k of parts.slice(0,-1))obj=obj[k];obj[parts.at(-1)]=value;}
function toast(message,error=false){$('toast').textContent=message;$('toast').className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').className='',error?6500:3400);}
function message(text){if($('modalMessage'))$('modalMessage').textContent=text;else toast(text);}
function saveLocalNow(){
 clearTimeout(saveTimer);const entry={id:activeId,project:clone(p),updatedAt:new Date().toISOString(),cloudId,cloudRevision,cloudOwner};
 const index=library.projects.findIndex(r=>r.id===activeId);if(index<0)library.projects.unshift(entry);else library.projects[index]=entry;library.active=activeId;
 try{localStorage.setItem(STORE,JSON.stringify(library));$('saveStatus').textContent='Saved in this browser';}catch{$('saveStatus').textContent='Browser storage full — export a backup';toast('Browser storage is full. Download a project backup to keep your work.',true);}
}
function scheduleSave(){clearTimeout(saveTimer);$('saveStatus').textContent='Saving…';saveTimer=setTimeout(saveLocalNow,450);}
function mutate(fn,group='',refresh=false){
 const now=Date.now();if(!group||group!==lastGroup||now-lastEdit>800){undo.push(JSON.stringify(p));if(undo.length>45)undo.shift();}lastGroup=group;lastEdit=now;redo=[];
 fn(p);p=normalizeProject(p);render();if(refresh)renderControls();scheduleSave();
}
function history(direction){const source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo;if(!source.length)return;target.push(JSON.stringify(p));p=normalizeProject(JSON.parse(source.pop()));lastGroup='';renderControls();render();scheduleSave();}
function refreshButtons(){$('undoButton').disabled=!undo.length;$('redoButton').disabled=!redo.length;document.querySelectorAll('#variantPicker button').forEach(b=>b.classList.toggle('active',b.dataset.action===p.variant));}
function field(path,label,type='text',options=null,visibility=''){
 const rawValue=get(path),value=type==='url'&&String(rawValue||'').startsWith('data:')?'':rawValue,id='f-'+path.replaceAll('.','-');
 let control;if(type==='select')control=`<select id="${id}" data-path="${path}">${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${String(v)===String(value)?' selected':''}>${esc(l)}</option>`;}).join('')}</select>`;
 else if(type==='range')control=`<input id="${id}" data-path="${path}" type="range" min="${options[0]}" max="${options[1]}" step="${options[2]||1}" value="${esc(value)}">`;
 else if(type==='textarea')control=`<textarea id="${id}" data-path="${path}" rows="3">${esc(value)}</textarea>`;
 else if(type==='color')control=`<div class="color-input"><input type="color" aria-label="${esc(label)} color picker" data-path="${path}" value="${esc(value)}"><input id="${id}" type="text" aria-label="${esc(label)} hexadecimal color" data-path="${path}" data-color="true" value="${esc(value)}" maxlength="7"></div>`;
 else control=`<input id="${id}" data-path="${path}" type="${type}" value="${esc(value)}" ${type==='url'?'placeholder="https://…"':''}>`;
 return `<div class="field"><div class="field-head"><label for="${id}">${esc(label)}</label>${type==='range'?`<output data-output="${path}">${esc(value)}</output>`:''}${visibility?`<input class="visibility" type="checkbox" data-path="visible.${visibility}" aria-label="Show ${esc(label)}" title="Show ${esc(label)}" ${p.visible[visibility]?'checked':''}>`:''}</div>${control}</div>`;
}
const check=(path,label)=>`<label class="switch-row"><input type="checkbox" data-path="${path}" ${get(path)?'checked':''}>${esc(label)}</label>`;
const section=(title,body)=>`<section class="control-section"><h3>${title}</h3>${body}</section>`;
const two=(...fields)=>`<div class="two-col">${fields.join('')}</div>`;
const D=(key,label,type='range',options=[0,50])=>field('design.'+key,label,type,options);
function renderControls(){
 $('panelTitle').textContent=titles[panel][0];$('panelDescription').textContent=titles[panel][1];document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));
 let html='';
 if(panel==='content'){
  html=section('Identity',[['name','Full name'],['title','Title / role'],['company','Company'],['kicker','Eyebrow / overline']].map(([k,l])=>field('identity.'+k,l,'text',null,k)).join(''))+
  section('Contact information',[['email','Email','email'],['phone','Phone','text'],['website','Website','url'],['mobile','Mobile','text'],['address','Address','text']].map(([k,l,t])=>field('identity.'+k,l,t,null,k)).join(''))+
  section('A little more',field('identity.tagline','Tagline')+field('identity.pronouns','Pronouns','text',null,'pronouns')+field('identity.department','Department / team','text',null,'department')+field('identity.availability','Availability / timezone','text',null,'availability'));
 }
 if(panel==='type'){
  const fonts=Object.entries(FONTS).map(([k,v])=>[k,v.name]);
  html=section('Font pairing',D('nameFont','Display font','select',fonts)+D('bodyFont','Body font','select',fonts)+'<p class="micro">Fonts use recipient-device fallbacks. Custom web fonts are not embedded in email.</p>')+
  section('Hierarchy',D('nameSize','Name size · px','range',[12,46])+D('roleSize','Role size · px','range',[9,24])+D('bodySize','Contact size · px','range',[9,22])+D('tagSize','Tagline size · px','range',[9,26])+D('footerSize','Disclaimer size · px','range',[8,16]))+
  section('Fine typography',D('nameWeight','Name weight','select',[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold'],[800,'Extra bold']])+D('nameCase','Name casing','select',[['none','As entered'],['uppercase','UPPERCASE'],['lowercase','lowercase']])+D('tracking','Name tracking · px','range',[-1,5,.1])+D('lineHeight','Line height','range',[1.1,2,.05])+check('design.linkUnderline','Underline contact links'));
 }
 if(panel==='layout'){
  const layouts=[...new Map(TEMPLATES.map(t=>[t.layout,[t.layout,t.name]])).values()];
  html=section('Structure',D('layout','Composition','select',layouts)+D('align','Alignment','select',[['left','Left'],['center','Center'],['right','Right']])+D('contactLayout','Contact arrangement','select',[['stacked','Stacked lines'],['inline','Single row'],['columns','Two columns']])+D('contactLabels','Contact labels','select',[['none','None'],['short','T / E / W'],['full','Phone / Email / Website']])+D('separator','Inline separator','select',[[' · ','Middle dot'],[' | ','Vertical bar'],[' / ','Slash'],[' — ','Em dash']]))+
  section('Density','<div class="pill-row"><button data-action="density" data-value="compact">Compact</button><button data-action="density" data-value="balanced">Balanced</button><button data-action="density" data-value="airy">Airy</button></div>'+D('padding','Outer padding · px','range',[0,50])+D('gap','Column gap · px','range',[4,64])+D('sectionGap','Section spacing · px','range',[2,36])+D('contactGap','Contact line gap · px','range',[0,20]))+
  section('Fit & scale',D('baseWidth','Design width · px','range',[240,900,10])+D('scale','Export scale · %','range',[30,150,.1])+D('targetWidth','Fit target · px','range',[280,1000,10])+check('design.nowrap','Keep individual text lines unbroken')+'<div class="mini-actions"><button data-action="autofit">Auto-fit</button><button data-action="mobile-fit">Fit to 360 px</button></div><p class="micro">No-wrap can overflow at large sizes. Auto-fit scales real HTML dimensions, not just the preview.</p>')+
  section('Frames & rules',D('border','Frame stroke · px','range',[0,5,.5])+D('borderStyle','Line style','select',['solid','dashed','dotted'])+D('radius','Frame corner radius · px','range',[0,30])+D('ruleWidth','Rule stroke · px','range',[.5,5,.5])+D('ruleLength','Rule length · %','range',[15,100]));
 }
 if(panel==='color')html=section('Curated palettes',`<div class="palette-grid">${PALETTES.map((a,index)=>`<button class="palette" data-action="palette" data-index="${index}"><span class="palette-swatches">${a.slice(1).map(h=>`<i style="background:${h}"></i>`).join('')}</span>${a[0]}</button>`).join('')}</div>`)+section('Your palette',two(D('primary','Primary text','color'),D('secondary','Secondary text','color'))+two(D('link','Links','color'),D('accent','Rules & icons','color'))+two(D('tint','Panel tint','color'),D('background','Background','color'))+check('design.transparent','Transparent signature background'))+section('Reusable brand kit','<div class="mini-actions"><button data-action="export-brand">Export brand kit</button><button data-action="import-brand">Import brand kit</button><button data-action="save-template">Save as template</button></div><p class="micro">Brand kits contain your palette and font pairing. Templates additionally preserve layout and spacing. Saved styles stay in this browser.</p>');
 if(panel==='images'){
  html=Object.entries(p.assets).map(([slot,a])=>{
   const label={logo:'Primary logo',portrait:'Portrait / headshot',partner:'Partner logo',banner:'Image banner'}[slot],size=slot==='logo'?'logoWidth':slot==='portrait'?'portraitWidth':slot==='partner'?'partnerWidth':'bannerWidth',max=slot==='banner'?820:190;
   return section(label,`<div class="asset-card"><div class="asset-summary">${a.src?`<img src="${esc(safeImage(a.src,origin))}" alt="${esc(label)}">`:'<span class="avatar-dot">＋</span>'}<div><strong>${label}</strong><span>${a.src?'Artwork loaded':'No artwork selected'}</span></div></div><div class="mini-actions"><button data-action="upload-image" data-slot="${slot}">Upload artwork</button><button data-action="remove-image" data-slot="${slot}">Remove</button></div>${field('assets.'+slot+'.src','Or use an image URL','url')}${field('assets.'+slot+'.alt','Accessible alt text')}${field('assets.'+slot+'.link','Image click-through URL','url')}${D(size,'Displayed width · px','range',[slot==='banner'?180:24,max])}${slot==='banner'?D('bannerHeight','Banner height · px','range',[36,220]):''}${field('assets.'+slot+'.zoom','Zoom · %','range',[50,300])}${field('assets.'+slot+'.fit','Image fitting','select',[['contain','Contain entire image'],['cover','Fill / crop frame']])}<details><summary>Crop & position</summary>${field('assets.'+slot+'.x','Horizontal position','range',[-100,100])}${field('assets.'+slot+'.y','Vertical position','range',[-100,100])}<button data-action="reset-crop" data-slot="${slot}">Reset crop</button></details></div>`);
  }).join('')+section('Image styling',D('logoShape','Logo shape','select',['square','rounded','circle'])+D('portraitShape','Portrait shape','select',['square','rounded','circle'])+D('imageBackground','Logo frame background','color')+D('bannerRadius','Banner corner radius','range',[0,30])+check('design.showLogo','Show primary logo')+check('design.showPortrait','Show portrait in portrait layouts')+check('design.showPartner','Show partner in co-brand layouts')+'<p class="micro">Upload PNG, JPEG, WebP or SVG. Crops and zoom are rasterized into the exported artwork. Remote URLs must permit image processing; uploading a file is most reliable.</p>');
 }
 if(panel==='social')html=section('Icon design',D('iconStyle','Treatment','select',[['bare','Bare graphic marks'],['circle','Filled circles'],['outline','Outlined circles'],['tile','Rounded tiles'],['text','Platform names'],['letter','Lettermarks']])+D('iconSize','Icon size · px','range',[16,46])+D('iconGap','Icon spacing · px','range',[2,22])+D('iconInk','Graphic ink','select',[['auto','Automatic'],['dark','Dark'],['light','Light']]))+
 section('Your channels',p.socials.map((s,index)=>`<div class="social-card"><div class="social-header"><input type="checkbox" data-path="socials.${index}.enabled" aria-label="Show ${esc(s.label)}" ${s.enabled?'checked':''}><strong>${esc(s.label)}</strong><div class="mini-actions"><button data-action="move-social" data-index="${index}" data-dir="-1" aria-label="Move ${esc(s.label)} up" ${index===0?'disabled':''}>↑</button><button data-action="move-social" data-index="${index}" data-dir="1" aria-label="Move ${esc(s.label)} down" ${index===p.socials.length-1?'disabled':''}>↓</button><button data-action="delete-social" data-index="${index}" aria-label="Remove ${esc(s.label)}">×</button></div></div>${field('socials.'+index+'.url','Profile URL','url')}${field('socials.'+index+'.label','Accessible label')}<div class="mini-actions"><button data-action="upload-social" data-index="${index}">Custom artwork</button>${s.customIcon?`<button data-action="clear-social" data-index="${index}">Use standard mark</button>`:''}</div></div>`).join('')+`<div class="field"><label for="networkSelect">Add a channel</label><select id="networkSelect">${NETWORKS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><button data-action="add-social" class="full">Add channel +</button><p class="micro">Channels without a valid URL are omitted from exports. Custom links may be repeated for additional destinations.</p>`);
 if(panel==='blocks')html=section('Calls to action',field('content.ctaLabel','Primary button label')+field('content.ctaUrl','Primary destination','url')+field('content.cta2Label','Secondary button label')+field('content.cta2Url','Secondary destination','url')+D('ctaStyle','Button style','select',['outline','filled','text'])+two(D('ctaColor','Button color','color'),D('ctaText','Filled-button text','color'))+D('ctaSize','Button type · px','range',[9,18])+D('ctaPadding','Button padding · px','range',[4,20])+D('ctaRadius','Button corner radius · px','range',[0,24]))+
 section('Announcement',field('content.announcementTitle','Headline')+field('content.announcementText','Supporting text','textarea')+field('content.announcementUrl','Announcement link','url'))+
 section('Custom fields',p.extras.map((e,index)=>`<div class="extra-card">${check('extras.'+index+'.enabled','Show field')}${field('extras.'+index+'.label','Label')}${field('extras.'+index+'.value','Value')}${field('extras.'+index+'.url','Optional destination','url')}<button data-action="remove-extra" data-index="${index}">Remove field</button></div>`).join('')+'<button class="full" data-action="add-extra">Add custom field +</button><p class="micro">Use these for credentials, licensing details, portfolio links or a preferred contact method.</p>')+
 section('Personal note',field('content.note','Closing note / quotation','textarea'))+section('Disclaimer',field('content.disclaimer','Your own legal or confidentiality text','textarea')+'<p class="micro">No legal language is added automatically. Review any disclaimer before using it.</p>');
 if(panel==='order')html=section('Visible sections',p.sections.map((s,index)=>`<div class="order-row"><input type="checkbox" data-path="sections.${index}.enabled" aria-label="Show ${SECTION_LABELS[s.type]}" ${s.enabled?'checked':''}><span>${SECTION_LABELS[s.type]}</span><div class="mini-actions"><button data-action="move-section" data-index="${index}" data-dir="-1" aria-label="Move ${SECTION_LABELS[s.type]} up" ${index===0?'disabled':''}>↑</button><button data-action="move-section" data-index="${index}" data-dir="1" aria-label="Move ${SECTION_LABELS[s.type]} down" ${index===p.sections.length-1?'disabled':''}>↓</button></div></div>`).join('')+'<p class="micro">Empty sections never add space. Split, banner-led and social-first layouts intentionally pin those specific modules to their structural positions.</p>')+section('Collection','<button class="full primary" data-action="gallery">Browse all 36 templates ↗</button><p class="micro">Try a different composition without replacing your identity or contact information.</p>');
 $('controls').innerHTML=html;
}
function measure(html){$('measurement').innerHTML=html;const node=$('measurement').firstElementChild;return node?{width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}:{width:0,height:0};}
function updatePreview(html,errors=[]){
 latestHTML=html;const size=measure(html);latestWidth=size.width;latestHeight=size.height;
 $('signaturePreview').innerHTML=html;$('dimensionLabel').textContent=`${Math.round(size.width)} × ${Math.round(size.height)} px`;
 $('previewScale').style.transform=`scale(${viewZoom})`;$('signatureScroll').style.minHeight=Math.ceil(size.height*viewZoom+4)+'px';
 $('fitStatus').textContent=size.width<=p.design.targetWidth+1?`${Math.round(size.width)} px · within your target`:`${Math.round(size.width)} px · wider than target`;
 const issues=[...preflight(p,html,size.width),...errors];$('checkBadge').textContent=issues.length?`${issues.length} to review`:'Checked';
 $('checks').innerHTML=issues.length?issues.map(w=>`<div class="check-item warning">${esc(w.text)}</div>`).join(''):'<div class="check-item">Within the selected width. Images use hosted sources. No obvious issues in the selected browser preview.</div>';
 return size;
}
function render(){
 const version=++renderVersion;refreshButtons();if(document.activeElement!==$('projectName'))$('projectName').value=p.name;$('targetInput').value=p.design.targetWidth;
 document.querySelectorAll('[data-output]').forEach(o=>o.value=get(o.dataset.output));
 updatePreview(renderSignature(p,{origin}));
 renderPromise=prepareImages(clone(p),origin).then(result=>{if(version!==renderVersion)return;prepared=result;updatePreview(renderSignature(p,{origin,images:result.images}),result.errors);}).catch(e=>toast(e.message,true));return renderPromise;
}
async function autoFit(target=null){
 await renderPromise;const before=JSON.stringify(p);if(target)p.design.targetWidth=target;
 const test=clone(p);let lo=30,hi=150;
 const actual=scale=>{test.design.scale=scale;return measure(renderSignature(test,{origin,images:prepared.images})).width;};
 if(actual(100)<=test.design.targetWidth)lo=100;
 else{hi=100;for(let n=0;n<15;n++){const mid=(lo+hi)/2;if(actual(mid)<=test.design.targetWidth-.5)lo=mid;else hi=mid;}}
 undo.push(before);redo=[];p.design.scale=Math.floor(lo*10)/10;renderControls();await render();scheduleSave();
 toast(latestWidth<=p.design.targetWidth+1?`Fitted to ${Math.round(latestWidth)} px at ${p.design.scale}%.`:'The design is still too wide at minimum scale. Try stacked contact lines or a narrower layout.',latestWidth>p.design.targetWidth+1);
}
function allTemplates(){return [...TEMPLATES,...savedStyles.filter(t=>t&&t.id&&t.design).map(t=>({...t,category:'My styles',description:'Your saved layout, typography and color settings.'}))];}
function templateCard(t,small=false){
 const temp=applyTemplate(p,t,false);temp.design.scale=100;
 const thumb=renderSignature(temp,{origin});
 return `<div class="template-card ${p.templateId===t.id?'active':''}" role="button" tabindex="0" data-action="template" data-id="${esc(t.id)}" aria-label="Apply ${esc(t.name)}"><button class="favorite" data-action="favorite" data-id="${esc(t.id)}" aria-label="${favorites.includes(t.id)?'Unfavorite':'Favorite'} ${esc(t.name)}">${favorites.includes(t.id)?'★':'☆'}</button><div class="template-thumb"><div class="template-render" inert>${thumb}</div></div><div class="template-info"><strong>${esc(t.name)}</strong><span>${esc(small?t.category:t.description)}</span></div></div>`;
}
function fitThumbnails(root=document){requestAnimationFrame(()=>{for(const box of root.querySelectorAll('.template-thumb')){const content=box.firstElementChild,scale=Math.min((box.clientWidth-18)/content.offsetWidth,(box.clientHeight-18)/content.offsetHeight,1);content.style.transform=`translate(${(box.clientWidth-content.offsetWidth*scale)/2}px,${(box.clientHeight-content.offsetHeight*scale)/2}px) scale(${scale})`;}});}
function curated(){const ids=['atelier','masthead','private','residence','director','classic'];$('curatedTemplates').innerHTML=ids.map(id=>templateCard(TEMPLATES.find(t=>t.id===id),true)).join('');fitThumbnails($('curatedTemplates'));}
function openModal(title,body,wide=false){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').className=wide?'gallery-modal':'';if(!$('modal').open)$('modal').showModal();}
function gallery(){
 openModal('Find your signature.',`<p class="modal-note">From familiar business essentials to editorial, luxury and culture-led compositions. Your content remains intact when you choose a template.</p><div class="gallery-controls"><input id="templateSearch" type="search" placeholder="Search the collection…" value="${esc(gallerySearch)}" aria-label="Search templates"><select id="templateCategory" aria-label="Template category">${['All',...CATEGORIES,'Favorites','My styles'].map(c=>`<option${c===galleryFilter?' selected':''}>${c}</option>`).join('')}</select><label><input type="checkbox" id="keepBrand" ${keepBrand?'checked':''}> Keep my colors & fonts</label></div><span class="collection-count" id="collectionCount"></span><div class="gallery-grid" id="galleryGrid"></div>`,true);filterGallery();
}
function filterGallery(){let list=allTemplates();if(galleryFilter==='Favorites')list=list.filter(t=>favorites.includes(t.id));else if(galleryFilter!=='All')list=list.filter(t=>t.category===galleryFilter);if(gallerySearch.trim()){const q=gallerySearch.toLowerCase();list=list.filter(t=>(t.name+' '+t.category+' '+t.description).toLowerCase().includes(q));}$('collectionCount').textContent=`${list.length} design${list.length===1?'':'s'} · 36 included templates`;$('galleryGrid').innerHTML=list.length?list.map(t=>templateCard(t)).join(''):'<div class="empty-state">No matching templates. Try another category or save a style of your own.</div>';fitThumbnails($('galleryGrid'));}
function selectTemplate(id){const t=allTemplates().find(x=>x.id===id);if(!t)return;mutate(()=>{p=applyTemplate(p,t,keepBrand);},'',true);$('modal').close();curated();toast(t.name+' applied. Your contact details are unchanged.');}
function localProjects(){
 saveLocalNow();openModal('Your signature library',`<p class="modal-note">Browser projects save automatically here. Cloud projects are available after you sign in. Export a project backup before clearing browser data.</p><div class="pill-row"><button data-action="new-project">New signature +</button><button data-action="import-project">Import project</button><button data-action="cloud-projects">Browse cloud projects</button></div><div class="project-list">${library.projects.map(r=>`<div class="project-row"><div><strong>${esc(r.project?.name||'Untitled')}</strong><span>${r.id===activeId?'Current signature · ':''}Saved ${new Date(r.updatedAt).toLocaleDateString()}</span></div><div><button data-action="open-local" data-id="${r.id}">Open</button><button data-action="duplicate-local" data-id="${r.id}">Duplicate</button><button data-action="delete-local" data-id="${r.id}" class="danger">Delete</button></div></div>`).join('')}</div>`);
}
function loadProject(project,remote=null){saveLocalNow();p=normalizeProject(project);if(remote?.name)p.name=String(remote.name).slice(0,100);activeId=crypto.randomUUID();cloudId=remote?.id||null;cloudRevision=remote?.updated_at||null;cloudOwner=remote?cloud.user?.id:null;undo=[];redo=[];renderControls();render();saveLocalNow();curated();$('modal').close();}
function account(){
 $('accountButton').textContent=cloud.user?'Cloud connected':'Cloud account';
 if(cloud.user)openModal('Your cloud workspace',`<p class="modal-note">Signed in as <strong>${esc(cloud.user.email)}</strong>. Projects are private to this account; only artwork you explicitly publish is placed at public URLs.</p><div class="export-grid"><button data-action="cloud-save">Save current signature<span>Update the linked cloud project.</span></button><button data-action="cloud-save-new">Save as a new project<span>Keep the original cloud project unchanged.</span></button><button data-action="cloud-projects">Open cloud projects<span>Load, duplicate or delete saved designs.</span></button><button data-action="publish-images">Publish email artwork<span>Make only the current processed images accessible for email.</span></button></div><button data-action="signout">Sign out</button><div id="modalMessage" class="modal-message" role="status"></div>`);
 else openModal('Save your work across devices',`<p class="modal-note">Local editing works without an account. Sign in to save private projects and publish the artwork used in your email signature.</p><form id="authForm" class="account-form"><div class="field"><label for="authEmail">Email</label><input id="authEmail" type="email" autocomplete="email" required></div><div class="field"><label for="authPassword">Password</label><input id="authPassword" type="password" autocomplete="current-password" minlength="6" required></div><div class="row-end"><button type="button" data-action="signup">Create account</button><button type="submit" class="primary">Sign in</button></div></form><div id="modalMessage" class="modal-message" role="status"></div>`);
}
async function authenticate(signup=false){const email=$('authEmail')?.value.trim(),password=$('authPassword')?.value;if(!email||!password)return message('Enter your email and password.');message(signup?'Creating your account…':'Signing in…');try{if(signup){const result=await cloud.signUp(email,password);if(result?.access_token){cloud.keep(result);account();}else message('Check your email for account confirmation, then return to sign in.');}else{await cloud.signIn(email,password);account();toast('Signed in.');}$('accountButton').textContent=cloud.user?'Cloud connected':'Cloud account';}catch(e){message(e.message);}}
async function saveCloud(asNew=false){
 if(!cloud.user){account();return;}if(cloudBusy)return;cloudBusy=true;const savingId=activeId;
 try{message('Saving to the cloud…');const owned=cloudOwner===cloud.user.id,row=await cloud.save(clone(p),asNew||!owned?null:cloudId,asNew||!owned?null:cloudRevision);if(savingId!==activeId){const original=library.projects.find(x=>x.id===savingId);if(original){original.cloudId=row.id;original.cloudRevision=row.updated_at;original.cloudOwner=cloud.user.id;}saveLocalNow();toast('The previous signature was saved to the cloud.');return;}cloudId=row.id;cloudRevision=row.updated_at;cloudOwner=cloud.user.id;saveLocalNow();message('Saved to the cloud.');toast(asNew?'Saved as a new cloud project.':'Cloud project saved.');}catch(e){message(e.message);toast(e.message,true);}finally{cloudBusy=false;}
}
async function cloudProjects(){
 if(!cloud.user){account();return;}
 try{const list=await cloud.list();openModal('Cloud signatures',`<p class="modal-note">These projects belong to ${esc(cloud.user.email)}. Opening an older project upgrades its design format locally; the cloud copy changes only when you save.</p><div class="project-list">${list.length?list.map(r=>`<div class="project-row"><div><strong>${esc(r.name)}</strong><span>Updated ${new Date(r.updated_at).toLocaleString()}</span></div><div><button data-action="open-cloud" data-id="${r.id}">Open</button><button data-action="duplicate-cloud" data-id="${r.id}">Duplicate</button><button data-action="delete-cloud" data-id="${r.id}" class="danger">Delete</button></div></div>`).join(''):'<div class="empty-state">No cloud signatures yet. Save your current design to begin.</div>'}</div><div id="modalMessage" class="modal-message"></div>`);window.__cloudRows=list;}catch(e){toast(e.message,true);}
}
function download(name,data,type){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const filename=()=>p.name.replace(/[^a-z\d_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'signature';
async function exportHTML(){await renderPromise;download(filename()+'.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title></head><body>${latestHTML}</body></html>`,'text/html');toast(/src="data:/.test(latestHTML)?'Portable HTML exported. Publish its local artwork before installing in Gmail.':'HTML signature exported.');}
async function exportPNG(){await renderPromise;toast('Rendering a 2× PNG…');try{const blob=await signaturePNG(latestHTML,Math.ceil(latestWidth),Math.ceil(latestHeight));download(filename()+'@2x.png',blob);toast('2× PNG exported. The HTML version keeps links clickable.');}catch(e){toast(e.message||'PNG export failed. Try uploading remote images directly.',true);}}
function exportJSON(){download(filename()+'.json',JSON.stringify({kind:'signature-studio-project',version:2,project:p},null,2),'application/json');toast('Editable project backup exported.');}
async function copyRich(){
 await renderPromise;if(prepared.errors.length)throw new Error('Fix the image-processing warnings before copying your signature.');if(/src="data:/i.test(latestHTML)){install();throw new Error('Publish your local artwork first, or download portable HTML.');}
 const holder=document.createElement('div');holder.innerHTML=latestHTML;const text=holder.innerText||holder.textContent;
 try{if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error('Clipboard unavailable');await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([latestHTML],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);}
 catch{holder.style.cssText='position:fixed;left:-10000px;top:0';document.body.appendChild(holder);const range=document.createRange();range.selectNodeContents(holder);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);const ok=document.execCommand('copy');selection.removeAllRanges();holder.remove();if(!ok)throw new Error('Automatic copying was blocked. Download HTML, open it in a browser, then select and copy the rendered signature.');}
 toast('Formatted signature copied. Paste it into Gmail’s signature editor.');if($('installCopied'))$('installCopied').textContent='Copied successfully — ready to paste.';return true;
}
async function publishImages(){
 if(!cloud.user){account();throw new Error('Sign in to publish signature artwork.');}await renderPromise;
 if(prepared.errors.length)throw new Error('Fix the image-processing warnings before publishing artwork.');
 const toUpload=Object.entries(prepared.images).filter(([,src])=>src.startsWith('data:'));
 if(!toUpload.length){toast('The current signature already uses hosted artwork.');return;}
 if(!confirm(`Publish ${toUpload.length} processed image(s) for email? Anyone with the image URLs can view them. Your project and source details remain private.`))return;
 for(const [slot,src] of toUpload){const key=prepared.keys[slot];const url=await cloud.upload(src,key);p.publishedAssets[key]=url;}
 await render();scheduleSave();toast('Email artwork published. Earlier exported image URLs remain unchanged.');if($('modalTitle').textContent==='Your signature, everywhere.')install();
}
function install(){
 const local=/src="data:/i.test(latestHTML),direct=!!config.enableDirectGmail&&!!config.googleClientId;
 openModal('Your signature, everywhere.',`<p class="modal-note">The export uses your actual type sizes, layout, spacing and cropped artwork. The workspace controls never become part of the signature.</p><div class="export-grid"><button data-action="export-html">HTML signature<span>Portable, editable email markup.</span></button><button data-action="export-png">2× PNG image<span>High-resolution visual; links are not clickable.</span></button><button data-action="export-json">Project JSON<span>Resume editing or transfer to another browser.</span></button><button data-action="copy-source">Copy HTML source<span>For developers and signature management tools.</span></button></div><h3>Install in Gmail</h3>${local?'<div class="highlight">Your signature contains local artwork. Publish the processed images before copying it to Gmail.</div><button data-action="publish-images">Publish email artwork</button>':''}<div class="step"><b>1</b><div><strong>Copy the formatted signature</strong><p>Use the rendered HTML, not an image or raw source code.</p><button data-action="copy-rich" class="primary">Copy formatted signature</button><p id="installCopied"></p></div></div><div class="step"><b>2</b><div><strong>Open Gmail settings</strong><p>Under General → Signature, create a signature or select an existing one.</p><a class="button" href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a></div></div><div class="step"><b>3</b><div><strong>Paste, choose defaults and save</strong><p>Paste into the signature box. Choose defaults for new emails and replies, then select Save Changes. Send yourself a test email.</p></div></div><details><summary>Direct Gmail installation</summary><p class="micro">${direct?'Google authorization is configured. You will review the detected address before replacing its signature.':'Direct installation remains disabled until the site’s Google OAuth client is configured. Guided installation above needs no Gmail permissions.'}</p><button data-action="direct-gmail" ${direct?'':'disabled'}>Connect Gmail</button></details><div id="modalMessage" class="modal-message"></div>`);
}
async function directGmail(){
 if(!config.enableDirectGmail||!config.googleClientId)throw new Error('Direct Gmail installation is not configured.');
 await renderPromise;if(/src="data:/i.test(latestHTML))throw new Error('Publish local artwork before direct installation.');if(prepared.errors.length)throw new Error('Fix image-processing warnings first.');
 if(!window.google?.accounts?.oauth2){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>reject(new Error('Google sign-in did not load. Use Guided Install.'));document.head.appendChild(s);});}
 const response=await new Promise((resolve,reject)=>google.accounts.oauth2.initTokenClient({client_id:config.googleClientId,scope:'https://www.googleapis.com/auth/gmail.settings.basic',callback:r=>r.error?reject(new Error(r.error)):resolve(r),error_callback:e=>reject(new Error(e.type||'Google sign-in was closed.'))}).requestAccessToken());
 const headers={Authorization:'Bearer '+response.access_token,'Content-Type':'application/json'},base='https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs';
 const listed=await fetch(base,{headers});if(!listed.ok)throw new Error('Gmail could not return your sending address.');const aliases=await listed.json(),primary=aliases.sendAs?.find(a=>a.isPrimary);if(!primary)throw new Error('No primary Gmail address was returned.');
 if(!confirm(`Replace the current Gmail signature for ${primary.sendAsEmail}? This changes that address’s signature; it does not send an email.`))return;
 const installed=await fetch(base+'/'+encodeURIComponent(primary.sendAsEmail),{method:'PATCH',headers,body:JSON.stringify({signature:latestHTML})});if(!installed.ok){const error=await installed.json();throw new Error(error.error?.message||'Gmail rejected the signature.');}
 message('Signature installed for '+primary.sendAsEmail+'. Send yourself a test email.');
}
function saveStyle(){openModal('Save your signature style',`<p class="modal-note">Save this layout, spacing, typography and color palette to My styles. Applying it later will not replace contact details or uploaded imagery.</p><div class="field"><label for="styleName">Style name</label><input id="styleName" maxlength="80" value="${esc(p.name+' style')}"></div><div class="row-end"><button data-action="confirm-style" class="primary">Save style</button></div>`);}
function brandKit(){const keys=['primary','secondary','link','accent','tint','background','nameFont','bodyFont','ctaColor','ctaText'],brand={};for(const k of keys)brand[k]=p.design[k];download('signature-brand-kit.json',JSON.stringify({kind:'signature-brand-kit',version:1,brand},null,2),'application/json');toast('Brand palette and font pairing exported.');}
function move(collection,index,dir){const to=index+dir;if(to<0||to>=collection.length)return;[collection[index],collection[to]]=[collection[to],collection[index]];}
const actions={
 'gallery':gallery,'projects':localProjects,'account':account,'install':install,'undo':()=>history('undo'),'redo':()=>history('redo'),
 'close-modal':()=>$('modal').close(),'template':b=>selectTemplate(b.dataset.id),
 'favorite':b=>{const id=b.dataset.id;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];try{localStorage.setItem(FAV_STORE,JSON.stringify(favorites));}catch{}if($('galleryGrid'))filterGallery();curated();},
 'full':()=>mutate(x=>x.variant='full','',true),'reply':()=>mutate(x=>x.variant='reply','',true),
 'density':b=>mutate(x=>{Object.assign(x.design,b.dataset.value==='compact'?{padding:6,gap:14,sectionGap:7,contactGap:2}:b.dataset.value==='airy'?{padding:24,gap:32,sectionGap:18,contactGap:7}:{padding:12,gap:24,sectionGap:12,contactGap:5});},'',true),
 'palette':b=>mutate(x=>{const a=PALETTES[+b.dataset.index];['primary','secondary','accent','tint','background'].forEach((k,n)=>x.design[k]=a[n+1]);x.design.link=a[3];x.design.ctaColor=a[3];x.design.transparent=false;},'',true),
 'autofit':()=>autoFit(),'mobile-fit':()=>autoFit(360),
 'upload-image':b=>{pendingImage={slot:b.dataset.slot,activeId};$('imageInput').value='';$('imageInput').click();},
 'remove-image':b=>mutate(x=>x.assets[b.dataset.slot].src='','',true),
 'reset-crop':b=>mutate(x=>Object.assign(x.assets[b.dataset.slot],{zoom:100,x:0,y:0}),'',true),
 'upload-social':b=>{pendingImage={index:+b.dataset.index,activeId};$('imageInput').value='';$('imageInput').click();},
 'clear-social':b=>mutate(x=>x.socials[+b.dataset.index].customIcon='','',true),
 'move-social':b=>mutate(x=>move(x.socials,+b.dataset.index,+b.dataset.dir),'',true),
 'delete-social':b=>mutate(x=>x.socials.splice(+b.dataset.index,1),'',true),
 'add-social':()=>{if(p.socials.length>=20)return toast('A signature can contain up to 20 social links.',true);const id=$('networkSelect').value,label=NETWORKS.find(n=>n[0]===id)[1];mutate(x=>x.socials.push({id,label,url:'',enabled:true,customIcon:''}),'',true);},
 'move-section':b=>mutate(x=>move(x.sections,+b.dataset.index,+b.dataset.dir),'',true),
 'add-extra':()=>{if(p.extras.length>=12)return toast('Up to 12 custom fields are supported.',true);mutate(x=>x.extras.push({label:'',value:'',url:'',enabled:true}),'',true);},
 'remove-extra':b=>mutate(x=>x.extras.splice(+b.dataset.index,1),'',true),
 'export-html':exportHTML,'export-png':exportPNG,'export-json':exportJSON,'export-brand':brandKit,
 'import-project':()=>{$('projectInput').value='';$('projectInput').click();},'import-brand':()=>{$('brandInput').value='';$('brandInput').click();},
 'save-template':saveStyle,'confirm-style':()=>{const name=$('styleName').value.trim();if(!name)return toast('Give your style a name.',true);const style={id:'style-'+crypto.randomUUID(),name,design:clone(p.design),layout:p.design.layout};savedStyles.push(style);try{localStorage.setItem(STYLE_STORE,JSON.stringify(savedStyles));}catch{return toast('Browser storage is full. Export a project backup instead.',true);}$('modal').close();toast('Saved to My styles in the template collection.');},
 'new-project':()=>{loadProject(freshProject());toast('New signature created.');},
 'open-local':b=>{const r=library.projects.find(x=>x.id===b.dataset.id);if(!r)return;saveLocalNow();p=normalizeProject(r.project);activeId=r.id;cloudId=r.cloudId||null;cloudRevision=r.cloudRevision||null;cloudOwner=r.cloudOwner||null;undo=[];redo=[];renderControls();render();curated();saveLocalNow();$('modal').close();},
 'duplicate-local':b=>{const r=library.projects.find(x=>x.id===b.dataset.id);if(r){const copy=normalizeProject(r.project);copy.name+=' · Copy';loadProject(copy);toast('Independent project copy created.');}},
 'delete-local':b=>{if(!confirm('Delete this browser project? Cloud copies are not deleted.'))return;library.projects=library.projects.filter(r=>r.id!==b.dataset.id);if(activeId===b.dataset.id){p=freshProject();activeId=crypto.randomUUID();cloudId=null;cloudRevision=null;cloudOwner=null;renderControls();render();}saveLocalNow();localProjects();},
 'signup':()=>authenticate(true),'signout':async()=>{await cloud.signOut();cloudId=null;cloudRevision=null;cloudOwner=null;saveLocalNow();account();},
 'cloud-save':()=>saveCloud(false),'cloud-save-new':()=>saveCloud(true),'cloud-projects':cloudProjects,
 'open-cloud':b=>{const row=window.__cloudRows?.find(r=>r.id===b.dataset.id);if(row)loadProject(row.data,row);},
 'duplicate-cloud':async b=>{const row=window.__cloudRows?.find(r=>r.id===b.dataset.id);if(row){const copy=normalizeProject(row.data);copy.name=row.name+' · Copy';loadProject(copy);await saveCloud(true);}},
 'delete-cloud':async b=>{if(!confirm('Delete this cloud project? Published images and browser copies will remain.'))return;await cloud.remove(b.dataset.id);if(cloudId===b.dataset.id){cloudId=null;cloudRevision=null;cloudOwner=null;saveLocalNow();}await cloudProjects();},
 'publish-images':publishImages,'copy-rich':copyRich,'direct-gmail':directGmail,
 'copy-source':async()=>{await renderPromise;await navigator.clipboard.writeText(latestHTML);toast('HTML source copied. Paste rendered HTML, not source, into Gmail.');}
};
document.addEventListener('click',async e=>{
 if(e.target.closest('#signaturePreview a')){e.preventDefault();return;}
 const nav=e.target.closest('[data-panel]');if(nav){panel=nav.dataset.panel;renderControls();return;}
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=actions[b.dataset.action];if(!action)return;e.preventDefault();e.stopPropagation();try{await action(b);}catch(error){message(error.message||'This action could not be completed.');toast(error.message||'This action could not be completed.',true);}
});
document.addEventListener('input',e=>{
 const el=e.target;if(el.dataset.path){
  if(el.type==='checkbox'||el.tagName==='SELECT')return;
  if(el.dataset.color&&!/^#[\da-f]{6}$/i.test(el.value))return;
  const path=el.dataset.path,value=['range','number'].includes(el.type)?Number(el.value):el.value;
  mutate(()=>set(path,value),path);
 }else if(el.id==='templateSearch'){gallerySearch=el.value;filterGallery();}
});
document.addEventListener('change',e=>{
 const el=e.target;if(el.dataset.path&&(el.type==='checkbox'||el.tagName==='SELECT'))mutate(()=>set(el.dataset.path,el.type==='checkbox'?el.checked:el.value),el.dataset.path);
 if(el.id==='templateCategory'){galleryFilter=el.value;filterGallery();}if(el.id==='keepBrand')keepBrand=el.checked;
 if(el.id==='environment')$('stage').className='stage '+(el.value==='light'?'':el.value);
 if(el.id==='viewportWidth'){$('emailCard').style.maxWidth=el.value==='mobile'?'360px':'800px';}
 if(el.id==='viewZoom'){viewZoom=+el.value;updatePreview(latestHTML,prepared.errors);}
});
document.addEventListener('submit',e=>{if(e.target.id==='authForm'){e.preventDefault();authenticate(false);}});
document.addEventListener('keydown',e=>{
 const typing=e.target.closest('input,textarea,select,[contenteditable]');
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveLocalNow();toast('Saved in this browser. Use Save to cloud for cross-device access.');}
 if(!typing&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');}
 if(!typing&&(e.key==='Enter'||e.key===' ')&&e.target.matches('.template-card')){e.preventDefault();selectTemplate(e.target.dataset.id);}
});
$('imageInput').onchange=async e=>{const file=e.target.files[0],target=pendingImage;if(!file||!target)return;try{toast('Preparing artwork…');const src=await readImage(file);if(target.activeId!==activeId)return toast('The project changed. Upload the artwork again to the current project.',true);mutate(x=>{if(target.slot)x.assets[target.slot].src=src;else if(x.socials[target.index])x.socials[target.index].customIcon=src;},'',true);toast('Artwork added. Cropping and zoom are editable in Images.');}catch(error){toast(error.message,true);}};
$('projectInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20e6)throw new Error('Project files must be under 20 MB.');const parsed=JSON.parse(await file.text());loadProject(parsed);toast('Project imported as a new browser signature.');}catch(error){toast('Could not import this project. '+error.message,true);}};
$('brandInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('This file is too large for a brand kit.');const data=JSON.parse(await file.text());if(data.kind!=='signature-brand-kit'||!data.brand)throw new Error('Choose a Signature Studio brand kit.');const keys=['primary','secondary','link','accent','tint','background','nameFont','bodyFont','ctaColor','ctaText'];mutate(x=>{for(const k of keys)if(data.brand[k]!==undefined)x.design[k]=data.brand[k];},'',true);toast('Brand palette and font pairing applied.');}catch(error){toast(error.message,true);}};
window.addEventListener('beforeunload',saveLocalNow);window.addEventListener('resize',()=>fitThumbnails());
// A small public inspection surface powers regression tests without exposing cloud sessions.
window.signatureStudio={getProject:()=>clone(p),render:renderSignature,templates:TEMPLATES,apply:id=>selectTemplate(id),autoFit,ready:()=>renderPromise,html:()=>latestHTML,measure:()=>({width:latestWidth,height:latestHeight})};
renderControls();render();curated();scheduleSave();cloud.restore().then(()=>$('accountButton').textContent=cloud.user?'Cloud connected':'Cloud account');
