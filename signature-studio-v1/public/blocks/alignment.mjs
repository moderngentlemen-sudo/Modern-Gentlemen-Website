/** Geometry for layout-safe handles. Values are unscaled design pixels. */
export const GRID_STEPS = [4, 8, 12, 16, 24];
export const DEFAULT_TOOLS = {snap:true, grid:true, step:8, handles:'size'};
export function toolPreferences(input={}) {
 return {snap:typeof input.snap==='boolean'?input.snap:true, grid:typeof input.grid==='boolean'?input.grid:true,
  step:GRID_STEPS.includes(Number(input.step))?Number(input.step):8, handles:input.handles==='spacing'?'spacing':'size'};
}
const bound=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
const round=v=>Math.round(v*10000)/10000;
export function snapValue(value,step=8,enabled=true,min=0,max=900) {
 const valid=Number.isFinite(step)&&step>0?step:8;
 return round(bound(enabled?Math.round(value/valid)*valid:value,min,max));
}
export function designDelta(dx,dy,zoom=1,scale=100) {
 const factor=Math.max(.01,Number(zoom)*Number(scale)/100);
 return {dx:dx/factor,dy:dy/factor};
}
export function resizeArtwork({width,height,dx=0,dy=0,edge='se',step=8,snap=true,free=false,minW=24,maxW=820,minH=1,maxH=300}) {
 const w=Math.max(.01,width),h=Math.max(.01,height),ratio=h/w;
 const x=edge.includes('w')?-dx:edge.includes('e')?dx:0;
 const y=edge.includes('n')?-dy:edge.includes('s')?dy:0;
 const horizontal=/[ew]/.test(edge),vertical=/[ns]/.test(edge);
 if(free) return {width:horizontal?snapValue(w+x,step,snap,minW,maxW):w,height:vertical?snapValue(h+y,step,snap,minH,maxH):h};
 // The dominant drag axis controls a corner. The other dimension follows its aspect ratio.
 const byHeight=!horizontal||(vertical&&Math.abs(y)>Math.abs(x*ratio));
 const lowW=Math.max(minW,minH/ratio),highW=Math.min(maxW,maxH/ratio);
 if(byHeight){const nextH=snapValue(h+y,step,snap,lowW*ratio,highW*ratio);return {width:round(nextH/ratio),height:round(nextH)};}
 const nextW=snapValue(w+x,step,snap,lowW,highW);return {width:round(nextW),height:round(nextW*ratio)};
}
export function resizeColumnRatios(ratios,index,dx,availableWidth,step=8,snap=true) {
 if(!Array.isArray(ratios)||index<0||index>=ratios.length-1||availableWidth<=0)return [...(ratios||[])];
 const out=[...ratios],sum=out[index]+out[index+1],leftWidth=out[index]/100*availableWidth;
 const low=Math.max(10,sum-80),high=Math.min(80,sum-10);
 const next=snapValue(leftWidth+dx,step,snap,availableWidth*low/100,availableWidth*high/100);
 out[index]=round(next/availableWidth*100);out[index+1]=round(sum-out[index]);return out;
}
export function resizePadding(style,side,delta,step=8,snap=true) {
 const key='padding'+side,sign=['Right','Bottom'].includes(side)?-1:1;
 return snapValue(Number(style[key]??style.padding??0)+sign*delta,step,snap,0,['Left','Right'].includes(side)?64:48);
}
export function pointIn(rect,x,y,margin=0) {return !!rect&&x>=rect.left-margin&&x<=rect.right+margin&&y>=rect.top-margin&&y<=rect.bottom+margin;}
