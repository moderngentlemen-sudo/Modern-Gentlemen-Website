import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {freshProject,TEMPLATES,applyTemplate} from '../public/design/catalog.mjs';
import {renderSignature,normalizeProject,safeImage} from '../public/design/engine.mjs';
import {freshDocument,block,preservedProject,normalize,walk} from '../public/blocks/model.mjs';
import {renderBlocks} from '../public/blocks/render.mjs';
import {fromDesign,designProject} from '../public/studio/model.mjs';
import {render,prepare} from '../public/studio/render.mjs';
import {prepareBlocks} from '../public/blocks/media.mjs';
import {digest,readImage} from '../public/design/media.mjs';
import {collectRenderedImages,normalizeEmailAssetMetadata} from '../public/shared/rendered-images.mjs';

const origin='https://studio.example';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const inventory=(doc,renderer=render)=>collectRenderedImages(doc,{render:renderer,origin});
function sourceProject(){const p=freshProject();p.socials=['instagram','linkedin','x'].map(id=>({id,label:id,url:'https://example.com/'+id,enabled:true,customIcon:''}));return p;}

test('actual unified output inventories the default logo and packaged Instagram, LinkedIn and X icons',()=>{
 const p=sourceProject(),doc=fromDesign(p),before=JSON.stringify(doc),result=inventory(doc);
 assert.deepEqual(new Set(result.inventory.map(i=>i.kind)),new Set(['logo','social']));
 assert.equal(result.inventory.length,4);assert.equal((result.html.match(/<img\b/g)||[]).length,4);
 for(const id of ['instagram','linkedin','x'])assert.ok(result.inventory.some(i=>i.source.includes('/'+id+'-')));
 assert.doesNotMatch(result.html,/data-ss-/);assert.equal(JSON.stringify(doc),before);
});

test('unused eager design branches never appear in the authoritative inventory',()=>{
 const p=sourceProject();p.design.layout='text';p.sections.find(s=>s.type==='social').enabled=false;
 const result=inventory(p,renderSignature);assert.equal(result.inventory.length,0);assert.doesNotMatch(result.html,/<img/);
});

test('all existing templates inventory exactly their final rendered images',()=>{
 for(const template of TEMPLATES){const p=applyTemplate(sourceProject(),template),result=inventory(p,renderSignature);assert.equal(result.inventory.length,(result.html.match(/<img\b/g)||[]).length,template.id);}
});

test('text and letter socials have no image dependency in all renderers',()=>{
 for(const style of ['text','letter']){
  const p=sourceProject();p.design.iconStyle=style;p.assets.logo.src='';assert.equal(inventory(fromDesign(p)).inventory.length,0);
  const d=freshDocument(true);d.children=[block('social',{appearance:style,items:p.socials})];assert.equal(inventory(d,renderBlocks).inventory.length,0);
 }
});

test('Full Reply both and hidden ancestors select only actually rendered artwork',()=>{
 const d=freshDocument(true),full=block('image',{src:png}),reply=block('image',{src:png}),both=block('image',{src:png}),hidden=block('group',{}, {},[block('image',{src:'https://private.example/secret.png'})]);
 full.visibility='full';reply.visibility='reply';hidden.visibility='hidden';d.children=[full,reply,both,hidden];
 d.variant='full';assert.deepEqual(inventory(d,renderBlocks).inventory.map(i=>i.id),[full.id,both.id]);
 d.variant='reply';assert.deepEqual(inventory(d,renderBlocks).inventory.map(i=>i.id),[reply.id,both.id]);
});

test('explicit unified logo visibility in Reply works while default legacy Reply stays compact',()=>{
 const p=sourceProject(),doc=fromDesign(p);let logo;walk(doc.children,n=>{if(n.props.part==='logo')logo=n;});assert.ok(logo);
 doc.variant='reply';assert.equal(inventory(doc).inventory.length,0);
 logo.visibility='both';assert.equal(inventory(doc).inventory.filter(i=>i.kind==='logo').length,1);
 assert.match(render(doc),/font-size:18px/);
 p.variant='reply';assert.equal(inventory(p,renderSignature).inventory.length,0);
});

test('portrait partner banner custom social and preserved template sources retain processing recipes',()=>{
 const p=sourceProject();p.assets.portrait={src:png,zoom:180,x:25,y:-10,fit:'cover',alt:'Headshot',link:''};p.assets.partner.src=png;p.assets.banner.src=png;p.socials[0].customIcon=png;
 const d=fromDesign(p);d.children=[...['portrait','partner','banner','social'].map(part=>block('fragment',{part}, {},[],part))];
 const refs=inventory(d).inventory;assert.deepEqual(new Set(refs.map(i=>i.kind)),new Set(['portrait','partner','banner','social']));
 const portrait=refs.find(i=>i.kind==='portrait');assert.equal(portrait.recipe.zoom,180);assert.equal(portrait.recipe.x,25);assert.equal(portrait.recipe.shape,'circle');assert.ok(refs.some(i=>i.kind==='social'&&i.source===png));
 const preserved=preservedProject(p);assert.ok(inventory(preserved,renderBlocks).inventory.every(i=>i.id.startsWith(preserved.children[0].id+':')));
});

test('invalid required images and generated QR remain dependencies before they can produce img tags',()=>{
 const d=freshDocument(true),bad=block('image',{src:'javascript:alert(1)'}, {},[],'Broken artwork'),qr=block('qr',{url:'https://example.com/qr',size:100});d.children=[bad,qr];
 const result=inventory(d,renderBlocks);assert.equal(result.inventory.length,2);assert.equal(result.inventory[0].source,'javascript:alert(1)');assert.equal(result.inventory[1].kind,'qr');assert.doesNotMatch(result.html,/javascript:|data-ss-/);
});

test('preview never embeds private or signed source credentials while required assets remain discoverable',()=>{
 for(const source of ['https://example.com/image.png?token=private-token','https://example.com/storage/v1/object/sign/bucket/a.png?sig=private-token','https://private-token@example.com/image.png','https://example.com/authenticated/image.png']){
  const p=sourceProject();p.assets.logo.src=source;p.socials[0].customIcon=source;
  const doc=fromDesign(p),raw=render(doc,{edit:true,origin});
  assert.doesNotMatch(raw,/private-token|\/authenticated\/|\/object\/sign\//);
  const refs=inventory(doc).inventory;assert.equal(refs.filter(row=>row.source===source).length,2);
  const plain=freshDocument(true);plain.children=[block('image',{src:source})];assert.doesNotMatch(renderBlocks(plain,{edit:true,origin}),/private-token|\/authenticated\/|\/object\/sign\//);
 }
 assert.equal(safeImage(png,origin),png);
 assert.equal(safeImage('blob:https://studio.example/local-object',origin),'blob:https://studio.example/local-object');
 assert.equal(safeImage('blob:https://unrelated.example/private-object',origin),'');
 assert.equal(safeImage('https://images.example/immutable.png',origin),'https://images.example/immutable.png');
 assert.equal(safeImage('/design/media/mg-logo.png',origin),origin+'/design/media/mg-logo.png');
});

function canvasEnvironment(){
 const previous={Image:globalThis.Image,document:globalThis.document,FileReader:globalThis.FileReader,fetch:globalThis.fetch},loaded=[],draws=[],requests=[];
 globalThis.fetch=async(url,options)=>{if(/^https?:/.test(String(url))){requests.push({url:String(url),options});if(String(url).includes('unavailable'))throw new Error('Unavailable');return new Response(Buffer.from(png.split(',')[1],'base64'),{headers:{'content-type':'image/png'}});}return previous.fetch(url,options);};
 globalThis.Image=class{naturalWidth=200;naturalHeight=100;set src(value){if(!value)return;loaded.push(value);queueMicrotask(()=>value.includes('unavailable')?this.onerror?.():this.onload?.());}};
 const ctx={scale(){},beginPath(){},roundRect(){},clip(){},fillRect(){},drawImage(...args){draws.push(args);}};
 globalThis.document={createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext:()=>ctx,toDataURL:()=>png};}};
 globalThis.FileReader=class{readAsDataURL(file){file.arrayBuffer().then(bytes=>{this.result='data:'+file.type+';base64,'+Buffer.from(bytes).toString('base64');this.onload();});}};
 return {loaded,draws,requests,restore(){Object.assign(globalThis,previous);}};
}

test('preparation never loads variant-hidden or ancestor-hidden assets and scopes failures',async()=>{
 const env=canvasEnvironment();try{
  const d=freshDocument(true),image=block('image',{src:'https://unavailable.example/image.png',width:92,height:92});image.visibility='full';d.children=[image];
  const reply=await prepareBlocks(d,origin,'reply');assert.equal(reply.inventory.length,0);assert.equal(reply.errors.length,0);assert.equal(env.loaded.length,0);
  const full=await prepareBlocks(d,origin,'full');assert.equal(full.errors.length,1);assert.equal(env.requests.length,1);
  const parent=block('group',{}, {},[image]);parent.visibility='hidden';d.children=[parent];assert.equal((await prepareBlocks(d,origin,'full')).errors.length,0);assert.equal(env.requests.length,1);
 }finally{env.restore();}
});

test('processed output uses final byte hashes, reuses identical recipes, and retains editable sources',async()=>{
 const env=canvasEnvironment();try{
  const d=fromDesign(sourceProject()),before=JSON.stringify(d),result=await prepare(d,origin,'full');
  assert.equal(result.errors.length,0);assert.equal(Object.keys(result.images).length,4);assert.ok(Object.values(result.images).every(v=>v===png));
  const expected=createHash('sha256').update(Buffer.from(png.split(',')[1],'base64')).digest('hex');assert.ok(Object.values(result.keys).every(v=>v===expected));assert.equal(JSON.stringify(d),before);
  const dup=freshDocument(true);dup.children=[block('image',{src:'https://example.com/same.png',width:92,height:92}),block('image',{src:'https://example.com/same.png',width:92,height:92})];
  await prepareBlocks(dup,origin);assert.equal(env.requests.filter(r=>r.url.includes('/same.png')).length,1);
  for(const request of env.requests){assert.equal(request.options.credentials,'omit');assert.equal(request.options.redirect,'error');assert.equal(request.options.cache,'no-store');}
  const uploaded=await readImage(new File([Buffer.from(png.split(',')[1],'base64')],'original.png',{type:'image/png'}));assert.equal(uploaded,png);
 }finally{env.restore();}
});

test('remote URLs are reprocessed rather than cached by URL across preparation passes',async()=>{
 const env=canvasEnvironment();try{const d=freshDocument(true);d.children=[block('image',{src:'https://example.com/changing.png',width:92,height:92})];await prepareBlocks(d,origin);await prepareBlocks(d,origin);assert.equal(env.requests.length,2);}finally{env.restore();}
});

test('QR is generated and invalid QR destination fails required preparation',async()=>{
 const env=canvasEnvironment();try{const d=freshDocument(true);d.children=[block('qr',{url:'https://example.com/',size:100})];const ready=await prepareBlocks(d,origin);assert.equal(ready.errors.length,0);assert.equal(Object.keys(ready.images).length,1);d.children[0].props.url='javascript:alert(1)';assert.equal((await prepareBlocks(d,origin)).errors.length,1);}finally{env.restore();}
});

test('hash identity changes with actual bytes',async()=>{assert.notEqual(await digest(new Blob(['pixels one'])),await digest(new Blob(['pixels two'])));assert.equal(await digest(new Blob(['same'])),await digest(new Blob(['same'])));});

test('bounded publication metadata survives model normalization without becoming a trust assertion',()=>{
 const hash='a'.repeat(64),record={hash,url:'https://assets.example/signature-assets/owner/'+hash+'.png',hostingIdentity:'https://assets.example/signature-assets',ownerId:'owner',mime:'image/png',width:184,height:184,size:300,verifiedAt:'2026-10-08T00:00:00.000Z'};
 const p=sourceProject();p.emailAssetMetadata={[hash]:record};assert.deepEqual(normalizeProject(p).emailAssetMetadata,{[hash]:record});const d=fromDesign(p);assert.deepEqual(normalize(d).emailAssetMetadata,{[hash]:record});assert.deepEqual(designProject(d).emailAssetMetadata,{[hash]:record});
 assert.deepEqual(normalizeEmailAssetMetadata({[hash]:{...record,url:'https://user:secret@assets.example/a.png'}}),{});assert.deepEqual(normalizeEmailAssetMetadata({[hash]:{...record,width:5000}}),{});assert.deepEqual(normalizeEmailAssetMetadata({[hash]:{...record,ownerId:'../other'}}),{});
});

 test('private signed and malformed sources are refused before any download',async()=>{
 const env=canvasEnvironment();try{for(const src of ['https://example.com/a.png?token=secret','https://example.com/storage/v1/object/sign/bucket/a.png','https://user:secret@example.com/a.png','javascript:alert(1)']){const d=freshDocument(true);d.children=[block('image',{src,width:92,height:92})];const result=await prepareBlocks(d,origin);assert.equal(result.errors.length,1);assert.doesNotMatch(result.errors.join(' '),/secret/);}assert.equal(env.requests.length,0);}finally{env.restore();}
});

test('rendered image inventory is bounded before any source requests start',async()=>{
 const env=canvasEnvironment();try{const d=freshDocument(true);d.children=Array.from({length:121},(_,index)=>block('image',{src:'https://example.com/image-'+index+'.png',width:32,height:32}));const result=await prepareBlocks(d,origin);assert.equal(result.errors.length,1);assert.match(result.errors[0],/too many images/);assert.equal(Object.keys(result.images).length,0);assert.equal(env.requests.length,0);}finally{env.restore();}
});
