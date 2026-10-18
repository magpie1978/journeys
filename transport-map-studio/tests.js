const G=require('./geometry.js');let passed=0,failed=0,details=[];
function check(name,fn){try{fn();passed++}catch(e){failed++;details.push(name+': '+e.message)}}
function valid(points,spacing,count,radius){const g=G.build({points,spacing,count,radius});if(g.error)throw Error(g.error);const e=G.verify(g);if(e.length)throw Error(e.join(', '));return g}
for(const heading of [0,45,90,135,180,225,270,315])for(const angle of [30,45,60,90,120,135,150])for(const sign of [-1,1])check(`single ${heading}/${angle}/${sign}`,()=>valid(G.fromTurns(heading,[sign*angle],800),6,12,100));
for(const turns of [[45,-45],[45,45],[90,-90],[45,-45,45],[90,45,-45],[135,-90,45],[30,60,-30],[150,-150]])for(const heading of [0,45,90,135,180,225,270,315])check(`multi ${heading}/${turns}`,()=>valid(G.fromTurns(heading,turns,800),6,12,100));
for(const count of [1,2,6,12,24])for(const spacing of [3,5,9,16])for(const angle of [45,90,135,150])check(`stress ${count}/${spacing}/${angle}`,()=>valid(G.fromTurns(45,[angle],1100),spacing,count,Math.max(120,(count-1)*spacing/2+15)));
check('reject insufficient radius',()=>{if(!G.build({points:G.fromTurns(0,[90],300),count:24,spacing:16,radius:20}).error)throw Error('accepted')});
check('reject too-short leg',()=>{if(!G.build({points:G.fromTurns(0,[90,-90],30),count:6,spacing:6,radius:80}).error)throw Error('accepted')});
check('reject reversal',()=>{if(!G.build({points:G.fromTurns(0,[180],300),count:6,spacing:6,radius:80}).error)throw Error('accepted')});
console.log(JSON.stringify({passed,failed,details},null,2));if(failed)process.exitCode=1;
