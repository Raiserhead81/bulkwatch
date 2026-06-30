// Sea Routing Engine — Dijkstra shortest path through ocean waypoint graph

const NODES: [string, number, number][] = [
  // North Atlantic
  ["atl-n1",50,-30],["atl-n2",40,-40],["atl-n3",35,-20],
  // Central/South Atlantic
  ["atl-c1",20,-30],["atl-c2",10,-25],["atl-c3",0,-20],["atl-s1",-15,-20],["atl-s2",-30,-15],
  // NW Europe
  ["eng-ch",50,-1.5],["nth-sea",54,4],["skagen",57.7,10.6],
  // Mediterranean
  ["gib",36,-5.5],["med-w",38,5],["med-c",36,15],["med-e",34,28],
  // Suez + Red Sea
  ["suez-n",31.3,32.3],["suez-s",29,33],["red-s",15,42],["bab",12.5,43.5],
  // Arabian Sea / Persian Gulf
  ["aden",12,48],["arab",15,55],["hormuz",26.5,56.5],["gulf",27,50],
  // Indian Ocean
  ["ind-w",10,60],["ind-c",5,73],["sri",6,80],["ind-e",5,85],
  // SE Asia
  ["malacca",3,100],["sing",1.2,103.8],["scs-s",3,108],["scs-c",10,112],["scs-n",18,115],
  // Indonesia
  ["lombok",-8.5,115.7],["banda",-5,125],["e-indo",-2,135],
  // East Asia
  ["taiwan-s",21.5,121],["china-e",30,125],["korea",34,129],
  ["japan-s",30,133],["japan-e",35,142],["japan-ne",40,145],
  // Philippines east
  ["e-phil",15,128],["pac-w",10,140],
  // Pacific
  ["pac-nw",35,155],["pac-nc",30,-170],["pac-ne",35,-140],["hawaii",21,-158],
  // Australia
  ["au-nw",-15,115],["au-n",-10,135],["au-ne",-15,155],["au-e",-28,155],
  ["au-se",-38,150],["au-s",-40,135],["au-sw",-35,115],
  // NZ
  ["nz-n",-35,174],["nz-s",-48,167],
  // Southern
  ["cape-gh",-34.4,18.5],["cape-gh-w",-35,10],["cape-horn",-56,-67],
  // East Africa
  ["moz",-15,42],["mad-n",-12,49],["eaf-n",0,42],
  // West Africa
  ["waf-n",14.7,-17.5],["waf-c",4,-3],["waf-s",-5,8],
  // Americas
  ["panama-a",9.5,-79.5],["panama-p",8,-82],
  ["carib-e",15,-62],["carib-w",18,-82],["florida",25,-80],
  ["us-e",38,-72],["us-ne",42,-68],["nova-sc",44,-62],
  ["brazil-ne",-5,-34],["brazil-se",-23,-42],["plate",-35,-55],
  ["us-w-s",32,-120],["us-w-n",42,-126],["alaska",55,-140],
];

const EDGES: string[][] = [
  // Atlantic
  ["eng-ch","atl-n1"],["atl-n1","atl-n2"],["atl-n2","us-ne"],["atl-n2","nova-sc"],
  ["atl-n1","atl-n3"],["atl-n3","gib"],["atl-n3","atl-c1"],
  ["atl-n1","nth-sea"],["nth-sea","skagen"],["eng-ch","nth-sea"],["eng-ch","gib"],
  ["atl-c1","atl-c2"],["atl-c2","atl-c3"],["atl-c3","atl-s1"],
  ["atl-c1","waf-n"],["atl-c2","waf-c"],["atl-c2","brazil-ne"],
  ["atl-c1","carib-e"],["atl-c1","florida"],
  ["atl-s1","atl-s2"],["atl-s2","cape-gh-w"],["cape-gh-w","cape-gh"],
  ["atl-s1","brazil-ne"],["atl-s2","brazil-se"],["brazil-se","plate"],
  ["atl-s1","waf-s"],["waf-s","waf-c"],["waf-c","waf-n"],
  // Med + Suez
  ["gib","med-w"],["med-w","med-c"],["med-c","med-e"],["med-e","suez-n"],
  ["suez-n","suez-s"],["suez-s","red-s"],["red-s","bab"],
  ["bab","aden"],["aden","arab"],["arab","ind-w"],
  ["arab","hormuz"],["hormuz","gulf"],
  // Indian Ocean
  ["ind-w","ind-c"],["ind-c","sri"],["sri","ind-e"],["ind-e","malacca"],
  ["malacca","sing"],["sing","scs-s"],["scs-s","scs-c"],["scs-c","scs-n"],
  ["sing","lombok"],
  // Indonesia
  ["lombok","banda"],["banda","e-indo"],["e-indo","pac-w"],["lombok","au-nw"],
  // East Asia
  ["scs-n","taiwan-s"],["taiwan-s","china-e"],["china-e","korea"],
  ["korea","japan-s"],["japan-s","japan-e"],["japan-e","japan-ne"],
  ["scs-n","e-phil"],["e-phil","pac-w"],["e-phil","taiwan-s"],
  ["japan-e","pac-nw"],
  // Pacific
  ["pac-nw","pac-nc"],["pac-nc","pac-ne"],["pac-ne","us-w-n"],
  ["pac-nc","hawaii"],["hawaii","us-w-s"],["pac-ne","us-w-s"],
  ["japan-ne","alaska"],["alaska","us-w-n"],["pac-w","pac-nw"],
  // Australia
  ["au-nw","au-n"],["au-n","au-ne"],["au-ne","au-e"],["au-e","au-se"],
  ["au-se","au-s"],["au-s","au-sw"],["au-sw","au-nw"],
  ["au-ne","e-indo"],["au-e","nz-n"],["nz-n","nz-s"],
  // Southern
  ["cape-gh","moz"],["moz","mad-n"],["mad-n","ind-w"],
  ["moz","eaf-n"],["eaf-n","aden"],
  // Americas
  ["florida","us-e"],["us-e","us-ne"],["us-ne","nova-sc"],
  ["florida","carib-e"],["carib-e","carib-w"],["carib-w","panama-a"],
  ["panama-a","panama-p"],["panama-p","us-w-s"],["us-w-s","us-w-n"],
  ["plate","cape-horn"],["cape-horn","panama-p"],["brazil-ne","carib-e"],
];

function hav(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export function findSeaRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): [number, number][] {
  // Build node map
  const pos = new Map<string, [number, number]>();
  NODES.forEach(([id, lat, lon]) => pos.set(id, [lat, lon]));

  // Find 3 nearest nodes to start and end
  const nearest = (lat: number, lon: number) =>
    NODES.map(([id, nlat, nlon]) => ({ id, d: hav(lat, lon, nlat, nlon) }))
      .sort((a, b) => a.d - b.d).slice(0, 3);

  const startNearest = nearest(fromLat, fromLon);
  const endNearest = nearest(toLat, toLon);

  // Build adjacency
  const adj = new Map<string, [string, number][]>();
  for (const [id] of NODES) adj.set(id, []);

  for (const [a, b] of EDGES) {
    if (!pos.has(a) || !pos.has(b)) continue;
    const [la, loa] = pos.get(a)!;
    const [lb, lob] = pos.get(b)!;
    const d = hav(la, loa, lb, lob);
    adj.get(a)!.push([b, d]);
    adj.get(b)!.push([a, d]);
  }

  // Try each combination of start/end nearest nodes, find shortest total
  let bestPath: string[] = [];
  let bestDist = Infinity;

  for (const sn of startNearest) {
    for (const en of endNearest) {
      // Dijkstra from sn.id to en.id
      const dist = new Map<string, number>();
      const prev = new Map<string, string | null>();
      const visited = new Set<string>();

      for (const [id] of NODES) {
        dist.set(id, Infinity);
        prev.set(id, null);
      }
      dist.set(sn.id, 0);

      for (let iter = 0; iter < NODES.length; iter++) {
        // Find unvisited with smallest dist
        let u = "";
        let minD = Infinity;
        for (const [id, d] of dist) {
          if (!visited.has(id) && d < minD) { u = id; minD = d; }
        }
        if (!u || minD === Infinity) break;
        if (u === en.id) break;
        visited.add(u);

        for (const [v, w] of adj.get(u) || []) {
          if (visited.has(v)) continue;
          const alt = minD + w;
          if (alt < dist.get(v)!) {
            dist.set(v, alt);
            prev.set(v, u);
          }
        }
      }

      const totalDist = sn.d + (dist.get(en.id) || Infinity) + en.d;
      if (totalDist < bestDist) {
        bestDist = totalDist;
        // Reconstruct path
        const path: string[] = [];
        let cur: string | null = en.id;
        const seen = new Set<string>();
        while (cur !== null && !seen.has(cur)) {
          seen.add(cur);
          path.push(cur);
          cur = prev.get(cur) || null;
        }
        path.reverse();
        bestPath = path;
      }
    }
  }

  // Convert to coordinates
  const result: [number, number][] = [[fromLat, fromLon]];
  for (const id of bestPath) {
    const p = pos.get(id);
    if (p) result.push(p);
  }
  result.push([toLat, toLon]);
  return result;
}
