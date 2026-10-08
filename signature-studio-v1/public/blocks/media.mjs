import {prepareImageDependencies,readImage,qrData} from '../design/media.mjs';
import {renderBlocks} from './render.mjs';
import {collectRenderedImages} from '../shared/rendered-images.mjs';
export {readImage,qrData};
export async function prepareBlocks(doc,origin=location.origin,variant=doc.variant){
 const snapshot=structuredClone(doc);snapshot.variant=variant;
 const {inventory}=collectRenderedImages(snapshot,{render:renderBlocks,origin});
 return prepareImageDependencies(inventory,origin);
}
