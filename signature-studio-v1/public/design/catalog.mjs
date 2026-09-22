/** Signature Studio Design Edition. Presets only change design, never identity. */
export const FONTS = {
  sans: {name:'Arial / Helvetica',value:'Arial,Helvetica,sans-serif'},
  georgia: {name:'Georgia',value:'Georgia,"Times New Roman",serif'},
  times: {name:'Times New Roman',value:'"Times New Roman",Times,serif'},
  verdana: {name:'Verdana',value:'Verdana,Geneva,sans-serif'},
  tahoma: {name:'Tahoma',value:'Tahoma,Verdana,sans-serif'},
  trebuchet: {name:'Trebuchet MS',value:'"Trebuchet MS",Arial,sans-serif'},
  courier: {name:'Courier New',value:'"Courier New",Courier,monospace'},
  palatino: {name:'Palatino',value:'Palatino,"Palatino Linotype",Georgia,serif'},
  garamond: {name:'Garamond',value:'Garamond,Georgia,serif'},
  optima: {name:'Optima',value:'Optima,Arial,sans-serif'},
  avenir: {name:'Avenir',value:'Avenir,"Century Gothic",Arial,sans-serif'},
  system: {name:'System sans',value:'-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif'}
};
export const PALETTES = [
  ['Modern Gentlemen','#17191b','#61656a','#17191b','#f2f1ec','#ffffff'],
  ['Atelier','#282820','#727060','#858060','#eeede4','#fffef9'],
  ['Midnight','#e9edf2','#b3bfcd','#aec3df','#253245','#132031'],
  ['Oxblood','#321c21','#776369','#842b3a','#f3e9ec','#fffafc'],
  ['British Racing','#173529','#60746a','#225c44','#e7eee9','#fafcf9'],
  ['Cobalt','#18283f','#647083','#235dcc','#eaf0fa','#ffffff'],
  ['Terracotta','#372821','#826e64','#aa5c3d','#f3e6dc','#fffcf7'],
  ['Graphite','#272c30','#70757c','#505f70','#edf0f2','#ffffff'],
  ['Champagne','#423828','#8a7b64','#957b49','#f2ecdf','#fffdf8'],
  ['Aubergine','#352b3b','#7d7185','#705581','#f0eaf3','#fdfbfe'],
  ['Ink & Paper','#141414','#626262','#141414','#efefeb','#faf9f4'],
  ['Ocean','#1b3440','#597c8a','#17768c','#e7f0f2','#faffff'],
  ['Coral Studio','#362c32','#88717c','#cb586e','#f9e9ee','#fffafd'],
  ['Slate Blue','#243247','#768197','#536b8f','#edf0f5','#ffffff'],
  ['Warm Minimal','#302d29','#817b72','#8c7660','#f0ece6','#fffcf8'],
  ['Noir','#f1efea','#bcb8ae','#d3bd88','#272727','#171717']
];
export const NETWORKS = [
  ['instagram','Instagram'],['tiktok','TikTok'],['facebook','Facebook'],['linkedin','LinkedIn'],
  ['x','X'],['youtube','YouTube'],['threads','Threads'],['pinterest','Pinterest'],
  ['github','GitHub'],['behance','Behance'],['dribbble','Dribbble'],['vimeo','Vimeo'],['custom','Custom link']
];
export const BASE_DESIGN = {
 layout:'horizontal',align:'left',baseWidth:520,targetWidth:520,scale:100,nowrap:true,
 nameFont:'sans',bodyFont:'sans',nameSize:25,roleSize:13,bodySize:12,tagSize:13,
 nameWeight:700,tracking:0,nameCase:'none',lineHeight:1.45,
 primary:'#17191b',secondary:'#61656a',link:'#17191b',accent:'#17191b',tint:'#f2f1ec',background:'#ffffff',transparent:true,
 padding:12,gap:24,sectionGap:12,contactGap:5,contactLayout:'stacked',separator:' · ',contactLabels:'none',
 border:0,borderStyle:'solid',radius:0,ruleWidth:1,ruleLength:100,
 logoWidth:92,portraitWidth:90,partnerWidth:74,logoShape:'square',portraitShape:'circle',imageBackground:'#000000',
 iconSize:24,iconGap:8,iconStyle:'bare',iconInk:'auto',linkUnderline:false,
 ctaStyle:'outline',ctaRadius:0,ctaPadding:8,ctaSize:11,ctaColor:'#17191b',ctaText:'#ffffff',
 bannerWidth:440,bannerHeight:95,bannerRadius:0,footerSize:10,showLogo:true,showPortrait:true,showPartner:true
};
// Each row describes a composed layout, not a replacement for the user's contact data.
const defs = [
 ['classic','Classic Horizontal','Essentials','horizontal','Logo and identity in a familiar two-column arrangement.',{}],
 ['portrait','Portrait Professional','Essentials','portrait','A personal portrait paired with a separate brand mark.',{logoWidth:56,portraitWidth:92}],
 ['divider','Corporate Divider','Essentials','vertical-rule','A fine vertical rule separates mark and details.',{ruleWidth:1,gap:20}],
 ['text','Text Only','Essentials','text','Type-first identity, without an image column.',{showLogo:false,baseWidth:440}],
 ['center','Centered Classic','Essentials','centered','Centered brand mark, identity and contact stack.',{align:'center',logoWidth:62,baseWidth:420}],
 ['right','Logo Right','Essentials','mirrored','Identity leads; the brand mark sits on the right.',{logoWidth:78}],
 ['business','Compact Business','Essentials','horizontal','A compact, conservative business-card signature.',{baseWidth:440,logoWidth:62,nameSize:20,gap:16,sectionGap:8}],
 ['banner','Banner Standard','Essentials','banner-led','A campaign banner precedes a conventional contact card.',{logoWidth:68}],
 ['masthead','The Masthead','Editorial','masthead','A publication-style header and ruled identity block.',{nameFont:'georgia',nameWeight:400,nameSize:28,logoWidth:38}],
 ['publisher','Publisher’s Note','Editorial','byline','An expressive byline above a slim brand footer.',{nameFont:'georgia',nameSize:29,nameWeight:400,logoWidth:38}],
 ['split','Magazine Split','Editorial','split','Identity and contact details occupy separate columns.',{nameFont:'georgia',nameSize:27,logoWidth:50,baseWidth:570}],
 ['colophon','The Colophon','Editorial','footer-mark','Quiet typography followed by an understated logo footer.',{nameFont:'times',nameSize:26,logoWidth:32,sectionGap:10}],
 ['ledger','Typographic Ledger','Editorial','ledger','A large byline over a structured two-column ledger.',{nameFont:'georgia',nameSize:32,nameWeight:400,contactLabels:'short'}],
 ['correspondent','The Correspondent','Editorial','letterhead','A small letterhead sits above personal correspondence.',{nameFont:'palatino',logoWidth:46,nameWeight:400}],
 ['atelier','Atelier Frame','Luxury','frame','An inset hairline frame with generous interior spacing.',{nameFont:'georgia',nameWeight:400,padding:24,border:1,logoWidth:72,accent:'#858060',tint:'#eeede4'}],
 ['private','Private Office','Luxury','rail','A contrasting brand rail beside restrained contact details.',{nameFont:'georgia',nameWeight:400,padding:0,gap:24,logoWidth:76}],
 ['maison','Maison Monogram','Luxury','maison','A centered monogram and small-cap brand inscription.',{align:'center',nameFont:'georgia',nameWeight:400,logoWidth:62,tracking:.3,baseWidth:440}],
 ['gallery','Gallery Label','Luxury','gallery','A numbered-label composition with a slender accent rule.',{nameFont:'georgia',nameWeight:400,nameSize:29,logoWidth:42}],
 ['concierge','The Concierge','Luxury','seal','A seal-like brand column with centered personal details.',{nameFont:'georgia',align:'center',logoShape:'circle',logoWidth:82}],
 ['ivory','Ivory Nameplate','Luxury','nameplate','A tonal nameplate above a neatly separated contact block.',{nameFont:'georgia',nameWeight:400,tint:'#f2ecdf',accent:'#957b49',padding:16}],
 ['director','Creative Director','Creative','poster','Oversized type, a bold rule and a small signing mark.',{nameSize:32,nameWeight:800,nameCase:'uppercase',tracking:.6,logoWidth:40,ruleWidth:3}],
 ['portfolio','Portfolio Index','Creative','portfolio','A name/portrait header with a portfolio-link footer.',{nameSize:28,portraitWidth:68,logoWidth:40}],
 ['duo','Studio Duo','Creative','dual','Two independent brand marks above the identity block.',{logoWidth:66,partnerWidth:66,tracking:.3}],
 ['colorblock','Colorblock Studio','Creative','colorblock','A contrasting identity panel with a separate details column.',{tint:'#eaf0fa',accent:'#235dcc',link:'#235dcc',padding:16,baseWidth:580}],
 ['social','Social First','Creative','social-first','Social links lead a compact creator-focused signature.',{nameSize:24,logoWidth:48,iconSize:28,iconStyle:'tile'}],
 ['independent','The Independent','Creative','offset','A right-aligned brand mark and full-width closing rule.',{nameFont:'courier',nameSize:23,logoWidth:62,ruleWidth:2}],
 ['residence','The Residence','Hospitality & Culture','residence','A venue-style masthead above a warm personal introduction.',{nameFont:'georgia',nameWeight:400,logoWidth:50,tint:'#f0ece6',accent:'#8c7660'}],
 ['invitation','Private Invitation','Hospitality & Culture','invitation','A centered, double-ruled invitation-style signature.',{align:'center',nameFont:'georgia',nameWeight:400,nameSize:28,logoWidth:46,baseWidth:460}],
 ['credits','Film Credits','Hospitality & Culture','credits','A credit-line header with disciplined typography.',{nameFont:'sans',nameCase:'uppercase',nameSize:24,tracking:1.1,logoWidth:44,contactLabels:'short'}],
 ['property','Property Advisor','Hospitality & Culture','property','A portrait and brand lockup with room for a property banner.',{portraitWidth:102,logoWidth:56,baseWidth:540}],
 ['guest','Guest Relations','Hospitality & Culture','guest','An understated brand header over guest-facing details.',{nameFont:'georgia',nameWeight:400,logoWidth:50}],
 ['partners','Partnership Desk','Hospitality & Culture','partners','Two brands and a split contact desk for collaborations.',{logoWidth:58,partnerWidth:58,baseWidth:560}],
 ['twoline','Two-Line Essential','Compact & Reply','inline','Identity on one line and a compact contact line below.',{showLogo:false,nameSize:16,roleSize:11,bodySize:11,sectionGap:6,padding:4,baseWidth:400}],
 ['reply','Reply Note','Compact & Reply','reply','A restrained sign-off for ongoing conversations.',{showLogo:false,nameSize:17,bodySize:11,roleSize:11,sectionGap:5,padding:2,baseWidth:360}],
 ['micro','Micro Mark','Compact & Reply','micromark','A miniature logo punctuates a compact sign-off.',{nameSize:18,logoWidth:30,sectionGap:6,padding:4,baseWidth:400}],
 ['mono','Monochrome Note','Compact & Reply','clean','Minimal contact typography with a small brand header.',{nameSize:20,logoWidth:34,nameWeight:400,sectionGap:7,baseWidth:410}]
];
export const TEMPLATES = defs.map(([id,name,category,layout,description,design])=>({id,name,category,layout,description,design:{...BASE_DESIGN,layout,...design}}));
export const CATEGORIES = [...new Set(TEMPLATES.map(t=>t.category))];
export const SECTIONS = ['tagline','contact','custom','social','cta','announcement','banner','note','disclaimer'];
export const SECTION_LABELS = {tagline:'Tagline',contact:'Contact details',custom:'Custom fields',social:'Social links',cta:'Calls to action',announcement:'Announcement',banner:'Image banner',note:'Personal note',disclaimer:'Disclaimer'};
export function freshProject(){return {
 schemaVersion:2,templateId:'classic',name:'Modern Gentlemen · Primary',variant:'full',
 identity:{name:'Jason Mallard',title:'Creator & Founder',company:'Modern Gentlemen',kicker:'',pronouns:'',department:'',tagline:'The Lifestyle Guide for the Modern Man',email:'partners@moderngentlemen.co',phone:'334-581-1193',mobile:'',website:'https://www.moderngentlemen.co',address:'',availability:''},
 visible:{name:true,title:true,company:true,pronouns:true,department:true,kicker:true,email:true,phone:true,mobile:true,website:true,address:true,availability:true},
 design:{...BASE_DESIGN},assets:{logo:{src:'/design/media/mg-logo.png',alt:'Modern Gentlemen',link:'https://www.moderngentlemen.co',zoom:100,x:0,y:0,fit:'contain'},portrait:{src:'',alt:'Portrait',link:'',zoom:100,x:0,y:0,fit:'cover'},partner:{src:'',alt:'Partner logo',link:'',zoom:100,x:0,y:0,fit:'contain'},banner:{src:'',alt:'',link:'',zoom:100,x:0,y:0,fit:'cover'}},
 socials:NETWORKS.slice(0,4).map(([id,label])=>({id,label,url:'',enabled:true,customIcon:''})),
 sections:SECTIONS.map(type=>({type,enabled:true})),
 content:{ctaLabel:'Book a conversation',ctaUrl:'',cta2Label:'View portfolio',cta2Url:'',announcementTitle:'',announcementText:'',announcementUrl:'',note:'',disclaimer:''},extras:[],publishedAssets:{}
};}
export function applyTemplate(project,template,keepBrand=false){
 const p=structuredClone(project),brand={};
 if(keepBrand) for(const k of ['primary','secondary','link','accent','tint','background','nameFont','bodyFont','ctaColor','ctaText'])brand[k]=p.design[k];
 p.design={...BASE_DESIGN,...template.design,...brand};p.templateId=template.id;
 p.variant=template.id==='reply'?'reply':'full';p.publishedAssets={};return p;
}
