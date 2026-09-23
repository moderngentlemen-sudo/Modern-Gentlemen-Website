/** Additive bridge: never reinterpret a block project in the template-only editor. */
function send(project,meta={}){
 localStorage.setItem('signature-studio.blocks.handoff',JSON.stringify({project,meta}));
 location.href='/blocks/index.html';
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 if(button.dataset.action==='edit-blocks'){
  event.preventDefault();event.stopImmediatePropagation();
  const p=window.signatureStudio?.getProject();if(p)send(p);return;
 }
 if(['open-cloud','duplicate-cloud'].includes(button.dataset.action)){
  const row=window.__cloudRows?.find(r=>r.id===button.dataset.id);if(row?.data?.schemaVersion!==3)return;
  event.preventDefault();event.stopImmediatePropagation();
  const copy=structuredClone(row.data);if(button.dataset.action==='duplicate-cloud'){copy.name+=' · Copy';send(copy);}
  else {let owner=null;try{owner=JSON.parse(localStorage.getItem('ss_session')||'null')?.user?.id;}catch{}send(copy,{id:row.id,revision:row.updated_at,owner});}
 }
},true);
window.addEventListener('load',()=>{
 const input=document.getElementById('projectInput');if(!input)return;const previous=input.onchange;
 input.onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  try{if(file.size<=18000000){const raw=JSON.parse(await file.text()),p=raw.project||raw;if(p?.schemaVersion===3){send(p);return;}}}catch{}
  await previous?.call(input,event);
 };
});
