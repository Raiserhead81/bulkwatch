// Sea Routing — finds shortest ocean path between any two points

const LAND: number[][] = [
  // North America — split into precise regions (not one giant box)
  [48,72,-140,-55],   // Canada
  [25,48,-125,-65],   // Continental US (leaves ocean on all coasts)
  [25,35,-105,-82],   // US South / Texas (leaves Gulf of Mexico open)
  [15,25,-105,-97],   // Mexico west coast
  [15,32,-97,-82],    // Mexico east (leaves Yucatan Channel open)
  [7,20,-92,-77],     // Central America (already existed)
  [-56,12,-82,-34],   // South America (already existed)
  [36,72,-12,45],     // Europe
  [55,72,4,32],[-35,37,-18,52],[12,42,25,65],[7,35,68,90],
  [0,28,92,110],[18,55,100,135],[33,43,125,130],[30,46,129,146],
  [-11,6,95,141],[5,20,117,127],[-40,-10,112,154],[-48,-34,166,178],
  [-10,0,140,155],[59,84,-75,-10],[63,67,-25,-13],[-90,-60,-180,180],
  [50,75,100,180],[55,75,30,100],[55,85,-140,-55],[55,72,-170,-130],
  [-26,-12,43,50],[50,59,-11,2],[22,26,119,122],[6,10,79,82],
  [-4,7,108,119],[-6,6,95,106],[1,8,99,105],[37,47,7,19],
  [35,42,19,30],[36,42,26,44],
];

function isLand(lat: number, lon: number): boolean {
  for (const b of LAND) if (lat>=b[0] && lat<=b[1] && lon>=b[2] && lon<=b[3]) return true;
  return false;
}

function hav(lat1:number,lon1:number,lat2:number,lon2:number): number {
  const R=3440, dLat=(lat2-lat1)*Math.PI/180, dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}

function crossesLand(lat1:number,lon1:number,lat2:number,lon2:number): boolean {
  for (let f=0.2;f<=0.8;f+=0.2) if (isLand(lat1+(lat2-lat1)*f, lon1+(lon2-lon1)*f)) return true;
  return false;
}

const NP: number[][] = [];
const ADJ: number[][][] = [];

// Grid + chokepoints
for (let lat=-56;lat<=64;lat+=8) for (let lon=-180;lon<180;lon+=10) if (!isLand(lat,lon)) NP.push([lat,lon]);
for (const p of [[36,-5.5],[31.3,32.3],[29,33],[12.5,43.5],[26.5,56.5],[2,101],[1.2,103.8],[-8.5,115.7],[9.5,-79.5],[8,-82],[50,-1.5],[57.7,10.6],[21.5,121],[34,129],[30,133],[-34.4,18.5],[-56,-67],[36,15],[15,42],[6,80],[12,48],[15,128],[-15,115],[25,-80],[28,-90],[20,-110],[-33,-72]]) {
  let ok=true; for (const n of NP) if (hav(p[0],p[1],n[0],n[1])<100){ok=false;break;} if(ok) NP.push(p);
}

// Build adjacency
for (let i=0;i<NP.length;i++) {
  const edges: number[][] = [];
  for (let j=0;j<NP.length;j++) {
    if (i===j) continue;
    const d=hav(NP[i][0],NP[i][1],NP[j][0],NP[j][1]);
    if (d<2500) edges.push([j,d]);
  }
  edges.sort((a,b)=>a[1]-b[1]);
  const filtered: number[][] = [];
  for (const e of edges) { if (filtered.length>=8) break; if (!crossesLand(NP[i][0],NP[i][1],NP[e[0]][0],NP[e[0]][1])) filtered.push(e); }
  ADJ.push(filtered);
}

export function findSeaRoute(fromLat:number, fromLon:number, toLat:number, toLon:number): [number,number][] {
  const N=NP.length;
  const near=(lat:number,lon:number)=>{const d:number[][]=[];for(let i=0;i<N;i++)d.push([i,hav(lat,lon,NP[i][0],NP[i][1])]);d.sort((a,b)=>a[1]-b[1]);return d.slice(0,3);};
  const sn=near(fromLat,fromLon), en=near(toLat,toLon);
  let bestPath:number[]|null=null, bestCost=Infinity;
  for (const [si,sd] of sn) {
    const dist=new Array(N).fill(Infinity), prev=new Array(N).fill(-1), vis=new Array(N).fill(false);
    dist[si]=0;
    for (let it=0;it<N;it++) {
      let u=-1,m=Infinity; for(let i=0;i<N;i++) if(!vis[i]&&dist[i]<m){u=i;m=dist[i];}
      if(u<0||m===Infinity) break;
      vis[u]=true;
      for (const [v,w] of ADJ[u]) { if(vis[v]) continue; const a=m+w; if(a<dist[v]){dist[v]=a;prev[v]=u;} }
    }
    for (const [ei,ed] of en) {
      const t=sd+dist[ei]+ed;
      if (t<bestCost&&dist[ei]<Infinity) {
        bestCost=t;
        const p:number[]=[]; let c=ei;
        for(let s=0;s<N;s++){p.push(c);if(c===si)break;const nx=prev[c];if(nx<0||nx===c)break;c=nx;}
        p.reverse();
        if(p[0]===si) bestPath=p;
      }
    }
  }
  const r:[number,number][]=[[fromLat,fromLon]];
  if(bestPath) for(const i of bestPath) r.push([NP[i][0],NP[i][1]]);
  r.push([toLat,toLon]);
  return r;
}
