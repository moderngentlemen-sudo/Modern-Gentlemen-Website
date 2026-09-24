import {TEMPLATES,PALETTES,FONTS,NETWORKS,SECTION_LABELS} from '../design/catalog.mjs';
import {esc,safeImage} from '../design/engine.mjs';
import {inspector as blockInspector} from '../blocks/inspector.mjs';
import {designProject} from './model.mjs';
let p,panel,fieldSerial=0;const origin=location.origin;
const get=path=>path.split('.').reduce((o,k)=>o?.[k],p);
function field(path,label,type='text',options=null,visibility=''){
 const rawValue=get(path),value=type==='url'&&String(rawValue||'').startsWith('data:')?'':rawValue,id='u-'+(++fieldSerial)+'-'+path.replaceAll('.','-');
 let control;if(type==='select')control=`<select id="${id}" data-u-path="${path}">${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${String(v)===String(value)?' selected':''}>${esc(l)}</option>`;}).join('')}</select>`;
 else if(type==='range')control=`<input id="${id}" data-u-path="${path}" type="range" min="${options[0]}" max="${options[1]}" step="${options[2]||1}" value="${esc(value)}">`;
 else if(type==='textarea')control=`<textarea id="${id}" data-u-path="${path}" rows="3">${esc(value)}</textarea>`;
 else if(type==='color')control=`<div class="color-input"><input type="color" aria-label="${esc(label)} color picker" data-u-path="${path}" value="${esc(value)}"><input id="${id}" type="text" aria-label="${esc(label)} hexadecimal color" data-u-path="${path}" data-color="true" value="${esc(value)}" maxlength="7"></div>`;
 else control=`<input id="${id}" data-u-path="${path}" type="${type}" value="${esc(value)}" ${type==='url'?'placeholder="https://…"':''}>`;
 return `<div class="field"><div class="field-head"><label for="${id}">${esc(label)}</label>${type==='range'?`<output data-output="${path}">${esc(value)}</output>`:''}${visibility?`<input class="visibility" type="checkbox" data-u-path="visible.${visibility}" aria-label="Show ${esc(label)}" title="Show ${esc(label)}" ${p.visible[visibility]?'checked':''}>`:''}</div>${control}</div>`;
}
const check=(path,label)=>`<label class="switch-row"><input type="checkbox" data-u-path="${path}" ${get(path)?'checked':''}>${esc(label)}</label>`;
const section=(title,body)=>`<section class="control-section"><h3>${title}</h3>${body}</section>`;
const two=(...fields)=>`<div class="two-col">${fields.join('')}</div>`;
const D=(key,label,type='range',options=[0,50])=>field('design.'+key,label,type,options);
export function globalControls(doc,which){
 p=designProject(doc);panel=which;
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
  html=section('Structure',D('layout','Composition','select',layouts)+D('align','Alignment','select',[['left','Left'],['center','Center'],['right','Right']])+D('contactLayout','Contact arrangement','select',[['stacked','Stacked lines'],['inline','Single row'],['columns','Two columns']])+D('contactLabels','Contact labels','select',[['none','None'],['short','T / E / W'],['full','Phone / Email / Website']])+D('separator','Inline separator','select',[['','None'],[' · ','Middle dot'],[' | ','Vertical bar'],[' / ','Slash'],[' — ','Em dash']]))+
  section('Density','<div class="pill-row"><button data-u-action="density" data-value="compact">Compact</button><button data-u-action="density" data-value="balanced">Balanced</button><button data-u-action="density" data-value="airy">Airy</button></div>'+D('padding','Outer padding · px','range',[0,50])+D('gap','Column gap · px','range',[4,64])+D('sectionGap','Section spacing · px','range',[2,36])+D('contactGap','Contact line gap · px','range',[0,20]))+
  section('Fit & scale',D('baseWidth','Design width · px','range',[240,900,10])+D('scale','Export scale · %','range',[30,150,.1])+D('targetWidth','Fit target · px','range',[280,1000,10])+check('design.nowrap','Keep individual text lines unbroken')+'<div class="mini-actions"><button data-u-action="autofit">Auto-fit</button><button data-u-action="mobile-fit">Fit to 360 px</button></div><p class="micro">No-wrap can overflow at large sizes. Auto-fit scales real HTML dimensions, not just the preview.</p>')+
  section('Frames & rules',D('border','Frame stroke · px','range',[0,5,.5])+D('borderStyle','Line style','select',['solid','dashed','dotted'])+D('radius','Frame corner radius · px','range',[0,30])+D('ruleWidth','Rule stroke · px','range',[.5,5,.5])+D('ruleLength','Rule length · %','range',[15,100]));
 }
 if(panel==='visibility'){
  const show=(path,label)=>check(path,label);
  const sectionRows=p.sections.map((s,index)=>`<div class="order-row"><input type="checkbox" data-u-path="sections.${index}.enabled" aria-label="Show ${SECTION_LABELS[s.type]}" ${s.enabled?'checked':''}><span>${SECTION_LABELS[s.type]}</span><div class="mini-actions"><button data-u-action="move-section" data-index="${index}" data-dir="-1" aria-label="Move ${SECTION_LABELS[s.type]} up" ${index===0?'disabled':''}>↑</button><button data-u-action="move-section" data-index="${index}" data-dir="1" aria-label="Move ${SECTION_LABELS[s.type]} down" ${index===p.sections.length-1?'disabled':''}>↓</button></div></div>`).join('');
  html=section('Identity elements',
    '<div class="mini-actions"><button data-u-action="visibility-preset" data-group="identity" data-value="show">Show all</button><button data-u-action="visibility-preset" data-group="identity" data-value="hide">Hide all</button></div>'+
    [['name','Full name'],['title','Title / role'],['company','Company'],['kicker','Eyebrow / overline'],['pronouns','Pronouns'],['department','Department / team']].map(([k,l])=>show('visible.'+k,l)).join('')
  )+
  section('Contact elements',
    '<div class="mini-actions"><button data-u-action="visibility-preset" data-group="contact" data-value="show">Show all</button><button data-u-action="visibility-preset" data-group="contact" data-value="hide">Hide all</button></div>'+
    [['email','Email'],['phone','Phone'],['mobile','Mobile'],['website','Website'],['address','Address'],['availability','Availability / timezone']].map(([k,l])=>show('visible.'+k,l)).join('')
  )+
  section('Artwork',
    '<div class="mini-actions"><button data-u-action="visibility-preset" data-group="artwork" data-value="show">Show all</button><button data-u-action="visibility-preset" data-group="artwork" data-value="hide">Hide all</button></div>'+
    show('design.showLogo','Primary logo')+show('design.showPortrait','Portrait / headshot')+show('design.showPartner','Partner logo')
  )+
  section('Signature sections',
    '<div class="mini-actions"><button data-u-action="visibility-preset" data-group="sections" data-value="show">Show all</button><button data-u-action="visibility-preset" data-group="sections" data-value="hide">Hide all</button></div>'+sectionRows+
    '<p class="micro">Empty sections do not add spacing. Select any block on the canvas for Full & reply, Full only, Reply only, or Hidden visibility.</p>'
  );
 }
 if(panel==='color')html=section('Curated palettes',`<div class="palette-grid">${PALETTES.map((a,index)=>`<button class="palette" data-u-action="palette" data-index="${index}"><span class="palette-swatches">${a.slice(1).map(h=>`<i style="background:${h}"></i>`).join('')}</span>${a[0]}</button>`).join('')}</div>`)+section('Your palette',two(D('primary','Primary text','color'),D('secondary','Secondary text','color'))+two(D('link','Links','color'),D('accent','Rules & icons','color'))+two(D('tint','Panel tint','color'),D('background','Background','color'))+check('design.transparent','Transparent signature background'))+section('Reusable brand kit','<div class="mini-actions"><button data-u-action="export-brand">Export brand kit</button><button data-u-action="import-brand">Import brand kit</button><button data-u-action="save-template">Save as template</button></div><p class="micro">Brand kits contain your palette and font pairing. Templates additionally preserve layout and spacing. Saved styles stay in this browser.</p>');
 if(panel==='images'){
  html=Object.entries(p.assets).map(([slot,a])=>{
   const label={logo:'Primary logo',portrait:'Portrait / headshot',partner:'Partner logo',banner:'Image banner'}[slot],size=slot==='logo'?'logoWidth':slot==='portrait'?'portraitWidth':slot==='partner'?'partnerWidth':'bannerWidth',max=slot==='banner'?820:190;
   return section(label,`<div class="asset-card"><div class="asset-summary">${a.src?`<img src="${esc(safeImage(a.src,origin))}" alt="${esc(label)}">`:'<span class="avatar-dot">＋</span>'}<div><strong>${label}</strong><span>${a.src?'Artwork loaded':'No artwork selected'}</span></div></div><div class="mini-actions"><button data-u-action="upload-image" data-slot="${slot}">Upload artwork</button><button data-u-action="remove-image" data-slot="${slot}">Remove</button></div>${field('assets.'+slot+'.src','Or use an image URL','url')}${field('assets.'+slot+'.alt','Accessible alt text')}${field('assets.'+slot+'.link','Image click-through URL','url')}${D(size,'Displayed width · px','range',[slot==='banner'?180:24,max])}${slot==='banner'?D('bannerHeight','Banner height · px','range',[36,220]):''}${field('assets.'+slot+'.zoom','Zoom · %','range',[50,300])}${field('assets.'+slot+'.fit','Image fitting','select',[['contain','Contain entire image'],['cover','Fill / crop frame']])}<details><summary>Crop & position</summary>${field('assets.'+slot+'.x','Horizontal position','range',[-100,100])}${field('assets.'+slot+'.y','Vertical position','range',[-100,100])}<button data-u-action="reset-crop" data-slot="${slot}">Reset crop</button></details></div>`);
  }).join('')+section('Image styling',D('logoShape','Logo shape','select',['square','rounded','circle'])+D('portraitShape','Portrait shape','select',['square','rounded','circle'])+D('imageBackground','Logo frame background','color')+D('bannerRadius','Banner corner radius','range',[0,30])+check('design.showLogo','Show primary logo')+check('design.showPortrait','Show portrait in portrait layouts')+check('design.showPartner','Show partner in co-brand layouts')+'<p class="micro">Upload PNG, JPEG, WebP or SVG. Crops and zoom are rasterized into the exported artwork. Remote URLs must permit image processing; uploading a file is most reliable.</p>');
 }
 if(panel==='social')html=section('Icon design',D('iconStyle','Treatment','select',[['bare','Bare graphic marks'],['circle','Filled circles'],['outline','Outlined circles'],['tile','Rounded tiles'],['text','Platform names'],['letter','Lettermarks']])+D('iconSize','Icon size · px','range',[16,46])+D('iconGap','Icon spacing · px','range',[2,22])+D('iconInk','Graphic ink','select',[['auto','Automatic'],['dark','Dark'],['light','Light']]))+
 section('Your channels',p.socials.map((s,index)=>`<div class="social-card"><div class="social-header"><input type="checkbox" data-u-path="socials.${index}.enabled" aria-label="Show ${esc(s.label)}" ${s.enabled?'checked':''}><strong>${esc(s.label)}</strong><div class="mini-actions"><button data-u-action="move-social" data-index="${index}" data-dir="-1" aria-label="Move ${esc(s.label)} up" ${index===0?'disabled':''}>↑</button><button data-u-action="move-social" data-index="${index}" data-dir="1" aria-label="Move ${esc(s.label)} down" ${index===p.socials.length-1?'disabled':''}>↓</button><button data-u-action="delete-social" data-index="${index}" aria-label="Remove ${esc(s.label)}">×</button></div></div>${field('socials.'+index+'.url','Profile URL','url')}${field('socials.'+index+'.label','Accessible label')}<div class="mini-actions"><button data-u-action="upload-social" data-index="${index}">Custom artwork</button>${s.customIcon?`<button data-u-action="clear-social" data-index="${index}">Use standard mark</button>`:''}</div></div>`).join('')+`<div class="field"><label for="networkSelect">Add a channel</label><select id="networkSelect">${NETWORKS.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></div><button data-u-action="add-social" class="full">Add channel +</button><p class="micro">Channels without a valid URL are omitted from exports. Custom links may be repeated for additional destinations.</p>`);
 if(panel==='blocks')html=section('Calls to action',field('content.ctaLabel','Primary button label')+field('content.ctaUrl','Primary destination','url')+field('content.cta2Label','Secondary button label')+field('content.cta2Url','Secondary destination','url')+D('ctaStyle','Button style','select',['outline','filled','text'])+two(D('ctaColor','Button color','color'),D('ctaText','Filled-button text','color'))+D('ctaSize','Button type · px','range',[9,18])+D('ctaPadding','Button padding · px','range',[4,20])+D('ctaRadius','Button corner radius · px','range',[0,24]))+
 section('Announcement',field('content.announcementTitle','Headline')+field('content.announcementText','Supporting text','textarea')+field('content.announcementUrl','Announcement link','url'))+
 section('Custom fields',p.extras.map((e,index)=>`<div class="extra-card">${check('extras.'+index+'.enabled','Show field')}${field('extras.'+index+'.label','Label')}${field('extras.'+index+'.value','Value')}${field('extras.'+index+'.url','Optional destination','url')}<button data-u-action="remove-extra" data-index="${index}">Remove field</button></div>`).join('')+'<button class="full" data-u-action="add-extra">Add custom field +</button><p class="micro">Use these for credentials, licensing details, portfolio links or a preferred contact method.</p>')+
 section('Personal note',field('content.note','Closing note / quotation','textarea'))+section('Disclaimer',field('content.disclaimer','Your own legal or confidentiality text','textarea')+'<p class="micro">No legal language is added automatically. Review any disclaimer before using it.</p>');
 if(panel==='order')html=section('Visible sections',p.sections.map((s,index)=>`<div class="order-row"><input type="checkbox" data-u-path="sections.${index}.enabled" aria-label="Show ${SECTION_LABELS[s.type]}" ${s.enabled?'checked':''}><span>${SECTION_LABELS[s.type]}</span><div class="mini-actions"><button data-u-action="move-section" data-index="${index}" data-dir="-1" aria-label="Move ${SECTION_LABELS[s.type]} up" ${index===0?'disabled':''}>↑</button><button data-u-action="move-section" data-index="${index}" data-dir="1" aria-label="Move ${SECTION_LABELS[s.type]} down" ${index===p.sections.length-1?'disabled':''}>↓</button></div></div>`).join('')+'<p class="micro">Empty sections never add space. Split, banner-led and social-first layouts intentionally pin those specific modules to their structural positions.</p>')+section('Collection','<button class="full primary" data-u-action="gallery">Browse all 36 templates ↗</button><p class="micro">Try a different composition without replacing your identity or contact information.</p>');
 return html;
}

export function inspect(doc,node,mode){
 if(mode==='document')return '<div class="scope-label">WHOLE SIGNATURE</div><h2 class="inspector-heading">Design settings</h2><p class="inspector-sub">These settings apply to your template and all inheriting blocks.</p>'+globalControls(doc,'type')+globalControls(doc,'layout')+globalControls(doc,'color');
 if(mode==='profile')return '<div class="scope-label">SHARED PROFILE</div>'+globalControls(doc,'content');
 if(!node)return '<div class="empty"><span class="scope-label">ONE CONNECTED WORKSPACE</span><h2 class="inspector-heading">Select something.<br>Make it yours.</h2><p>Click any element to edit it here. Use the left rail to change your template, add blocks, or style the whole signature.</p><button data-u-action="nav" data-panel="templates">Explore templates</button><button data-u-action="nav" data-panel="blocks">Add a block</button></div>';
 if(node.type==='template'){
  const old=node.props.project,fake={...doc,identity:old.identity,design:old.design,designData:old};
  return '<div class="scope-label">IMPORTED SIGNATURE GROUP</div><h2 class="inspector-heading">'+esc(node.label)+'</h2><p class="inspector-sub">This additional signature keeps its original composition and independent details. Edit its fields here; the primary profile remains separate.</p>'+ (globalControls(fake,'content')+globalControls(fake,'type')).replaceAll('data-u-path=','data-node-project-path=');
 }
 let html=blockInspector(doc,node,'block');
 const scope='<div class="scope-label">SELECTED ELEMENT</div>';
 if(node.type!=='fragment')return scope+html;
 const part=node.props.part;
 let controls='';
 const pick=(which,titles)=>{const holder=document.createElement('div');holder.innerHTML=globalControls(doc,which);return [...holder.querySelectorAll(':scope > .control-section')].filter(e=>titles.includes(e.querySelector('h3')?.textContent)).map(e=>e.outerHTML).join('');};
 if(['identity','identity-no-company','name','title','company','kicker','pronouns','department','brand'].includes(part))controls=pick('content',['Identity','A little more']);
 if(part==='contact')controls=pick('content',['Contact information'])+pick('layout',['Structure']).replace(/<div class="field"><div class="field-head"><label[^>]*>Composition[\s\S]*?<\/select><\/div>/,'');
 if(part==='social')controls=globalControls(doc,'social');
 if(['logo','portrait','partner','banner'].includes(part))controls=pick('images',[{logo:'Primary logo',portrait:'Portrait / headshot',partner:'Partner logo',banner:'Image banner'}[part],'Image styling']);
 if(part==='cta')controls=pick('blocks',['Calls to action']);
 if(part==='announcement')controls=pick('blocks',['Announcement']);
 if(part==='note')controls=pick('blocks',['Personal note']);
 if(part==='disclaimer')controls=pick('blocks',['Disclaimer']);
 if(part==='custom')controls=pick('blocks',['Custom fields']);
 if(part==='tagline'){p=designProject(doc);controls=section('Tagline',field('identity.tagline','Tagline','textarea')+D('tagSize','Tagline size · px','range',[9,26]));}
 const intro='<p class="connected-hint">Connected to your signature. Edit content here or in the left panels; both update the same design.</p>';
 html=html.replace('<section class="control-section"><h3>Block styling</h3>',intro+controls+'<section class="control-section"><h3>Local style overrides</h3>');
 if(['identity','identity-no-company','contact'].includes(part))html=html.replace('<h3>Arrange & reuse</h3>','<h3>Arrange & reuse</h3><button data-u-action="ungroup-fragment">Separate into individual fields</button>');
 return scope+html.replace('fragment block · independent instance','Connected signature element');
}
