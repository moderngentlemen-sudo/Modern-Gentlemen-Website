import test from 'node:test';
import assert from 'node:assert/strict';
import {toolPreferences,snapValue,designDelta,resizeArtwork,resizeColumnRatios,resizePadding,pointIn} from '../public/blocks/alignment.mjs';
import {freshDocument,block,normalize,find} from '../public/blocks/model.mjs';
import {renderBlocks} from '../public/blocks/render.mjs';
import {newSignature} from '../public/studio/model.mjs';
import {render} from '../public/studio/render.mjs';

test('Canvas preferences are validated separately from document styling',()=>{
 assert.deepEqual(toolPreferences({step:'12',grid:false,handles:'spacing'}),{step:12,grid:false,snap:true,handles:'spacing'});
 assert.equal(toolPreferences({step:0,handles:'anything'}).step,8);
 assert.equal(toolPreferences({snap:'no'}).snap,true);
});
for(const step of [4,8,12,16,24])test('Size values snap to '+step+'px increments',()=>{for(let i=30;i<180;i++)assert.equal(snapValue(i,step)%step,0);});
test('Alt-style bypass preserves a non-grid dimension',()=>assert.equal(snapValue(103.5,8,false),103.5));
test('Limits take precedence over grid increments',()=>{assert.equal(snapValue(199,8,true,24,190),190);assert.equal(snapValue(-10,8,true,24,190),24);});
for(const zoom of [.75,1,1.25])for(const scale of [60,100])test(`Pointer geometry respects zoom ${zoom} and export scale ${scale}`,()=>{
 const d=designDelta(24*zoom*scale/100,16*zoom*scale/100,zoom,scale);assert.ok(Math.abs(d.dx-24)<.00001);assert.ok(Math.abs(d.dy-16)<.00001);
});
test('Corner resizing preserves aspect ratio with a snapped driving dimension',()=>{
 const result=resizeArtwork({width:100,height:50,dx:21,dy:7});assert.deepEqual(result,{width:120,height:60});
});
test('West and north resize handles reverse the delta',()=>{
 const a=resizeArtwork({width:96,height:96,dx:-24,dy:-24,edge:'nw'});assert.deepEqual(a,{width:120,height:120});
});
test('Shift allows independent dimensions, both snapped',()=>assert.deepEqual(resizeArtwork({width:96,height:64,dx:23,dy:13,free:true}),{width:120,height:80}));
test('Tall images stay within height limits without distorting proportions',()=>{const a=resizeArtwork({width:100,height:250,dx:300,dy:0});assert.equal(a.height,300);assert.equal(a.width,120);});
test('Vertical-only handles preserve aspect ratio',()=>assert.deepEqual(resizeArtwork({width:120,height:60,dy:20,edge:'s'}),{width:160,height:80}));
test('Two-column divider snapping is based on actual available width',()=>{
 const a=resizeColumnRatios([40,60],0,15,400,8);assert.deepEqual(a,[44,56]);assert.equal(a[0]*4%8,0);
});
test('Three-column second divider leaves first cell untouched and preserves adjacent total',()=>{
 const a=resizeColumnRatios([20,40,40],1,30,400,8);assert.deepEqual(a,[20,48,32]);assert.equal(a.reduce((x,y)=>x+y),100);
});
test('Column bounds prevent normalization-induced jumps',()=>{assert.deepEqual(resizeColumnRatios([20,40,40],1,999,400,8),[20,70,10]);});
test('Nested narrow columns use their own width, not document width',()=>{assert.deepEqual(resizeColumnRatios([50,50],0,16,160,8),[60,40]);});
test('Each spacing handle sets exported padding with inward-positive direction',()=>{
 assert.equal(resizePadding({},'Left',19),16);assert.equal(resizePadding({},'Right',-19),16);assert.equal(resizePadding({},'Top',19),16);assert.equal(resizePadding({},'Bottom',-19),16);
});
test('Padding starts from the common padding until overridden',()=>{assert.equal(resizePadding({padding:8},'Left',16),24);assert.equal(resizePadding({padding:8,paddingLeft:0},'Left',16),16);});
test('Padding respects per-side bounds and free movement',()=>{assert.equal(resizePadding({},'Top',99),48);assert.equal(resizePadding({},'Left',99),64);assert.equal(resizePadding({},'Left',19,8,false),19);});
test('Selected content widths and padding survive project round-trip and export scale',()=>{
 const d=freshDocument(true);d.design.scale=75;const n=block('text',{text:'Aligned'},{width:240,paddingLeft:16,align:'right'});d.children=[n];const copy=normalize(JSON.parse(JSON.stringify(d)));
 const h=renderBlocks(copy);assert.match(h,/width="180"/);assert.match(h,/align="right"/);assert.match(h,/padding-left:12px/);assert.ok(!/data-width-box|canvasGrid|canvasTools/.test(h));assert.ok(renderBlocks(copy,{edit:true}).includes('data-width-box'));
});
test('Fixed width remains bounded to its parent column',()=>{const d=freshDocument(true);d.design.baseWidth=300;d.design.padding=0;d.children=[block('text',{text:'short'},{width:900})];assert.ok(!renderBlocks(d).includes('width="900"'));});
test('Connected fragments inherit parent alignment, with local overrides retaining priority',()=>{
 const d=newSignature();const root=d.children[0];root.style.align='right';const h=render(d);assert.match(h,/align="right"/);
 let ids=[];function walk(nodes){for(const n of nodes){if(n.props.part==='identity')ids.push(n.id);walk(n.children);}}walk(d.children);
 find(d,ids[0]).style.align='center';assert.match(render(d),/text-align:center/);
});
test('Native social block gets an email-table alignment attribute',()=>{const d=freshDocument(true);d.children=[block('social',{items:[{id:'custom',label:'Site',url:'https://example.com',enabled:true}],appearance:'text'},{align:'right'})];assert.match(renderBlocks(d),/table align="right"/);});
test('Rect hit tests distinguish content from surrounding whitespace',()=>{
 const r={left:10,right:100,top:30,bottom:50};assert.equal(pointIn(r,50,40),true);assert.equal(pointIn(r,150,40),false);assert.equal(pointIn(r,102,40,3),true);
});
