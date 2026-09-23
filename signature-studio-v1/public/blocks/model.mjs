/** Versioned block documents. All operations return copies; no HTML is accepted. */
import {freshProject,BASE_DESIGN,NETWORKS} from '../design/catalog.mjs';
import {normalizeProject,clamp} from '../design/engine.mjs';
export const clone=x=>structuredClone(x);
export const uid=()=>globalThis.crypto.randomUUID();
export const CONTAINERS=['section','columns','column','group','panel'];
export const TYPES=[...CONTAINERS,'heading','text','contact','social','image','button','divider','spacer','qr','template'];
export const LIMITS={nodes:180,depth:9,columnDepth:2,bytes:18000000};
export const LIBRARY=[
 ['identity','Identity group','Core','Aa','Name, title and company, connected to your profile.'],
 ['heading','Heading / name','Core','H','An independent heading or connected profile field.'],
 ['text','Text / tagline','Core','T','Text with simple bold, italic and link formatting.'],
 ['contact','Contact item','Core','@','One connected or custom contact detail.'],
 ['contacts','Contact group','Core','≡','A coordinated set of contact details.'],
 ['social','Social links','Core','↗','Graphic marks, labels and custom artwork.'],
 ['image','Image','Core','▧','Logo, portrait or linked artwork.'],
 ['button','Button / link','Core','→','A booking, portfolio or inquiry action.'],
 ['section','Section','Layout','▤','Full-width section with padding and alignment.'],
 ['columns','Columns','Layout','Ⅱ','Two or three proportional columns.'],
 ['group','Stack / group','Layout','☷','Move and reuse related blocks together.'],
 ['divider','Divider','Layout','—','Horizontal rule or vertical separator.'],
 ['spacer','Spacer','Layout','↕','Precisely measured breathing room.'],
 ['panel','Panel / frame','Layout','□','A tinted or bordered content container.'],
 ['campaign','Campaign banner','Modules','▰','Artwork, headline and a destination.'],
 ['announcement','Announcement strip','Modules','!','A short announcement with an action.'],
 ['partners','Partner lockup','Modules','×','Independent, linked partner logos.'],
 ['editorial','Editorial feature','Modules','¶','A story thumbnail, title and link.'],
 ['event','Event invitation','Modules','✦','Event, date, location and RSVP action.'],
 ['spotlight','Project spotlight','Modules','◇','A project or property with a visual.'],
 ['credentials','Credentials / recognition','Modules','✓','Your own memberships and achievements.'],
 ['location','Location / availability','Modules','⌖','Location, availability and booking.'],
 ['qr-card','QR link card','Modules','▦','A locally generated QR and clickable alternative.'],
 ['footer','Personal / legal footer','Modules','…','Your own note or supplied disclaimer.']
].map(([id,name,category,icon,description])=>({id,name,category,icon,description}));
export function block(type,props={},style={},children=[],label=''){
 return {id:uid(),type,label:label||type[0].toUpperCase()+type.slice(1),visibility:'both',props,style,children};
}
const text=(s,style={})=>block('text',{text:s},style);
const heading=(s,style={})=>block('heading',{text:s},style);
const action=(s='Learn more',url='')=>block('button',{text:s,url,appearance:'outline'},{size:12,padding:8});
const image=(src='',alt='Artwork',w=90,h=90)=>block('image',{src,alt,width:w,height:h,fit:'contain',zoom:100,x:0,y:0,shape:'square',background:'transparent',url:''});
const group=(label,children,style={})=>block('group',{},style,children,label);
const columns=(children,ratios=[28,72])=>block('columns',{ratios}, {},children.map((c,j)=>block('column',{}, {},c,'Column '+(j+1))));
export function makeBlock(kind,doc){
 const logo=doc?.source?.assets?.logo?.src||'/design/media/mg-logo.png';
 switch(kind){
  case 'identity':return group('Identity group',[block('heading',{bind:'name'}),block('text',{bind:'title'},{size:13,color:doc?.design.secondary||'#61656a'}),block('text',{bind:'company'},{size:13})],{gap:4});
  case 'heading':return heading('Your heading');
  case 'text':return text('A considered introduction. Make it yours.');
  case 'contact':return block('contact',{bind:'email',kind:'email',label:'',value:'',url:''});
  case 'contacts':return group('Contact group',['phone','email','website'].map(k=>block('contact',{bind:k,kind:k,label:'',value:'',url:''})),{gap:5});
  case 'social':return block('social',{items:NETWORKS.slice(0,4).map(([id,label])=>({id,label,url:'',enabled:true,customIcon:''})),appearance:'bare',size:24,gap:8});
  case 'image':return image(logo,'Modern Gentlemen',92,92);
  case 'button':return action('Book a conversation');
  case 'section':return block('section',{}, {padding:12,gap:12},[],'New section');
  case 'columns':return columns([[],[]],[35,65]);
  case 'group':return group('New group',[]);
  case 'divider':return block('divider',{orientation:'horizontal',length:100,thickness:1,line:'solid',height:60});
  case 'spacer':return block('spacer',{height:14,width:12});
  case 'panel':return block('panel',{}, {padding:16,border:1,background:'#f2f1ec',radius:0},[],'Framed panel');
  case 'campaign':return group('Campaign banner',[image('','Campaign artwork',420,110),heading('A new perspective',{size:18}),action('Explore the collection')]);
  case 'announcement':return block('panel',{}, {padding:12,background:'#f2f1ec'},[text('NEWS',{size:9,tracking:2,weight:700}),text('Share your latest announcement.'),action('Discover more')],'Announcement strip');
  case 'partners':return group('Partner lockup',[text('IN COLLABORATION',{size:9,tracking:1.5}),columns([[image(logo,'Primary brand',64,64)],[text('×',{size:22,align:'center'})],[image('','Partner brand',64,64)]],[40,20,40])]);
  case 'editorial':return group('Editorial feature',[columns([[image('','Editorial image',90,90)],[text('FROM THE JOURNAL',{size:9,tracking:1.5}),heading('A story worth sharing',{size:17}),text('Introduce a thoughtful story or interview.'),action('Read the feature')]],[25,75])]);
  case 'event':return block('panel',{}, {padding:18,border:1},[text('YOU ARE INVITED',{size:9,tracking:2}),heading('An exceptional gathering',{size:22,font:'georgia',weight:400}),text('Date · Location'),text('An invitation to connect.'),action('RSVP / inquire')],'Event invitation');
  case 'spotlight':return group('Project spotlight',[image('','Project artwork',420,130),heading('A project in focus',{size:20}),text('One distinctive detail. One memorable introduction.'),action('View project')]);
  case 'credentials':return group('Credentials / recognition',[text('CREDENTIALS',{size:9,tracking:1.6}),text('Add your own verified credentials or memberships.')]);
  case 'location':return group('Location / availability',[block('text',{bind:'address'}),block('text',{bind:'availability'}),action('Arrange a conversation')]);
  case 'qr-card':return group('QR link card',[columns([[block('qr',{url:'https://www.moderngentlemen.co',size:100,alt:'QR code for website'})],[heading('Stay connected',{size:18}),text('Scan or use the link below.'),action('Visit our website','https://www.moderngentlemen.co')]],[30,70])]);
  case 'footer':return group('Personal / legal footer',[text('Add a personal note or your organization’s supplied disclaimer.',{size:10,color:'#61656a'})]);
  default:throw new Error('Unknown block preset.');
 }
}
export function freshDocument(blank=false){const base=freshProject();const d={schemaVersion:3,kind:'signature-blocks',name:'Modern Gentlemen · Blocks',variant:'full',identity:clone(base.identity),design:clone(base.design),children:[],publishedAssets:{}};
 d.design.baseWidth=540;d.design.targetWidth=540;
 if(!blank){const id=makeBlock('identity',d),tag=block('text',{bind:'tagline'},{size:12});d.children=[columns([[makeBlock('image',d)],[id,tag,makeBlock('contacts',d),makeBlock('social',d)]],[24,76])];}return d;}
export function walk(nodes,fn,parent=null,depth=0){for(const n of nodes){fn(n,parent,depth);walk(n.children||[],fn,n,depth+1);}}
export function find(doc,id){let result=null;walk(doc.children,n=>{if(n.id===id)result=n;});return result;}
export function locationOf(doc,id){let result=null;function scan(nodes,parent){const i=nodes.findIndex(n=>n.id===id);if(i>=0){result={nodes,parent,index:i,node:nodes[i]};return;}for(const n of nodes)scan(n.children||[],n);}scan(doc.children,null);return result;}
export function newIds(node){const n=clone(node);walk([n],b=>b.id=uid());return n;}
export function normalize(input){
 if(input?.schemaVersion!==3||input.kind!=='signature-blocks')throw new Error('Choose a Block Studio project. Older designs can be opened as preserved template blocks.');
 if(JSON.stringify(input).length>LIMITS.bytes)throw new Error('Project exceeds the 18 MB limit. Resize its artwork.');
 const base=freshProject();const safe=normalizeProject({...base,identity:input.identity,design:input.design});
 const doc={schemaVersion:3,kind:'signature-blocks',name:String(input.name||'Untitled signature').slice(0,100),variant:input.variant==='reply'?'reply':'full',identity:safe.identity,design:safe.design,children:[],publishedAssets:{}};
 const seen=new Set();let count=0;
 const ranges={padding:[0,48],gap:[0,40],size:[8,46],weight:[400,800],tracking:[-1,5],lineHeight:[1,2.5],border:[0,5],radius:[0,30],width:[24,900]};
 function read(raw,depth=0,cd=0){
  if(!raw||!TYPES.includes(raw.type))throw new Error('This project has an unsupported block type.');
  if(++count>LIMITS.nodes||depth>LIMITS.depth)throw new Error('This layout is too large or deeply nested.');
  if(raw.type==='columns'&&++cd>LIMITS.columnDepth)throw new Error('Use no more than two nested column sections.');
  const id=typeof raw.id==='string'&&/^[\w-]{1,80}$/.test(raw.id)&&!seen.has(raw.id)?raw.id:uid();seen.add(id);
  const n={id,type:raw.type,label:String(raw.label||raw.type).slice(0,80),visibility:['both','full','reply','hidden'].includes(raw.visibility)?raw.visibility:'both',props:{},style:{},children:[]};const p=raw.props||{};
  for(const k of ['text','value','label','alt','url','src','bind','kind','fit','shape','appearance','orientation','line','background'])if(typeof p[k]==='string')n.props[k]=p[k].slice(0,k==='src'?8000000:k==='text'?4000:2000);
  if(n.props.bind&&!Object.hasOwn(doc.identity,n.props.bind))delete n.props.bind;
  for(const [k,min,max,def] of [['width',24,820,92],['height',0,300,92],['zoom',50,300,100],['x',-100,100,0],['y',-100,100,0],['size',16,240,24],['gap',0,24,8],['length',10,100,100],['thickness',.5,5,1]])if(p[k]!==undefined)n.props[k]=clamp(p[k],min,max,def);
  n.props.italic=p.italic===true;n.props.underline=p.underline===true;
  if(n.type==='social')n.props.items=(Array.isArray(p.items)?p.items:[]).slice(0,16).map(s=>({id:NETWORKS.some(x=>x[0]===s.id)?s.id:'custom',label:String(s.label||s.id||'Link').slice(0,60),url:String(s.url||'').slice(0,2000),enabled:s.enabled!==false,customIcon:typeof s.customIcon==='string'?s.customIcon.slice(0,8000000):''}));
  for(const [k,[min,max]] of Object.entries(ranges))if(raw.style?.[k]!==undefined&&raw.style[k]!==null&&raw.style[k]!=='')n.style[k]=clamp(raw.style[k],min,max,min);
  for(const k of ['color','background','borderColor'])if(/^#[a-f\d]{6}$/i.test(raw.style?.[k])||raw.style?.[k]==='transparent')n.style[k]=raw.style[k];
  for(const [k,values] of Object.entries({align:['left','center','right'],font:['sans','georgia','times','verdana','tahoma','trebuchet','courier','palatino','garamond','optima','avenir','system'],valign:['top','middle','bottom'],casing:['none','uppercase','lowercase'],nowrap:['inherit','nowrap','normal']}))if(values.includes(raw.style?.[k]))n.style[k]=raw.style[k];
  if(CONTAINERS.includes(n.type))n.children=(Array.isArray(raw.children)?raw.children:[]).map(x=>read(x,depth+1,cd));
  if(n.type==='columns'){
   if(n.children.length<2||n.children.length>3||n.children.some(x=>x.type!=='column'))throw new Error('Columns must contain two or three column cells.');
   const ratios=n.children.map((_,j)=>clamp(p.ratios?.[j],10,80,100/n.children.length)),sum=ratios.reduce((a,b)=>a+b,0);n.props.ratios=ratios.map(r=>100*r/sum);
  }else if(n.children.some(x=>x.type==='column'))throw new Error('Column cells must belong to a columns block.');
  if(n.type==='template'){if(!p.project)throw new Error('The preserved template is missing.');n.props.project=normalizeProject(p.project);}
  return n;
 }
 doc.children=(Array.isArray(input.children)?input.children:[]).map(n=>read(n));
 if(doc.children.some(n=>n.type==='column'))throw new Error('Column cells cannot be placed at the root.');
 for(const [k,v] of Object.entries(input.publishedAssets||{}).slice(0,300))if(/^[a-f\d]{64}$/.test(k)&&typeof v==='string'&&/^https:\/\//.test(v))doc.publishedAssets[k]=v;
 return doc;
}
export function transact(doc,fn){const next=clone(doc);fn(next);return normalize(next);}
export function insert(doc,node,parentId=null,index=Infinity){return transact(doc,d=>{
 const parent=parentId?find(d,parentId):null;if(parentId&&!parent)throw new Error('The destination no longer exists.');
 if(parent&&(!CONTAINERS.includes(parent.type)||parent.type==='columns'))throw new Error('Choose a column, group or section as destination.');
 if(node.type==='column')throw new Error('Move the column contents or the entire columns block.');
 const nodes=parent?parent.children:d.children;nodes.splice(Math.max(0,Math.min(index,nodes.length)),0,clone(node));
 });}
export function move(doc,id,parentId=null,index=Infinity){return transact(doc,d=>{
 const from=locationOf(d,id);if(!from)throw new Error('Block not found.');if(from.node.type==='column')throw new Error('Move the whole columns section or its contents.');
 const dest=parentId?find(d,parentId):null;if(parentId&&!dest)throw new Error('Destination not found.');
 if(dest&&(!CONTAINERS.includes(dest.type)||dest.type==='columns'))throw new Error('Drop inside a column, not on the columns container.');
 let cycle=false;walk([from.node],n=>{if(n.id===parentId)cycle=true;});if(cycle)throw new Error('A group cannot be moved into itself.');
 const list=dest?dest.children:d.children;let at=Math.min(index,list.length);if(list===from.nodes&&from.index<at)at--;
 from.nodes.splice(from.index,1);list.splice(Math.max(0,at),0,from.node);
 });}
export function remove(doc,id){return transact(doc,d=>{const loc=locationOf(d,id);if(!loc)return;if(loc.node.type==='column')throw new Error('Remove or ungroup the columns block instead.');loc.nodes.splice(loc.index,1);});}
export function duplicate(doc,id){const loc=locationOf(doc,id);if(!loc)throw new Error('Select a block first.');const copy=newIds(loc.node);return {document:insert(doc,copy,loc.parent?.id,loc.index+1),id:copy.id};}
export function ungroup(doc,id){return transact(doc,d=>{const loc=locationOf(d,id);if(!loc||!['group','section','panel','columns'].includes(loc.node.type))throw new Error('Select a group, panel, section or columns block.');const content=loc.node.type==='columns'?loc.node.children.flatMap(c=>c.children):loc.node.children;loc.nodes.splice(loc.index,1,...content);});}
export function beside(doc,id){const loc=locationOf(doc,id);if(!loc||loc.node.type==='column')throw new Error('Select a content block.');const cols=columns([[clone(loc.node)],[]],[50,50]);return {document:transact(doc,d=>{const l=locationOf(d,id);l.nodes.splice(l.index,1,cols);}),id:cols.children[1].id};}
export function preservedProject(input){const p=normalizeProject(input);const d=freshDocument(true);d.name=p.name+' · Block copy';d.variant=p.variant;d.identity=clone(p.identity);d.design={...clone(p.design),padding:0};d.children=[block('template',{project:p},{},[],'Preserved '+p.templateId+' template')];return normalize(d);}
export function recompose(doc,id){return transact(doc,d=>{
 const loc=locationOf(d,id);if(loc?.node.type!=='template')throw new Error('Select a preserved template.');const old=loc.node.props.project;
 const idg=group('Identity group',['kicker','name','title','pronouns','company','department'].filter(k=>old.visible[k]!==false&&old.identity[k]).map(k=>block(k==='name'?'heading':'text',{bind:k},k==='name'?{}:{size:old.design.roleSize})),{gap:4});const contacts=group('Contact group',['phone','mobile','email','website','address','availability'].filter(k=>old.visible[k]!==false&&old.identity[k]).map(k=>block('contact',{bind:k,kind:k})),{gap:old.design.contactGap});
 const main=[idg];for(const s of old.sections||[]){if(!s.enabled)continue;
  if(s.type==='tagline'&&old.identity.tagline)main.push(block('text',{bind:'tagline'},{size:old.design.tagSize}));
  if(s.type==='contact')main.push(contacts);
  if(s.type==='social'){const social=makeBlock('social',d);social.props.items=clone(old.socials);main.push(social);}
  if(s.type==='note'&&old.content.note)main.push(text(old.content.note));
  if(s.type==='disclaimer'&&old.content.disclaimer)main.push(text(old.content.disclaimer,{size:old.design.footerSize}));
  if(s.type==='cta'&&old.content.ctaLabel&&old.content.ctaUrl)main.push(action(old.content.ctaLabel,old.content.ctaUrl));
  if(s.type==='banner'&&old.assets.banner.src){const im=image(old.assets.banner.src,old.assets.banner.alt,old.design.bannerWidth,old.design.bannerHeight);im.props={...im.props,...old.assets.banner,url:old.assets.banner.link};main.push(im);}
  if(s.type==='announcement'&&(old.content.announcementTitle||old.content.announcementText))main.push(group('Announcement',[text(old.content.announcementTitle||'',{weight:700}),text(old.content.announcementText||''),...(old.content.announcementUrl?[action('Learn more',old.content.announcementUrl)]:[])]));
 }
 for(const e of old.extras||[])if(e.enabled)main.push(block('contact',{label:e.label,value:e.value,url:e.url,kind:'custom'}));
 if(old.content.cta2Label&&old.content.cta2Url)main.push(action(old.content.cta2Label,old.content.cta2Url));
 const images=[];for(const slot of ['logo','portrait','partner'])if(old.design['show'+slot[0].toUpperCase()+slot.slice(1)]&&old.assets[slot].src){const sz=old.design[slot+'Width'];const im=image(old.assets[slot].src,old.assets[slot].alt,sz,sz);Object.assign(im.props,old.assets[slot],{url:old.assets[slot].link});images.push(im);}
 loc.nodes.splice(loc.index,1,images.length?columns([images,main],[25,75]):group('Editable signature',main));
 });}
