/** Shared visibility and variant rules for the unified editor and renderers. */
export const VISIBILITY_VALUES = Object.freeze(['both','full','reply','hidden']);
const RESTORE_KEY='visibilityBeforeHide';

export function normalizeVisibility(value){
 return VISIBILITY_VALUES.includes(value)?value:'both';
}

export function layerBadge(node){
 const v=normalizeVisibility(node?.visibility);
 if(v==='hidden')return 'Hidden';
 if(v==='full')return 'Full';
 if(v==='reply')return 'Reply';
 return node?.type==='column'?'Cell':'';
}

export function toggleVisibilityState(node){
 if(!node||typeof node!=='object')return node;
 node.props=node.props&&typeof node.props==='object'?node.props:{};
 const current=normalizeVisibility(node.visibility);
 if(current==='hidden'){
  const restore=['both','full','reply'].includes(node.props[RESTORE_KEY])?node.props[RESTORE_KEY]:'both';
  node.visibility=restore;
  delete node.props[RESTORE_KEY];
 }else{
  node.props[RESTORE_KEY]=current;
  node.visibility='hidden';
 }
 return node;
}

export function profileFieldVisible(doc,node){
 const key=node?.props?.bind;
 if(!key)return true;
 const visible=doc?.designData?.visible;
 return !visible||visible[key]!==false;
}

export function nodeActive(doc,node,variant=doc?.variant){
 if(!node||!profileFieldVisible(doc,node))return false;
 const v=normalizeVisibility(node.visibility);
 return v!=='hidden'&&(v==='both'||v===variant);
}

export function documentForVariant(doc,variant){
 if(!['full','reply'].includes(variant))throw new Error('Variant must be full or reply.');
 const next=structuredClone(doc);next.variant=variant;return next;
}
