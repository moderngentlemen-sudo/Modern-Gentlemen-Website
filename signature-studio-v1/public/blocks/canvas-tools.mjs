/** Editor-only overlays and user preferences. Nothing here is serialized to signature HTML. */
import {GRID_STEPS,toolPreferences,pointIn} from './alignment.mjs';
import {find,CONTAINERS} from './model.mjs';
const $=id=>document.getElementById(id);
const PREF='signature-studio.canvas-tools.v1';
const rect=(el)=>el?.getBoundingClientRect();
const place=(el,x,y)=>{el.style.left=x+'px';el.style.top=y+'px';};
const imageParts=['logo','portrait','partner','banner'];
export class CanvasTools {
 constructor(getState,onAlign){
  this.state=getState;this.align=onAlign;
  try{this.prefs=toolPreferences(JSON.parse(localStorage.getItem(PREF)||'{}'));}catch{this.prefs=toolPreferences();}
  this.bar=document.createElement('div');this.bar.className='alignment-toolbar';this.bar.dataset.canvasControl='true';
  this.bar.innerHTML=`<div class="alignment-options"><button type="button" id="gridToggle" aria-pressed="false" title="Show or hide the design grid">▦ Grid</button><label title="Snap handle sizes and spacing to design-pixel increments"><input type="checkbox" id="snapToggle">Snap</label><select id="gridStep" aria-label="Grid spacing">${GRID_STEPS.map(n=>`<option value="${n}">${n} px</option>`).join('')}</select><select id="handleMode" aria-label="Handle mode"><option value="size">Size handles</option><option value="spacing">Spacing handles</option></select></div><div class="quick-alignment" role="group" aria-label="Align selected content"><button type="button" data-canvas-align="left" title="Align selected content left">Left</button><button type="button" data-canvas-align="center" title="Align selected content center">Center</button><button type="button" data-canvas-align="right" title="Align selected content right">Right</button></div><span class="alignment-hint">Design pixels · Alt bypasses snap</span>`;
  document.querySelector('.preview-toolbar').after(this.bar);
  this.grid=document.createElement('div');this.grid.id='canvasGrid';this.grid.setAttribute('aria-hidden','true');$('scaleWrap').append(this.grid);
  this.layer=document.createElement('div');this.layer.id='canvasTools';this.layer.dataset.canvasControl='true';document.body.append(this.layer);
  this.frame=document.createElement('div');this.frame.className='handle-frame';this.frame.setAttribute('aria-hidden','true');this.layer.append(this.frame);
  document.querySelector('#selectionBar [data-drag-selected]')?.remove();
  this.grip=this.button('Move selected block','move','⠿');this.grip.id='canvasMoveHandle';this.grip.dataset.dragSelected='';this.grip.dataset.action='move';
  this.grip.title='Drag to move between rows or columns. Click for Move to…';
  this.handles={};
  for(const edge of ['nw','n','ne','e','se','s','sw','w']){
   const el=edge==='se'?$('resizeHandle'):this.button('Resize '+edge,'size');
   this.layer.append(el);el.type='button';el.className='canvas-handle size-handle edge-'+edge;el.dataset.canvasResize='size:'+edge;el.setAttribute('aria-label','Resize '+({nw:'top left',n:'top',ne:'top right',e:'right',se:'bottom right',s:'bottom',sw:'bottom left',w:'left'}[edge]));el.title='Drag to resize · Alt: free of grid · Shift: independent image dimensions';el.hidden=true;this.handles[edge]=el;
  }
  this.columns=[0,1].map(i=>{const el=this.button('Resize column divider '+(i+1),'column');el.dataset.canvasResize='column:'+i;el.title='Drag divider · Arrow keys adjust width · Alt bypasses snap';return el;});
  this.paddings=Object.fromEntries(['Top','Right','Bottom','Left'].map(side=>{const el=this.button('Adjust '+side.toLowerCase()+' spacing','padding');el.dataset.canvasResize='padding:'+side;el.title='Drag '+side.toLowerCase()+' inset · changes exported padding';return [side,el];}));
  this.readout=document.createElement('div');this.readout.id='snapReadout';this.readout.hidden=true;this.layer.append(this.readout);
  this.guides=['X','Y'].map(axis=>{const el=document.createElement('div');el.className='snap-guide axis-'+axis.toLowerCase();el.id='snapGuide'+axis;el.hidden=true;this.layer.append(el);return el;});
  $('gridToggle').onclick=()=>this.set({grid:!this.prefs.grid});
  $('snapToggle').onchange=e=>this.set({snap:e.target.checked});$('gridStep').onchange=e=>this.set({step:Number(e.target.value)});$('handleMode').onchange=e=>this.set({handles:e.target.value});
  this.bar.querySelectorAll('[data-canvas-align]').forEach(b=>b.onclick=()=>this.align(b.dataset.canvasAlign));
  this.sync();
 }
 button(label,kind,text=''){const el=document.createElement('button');el.type='button';el.className='canvas-handle '+kind+'-handle';el.setAttribute('aria-label',label);el.textContent=text;el.hidden=true;this.layer.append(el);return el;}
 sync(){const p=this.prefs;$('gridToggle').setAttribute('aria-pressed',String(p.grid));$('snapToggle').checked=p.snap;$('gridStep').value=p.step;$('handleMode').value=p.handles;}
 set(values){this.prefs=toolPreferences({...this.prefs,...values});try{localStorage.setItem(PREF,JSON.stringify(this.prefs));}catch{}this.sync();this.update();}
 contentBox(el,node){return ['image','qr'].includes(node?.type)||(node?.type==='fragment'&&imageParts.includes(node.props.part))?el?.querySelector('img')||el:el?.querySelector(':scope > [data-width-box]')||el;}
 show(el,x,y){place(el,x-12,y-12);el.hidden=false;}
 update(){
  const focus=this.layer.contains(document.activeElement)?document.activeElement:null;
  const restoreFocus=()=>{if(focus&&!focus.hidden&&!this.layer.hidden)focus.focus({preventScroll:true});};
  const {doc,selected,zoom,viewOnly,dragging,resizing}=this.state();const cell=selected?$('canvas').querySelector(`[data-bid="${selected}"]`):null,n=find(doc,selected);
  const cv=rect($('canvas')),table=rect($('canvas').firstElementChild),sr=rect($('stage'));
  this.grid.hidden=!this.prefs.grid||viewOnly;
  const spacing=this.prefs.step*doc.design.scale/100;this.grid.style.backgroundSize=`${spacing}px ${spacing}px`;
  this.grid.style.width=(table?.width||cv.width)/zoom+'px';this.grid.style.height=(table?.height||cv.height)/zoom+'px';
  // Clip fixed controls to the visible canvas viewport; they never cover the inspector.
  let clip={left:Math.max(0,sr.left+1),right:Math.min(innerWidth,sr.right-1),top:Math.max(0,sr.top+1),bottom:Math.min(innerHeight,sr.bottom-1)};
  for(let parent=$('stage').parentElement;parent&&parent!==document.body;parent=parent.parentElement){const css=getComputedStyle(parent),r=rect(parent);if(/auto|scroll|hidden|clip/.test(css.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}if(/auto|scroll|hidden|clip/.test(css.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}}
  this.layer.style.clipPath=`inset(${clip.top}px ${Math.max(0,innerWidth-clip.right)}px ${Math.max(0,innerHeight-clip.bottom)}px ${clip.left}px)`;
  this.layer.hidden=viewOnly||!cell||dragging||$('modal').open;this.frame.hidden=this.layer.hidden;
  for(const el of [this.grip,...Object.values(this.handles),...this.columns,...Object.values(this.paddings)])el.hidden=true;
  this.bar.querySelectorAll('[data-canvas-align]').forEach(b=>{b.disabled=!n||viewOnly||!!resizing||dragging;b.setAttribute('aria-pressed',String(!!n&&(n.style.align||doc.design.align)===b.dataset.canvasAlign));});
  if(!cell||this.layer.hidden){this.clearMeasurement();return;}
  const target=this.contentBox(cell,n),r=rect(target);this.currentRect=r;
  Object.assign(this.frame.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  if(!resizing&&n.type!=='column')this.show(this.grip,Math.max(sr.left+13,r.left-16),r.top+Math.min(14,r.height/2));
  if(this.prefs.handles==='spacing'){
   const cr=rect(cell),f=zoom*doc.design.scale/100;
   const p=side=>(n.style['padding'+side]??n.style.padding??0)*f;
   this.show(this.paddings.Top,cr.left+cr.width/2,cr.top+p('Top'));
   this.show(this.paddings.Bottom,cr.left+cr.width/2,cr.bottom-p('Bottom'));
   this.show(this.paddings.Left,cr.left+p('Left'),cr.top+cr.height/2);
   this.show(this.paddings.Right,cr.right-p('Right'),cr.top+cr.height/2);
   restoreFocus();return;
  }
  if(n.type==='columns'){
   for(let i=0;i<n.children.length-1;i++){const a=rect(cell.querySelector(`[data-bid="${n.children[i].id}"]`)),b=rect(cell.querySelector(`[data-bid="${n.children[i+1].id}"]`));if(a&&b){const h=i===0?this.handles.se:this.columns[i];h.dataset.canvasResize='column:'+i;h.className='canvas-handle column-handle';h.setAttribute('aria-label','Resize column divider '+(i+1));this.show(h,(a.right+b.left)/2,Math.max(a.top,b.top)+Math.min(a.height,b.height)/2);}}
   restoreFocus();return;
  }
  const artwork=['image','qr','spacer'].includes(n.type)||(n.type==='fragment'&&imageParts.includes(n.props.part));
  if(n.type==='column')return; // Cell proportions belong to the enclosing Columns element.
  const positions={nw:[r.left,r.top],n:[r.left+r.width/2,r.top],ne:[r.right,r.top],e:[r.right,r.top+r.height/2],se:[r.right,r.bottom],s:[r.left+r.width/2,r.bottom],sw:[r.left,r.bottom],w:[r.left,r.top+r.height/2]};
  const edges=artwork?(n.type==='qr'?['nw','ne','se','sw']:['nw','n','ne','e','se','s','sw','w']):['e','w'];
  for(const edge of edges){const h=this.handles[edge];h.dataset.canvasResize=(artwork?'size:':'width:')+edge;h.className='canvas-handle size-handle edge-'+edge;h.setAttribute('aria-label',artwork?'Resize '+({se:'bottom right',nw:'top left',ne:'top right',sw:'bottom left',e:'right',w:'left',n:'top',s:'bottom'}[edge]):'Resize block width '+(edge==='e'?'right':'left'));this.show(h,...positions[edge]);}
  restoreFocus();
 }
 measurement(text,x=null,y=null){const sr=rect($('stage')),r=this.currentRect||sr;this.readout.textContent=text;this.readout.hidden=false;place(this.readout,Math.max(sr.left+5,Math.min(r.left,innerWidth-220)),Math.min(sr.bottom-28,r.bottom+17));
  for(const [i,v]of [x,y].entries()){const line=this.guides[i];line.hidden=v===null||!this.prefs.snap;if(v!==null){place(line,i===0?v:sr.left,i===1?v:sr.top);line.style[i===0?'height':'width']=(i===0?sr.height:sr.width)+'px';}}
  $('dragStatus').textContent=text;
 }
 clearMeasurement(){this.readout.hidden=true;this.guides.forEach(g=>g.hidden=true);}
}
/** Ignore empty row/padding space while keeping actual content and explicit container edges selectable. */
export function hitBlock(target,x,y,canvas){
 const el=target?.closest?.('[data-bid]');if(!el||!canvas.contains(el))return null;
 if(target.closest('[data-placeholder]'))return el;
 if(CONTAINERS.includes(el.dataset.type)){
  const r=rect(el);const borderHit=Math.min(Math.abs(x-r.left),Math.abs(x-r.right),Math.abs(y-r.top),Math.abs(y-r.bottom))<=4;
  return borderHit?el:null;
 }
 if(el.dataset.type==='spacer')return el;
 if(target.closest('img'))return el;
 // Range rectangles distinguish rendered text from the otherwise full-width table cell.
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let text;
 while((text=walker.nextNode())){if(!text.textContent.trim()||text.parentElement?.closest('[data-bid]')!==el)continue;const range=document.createRange();range.selectNodeContents(text);if([...range.getClientRects()].some(r=>pointIn(r,x,y,3)))return el;}
 const images=[...el.querySelectorAll('img')];if(images.some(im=>pointIn(rect(im),x,y,2)))return el;
 if(target.closest('a,button,[data-edit],[data-u-bind]'))return el;
 // Empty leaf blocks need to remain selectable for configuration.
 return !el.textContent.trim()&&!images.length?el:null;
}
