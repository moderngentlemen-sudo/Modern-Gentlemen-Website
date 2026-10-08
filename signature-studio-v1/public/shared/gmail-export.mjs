/** Coordinates export snapshots; editor previews are never a clipboard source. */
import {collectRenderedImages} from './rendered-images.mjs';
const clone=value=>structuredClone(value);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const error=(code,message)=>Object.assign(new Error(message),{code});
const fingerprint=state=>JSON.stringify(state);
export const exportMessage=err=>({
 CONSENT_REQUIRED:'Review permission to publish the artwork used by this signature.',
 SIGN_IN_REQUIRED:'Sign in to publish email images, then return here and retry. Local editing and backups remain available.',
 STALE_EXPORT:'The signature, project or account changed. Prepare the current signature again.',
 VERIFY_UNAVAILABLE:'Image verification is unavailable. Retry when hosting is reachable, or re-upload the image from its original file.',
 VERIFICATION_UNAVAILABLE:'Image verification is unavailable. Retry when hosting is reachable, or re-upload the image from its original file.',
 IMAGE_INVALID:'An image could not be prepared. Re-upload its original PNG or JPEG, or remove it from this variant.',
 IMAGE_UNVERIFIED:'An image does not have a verified stable public URL. Re-upload the original image, or remove it from this variant.',
 PUBLICATION_FAILED:'Image hosting is unavailable. Your editable artwork is safe. Retry later; no signature has been copied.',
 DIRECT_GMAIL_FAILED:'Gmail connection or installation failed. Retry connecting, or use the guided installation steps with your prepared signature.',
 CLIPBOARD_BLOCKED:'Images are prepared, but clipboard access was blocked. Select Copy prepared signature to try with a fresh click.',
 PREPARED_EXPIRED:'Prepared images need a fresh check. Select Prepare images, then copy again.',
}[err?.code]||'Email preparation could not finish. Retry, re-upload the affected image, or remove it from this variant.');

export function createGmailExport({getState,getReady,prepare,apply=()=>{},onStatus=()=>{},now=Date.now,maxAge=120000}){
 let generation=0,cached=null,pendingConsent=null,consents=new Set();
 const current=key=>key===fingerprint(getState());
 const assertCurrent=(key,run)=>{if(!current(key)||run!==generation)throw error('STALE_EXPORT',exportMessage({code:'STALE_EXPORT'}));};
 async function settled(){let waiting;do{waiting=getReady();await waiting;}while(waiting!==getReady());}
 async function run(variants){
  const run=++generation,requested=fingerprint(getState());cached=null;await settled();
  assertCurrent(requested,run);
  const state=clone(getState()),key=fingerprint(state),selected=[...new Set(variants)];
  const consentKey=key+'|'+selected.slice().sort().join(',');
  const isCurrent=()=>current(key)&&run===generation;
  try{
   const result=await prepare(state.document,selected,{isCurrent,consent:consents.has(consentKey),onStatus:rows=>{assertCurrent(key,run);onStatus(rows);}});
   assertCurrent(key,run);apply(result,state);const appliedKey=fingerprint(getState());
   cached={result,key:appliedKey,run,time:now()};pendingConsent=null;
   // Publication metadata is not new artwork; consent follows only this exact result.
   if(consents.has(consentKey))consents.add(appliedKey+'|'+selected.slice().sort().join(','));
   onStatus(result.inventory||[]);return result;
  }catch(err){
   if(!isCurrent())throw error('STALE_EXPORT',exportMessage({code:'STALE_EXPORT'}));
   if(err.code==='CONSENT_REQUIRED')pendingConsent={key,run,variants:selected,consentKey};
   if(err.inventory)onStatus(err.inventory);
   throw err;
  }
 }
 function consent(){
  if(!pendingConsent)throw error('STALE_EXPORT',exportMessage({code:'STALE_EXPORT'}));
  assertCurrent(pendingConsent.key,pendingConsent.run);const variants=pendingConsent.variants;
  consents.add(pendingConsent.consentKey);pendingConsent=null;return run(variants);
 }
 function prepared(variant,expectedResult=null){
  if(!cached||now()-cached.time>maxAge)throw error('PREPARED_EXPIRED',exportMessage({code:'PREPARED_EXPIRED'}));
  if(expectedResult&&cached.result!==expectedResult)throw error('STALE_EXPORT',exportMessage({code:'STALE_EXPORT'}));
  assertCurrent(cached.key,cached.run);const html=cached.result.htmlByVariant?.[variant];
  if(typeof html!=='string')throw error('PREPARED_EXPIRED',exportMessage({code:'PREPARED_EXPIRED'}));
  return html;
 }
 async function copyPrepared(variant,write=writeRichClipboard){
  const html=prepared(variant),key=cached.key,run=cached.run;
  try{await write(html);}catch{assertCurrent(key,run);throw error('CLIPBOARD_BLOCKED',exportMessage({code:'CLIPBOARD_BLOCKED'}));}
  assertCurrent(key,run);return true;
 }
 return {prepare:run,consent,prepared,copyPrepared,invalidate(){generation++;cached=null;pendingConsent=null;},hasPrepared:variant=>{try{return !!prepared(variant);}catch{return false;}}};
}

export function writeRichClipboard(html){
 const holder=document.createElement('div');holder.innerHTML=html;
 if(navigator.clipboard?.write&&globalThis.ClipboardItem)return navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([holder.textContent||''],{type:'text/plain'})})]);
 holder.style.cssText='position:fixed;left:-10000px;top:0';document.body.appendChild(holder);
 const selection=getSelection(),range=document.createRange();range.selectNodeContents(holder);selection.removeAllRanges();selection.addRange(range);
 try{if(!document.execCommand('copy'))throw error('CLIPBOARD_BLOCKED','Clipboard permission was denied.');return Promise.resolve();}
 finally{selection.removeAllRanges();holder.remove();}
}

const statusNames={ready:'Ready','needs-preparation':'Needs preparation',needs_preparation:'Needs preparation',preparing:'Preparing',failed:'Could not prepare',error:'Could not prepare','could-not-prepare':'Could not prepare','not-used':'Not used',not_used:'Not used','verification-unavailable':'Verification unavailable',verification_unavailable:'Verification unavailable',unavailable:'Verification unavailable'};
export function readinessMarkup(rows=[],{busy=false,prepared=false}={}){
 const body=rows.length?rows.map((row,index)=>{
  const raw=row.status||row.state||'needs-preparation',status=statusNames[raw]||(['Ready','Needs preparation','Preparing','Could not prepare','Not used','Verification unavailable'].includes(raw)?raw:'Needs preparation');
  const label=row.label||row.name||row.alt||('Image '+(index+1));
  return `<tr><th scope="row" style="text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid var(--line,#dedfd7)">${esc(label)}${row.variant?` <small>(${esc(row.variant==='reply'?'Reply':'Full')})</small>`:''}</th><td style="padding:8px 0;border-bottom:1px solid var(--line,#dedfd7)">${esc(status)}</td></tr>`;
 }).join(''):`<tr><td>${busy?'Inspecting rendered images…':prepared?'No images are required for this variant.':'Prepare this variant to check the images recipients will load.'}</td></tr>`;
 return `<section class="email-readiness" aria-label="Email readiness"><h3>Email readiness</h3><table aria-live="polite" style="width:100%;border-collapse:collapse;font-size:12px"><tbody>${body}</tbody></table><p class="hint micro">Ready means publicly verified for installation. Send a real test email to check Gmail desktop, mobile and recipient rendering.</p><div class="modal-actions"><button data-action="email-prepare" ${busy?'disabled':''}>${busy?'Preparing…':'Prepare images / Retry'}</button><button data-action="email-repair">Re-upload image / Remove image</button><button data-action="email-guide">Open installation guide</button></div></section>`;
}

/** Labels only: unused source bytes are never processed or passed to publication. */
export function unusedArtworkRows(snapshot,inventory=[]){
 const assets=snapshot.assets||snapshot.designData?.assets||{},variant=snapshot.variant||'full';
 const fragmentIds=new Set();
 const visit=nodes=>{for(const node of nodes||[]){if(node.type==='fragment')fragmentIds.add(node.id);visit(node.children);}};visit(snapshot.children);
 const belongs=(id,slot)=>snapshot.assets?id===slot:[...fragmentIds].some(nodeId=>id==='studio:'+nodeId+':'+slot);
 return Object.keys(assets).filter(slot=>!inventory.some(row=>belongs(String(row.id||''),slot))).map(slot=>({id:'unused:'+variant+':'+slot,label:slot.charAt(0).toUpperCase()+slot.slice(1),variant,status:'Not used'}));
}

/** Re-enumerate each selected variant without fetching, preparing or publishing artwork. */
export function variantReadiness(snapshot,variants,{render,origin,isPrepared=()=>false}){
 return [...new Set(variants)].flatMap(variant=>{
  const doc=clone(snapshot);doc.variant=variant;
  const {inventory}=collectRenderedImages(doc,{render,origin});
  const status=isPrepared(variant)?'Ready':'Needs preparation';
  return [...inventory.map(row=>({id:row.id,label:row.label||row.kind||'Image',variant,status})),...unusedArtworkRows(doc,inventory)];
 });
}

export const consentMarkup=rows=>`<p class="modal-note">Email recipients need public image URLs. Only artwork rendered in the selected variant(s) will be published. Anyone with those URLs can view it. Original editable files stay in your project. Images already used in sent emails are retained when you edit or delete a project.</p>${readinessMarkup(rows)}<p class="modal-note">This permission covers this exact signature and selected variant(s). It does not authorize hidden, unused or unrelated artwork.</p><div class="modal-actions"><button data-action="email-consent" class="primary">Publish these images and continue</button><button data-action="close">Cancel</button></div>`;

export const installationGuide=`<h3>Finish in Gmail</h3><p class="modal-note">Copy the prepared signature, then open Gmail Settings → General → Signature. Paste into the signature box, choose defaults, and save changes. For separate Full and Reply signatures, create two named signatures and choose their new-message and reply/forward defaults manually.</p><p class="modal-note">Send a new message and a reply to another mailbox; check the recipient view on desktop and mobile. A successful asset check or clipboard copy is not a real Gmail recipient test.</p><p class="modal-note">If one verified image still fails, inspect that image URL and try Gmail’s Insert image → Upload option in the signature editor. Replacing an image in Gmail may require restoring its intended link.</p><p class="hint micro">Gmail recommends artwork around 70–100 pixels high and 300–400 pixels wide, with stated guidance up to 100 × 1,000 pixels. Larger layouts can still be prepared but should be tested carefully.</p><a href="https://mail.google.com/mail/u/0/#settings/general" target="_blank" rel="noopener noreferrer">Open Gmail settings ↗</a>`;
