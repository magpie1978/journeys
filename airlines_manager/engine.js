export const EXCLUDED = new Set(['BKK','CGK','DEL','MPM']);
export function csv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}else cell+=c;}if(cell||row.length){row.push(cell);rows.push(row);}const [headers,...data]=rows;return data.map(a=>Object.fromEntries(headers.map((h,i)=>[h,a[i]??''])));}
export function duration(distance,speed){return Math.ceil((2*(distance/speed+1))*4)/4;}
export function prepare(routes,pricing,aircraft){const p=new Map(pricing.filter(x=>x.status==='ok').map(x=>[x.route_id,x]));const r=routes.filter(x=>x.ownership_status==='owned'&&!EXCLUDED.has(x.airport_code)).map(x=>{const z=p.get(x.route_id)||{};return {code:x.airport_code,id:x.route_id,distance:+x.distance_km,category:+x.category,ecoDemand:Math.max(0,+z.remaining_demand_economy||0),cargoDemand:Math.max(0,+z.remaining_demand_cargo||0),ecoFare:+z.current_price_economy||0,cargoFare:+z.current_price_cargo||0};});const a=aircraft.map(x=>({id:x.aircraft_id,model:x.model,category:+x.category,range:+x.range_km,speed:+x.speed_kmh,seats:+x.max_seats,payload:+x.payload_tonnes})).filter(x=>x.speed>0&&x.payload>0);return {routes:r,aircraft:a};}
// Baseline heuristic: chooses a fixed configuration for each seven-plane group,
// greedily fills a <=168h circuit, then consumes demand globally.
// No claim of global optimality or game preflight validity.
export function optimise(data,{groups=20,passengerMin=70,onProgress=()=>{},stop=()=>false}={}){
 const remaining=new Map(data.routes.map(r=>[r.id,{eco:r.ecoDemand,cargo:r.cargoDemand}]));const rotations=[];let total=0;
 for(let g=0;g<groups&&!stop();g++){
  let best=null;
  for(const a of data.aircraft){
   for(let cargo=1;cargo<=Math.min(35,Math.floor(a.payload));cargo++){
    const eco=Math.min(a.seats,Math.floor((a.payload-cargo)*10+1e-7));
    if(eco<=0||eco*.1/a.payload*100+1e-7<passengerMin)continue;
    const options=[];
    for(const r of data.routes){if(r.category<a.category||r.distance>a.range||!r.ecoFare)continue;
     const t=duration(r.distance,a.speed),rem=remaining.get(r.id);
     if(t>168||rem.eco<2*eco||rem.cargo<2*cargo)continue;
     const revenue=7*(2*eco*r.ecoFare+2*cargo*r.cargoFare);
     options.push({r,t,revenue,ratio:revenue/t});}
    options.sort((x,y)=>y.ratio-x.ratio);
    let hours=0,revenue=0;const legs=[],usage=new Map();
    for(const o of options){const used=usage.get(o.r.id)||0;const rem=remaining.get(o.r.id);if(hours+o.t>168.00001||rem.eco<(used+1)*2*eco||rem.cargo<(used+1)*2*cargo)continue;
     legs.push({code:o.r.code,routeId:o.r.id,start:hours,duration:o.t,revenue:o.revenue});hours+=o.t;revenue+=o.revenue;usage.set(o.r.id,used+1);}
    if(legs.length&&(!best||revenue>best.revenue))best={model:a.model,aircraftId:a.id,eco,cargo,hours,revenue,legs};
   }
  }
  if(!best)break;
  for(const l of best.legs){const rem=remaining.get(l.routeId);rem.eco-=2*best.eco;rem.cargo-=2*best.cargo;}
  best.id=`BOM-${String(g+1).padStart(3,'0')}`;rotations.push(best);total+=best.revenue;onProgress({completed:g+1,total,rotation:best});
 }
 return {rotations,total,remaining,method:'greedy-baseline',preflight:'NOT_RUN'};
}
export function exportCSV(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';return [keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n');}
