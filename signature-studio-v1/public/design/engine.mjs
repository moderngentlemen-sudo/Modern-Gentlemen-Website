import {BASE_DESIGN,FONTS,TEMPLATES,SECTIONS,freshProject,NETWORKS} from './catalog.mjs';

export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const clamp=(v,min,max,fallback=min)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function safeUrl(value,{email=false,phone=false}={}){
 const s=String(value||'').trim();if(!s||/[\u0000-\u001f\u007f]/.test(s))return '';
 if(email)return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s)?'mailto:'+s:'';
 if(phone){const p=s.replace(/[^+\d,;*#]/g,'');return /\d/.test(p)?'tel:'+p:'';}
 try{const url=new URL(/^[a-z][a-z\d+.-]*:/i.test(s)?s:'https://'+s);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function safeImage(src,origin='https://example.com'){
 const s=String(src||'');
 if(/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(s))return s;
 if(s.startsWith('/design/media/'))return new URL(s,origin).href;
 return safeUrl(s);
}
const TEXT_LIMIT=4000;
export function normalizeProject(input){
 let source=input?.project||input;if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('This is not a signature project.');
 const p=freshProject();
 if(source.schemaVersion===2){
  p.name=String(source.name||p.name).slice(0,100);p.templateId=String(source.templateId||p.templateId).slice(0,100);p.variant=source.variant==='reply'?'reply':'full';
  for(const key of Object.keys(p.identity))if(typeof source.identity?.[key]==='string')p.identity[key]=source.identity[key].slice(0,TEXT_LIMIT);
  for(const key of Object.keys(p.visible))if(typeof source.visible?.[key]==='boolean')p.visible[key]=source.visible[key];
  for(const key of Object.keys(BASE_DESIGN))if(source.design?.[key]!==undefined)p.design[key]=source.design[key];
  for(const slot of Object.keys(p.assets))for(const key of Object.keys(p.assets[slot]))if(source.assets?.[slot]?.[key]!==undefined)p.assets[slot][key]=source.assets[slot][key];
  if(Array.isArray(source.socials))p.socials=source.socials.slice(0,20).map((s,i)=>({id:NETWORKS.some(n=>n[0]===s.id)?s.id:'custom',label:String(s.label||s.id||'Link').slice(0,60),url:String(s.url||'').slice(0,2000),enabled:s.enabled!==false,customIcon:typeof s.customIcon==='string'?s.customIcon:''}));
  if(Array.isArray(source.sections)){const seen=new Set();p.sections=source.sections.filter(s=>SECTIONS.includes(s.type)&&!seen.has(s.type)&&seen.add(s.type)).map(s=>({type:s.type,enabled:s.enabled!==false}));for(const type of SECTIONS)if(!seen.has(type))p.sections.push({type,enabled:true});}
  for(const key of Object.keys(p.content))if(typeof source.content?.[key]==='string')p.content[key]=source.content[key].slice(0,TEXT_LIMIT);
  if(Array.isArray(source.extras))p.extras=source.extras.slice(0,12).map(e=>({label:String(e.label||'').slice(0,100),value:String(e.value||'').slice(0,500),url:String(e.url||'').slice(0,2000),enabled:e.enabled!==false}));
  if(source.publishedAssets&&typeof source.publishedAssets==='object')for(const [k,v] of Object.entries(source.publishedAssets).slice(0,40))if(/^https:\/\//.test(v))p.publishedAssets[k]=safeUrl(v);
 }else{
  // Import both prior hosted snapshots and the original downloadable studio format.
  const st=source.state||source;
  const map={name:'name',role:'title',title:'title',company:'company',tag:'tagline',tagline:'tagline',phone:'phone',email:'email',site:'website',website:'website',address:'address',pronouns:'pronouns'};
  for(const [old,key] of Object.entries(map))if(source[old]!==undefined)p.identity[key]=String(source[old]).slice(0,TEXT_LIMIT);
  if(source.projectName)p.name=String(source.projectName).slice(0,100);
  const dm={logoFrame:'logoWidth',nameSize:'nameSize',bodySize:'bodySize',scale:'scale',target:'targetWidth',gap:'gap',primaryColor:'primary',secondaryColor:'secondary',linkColor:'link',accentColor:'accent',iconSize:'iconSize',iconGap:'iconGap',logoShape:'logoShape'};
  for(const [old,key] of Object.entries(dm))if(source[old]!==undefined)p.design[key]=source[old];
  if(source.logoZoom!==undefined)p.assets.logo.zoom=source.logoZoom;
  if(typeof st.logo==='string')p.assets.logo.src=st.logo.startsWith('assets/')?'/design/media/mg-logo.png':st.logo;
  const tm={editorial:'classic',executive:'business',minimal:'text',luxury:'atelier',bordered:'divider',centered:'center',publisher:'publisher',creative:'director',corporate:'business',hospitality:'guest',reply:'reply',monogram:'micro'};
  p.templateId=tm[st.template]||'classic';p.design.layout=TEMPLATES.find(t=>t.id===p.templateId)?.layout||'horizontal';p.variant=st.mode==='reply'?'reply':'full';
  if(Array.isArray(st.socialOrder))p.socials=st.socialOrder.filter(id=>NETWORKS.some(n=>n[0]===id)).map(id=>({id,label:NETWORKS.find(n=>n[0]===id)[1],url:String(source['social_'+id]||source[id]||''),enabled:st.socialVisible?.[id]!==false,customIcon:st.socialIcons?.[id]||''}));
  else p.socials.forEach(s=>s.url=String(source[s.id]||''));
  p.content.ctaUrl=String(source.booking||'');
 }
 const ranges={baseWidth:[240,900],targetWidth:[280,1000],scale:[30,150],nameSize:[12,46],roleSize:[9,24],bodySize:[9,22],tagSize:[9,26],nameWeight:[400,800],tracking:[-1,5],lineHeight:[1.1,2],padding:[0,50],gap:[4,64],sectionGap:[2,36],contactGap:[0,20],border:[0,5],radius:[0,30],ruleWidth:[.5,5],ruleLength:[15,100],logoWidth:[24,190],portraitWidth:[36,180],partnerWidth:[24,150],iconSize:[16,46],iconGap:[2,22],ctaRadius:[0,24],ctaPadding:[4,20],ctaSize:[9,18],bannerWidth:[180,820],bannerHeight:[36,220],bannerRadius:[0,30],footerSize:[8,16]};
 for(const [k,[min,max]] of Object.entries(ranges))p.design[k]=clamp(p.design[k],min,max,BASE_DESIGN[k]);
 for(const k of ['primary','secondary','link','accent','tint','background','imageBackground','ctaColor','ctaText'])if(!/^#[\da-f]{6}$/i.test(String(p.design[k])))p.design[k]=BASE_DESIGN[k];
 const enums={align:['left','center','right'],contactLayout:['stacked','inline','columns'],contactLabels:['none','short','full'],borderStyle:['solid','dashed','dotted'],logoShape:['square','rounded','circle'],portraitShape:['square','rounded','circle'],nameCase:['none','uppercase','lowercase'],iconStyle:['bare','circle','outline','tile','text','letter'],iconInk:['auto','dark','light'],ctaStyle:['outline','filled','text']};
 for(const [k,vals] of Object.entries(enums))if(!vals.includes(p.design[k]))p.design[k]=BASE_DESIGN[k];
 for(const k of ['nameFont','bodyFont'])if(!FONTS[p.design[k]])p.design[k]=BASE_DESIGN[k];
 if(!TEMPLATES.some(t=>t.layout===p.design.layout))p.design.layout='horizontal';
 for(const key of ['nowrap','transparent','linkUnderline','showLogo','showPortrait','showPartner'])p.design[key]=p.design[key]===true;
 p.design.separator=['',' · ',' | ',' / ',' — '].includes(p.design.separator)?p.design.separator:' · ';
 for(const a of Object.values(p.assets)){
  a.src=typeof a.src==='string'?a.src:'';if(a.src.length>8500000)throw new Error('An image is too large. Please use an image under 5 MB.');
  a.alt=String(a.alt||'').slice(0,200);a.link=String(a.link||'').slice(0,2000);a.zoom=clamp(a.zoom,50,300,100);a.x=clamp(a.x,-100,100,0);a.y=clamp(a.y,-100,100,0);a.fit=a.fit==='cover'?'cover':'contain';
 }
 return p;
}
export function renderSignature(project,context={}){
 const p=normalizeProject(project),d={...p.design},i=p.identity,c=p.content;
 if(p.variant==='reply')Object.assign(d,{layout:'reply',showLogo:false,nameSize:Math.min(d.nameSize,18),bodySize:Math.min(d.bodySize,12),baseWidth:Math.min(d.baseWidth,420),padding:4,sectionGap:6});
 const scale=d.scale/100,px=v=>Math.round(v*scale*100)/100,font=FONTS[d.bodyFont].value,nameFont=FONTS[d.nameFont].value;
 const origin=context.origin||'https://example.com';
 const style=obj=>Object.entries(obj).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>`${k}:${v}`).join(';');
 const table=(body,width='',extra={})=>!body?'':`<table align="${d.align}" role="presentation" cellpadding="0" cellspacing="0" border="0"${width?` width="${esc(width)}"`:''} style="${esc(style({'border-collapse':'collapse','font-family':font,'font-size':px(d.bodySize)+'px','line-height':d.lineHeight,color:d.primary,...extra}))}">${body}</table>`;
 const td=(body,extra={},attrs='')=>`<td align="${d.align}" ${attrs} style="${esc(style({'vertical-align':'middle','text-align':d.align,...extra}))}">${body}</td>`;
 const tr=(...cells)=>'<tr>'+cells.join('')+'</tr>';
 const line=(text,size=d.bodySize,color=d.primary,more={})=>`<div style="${esc(style({'font-family':font,'font-size':px(size)+'px','line-height':d.lineHeight,color,'white-space':d.nowrap?'nowrap':'normal',...more}))}">${text}</div>`;
 const link=(text,url,more={})=>url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="${esc(style({color:d.link,'text-decoration':d.linkUnderline?'underline':'none',...more}))}">${text}</a>`:text;
 const spacer=n=>tr(td('',{height:px(n)+'px','font-size':'0','line-height':'0'},`height="${px(n)}"`));
 const rule=()=>table(tr(td('',{'border-top':`${px(d.ruleWidth)}px ${d.borderStyle} ${d.accent}`,'font-size':0,'line-height':0})),d.ruleLength+'%');
 const visible=k=>p.visible[k]!==false&&i[k];
 const textField=key=>context.edit?`<span data-u-bind="${key}">${esc(i[key])}</span>`:esc(i[key]);
 const idBlock=(omitCompany=false)=>{
  const lines=[];
  if(visible('kicker'))lines.push(line(textField('kicker'),Math.max(9,d.bodySize-2),d.secondary,{'letter-spacing':px(1.4)+'px','text-transform':'uppercase','padding-bottom':px(7)+'px'}));
  if(visible('name'))lines.push(line(textField('name'),d.nameSize,d.primary,{'font-family':nameFont,'font-weight':d.nameWeight,'line-height':'1.16','letter-spacing':px(d.tracking)+'px','text-transform':d.nameCase}));
  const role=[visible('title')?textField('title'):'',visible('pronouns')?textField('pronouns'):''].filter(Boolean).join(' · ');
  if(role)lines.push(line(role,d.roleSize,d.secondary,{'padding-top':px(6)+'px'}));
  if(!omitCompany&&visible('company'))lines.push(line(textField('company'),d.roleSize,d.primary,{'padding-top':px(2)+'px','font-weight':500}));
  if(visible('department'))lines.push(line(textField('department'),d.bodySize,d.secondary));return lines.join('');
 };
 function image(slot,size,height=size){
  const a=p.assets[slot];if(!a?.src)return '';
  const source=safeImage(context.images?.[slot]||a.src,origin);if(!source)return '';
  const shape=slot==='portrait'?d.portraitShape:d.logoShape;
  const radius=slot==='banner'?d.bannerRadius:shape==='circle'?size/2:shape==='rounded'?Math.min(16,size/5):0;
  const img=`<img src="${esc(source)}" width="${px(size)}" height="${px(height)}" alt="${esc(a.alt)}" border="0" style="display:block;margin:${d.align==='center'?'0 auto':d.align==='right'?'0 0 0 auto':'0'};width:${px(size)}px;height:${px(height)}px;border:0;border-radius:${px(radius)}px;outline:none;text-decoration:none">`;
  return link(img,safeUrl(a.link));
 }
 const logo=()=>d.showLogo?image('logo',d.logoWidth):'';
 const portrait=()=>d.showPortrait?image('portrait',d.portraitWidth):'';
 const partner=()=>d.showPartner?image('partner',d.partnerWidth):'';
 const brandLabel=()=>visible('company')?line(textField('company'),Math.max(10,d.bodySize),d.secondary,{'letter-spacing':px(2)+'px','text-transform':'uppercase'}):'';
 function contact(){
  const fields=[['phone','T','Phone',safeUrl(i.phone,{phone:true})],['mobile','M','Mobile',safeUrl(i.mobile,{phone:true})],['email','E','Email',safeUrl(i.email,{email:true})],['website','W','Website',safeUrl(i.website)],['address','A','Address',''],['availability','','Availability','']].filter(([key])=>visible(key));
  const pieces=fields.map(([key,short,label,url])=>line((d.contactLabels==='none'?'':`<span style="color:${d.secondary}">${esc(d.contactLabels==='short'?short:label)}${short||d.contactLabels==='full'?': ':''}</span>`)+link(esc(key==='website'?i[key].replace(/^https?:\/\//,'').replace(/\/$/,''):i[key]),url)));
  if(d.contactLayout==='inline'||d.layout==='inline')return line(fields.map(([key,,label,url])=>link(esc(key==='website'?i[key].replace(/^https?:\/\//,'').replace(/\/$/,''):i[key]),url)).join(`<span style="color:${d.secondary}">${esc(d.separator)}</span>`));
  if(d.contactLayout==='columns')return table(pieces.reduce((acc,v,k)=>{if(k%2===0)acc.push(tr(td(v,{'padding-bottom':px(d.contactGap)+'px','padding-right':px(18)+'px'}),td(pieces[k+1]||'',{'padding-bottom':px(d.contactGap)+'px'})));return acc;},[]).join(''));
  return table(pieces.map(v=>tr(td(v,{'padding-bottom':px(d.contactGap)+'px'}))).join(''));
 }
 function social(){
  const list=p.socials.map((s,originalIndex)=>({...s,originalIndex})).filter(s=>s.enabled&&safeUrl(s.url));if(!list.length)return '';
  return table(tr(...list.map((s,index)=>{
   const dark=d.iconInk==='light'||(d.iconInk==='auto'&&['circle','tile'].includes(d.iconStyle));
   const imageURL=safeImage(context.images?.['social-'+s.originalIndex]||s.customIcon||`/design/media/${s.id}-${dark?'light':'dark'}.png`,origin);
   let art=['text','letter'].includes(d.iconStyle)?esc(d.iconStyle==='text'?s.label:s.id==='linkedin'?'in':s.label.slice(0,2)):imageURL?`<img src="${esc(imageURL)}" width="${px(d.iconSize-6)}" height="${px(d.iconSize-6)}" border="0" alt="${esc(s.label)}" style="display:block;width:${px(d.iconSize-6)}px;height:${px(d.iconSize-6)}px;border:0">`:esc(s.label);
   const shape=table(tr(td(art,{'text-align':'center',color:dark?'#ffffff':d.accent,'font-size':px(d.bodySize)+'px','font-weight':600,'padding':px(3)+'px','background-color':['circle','tile'].includes(d.iconStyle)?d.accent:'transparent','border':d.iconStyle==='outline'?`${px(1)}px solid ${d.accent}`:0,'border-radius':['circle','outline'].includes(d.iconStyle)?px(d.iconSize)+'px':d.iconStyle==='tile'?px(5)+'px':0})),['text','letter'].includes(d.iconStyle)?'':px(d.iconSize));
   return td(link(shape,safeUrl(s.url)),{'padding-right':index<list.length-1?px(d.iconGap)+'px':0},'valign="middle"');
  })));
 }
 function cta(){
  const links=[[c.ctaLabel,c.ctaUrl],[c.cta2Label,c.cta2Url]].filter(([label,url])=>label&&safeUrl(url));if(!links.length)return '';
  return table(tr(...links.map(([label,url],n)=>td(table(tr(td(link(esc(label),safeUrl(url),{color:d.ctaStyle==='filled'?d.ctaText:d.ctaColor,'font-size':px(d.ctaSize)+'px','font-weight':600}),{'padding':`${px(d.ctaPadding)}px ${px(d.ctaPadding*1.6)}px`,'background-color':d.ctaStyle==='filled'?d.ctaColor:'transparent','border':d.ctaStyle==='outline'?`${px(1)}px solid ${d.ctaColor}`:0,'border-radius':px(d.ctaRadius)+'px','white-space':'nowrap'}))),{'padding-right':n<links.length-1?px(8)+'px':0}))));
 }
 function module(type){
  switch(type){
   case 'tagline':return i.tagline?line(textField('tagline'),d.tagSize,d.secondary,{'font-style':['byline','residence','invitation'].includes(d.layout)?'italic':'normal'}):'';
   case 'contact':return contact();
   case 'social':return social();
   case 'cta':return cta();
   case 'custom':return table(p.extras.filter(e=>e.enabled&&e.value).map(e=>tr(td(line((e.label?`<span style="color:${d.secondary}">${esc(e.label)} · </span>`:'')+link(esc(e.value),safeUrl(e.url))),{'padding-bottom':px(4)+'px'}))).join(''));
   case 'announcement':return c.announcementTitle||c.announcementText?table(tr(td((c.announcementTitle?line(esc(c.announcementTitle),d.bodySize,d.primary,{'font-weight':600}):'')+(c.announcementText?line(link(esc(c.announcementText),safeUrl(c.announcementUrl)),d.bodySize,d.secondary,{'white-space':'normal'}):''),{padding:px(12)+'px','background-color':d.tint,'border-left':`${px(2)}px solid ${d.accent}`})),'100%'):'';
   case 'banner':return p.assets.banner.src?image('banner',Math.min(d.bannerWidth,d.baseWidth-2*d.padding),d.bannerHeight):'';
   case 'note':return c.note?line(esc(c.note).replace(/\n/g,'<br>'),d.bodySize,d.secondary,{'font-style':'italic','white-space':'normal'}):'';
   case 'disclaimer':return c.disclaimer?line(esc(c.disclaimer).replace(/\n/g,'<br>'),d.footerSize,d.secondary,{'white-space':'normal','max-width':px(d.baseWidth-d.padding*2)+'px'}):'';
   default:return '';
  }
 }
 // Named fragments allow the unified canvas to move and edit template elements
 // without embedding or exporting arbitrary HTML.
 if(context.part){
  if(context.part==='identity')return idBlock();
  if(context.part==='identity-no-company')return idBlock(true);
  if(context.part==='brand')return brandLabel();
  if(['logo','portrait','partner'].includes(context.part))return image(context.part,d[context.part+'Width']);
  if(['name','title','company','kicker','pronouns','department'].includes(context.part)){
   const one={...p.visible};for(const key of ['name','title','company','kicker','pronouns','department'])p.visible[key]=key===context.part&&one[key]!==false;
   return idBlock();
  }
  return module(context.part);
 }
 const enabled=type=>p.sections.some(s=>s.type===type&&s.enabled);
 const body=(exclude=[])=>table(p.sections.filter(s=>s.enabled&&!exclude.includes(s.type)&&((p.variant!=='reply'&&d.layout!=='inline')||s.type==='contact')).map(s=>{const m=module(s.type);return m&&m!=='<table></table>'?tr(td(m,{'padding-top':px(d.sectionGap)+'px'})):'';}).join(''),'100%');
 const identity=idBlock(),standard=identity+body();
 const columns=(a,b,reverse=false,border=false)=>table(tr(...(reverse?[td(b,{'padding-right':a?px(d.gap)+'px':0}),a?td(a,{'text-align':'center'},`width="${px(d.logoWidth)}"`):'']:[a?td(a,{'padding-right':px(d.gap)+'px','border-right':border?`${px(d.ruleWidth)}px ${d.borderStyle} ${d.accent}`:0},`width="${px(d.logoWidth+d.gap)}"`):'',td(b,{'padding-left':border&&a?px(d.gap)+'px':0})]).filter(Boolean)),'100%');
 const stack=(...parts)=>table(parts.filter(Boolean).map((part,n)=>tr(td(part,{'padding-top':n?px(d.sectionGap)+'px':0,'text-align':d.align}))).join(''),'100%');
 const marks=()=>table(tr(td(logo(),{'padding-right':partner()?px(d.gap)+'px':0}),partner()?td(line('×',d.bodySize,d.secondary),{'padding-right':px(d.gap)+'px'}):'',partner()?td(partner()):''));
 let layout;
 switch(d.layout){
  case 'text':case 'reply':layout=standard;break;
  case 'portrait':layout=columns(portrait()||logo(),identity+(portrait()?stack(logo()):'')+body());break;
  case 'mirrored':layout=columns(logo(),standard,true);break;
  case 'vertical-rule':layout=columns(logo(),standard,false,true);break;
  case 'centered':case 'seal':layout=stack(logo(),standard);break;
  case 'banner-led':layout=stack(enabled('banner')?module('banner'):'',columns(logo(),identity+body(['banner'])));break;
  case 'masthead':layout=stack(table(tr(td(brandLabel()),td(logo(),{'text-align':'right'},`width="${px(d.logoWidth)}"`)),'100%'),rule(),idBlock(true)+body());break;
  case 'byline':layout=stack(identity,body(),rule(),columns(logo(),brandLabel()));break;
  case 'split':layout=stack(table(tr(td(logo()+identity,{'padding-right':px(d.gap)+'px'},'width="50%"'),td(enabled('contact')?contact():'',{'vertical-align':'top','border-left':`${px(d.ruleWidth)}px solid ${d.accent}`,'padding-left':px(d.gap)+'px'})),'100%'),body(['contact']));break;
  case 'footer-mark':layout=stack(standard,rule(),table(tr(td(brandLabel()),td(logo(),{'text-align':'right'},`width="${px(d.logoWidth)}"`)),'100%'));break;
  case 'ledger':layout=stack(identity,rule(),table(tr(td(enabled('contact')?contact():'',{'padding-right':px(d.gap)+'px'}),td(logo(),{'text-align':'right'})),'100%'),body(['contact']));break;
  case 'letterhead':layout=stack(table(tr(td(brandLabel()),td(logo(),{'text-align':'right'},`width="${px(d.logoWidth)}"`)),'100%'),idBlock(true)+body());break;
  case 'frame':layout=columns(logo(),standard);break;
  case 'rail':layout=table(tr(td(logo(),{padding:px(20)+'px','background-color':d.tint,'vertical-align':'top'},`width="${px(d.logoWidth+40)}"`),td(standard,{padding:px(22)+'px'})),'100%');break;
  case 'maison':layout=stack(logo(),brandLabel(),rule(),idBlock(true)+body());break;
  case 'gallery':layout=stack(columns(logo(),brandLabel()),rule(),identity+body());break;
  case 'nameplate':layout=stack(table(tr(td(identity,{padding:px(14)+'px','background-color':d.tint})),'100%'),columns(logo(),body()));break;
  case 'poster':layout=stack(identity,rule(),table(tr(td(body()),td(logo(),{'vertical-align':'bottom','padding-left':px(d.gap)+'px'})),'100%'));break;
  case 'portfolio':layout=stack(table(tr(td(identity),td(portrait()||logo(),{'text-align':'right'},`width="${px(d.portraitWidth)}"`)),'100%'),rule(),body());break;
  case 'dual':layout=stack(marks(),rule(),standard);break;
  case 'colorblock':layout=stack(table(tr(td(logo()+identity,{padding:px(18)+'px','background-color':d.tint},'width="48%"'),td(enabled('contact')?contact():'',{'padding-left':px(d.gap)+'px'})),'100%'),body(['contact']));break;
  case 'social-first':layout=stack(enabled('social')?social():'',columns(logo(),identity+body(['social'])));break;
  case 'offset':layout=stack(columns(logo(),standard,true),rule());break;
  case 'residence':layout=stack(columns(logo(),brandLabel()),rule(),table(tr(td(idBlock(true)+body(),{padding:px(12)+'px','background-color':d.tint})),'100%'));break;
  case 'invitation':layout=stack(rule(),logo(),standard,rule());break;
  case 'credits':layout=stack(brandLabel(),table(tr(td('',{'border-top':`${px(3)}px solid ${d.accent}`})),'100%'),columns(logo(),idBlock(true)+body()));break;
  case 'property':layout=stack(columns(portrait()||logo(),identity+(portrait()?stack(logo()):'')+body(['banner'])),enabled('banner')?module('banner'):'');break;
  case 'guest':layout=stack(columns(logo(),brandLabel()),idBlock(true)+body());break;
  case 'partners':layout=stack(marks(),rule(),table(tr(td(identity,{'padding-right':px(d.gap)+'px'}),td(enabled('contact')?contact():'')),'100%'),body(['contact']));break;
  case 'inline':layout=stack(line((visible('name')?`<strong style="font-family:${esc(nameFont)};font-size:${px(d.nameSize)}px">${textField('name')}</strong>`:'')+(visible('title')?`<span style="color:${d.secondary}">${esc(d.separator+i.title)}</span>`:'')),body());break;
  case 'micromark':layout=columns(logo(),standard,true);break;
  case 'clean':layout=stack(columns(logo(),idBlock()),body());break;
  default:layout=columns(logo(),standard);
 }
 const outer={width:px(d.baseWidth)+'px','font-family':font,'font-size':px(d.bodySize)+'px','line-height':d.lineHeight,color:d.primary,'background-color':d.transparent?'transparent':d.background};
 return table(tr(td(layout,{padding:px(d.padding)+'px','border':d.border?`${px(d.border)}px ${d.borderStyle} ${d.accent}`:'0','border-radius':px(d.radius)+'px'})),px(d.baseWidth),outer);
}
export function contrast(a,b){const l=h=>{const c=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const x=l(a),y=l(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function preflight(p,html,width){
 const warnings=[],d=p.design;
 if(width>d.targetWidth+1)warnings.push({kind:'width',text:`${Math.round(width)} px exceeds your ${d.targetWidth} px target. Use Auto-fit or a narrower composition.`});
 const smallest=Math.min(d.bodySize,d.roleSize)*(d.scale/100);if(smallest<10)warnings.push({kind:'type',text:`Smallest contact text is ${smallest.toFixed(1)} px. Consider a more compact layout instead of further scaling.`});
 if(/src="data:/i.test(html))warnings.push({kind:'images',text:'Some images are local. Publish them before copying to Gmail; portable HTML can retain them.'});
 if(contrast(d.secondary,d.transparent?'#ffffff':d.background)<4.5)warnings.push({kind:'contrast',text:'Secondary text has low contrast on the selected light background.'});
 for(const s of p.socials)if(s.enabled&&s.url&&!safeUrl(s.url))warnings.push({kind:'link',text:`${s.label}: enter a valid website URL. Invalid links are omitted.`});
 if(p.identity.email&&p.visible.email&&!safeUrl(p.identity.email,{email:true}))warnings.push({kind:'link',text:'Check the email address. It is shown as text until valid.'});
 if(['garamond','optima','avenir','palatino'].includes(d.nameFont)||['garamond','optima','avenir','palatino'].includes(d.bodyFont))warnings.push({kind:'font',text:'This font is device-dependent. Recipients without it will see the configured fallback.'});
 return warnings;
}
