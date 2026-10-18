
(function(root){
'use strict';
const V=(x,y)=>({x,y}), add=(a,b)=>V(a.x+b.x,a.y+b.y), sub=(a,b)=>V(a.x-b.x,a.y-b.y), mul=(a,k)=>V(a.x*k,a.y*k), dot=(a,b)=>a.x*b.x+a.y*b.y, cross=(a,b)=>a.x*b.y-a.y*b.x, length=a=>Math.hypot(a.x,a.y), unit=a=>mul(a,1/length(a)), norm=a=>V(-a.y,a.x), distance=(a,b)=>length(sub(a,b)), rad=d=>d*Math.PI/180, fmt=n=>+n.toFixed(6);
function build(config){
 const {points,spacing=6,count=6,radius=60}=config;
 if(!Array.isArray(points)||points.length<2)return {error:'At least two points are required.'};
 if(!Number.isFinite(radius)||radius<=0||spacing<=0||count<1||count>24)return {error:'Invalid radius, spacing or strand count.'};
 const maxOff=(count-1)*spacing/2;
 if(radius<=maxOff+0.5)return {error:`Radius ${radius} must exceed maximum offset ${maxOff} by at least 0.5.`};
 const dirs=[],lens=[];
 for(let i=0;i<points.length-1;i++){const v=sub(points[i+1],points[i]),l=length(v);if(l<1e-7)return {error:`Zero-length segment ${i+1}.`};dirs.push(unit(v));lens.push(l)}
 const corners=[];
 for(let i=1;i<points.length-1;i++){
  const u=dirs[i-1],v=dirs[i],theta=Math.atan2(cross(u,v),dot(u,v)),a=Math.abs(theta);
  if(a>=Math.PI-1e-7)return {error:`180° reversal at bend ${i} requires a separate hairpin tool.`};
  if(a<1e-7){corners.push(null);continue}
  const sign=Math.sign(theta),t=radius*Math.tan(a/2);
  corners.push({index:i,theta,sign,t,angle:a*180/Math.PI});
 }
 for(let i=0;i<lens.length;i++){
  const left=i>0?corners[i-1]?.t||0:0,right=i<corners.length?corners[i]?.t||0:0;
  if(left+right>lens[i]-1e-6)return {error:`Insufficient straight length on segment ${i+1}: requires ${(left+right).toFixed(1)}, available ${lens[i].toFixed(1)}. Reduce radius or move bends.`}
 }
 const strands=[];
 for(let k=0;k<count;k++){
  const d=(k-(count-1)/2)*spacing, start=add(points[0],mul(norm(dirs[0]),d)),end=add(points.at(-1),mul(norm(dirs.at(-1)),d));
  let path=`M ${fmt(start.x)} ${fmt(start.y)}`, arcs=[],previous=start;
  for(let i=1;i<points.length-1;i++){
   const c=corners[i-1],p=points[i],u=dirs[i-1],v=dirs[i];
   if(!c)continue;
   const r=radius-c.sign*d;
   const a=add(add(p,mul(u,-c.t)),mul(norm(u),d));
   const b=add(add(p,mul(v,c.t)),mul(norm(v),d));
   const center=add(a,mul(norm(u),c.sign*r));
   path+=` L ${fmt(a.x)} ${fmt(a.y)} A ${fmt(r)} ${fmt(r)} 0 0 ${c.sign>0?1:0} ${fmt(b.x)} ${fmt(b.y)}`;
   arcs.push({a,b,center,r,sign:c.sign,angle:c.angle,inDir:u,outDir:v});
   previous=b;
  }
  path+=` L ${fmt(end.x)} ${fmt(end.y)}`;
  strands.push({d,start,end,arcs,path});
 }
 return {points,dirs,lens,corners,strands,spacing,count,radius,maxOff};
}
function verify(g){
 if(g.error)return [g.error];
 const errors=[],tol=1e-5;
 for(let k=0;k<g.strands.length;k++){
  const s=g.strands[k];
  if(k){const prev=g.strands[k-1];if(Math.abs(distance(s.start,prev.start)-g.spacing)>tol)errors.push('Start spacing');if(Math.abs(distance(s.end,prev.end)-g.spacing)>tol)errors.push('End spacing')}
  for(let j=0;j<s.arcs.length;j++){
   const a=s.arcs[j];if(a.r<=0)errors.push('Non-positive radius');
   if(Math.abs(distance(a.center,a.a)-a.r)>tol||Math.abs(distance(a.center,a.b)-a.r)>tol)errors.push('Arc radius mismatch');
   if(Math.abs(dot(sub(a.a,a.center),a.inDir))>tol||Math.abs(dot(sub(a.b,a.center),a.outDir))>tol)errors.push('Non-tangent transition');
   if(k){const prev=g.strands[k-1].arcs[j];if(distance(prev.center,a.center)>tol)errors.push('Non-concentric bend');if(Math.abs(Math.abs(a.r-prev.r)-g.spacing)>tol)errors.push('Incorrect arc spacing')}
  }
 }
 return [...new Set(errors)];
}
function fromTurns(heading,turns,leg=170){
 let p=V(0,0),h=heading,points=[p];
 for(let i=0;i<=turns.length;i++){p=add(p,mul(V(Math.cos(rad(h)),Math.sin(rad(h))),leg));points.push(p);if(i<turns.length)h+=turns[i]}
 return points;
}
root.Geometry={build,verify,fromTurns,rad,add,mul,norm,V};
if(typeof module!=='undefined')Object.assign(module.exports,root.Geometry);
})(typeof module!=='undefined'?module.exports:window);
