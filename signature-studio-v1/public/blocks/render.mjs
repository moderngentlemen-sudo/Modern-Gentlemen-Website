/** One renderer for the editing canvas and exports; editor attributes are opt-in. */
import {FONTS} from '../design/catalog.mjs';
import {esc,safeUrl,safeImage,renderSignature,contrast} from '../design/engine.mjs';
import {walk} from './model.mjs';
export function rich(text){
 const pattern=/(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\))/g;let out='',at=0,m;
 while((m=pattern.exec(text))){out+=esc(text.slice(at,m.index));if(m[2])out+='<strong>'+esc(m[2])+'</strong>';else if(m[3])out+='<em>'+esc(m[3])+'</em>';else {const u=safeUrl(m[5]);out+=u?`<a href="${esc(u)}" style="color:inherit">${esc(m[4])}</a>`:esc(m[4]);}at=pattern.lastIndex;}
 return (out+esc(text.slice(at))).replaceAll('\n','<br>');
}
export function effective(node,doc,parent={}){const d=doc.design;return {font:node.type==='heading'?d.nameFont:d.bodyFont,size:node.type==='heading'?d.nameSize:d.bodySize,color:d.primary,align:d.align,weight:node.type==='heading'?d.nameWeight:400,lineHeight:d.lineHeight,tracking:0,nowrap:'inherit',...parent,...(node.type==='heading'?{font:d.nameFont,size:d.nameSize,weight:d.nameWeight}:{}),...node.style};}
export function valueOf(n,doc){return n.props.bind?doc.identity[n.props.bind]||'':n.props.text??n.props.value??'';}
export function renderBlocks(doc,{edit=false,images={},origin='https://example.com'}={}){
 const d=doc.design,scale=d.scale/100,px=n=>Math.round(n*scale*100)/100;const style=o=>Object.entries(o).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>k+':'+v).join(';');
 const table=(body,w='100%',s={})=>`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${w}" style="border-collapse:collapse;${esc(style(s))}">${body}</table>`;
 const a=(text,url,s={})=>url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="${esc(style({color:d.link,'text-decoration':d.linkUnderline?'underline':'none',...s}))}">${text}</a>`:text;
 const empty=label=>edit?`<div data-placeholder="true" style="height:28px;font:11px Arial;color:#888">${esc(label)}</div>`:'';
 const active=n=>n.visibility!=='hidden'&&(n.visibility==='both'||n.visibility===doc.variant);
 function list(nodes,width,parent={}){
  const usable=nodes.filter(n=>edit||active(n));const rows=usable.map(n=>{
   const s=effective(n,doc,parent),attrs=edit?` data-bid="${n.id}" data-type="${n.type}" tabindex="0" aria-label="${esc(n.label)}"${!active(n)?' data-hidden="true"':''}`:'';
   const box={'vertical-align':s.valign||'top','text-align':s.align,'font-family':FONTS[s.font]?.value||FONTS.sans.value,'font-size':px(s.size)+'px','font-weight':s.weight,'line-height':s.lineHeight,color:s.color,'letter-spacing':px(s.tracking)+'px','white-space':s.nowrap==='normal'?'normal':s.nowrap==='nowrap'||d.nowrap?'nowrap':'normal',padding:px(n.style.padding||0)+'px','background-color':n.style.background,'border':n.style.border?`${px(n.style.border)}px solid ${n.style.borderColor||d.accent}`:undefined,'border-radius':n.style.radius?px(n.style.radius)+'px':undefined,'text-transform':s.casing==='none'?undefined:s.casing};
   const body=content(n,Math.max(24,width-2*(n.style.padding||0)),s);
   if(!body&&!edit)return '';
   return `<tr><td${attrs} style="${esc(style(box))}">${body||empty(n.label+' · click to edit')}</td></tr>`;
  }).filter(Boolean);
  const gap=px(parent.gap??d.sectionGap),spacer=gap?`<tr><td height="${gap}" style="height:${gap}px;font-size:0;line-height:0" aria-hidden="true">&nbsp;</td></tr>`:'';
  return rows.length?table(rows.join(spacer)):empty('Drop a block here');
 }
 function content(n,width,s){const p=n.props;
  const inherited={font:s.font,size:s.size,color:s.color,align:s.align,lineHeight:s.lineHeight,nowrap:s.nowrap,gap:n.style.gap??d.sectionGap};
  if(['section','group','panel','column'].includes(n.type))return list(n.children,width,inherited);
  if(n.type==='columns'){
   const gap=n.style.gap??d.gap,available=width-gap*(n.children.length-1);return table('<tr>'+n.children.map((col,j)=>{
    const cw=Math.max(20,available*p.ratios[j]/100),cs=effective(col,doc,inherited),att=edit?` data-bid="${col.id}" data-type="column"${!active(col)?' data-hidden="true"':''} tabindex="0" aria-label="${esc(col.label)}"`:'';
    const body=edit||active(col)?list(col.children,cw-2*(col.style.padding||0),{...inherited,...col.style}):'';
    return `<td${att} width="${px(cw)}" style="width:${px(cw)}px;vertical-align:${cs.valign||'top'};padding:${px(col.style.padding||0)}px;background-color:${col.style.background||'transparent'}">${body}</td>`+(j<n.children.length-1?`<td width="${px(gap)}" style="width:${px(gap)}px;font-size:0">&nbsp;</td>`:'');
   }).join('')+'</tr>');
  }
  if(n.type==='template'){
   const im={};for(const [k,v]of Object.entries(images))if(k.startsWith(n.id+':'))im[k.slice(n.id.length+1)]=v;
   return renderSignature({...p.project,variant:doc.variant,design:{...p.project.design,scale:d.scale}},{images:im,origin});
  }
  if(n.type==='heading'||n.type==='text')return `<span${edit?' data-edit="text"':''} style="${p.italic?'font-style:italic;':''}${p.underline?'text-decoration:underline;':''}">${rich(valueOf(n,doc))}</span>`;
  if(n.type==='contact'){
   const val=valueOf(n,doc),kind=p.kind||p.bind||'custom';const url=kind==='email'?safeUrl(val,{email:true}):['phone','mobile'].includes(kind)?safeUrl(val,{phone:true}):kind==='website'?safeUrl(val):safeUrl(p.url);
   return (p.label?`<span style="color:${d.secondary}">${esc(p.label)} </span>`:'')+a(esc(val),url);
  }
  if(n.type==='button'){
   if(!p.text)return '';const app=p.appearance||'outline';return table(`<tr><td align="${s.align}" style="padding:${px(6)}px ${px(12)}px;${app==='filled'?`background-color:${d.ctaColor};`:''}${app!=='text'?`border:${px(1)}px solid ${d.accent};border-radius:${px(n.style.radius??d.ctaRadius)}px;`:''}">${a(esc(p.text),safeUrl(p.url),{color:app==='filled'?d.ctaText:s.color,'text-decoration':'none'})}</td></tr>`,'',{'margin':s.align==='center'?'0 auto':s.align==='right'?'0 0 0 auto':'0'});
  }
  if(n.type==='image'||n.type==='qr'){
   const key=n.id,src=safeImage(images[key]||p.src||'',origin);if(!src)return empty(n.type==='qr'?'Enter a QR destination':'Add artwork in the inspector');
   const w=n.type==='qr'?p.size||100:p.width||92,h=n.type==='qr'?w:p.height||92;
   const img=`<img src="${esc(src)}" alt="${esc(p.alt||'')}" width="${px(w)}" height="${px(h)}" border="0" style="display:block;width:${px(w)}px;height:${px(h)}px;margin:${s.align==='center'?'0 auto':s.align==='right'?'0 0 0 auto':'0'};border:0">`;
   return a(img,safeUrl(p.url));
  }
  if(n.type==='divider'){
   const thick=px(p.thickness||1),line=['solid','dashed','dotted'].includes(p.line)?p.line:'solid',ink=n.style.color||d.accent;
   return p.orientation==='vertical'?table(`<tr><td height="${px(p.height||60)}" style="height:${px(p.height||60)}px;border-left:${thick}px ${line} ${ink};font-size:0">&nbsp;</td></tr>`,thick):table(`<tr><td style="border-top:${thick}px ${line} ${ink};font-size:0;line-height:0"></td></tr>`,(p.length||100)+'%');
  }
  if(n.type==='spacer')return `<div style="width:${px(p.width||12)}px;height:${px(p.height??14)}px;line-height:0;font-size:0">&nbsp;</div>`;
  if(n.type==='social'){
   const items=(p.items||[]).map((x,i)=>({...x,i})).filter(x=>x.enabled&&safeUrl(x.url));if(!items.length)return empty('Social links · add destinations');
   const size=p.size||24,gap=p.gap??8,app=p.appearance||'bare';return table('<tr>'+items.map((item,j)=>{
    const bg=['circle','tile'].includes(app)?d.accent:'transparent',ink=bg==='transparent'?d.accent:'#ffffff';
    let art=app==='text'?esc(item.label):app==='letter'?esc(item.label.slice(0,2)):'';
    if(!art){const src=safeImage(images[n.id+':'+item.i]||item.customIcon||`/design/media/${item.id}-${bg==='transparent'?'dark':'light'}.png`,origin);art=`<img alt="${esc(item.label)}" src="${esc(src)}" width="${px(size-6)}" height="${px(size-6)}" border="0" style="display:block;width:${px(size-6)}px;height:${px(size-6)}px;border:0">`;}
    return `<td style="padding:0 ${j===items.length-1?0:px(gap)}px 0 0">`+table(`<tr><td align="center" style="padding:${px(3)}px;color:${ink};background-color:${bg};border:${app==='outline'?px(1)+'px solid '+d.accent:'0'};border-radius:${px(app==='circle'||app==='outline'?size/2:app==='tile'?6:0)}px;font-size:${px(11)}px">${a(art,safeUrl(item.url),{color:ink})}</td></tr>`,'')+'</td>';
   }).join('')+'</tr>','');
  }
  return '';
 }
 const width=d.baseWidth-2*d.padding;
 return table(`<tr><td style="padding:${px(d.padding)}px">${list(doc.children,width)}</td></tr>`,px(d.baseWidth),{width:px(d.baseWidth)+'px','font-family':FONTS[d.bodyFont].value,'font-size':px(d.bodySize)+'px',color:d.primary,'background-color':d.transparent?'transparent':d.background});
}
export function checks(doc,html,width,mediaErrors=[]){const items=[...mediaErrors.map(text=>({level:'warning',text}))];
 if(width>doc.design.targetWidth+1)items.push({level:'warning',text:`${Math.ceil(width)} px exceeds the ${doc.design.targetWidth} px target. Auto-fit or simplify the composition.`});
 if(html.length>10000)items.push({level:'warning',text:`HTML has ${html.length.toLocaleString()} characters. Gmail counts signature content differently; simplify and test installation.`});
 if(/src="data:/.test(html))items.push({level:'warning',text:'Local artwork: publish images before copying to Gmail.'});
 let small=false,missing=false,qrSmall=false,count=0;walk(doc.children,n=>{count++;if(['text','contact','heading'].includes(n.type)&&effective(n,doc).size*doc.design.scale/100<10)small=true;if(['image','qr'].includes(n.type)&&!n.props.alt)missing=true;if(n.type==='qr'&&(n.props.size||100)*doc.design.scale/100<90)qrSmall=true;if(n.type==='button'&&!safeUrl(n.props.url))items.push({level:'warning',text:`${n.label}: add a valid destination before installing.`});});
 if(small)items.push({level:'warning',text:'Some text is below 10 px after scaling. Use a simpler layout instead of further shrinking.'});
 if(qrSmall)items.push({level:'warning',text:'A QR code is under 90 px. Increase its size and scan-test the exported result.'});
 if(missing)items.push({level:'warning',text:'Add alternative text to images and QR blocks.'});
 if(contrast(doc.design.secondary,doc.design.transparent?'#ffffff':doc.design.background)<4.5)items.push({level:'warning',text:'Secondary text has low contrast against the selected background.'});
 if(!items.length)items.push({level:'ok',text:'No basic design warnings. Test a real email before broad use.'});return {items,count,characters:html.length};
}
