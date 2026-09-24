import test from 'node:test';
import assert from 'node:assert/strict';
import {freshDocument,block,normalize,walk} from '../public/blocks/model.mjs';
import {renderBlocks} from '../public/blocks/render.mjs';
import {layerBadge,toggleVisibilityState,nodeActive,documentForVariant} from '../public/shared/signature-rules.mjs';
import {freshProject} from '../public/design/catalog.mjs';
import {renderSignature,normalizeProject} from '../public/design/engine.mjs';
import {fromDesign} from '../public/studio/model.mjs';
import {render as renderUnified} from '../public/studio/render.mjs';

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

test('None inline separator survives normalization and retains readable spacing',()=>{
 const p=freshProject();p.design.contactLayout='inline';p.design.separator='';p.identity.phone='111';p.identity.email='me@example.com';p.visible.phone=true;p.visible.email=true;
 const normalized=normalizeProject(p);assert.equal(normalized.design.separator,'');const html=renderSignature(normalized);
 assert.match(html,/111/);assert.match(html,/me@example\.com/);assert.match(html,/&nbsp;&nbsp;/);assert.doesNotMatch(html,/111\s*[·|/]\s*/);
});

test('variant generation never mutates the master document',()=>{
 const d=freshDocument();d.variant='full';const r=documentForVariant(d,'reply');assert.equal(r.variant,'reply');assert.equal(d.variant,'full');assert.notEqual(r,d);
});
