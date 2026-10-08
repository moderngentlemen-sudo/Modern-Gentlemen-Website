import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDocument,block,normalize,walk} from '../public/blocks/model.mjs';
import {renderBlocks} from '../public/blocks/render.mjs';
import {layerBadge,toggleVisibilityState,nodeActive,documentForVariant} from '../public/shared/signature-rules.mjs';
import {freshProject} from '../public/design/catalog.mjs';
import {renderSignature,normalizeProject} from '../public/design/engine.mjs';
import {fromDesign} from '../public/studio/model.mjs';
import {render as renderUnified} from '../public/studio/render.mjs';
import {createGmailExport,readinessMarkup,unusedArtworkRows,variantReadiness} from '../public/shared/gmail-export.mjs';

test('layer badges preserve Full and Reply states',()=>{
 assert.equal(layerBadge({type:'text',visibility:'full'}),'Full');
 assert.equal(layerBadge({type:'text',visibility:'reply'}),'Reply');
 assert.equal(layerBadge({type:'column',visibility:'both'}),'Cell');
 assert.equal(layerBadge({type:'column',visibility:'full'}),'Full');
});

test('quick hide/show restores Full-only and Reply-only state across project normalization',()=>{
 for(const value of ['full','reply']){
  const d=freshDocument(true),n=block('text',{text:value});n.visibility=value;toggleVisibilityState(n);d.children=[n];
  const saved=normalize(d);assert.equal(saved.children[0].visibility,'hidden');assert.equal(saved.children[0].props.visibilityBeforeHide,value);
  toggleVisibilityState(saved.children[0]);assert.equal(saved.children[0].visibility,value);assert.equal('visibilityBeforeHide' in saved.children[0].props,false);
 }
});

test('legacy hidden blocks without restore metadata show as both',()=>{
 const n={visibility:'hidden',props:{}};toggleVisibilityState(n);assert.equal(n.visibility,'both');
});

test('connected separated fields honor global profile visibility',()=>{
 const d=freshDocument(true);d.designData={visible:{email:false}};const n=block('contact',{bind:'email',kind:'email'});
 d.identity.email='private@example.com';d.children=[n];
 assert.equal(nodeActive(d,n,'full'),false);assert.doesNotMatch(renderBlocks(d),/private@example\.com/);
});

test('independent content is not hidden by an unrelated profile visibility setting',()=>{
 const d=freshDocument(true);d.designData={visible:{email:false}};const n=block('text',{text:'Independent copy'});d.children=[n];
 assert.equal(nodeActive(d,n,'full'),true);assert.match(renderBlocks(d),/Independent copy/);
});

test('hidden ancestors remove nested content from exports',()=>{
 const d=freshDocument(true),child=block('text',{text:'Nested secret'}),parent=block('group',{}, {},[child]);
 parent.visibility='hidden';d.children=[parent];assert.doesNotMatch(renderBlocks(d),/Nested secret/);
});

test('explicit Full and Reply visibility is authoritative in the unified renderer',()=>{
 const p=freshProject();p.socials[0].url='https://instagram.com/example';const d=fromDesign(p);
 let social=null;walk(d.children,n=>{if(n.type==='fragment'&&n.props.part==='social')social=n;});assert.ok(social);
 social.visibility='reply';
 assert.doesNotMatch(renderUnified(documentForVariant(d,'full')),/instagram\.com\/example/);
 assert.match(renderUnified(documentForVariant(d,'reply')),/instagram\.com\/example/);
});


test('legacy unified projects migrate prior implicit reply suppression to explicit Full-only once',()=>{
 const p=freshProject();const legacy=fromDesign(p);delete legacy.visibilityRulesVersion;
 let tagline=null;walk(legacy.children,n=>{if(n.type==='fragment'&&n.props.part==='tagline')tagline=n;});assert.ok(tagline);tagline.visibility='both';
 const migrated=normalize(legacy);walk(migrated.children,n=>{if(n.type==='fragment'&&n.props.part==='tagline')tagline=n;});
 assert.equal(migrated.visibilityRulesVersion,2);assert.equal(tagline.visibility,'full');
 tagline.visibility='both';const saved=normalize(migrated);walk(saved.children,n=>{if(n.type==='fragment'&&n.props.part==='tagline')tagline=n;});assert.equal(tagline.visibility,'both');
});

test('None inline separator survives normalization and retains readable spacing',()=>{
 const p=freshProject();p.design.contactLayout='inline';p.design.separator='';p.identity.phone='111';p.identity.email='me@example.com';p.visible.phone=true;p.visible.email=true;
 const normalized=normalizeProject(p);assert.equal(normalized.design.separator,'');const html=renderSignature(normalized);
 assert.match(html,/111/);assert.match(html,/me@example\.com/);assert.match(html,/&nbsp;&nbsp;/);assert.doesNotMatch(html,/111\s*[·|/]\s*/);
});

test('variant generation never mutates the master document',()=>{
 const d=freshDocument();d.variant='full';const r=documentForVariant(d,'reply');assert.equal(r.variant,'reply');assert.equal(d.variant,'full');assert.notEqual(r,d);
});

const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function exportHarness(options={}){
 const state={document:{name:'Current',variant:'full',logo:'data:original'},project:'project-a',account:'owner-a',revision:1};
 let preparation=Promise.resolve(),applied=0;
 const final={htmlByVariant:{full:'<table><tr><td><img src="https://images.example/verified.png"></td></tr></table>',reply:'<table><tr><td>Reply</td></tr></table>'},publishedAssets:{hash:'https://images.example/verified.png'},inventory:[]};
 const workflow=createGmailExport({getState:()=>state,getReady:()=>preparation,prepare:options.prepare||(async(snapshot,variants)=>({...final,htmlByVariant:Object.fromEntries(variants.map(variant=>[variant,final.htmlByVariant[variant]]))})),apply:result=>{applied++;state.document.publishedAssets=result.publishedAssets;},...options});
 return {state,workflow,final,applied:()=>applied,setReady:promise=>preparation=promise};
}

test('Gmail export waits for image preparation and copies final verified HTML without replacing source',async()=>{
 const gate=deferred(),h=exportHarness();h.setReady(gate.promise);const run=h.workflow.prepare(['full']);
 assert.equal(h.applied(),0);gate.resolve();await run;let copied;
 await h.workflow.copyPrepared('full',async html=>{copied=html;});assert.equal(copied,h.final.htmlByVariant.full);
 assert.equal(h.state.document.logo,'data:original');assert.equal(h.applied(),1);
});

test('project changes while waiting for initial rendering cancel the requested Gmail export',async()=>{
 const gate=deferred(),h=exportHarness();h.setReady(gate.promise);const run=h.workflow.prepare(['full']);
 h.state.project='project-b';gate.resolve();await assert.rejects(run,{code:'STALE_EXPORT'});assert.equal(h.applied(),0);
});

for(const change of ['project','account','revision'])test(`Gmail publication cannot apply after ${change} changes`,async()=>{
 const started=deferred(),gate=deferred();let h;
 h=exportHarness({prepare:async()=>{started.resolve();await gate.promise;return h.final;}});
 const run=h.workflow.prepare(['full']);await started.promise;h.state[change]=change==='revision'?2:'other';gate.resolve();
 await assert.rejects(run,{code:'STALE_EXPORT'});assert.equal(h.applied(),0);assert.equal(h.workflow.hasPrepared('full'),false);
});

test('a newer export operation supersedes earlier asynchronous publication results',async()=>{
 const first=deferred(),started=deferred();let calls=0,h;
 h=exportHarness({prepare:async()=>{if(++calls===1){started.resolve();await first.promise;}return h.final;}});
 const older=h.workflow.prepare(['full']);await started.promise;await h.workflow.prepare(['reply']);first.resolve();
 await assert.rejects(older,{code:'STALE_EXPORT'});assert.equal(h.applied(),1);
});

test('publication consent is explicit and scoped to the unchanged project and selected variants',async()=>{
 let consentCalls=[],h;h=exportHarness({prepare:async(snapshot,variants,options)=>{consentCalls.push(options.consent);if(!options.consent)throw Object.assign(new Error('consent'),{code:'CONSENT_REQUIRED'});return h.final;}});
 await assert.rejects(h.workflow.prepare(['full']),{code:'CONSENT_REQUIRED'});assert.equal(h.applied(),0);
 await h.workflow.consent();assert.deepEqual(consentCalls,[false,true]);assert.equal(h.applied(),1);
 h.state.document.logo='data:new-unrelated-artwork';await assert.rejects(h.workflow.prepare(['full']),{code:'CONSENT_REQUIRED'});
 h.state.account='different-owner';assert.throws(()=>h.workflow.consent(),{code:'STALE_EXPORT'});
});

test('clipboard rejection retains prepared HTML for a fresh gesture without reporting copy success',async()=>{
 const h=exportHarness();await h.workflow.prepare(['full']);let writes=0;
 await assert.rejects(h.workflow.copyPrepared('full',async()=>{writes++;throw new Error('NotAllowedError');}),{code:'CLIPBOARD_BLOCKED'});
 assert.equal(h.workflow.hasPrepared('full'),true);assert.equal(writes,1);
 assert.equal(await h.workflow.copyPrepared('full',async html=>{writes++;assert.equal(html,h.final.htmlByVariant.full);}),true);assert.equal(writes,2);
});

test('prepared clipboard HTML is refused after edits, sign-out, expiration or wrong variant',async()=>{
 let time=0;const h=exportHarness({now:()=>time,maxAge:100});await h.workflow.prepare(['full']);
 await assert.rejects(h.workflow.copyPrepared('reply',async()=>assert.fail('wrong variant must not copy')),{code:'PREPARED_EXPIRED'});
 time=101;await assert.rejects(h.workflow.copyPrepared('full',async()=>assert.fail('must not copy')),{code:'PREPARED_EXPIRED'});
 time=0;h.state.document.name='New name';await assert.rejects(h.workflow.copyPrepared('full',async()=>assert.fail('must not copy')),{code:'STALE_EXPORT'});
 await h.workflow.prepare(['full']);h.state.account=null;assert.equal(h.workflow.hasPrepared('full'),false);
});

test('Full and Reply clipboard actions select only their own freshly prepared HTML',async()=>{
 const h=exportHarness();await h.workflow.prepare(['full','reply']);let copied;
 await h.workflow.copyPrepared('reply',async html=>{copied=html;});assert.equal(copied,h.final.htmlByVariant.reply);
});

test('delayed OAuth operation cannot use a replacement prepared cache, even for the same variant',async()=>{
 const h=exportHarness(),original=await h.workflow.prepare(['full']);
 assert.equal(h.workflow.prepared('full',original),h.final.htmlByVariant.full);
 h.state.project='project-b';h.state.document.name='Different signature';h.state.revision++;
 const replacement=await h.workflow.prepare(['full']);
 assert.throws(()=>h.workflow.prepared('full',original),{code:'STALE_EXPORT'});
 assert.equal(h.workflow.prepared('full',replacement),h.final.htmlByVariant.full);
 const newer=await h.workflow.prepare(['full']);
 assert.throws(()=>h.workflow.prepared('full',replacement),{code:'STALE_EXPORT'});
 assert.equal(h.workflow.prepared('full',newer),h.final.htmlByVariant.full);
});

test('readiness never marks unverified image rows Ready and escapes image names',()=>{
 const html=readinessMarkup([{label:'<script>private</script>'},{label:'Banner',status:'Verification unavailable'},{label:'Portrait',status:'Not used'}]);
 assert.match(html,/Needs preparation/);assert.match(html,/Verification unavailable/);assert.match(html,/Not used/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});

test('unused artwork readiness contains labels only, never source bytes or credentials',()=>{
 const rows=unusedArtworkRows({variant:'reply',assets:{logo:{src:'data:private'},portrait:{src:'https://host/token=private'}}},[{id:'logo'}]);
 assert.deepEqual(rows,[{id:'unused:reply:portrait',label:'Portrait',variant:'reply',status:'Not used'}]);
});

test('preserved template assets cannot suppress unused master project artwork labels',()=>{
 const nested=[{id:'nested-template:logo'},{id:'studio:not-a-master-fragment:portrait'}];
 const designer={variant:'full',assets:{logo:{src:'root'},portrait:{src:'portrait'}}};
 assert.deepEqual(unusedArtworkRows(designer,nested).map(row=>row.label),['Logo','Portrait']);
 const unified={variant:'full',designData:{assets:designer.assets},children:[{id:'master-fragment',type:'fragment',props:{part:'logo'}}]};
 assert.deepEqual(unusedArtworkRows(unified,nested).map(row=>row.label),['Logo','Portrait']);
 assert.deepEqual(unusedArtworkRows(unified,[...nested,{id:'studio:master-fragment:logo'}]).map(row=>row.label),['Portrait']);
});

test('Full and Reply readiness re-enumerates selected variants and preserves only valid prepared states',()=>{
 const doc=freshDocument(true),full=block('image',{src:'https://images.example/full.png'}),reply=block('image',{src:'https://images.example/reply.png'});
 full.visibility='full';reply.visibility='reply';doc.children=[full,reply];
 const options={render:renderBlocks,origin:'https://example.com',isPrepared:variant=>variant==='reply'};
 const replyRows=variantReadiness(doc,['reply'],options);assert.equal(replyRows.length,1);assert.equal(replyRows[0].id,reply.id);assert.equal(replyRows[0].status,'Ready');
 const both=variantReadiness(doc,['full','reply'],options);assert.equal(both.length,2);assert.equal(both.find(row=>row.variant==='full').status,'Needs preparation');assert.equal(both.find(row=>row.variant==='reply').status,'Ready');
 const expired=variantReadiness(doc,['reply'],{...options,isPrepared:()=>false});assert.equal(expired[0].status,'Needs preparation');
 assert.equal('source' in both[0],false);assert.equal('recipe' in both[0],false);
});
