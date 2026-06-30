// Sea Routing — finds shortest ocean path between any two points

const LAND: number[][] = [
  // Ultra-tight: only deep inland areas, all coastal waters open
  [54,66,-125,-70],    // Canada interior
  [35,45,-110,-80],    // US midwest
  [23,27,-103,-90],    // Mexico interior
  [-40,-5,-65,-48],    // SA interior (Amazon/interior)
  [49,59,12,26],        // Europe deep interior
  [-20,25,0,33],       // Africa interior (very conservative)
  [24,33,38,48],       // Arabia desert
  [18,26,77,82],       // India interior (small)
  [10,16,98,102],      // Indochina narrow interior
  [32,42,113,118],     // China interior (leaves coast)
  [36,40,134,139],     // Japan Honshu interior (tiny)
  [-30,-20,125,142],   // Australia interior
  [64,78,-58,-25],     // Greenland interior
  [-80,-66,-180,180],  // Antarctica
  [58,68,50,90],       // Russia interior
  [58,66,115,165],     // Siberia interior
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
