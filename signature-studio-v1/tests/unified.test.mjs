import test from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATES,freshProject,applyTemplate} from '../public/design/catalog.mjs';
import {normalize as validate,walk,makeBlock,insert,freshDocument,preservedProject} from '../public/blocks/model.mjs';
import {newSignature,fromDesign,upgrade,normalize,designProject,changeTemplate,migrateStorage,STORE} from '../public/studio/model.mjs';
import {render} from '../public/studio/render.mjs';
for(const t of TEMPLATES)test('Unified template is editable: '+t.name,()=>{
 const p=applyTemplate(freshProject(),t),d=fromDesign(p);const nodes=[];walk(d.children,n=>nodes.push(n));
 assert.ok(nodes.length>1);assert.ok(nodes.some(n=>n.type==='fragment'));assert.ok(!nodes.some(n=>n.type==='template'));
 assert.equal(d.identity.email,p.identity.email);assert.equal(d.designData.templateId,t.id);
 const html=render(d);assert.ok(html.includes('Jason Mallard'));assert.ok(html.includes('partners@moderngentlemen.co'));assert.ok(!html.includes('data-bid'));
 assert.deepEqual(normalize(JSON.parse(JSON.stringify(d))),d);
});
test('Global profile is the one source for template elements',()=>{const d=newSignature();d.identity.name='Changed Everywhere';assert.ok(render(d).includes('Changed Everywhere'));assert.ok(!render(d).includes('Jason Mallard'));});
test('Global font, color and export scale reach the same renderer',()=>{const d=newSignature();d.design.nameSize=39;d.design.nameFont='georgia';d.design.primary='#b41155';d.design.scale=80;const h=render(d);assert.ok(h.includes('31.2px'));assert.ok(h.includes('#b41155'));assert.ok(h.includes('Georgia'));assert.ok(h.includes('width="416"'));});
test('Template application preserves added blocks and content, no new project',()=>{let d=newSignature();const n=makeBlock('event',d);d=insert(d,n,d.children[0].children[0].children[1].id);const next=changeTemplate(d,TEMPLATES.find(t=>t.id==='masthead'),true);const ids=[];walk(next.children,n=>ids.push(n.id));assert.ok(ids.includes(n.id));assert.equal(next.identity.name,d.identity.name);assert.equal(next.name,d.name);assert.equal(next.design.nameFont,d.design.nameFont);});
test('Source assets and custom sections survive template change',()=>{const d=newSignature();d.designData.content.note='KEEP THIS NOTE';d.designData.assets.banner.src='https://example.com/banner.png';d.designData.extras=[{label:'Custom',value:'Kept value',url:'',enabled:true}];const n=changeTemplate(d,TEMPLATES[3]);assert.equal(n.designData.content.note,'KEEP THIS NOTE');assert.equal(n.designData.assets.banner.src,d.designData.assets.banner.src);assert.equal(n.designData.extras[0].value,'Kept value');});
test('Old designer imports become native elements without modifying source',()=>{const p=freshProject(),before=JSON.stringify(p);const d=upgrade(p);assert.equal(JSON.stringify(p),before);assert.ok(d.designData);assert.equal(d.children[0].props.managed,true);});
test('Old block document retains node IDs, order and custom content',()=>{const d=freshDocument();const before=JSON.stringify(d);const ids=[];walk(d.children,n=>ids.push(n.id));const next=upgrade(d),after=[];walk(next.children,n=>after.push(n.id));assert.deepEqual(ids,after);assert.equal(JSON.stringify(d),before);});
test('Old preserved template unwraps automatically',()=>{const d=upgrade(preservedProject(freshProject()));const types=[];walk(d.children,n=>types.push(n.type));assert.ok(types.includes('fragment'));assert.ok(!types.includes('template'));});
test('One-time browser migration preserves originals and separate projects',()=>{
 const a=freshProject(),b=freshDocument(),store={'signature-studio.design.v2':JSON.stringify({active:'d1',projects:[{id:'d1',project:a,cloudId:'cloud-id',cloudRevision:'rev',cloudOwner:'owner'}]}),'signature-studio.blocks.v3':JSON.stringify({active:'b1',projects:[{id:'b1',doc:b}]})},before={...store};
 const storage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v};const result=migrateStorage(storage);assert.equal(result.projects.length,2);assert.equal(store['signature-studio.design.v2'],before['signature-studio.design.v2']);assert.equal(store['signature-studio.blocks.v3'],before['signature-studio.blocks.v3']);assert.equal(result.projects[0].meta.id,'cloud-id');assert.equal(migrateStorage(storage).projects.length,2);assert.ok(store[STORE]);
});
test('Local overrides can be reset without disconnecting shared profile',()=>{const d=newSignature();let n;walk(d.children,x=>{if(x.props.part==='identity')n=x;});n.style.color='#cc2200';assert.ok(render(d).includes('#cc2200'));n.style={};d.design.primary='#113311';assert.ok(!render(d).includes('#cc2200'));assert.ok(render(d).includes('#113311'));});
test('Fragments reject unknown types and omit injected HTML and URLs',()=>{const d=newSignature();d.identity.name='<script>alert(1)</script>';d.identity.website='javascript:alert(1)';const h=render(d);assert.ok(!h.includes('<script>'));assert.ok(!h.includes('href="javascript:'));d.children[0].children.push({id:'bad',type:'fragment',props:{part:'arbitrary-html'},style:{},children:[]});assert.throws(()=>validate(d));});
test('Empty and disabled source sections disappear from email output',()=>{const d=newSignature();d.designData.content.note='PRIVATE TEST';d.designData.sections.find(s=>s.type==='note').enabled=false;assert.ok(!render(d).includes('PRIVATE TEST'));});
test('Export strips all direct-edit and drag attributes',()=>{const d=newSignature();assert.ok(render(d,{edit:true}).includes('data-u-bind'));const html=render(d);assert.ok(!/data-u-bind|data-bid|data-edit|contenteditable/.test(html));});

test('Imported composite keeps a second preserved signature independent',()=>{const a=freshProject(),b=freshProject();a.identity.name='First identity';b.identity.name='Second identity';const d=preservedProject(a);d.children.push(...preservedProject(b).children);const u=upgrade(d);assert.equal(u.identity.name,'First identity');const h=render(u);assert.ok(h.includes('First identity'));assert.ok(h.includes('Second identity'));});
test('Column ratio normalization is stable across repeated editing and saves',()=>{let d=fromDesign(applyTemplate(freshProject(),TEMPLATES.find(t=>t.id==='director')));const start=JSON.stringify(d);for(let k=0;k<30;k++)d=normalize(d);assert.equal(JSON.stringify(d),start);});

test('Architectural column separators survive template compilation',()=>{for(const layout of ['vertical-rule','split']){const t=TEMPLATES.find(t=>t.layout===layout),d=fromDesign(applyTemplate(freshProject(),t));assert.match(render(d),/border-(left|right):[\d.]+px/);}});
