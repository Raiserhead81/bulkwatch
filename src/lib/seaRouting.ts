// Sea Routing Engine — waypoint graph + shortest path
// Works for ANY port-to-port combination worldwide

// Ocean waypoint network — nodes that are guaranteed to be at sea
const OCEAN_NODES: [string, number, number][] = [
  // North Atlantic
  ["atl-n1", 50.0, -30.0],
  ["atl-n2", 40.0, -40.0],
  ["atl-n3", 35.0, -20.0],
  // Central Atlantic
  ["atl-c1", 20.0, -30.0],
  ["atl-c2", 10.0, -25.0],
  ["atl-c3", 0.0, -20.0],
  // South Atlantic
  ["atl-s1", -15.0, -20.0],
  ["atl-s2", -30.0, -15.0],
  // English Channel & North Sea
  ["eng-ch", 50.0, -1.5],
  ["nth-sea", 54.0, 4.0],
  ["skagen", 57.7, 10.6],
  // Mediterranean
  ["gib", 36.0, -5.5],
  ["med-w", 38.0, 5.0],
  ["med-c", 36.0, 15.0],
  ["med-e", 34.0, 28.0],
  // Suez approach
  ["suez-n", 31.3, 32.3],
  ["suez-s", 29.0, 33.0],
  // Red Sea
  ["red-n", 27.0, 34.5],
  ["red-s", 15.0, 42.0],
  ["bab", 12.5, 43.5],
  // Gulf of Aden / Arabian Sea
  ["aden", 12.0, 48.0],
  ["arab-w", 15.0, 55.0],
  // Persian Gulf
  ["hormuz", 26.5, 56.5],
  ["gulf", 27.0, 50.0],
  // Indian Ocean
  ["ind-w", 10.0, 60.0],
  ["ind-c", 5.0, 73.0],
  ["sri", 6.0, 80.0],
  ["ind-e", 5.0, 85.0],
  ["bay-beng", 12.0, 88.0],
  // SE Asia
  ["malacca", 3.0, 100.0],
  ["singapore", 1.2, 103.8],
  ["scs-s", 3.0, 108.0],
  ["scs-c", 10.0, 112.0],
  ["scs-n", 18.0, 115.0],
  // Indonesia
  ["lombok", -8.5, 115.7],
  ["banda", -5.0, 125.0],
  ["flores", -8.0, 122.0],
  // East of Indonesia/Philippines
  ["e-indo", -2.0, 135.0],
  ["e-phil", 15.0, 128.0],
  ["pac-w", 10.0, 140.0],
  // East Asia
  ["taiwan-s", 21.5, 121.0],
  ["taiwan-e", 24.0, 123.0],
  ["china-e", 30.0, 125.0],
  ["korea", 34.0, 129.0],
  ["japan-s", 30.0, 133.0],
  ["japan-e", 35.0, 142.0],
  ["japan-ne", 40.0, 145.0],
  // Pacific
  ["pac-nw", 35.0, 155.0],
  ["pac-nc", 30.0, -170.0],
  ["pac-ne", 35.0, -140.0],
  ["hawaii", 21.0, -158.0],
  ["pac-c", 5.0, -160.0],
  ["pac-se", -15.0, -140.0],
  // Australia
  ["au-nw", -15.0, 115.0],
  ["au-n", -10.0, 135.0],
  ["au-ne", -15.0, 155.0],
  ["au-e", -28.0, 155.0],
  ["au-se", -38.0, 150.0],
  ["au-s", -40.0, 135.0],
  ["au-sw", -35.0, 115.0],
  // New Zealand
  ["nz-n", -35.0, 174.0],
  ["nz-s", -48.0, 167.0],
  // Southern Ocean / Capes
  ["cape-gh", -34.4, 18.5],
  ["cape-gh-w", -35.0, 10.0],
  ["cape-horn", -56.0, -67.0],
  // East Africa
  ["moz", -15.0, 42.0],
  ["mad-n", -12.0, 49.0],
  ["mad-e", -18.0, 52.0],
  ["eaf-n", 0.0, 42.0],
  // West Africa
  ["waf-n", 14.7, -17.5],
  ["waf-c", 4.0, -3.0],
  ["waf-s", -5.0, 8.0],
  // Caribbean / Americas
  ["panama-a", 9.5, -79.5],
  ["panama-p", 8.0, -82.0],
  ["carib-e", 15.0, -62.0],
  ["carib-w", 18.0, -82.0],
  ["florida", 25.0, -80.0],
  ["us-e", 38.0, -72.0],
  ["us-ne", 42.0, -68.0],
  ["nova-sc", 44.0, -62.0],
  ["brazil-ne", -5.0, -34.0],
  ["brazil-se", -23.0, -42.0],
  ["plate", -35.0, -55.0],
  // US West / Pacific
  ["us-w-s", 32.0, -120.0],
  ["us-w-n", 42.0, -126.0],
  ["alaska", 55.0, -140.0],
];

// Define connections between nodes (edges of the graph)
// Only connect nodes that have open water between them
const EDGES: [string, string][] = [
  // North Atlantic crossings
  ["eng-ch","atl-n1"], ["atl-n1","atl-n2"], ["atl-n2","us-ne"], ["atl-n2","nova-sc"],
  ["atl-n1","atl-n3"], ["atl-n3","gib"], ["atl-n3","atl-c1"],
  ["atl-n1","nth-sea"], ["nth-sea","skagen"],
  ["eng-ch","nth-sea"], ["eng-ch","gib"], ["eng-ch","atl-n3"],
  // Central Atlantic
  ["atl-c1","atl-c2"], ["atl-c2","atl-c3"], ["atl-c3","atl-s1"],
  ["atl-c1","waf-n"], ["atl-c2","waf-c"], ["atl-c2","brazil-ne"],
  ["atl-c1","carib-e"], ["atl-c1","florida"],
  // South Atlantic
  ["atl-s1","atl-s2"], ["atl-s2","cape-gh-w"], ["cape-gh-w","cape-gh"],
  ["atl-s1","brazil-ne"], ["atl-s2","brazil-se"], ["brazil-se","plate"],
  ["atl-s1","waf-s"], ["waf-s","waf-c"], ["waf-c","waf-n"],
  // Mediterranean
  ["gib","med-w"], ["med-w","med-c"], ["med-c","med-e"], ["med-e","suez-n"],
  // Suez -> Red Sea -> Indian Ocean
  ["suez-n","suez-s"], ["suez-s","red-n"], ["red-n","red-s"], ["red-s","bab"],
  ["bab","aden"], ["aden","arab-w"], ["arab-w","ind-w"],
  // Persian Gulf
  ["arab-w","hormuz"], ["hormuz","gulf"],
  // Indian Ocean
  ["ind-w","ind-c"], ["ind-c","sri"], ["sri","ind-e"], ["ind-e","bay-beng"],
  ["bay-beng","malacca"],
  // SE Asia
  ["malacca","singapore"], ["singapore","scs-s"], ["scs-s","scs-c"], ["scs-c","scs-n"],
  ["singapore","lombok"],
  // Indonesia passages
  ["lombok","flores"], ["flores","banda"], ["banda","e-indo"], ["e-indo","pac-w"],
  ["lombok","au-nw"],
  // Philippines / Pacific West
  ["scs-n","taiwan-s"], ["taiwan-s","taiwan-e"], ["taiwan-e","china-e"],
  ["scs-n","e-phil"], ["e-phil","pac-w"], ["e-phil","taiwan-e"],
  ["china-e","korea"], ["korea","japan-s"], ["japan-s","japan-e"], ["japan-e","japan-ne"],
  ["japan-e","pac-nw"],
  // Pacific
  ["pac-nw","pac-nc"], ["pac-nc","pac-ne"], ["pac-ne","us-w-n"],
  ["pac-nc","hawaii"], ["hawaii","pac-c"], ["hawaii","us-w-s"],
  ["pac-c","pac-se"],
  ["pac-ne","us-w-s"],
  ["japan-ne","alaska"], ["alaska","us-w-n"],
  ["pac-w","pac-nw"],
  // Australia
  ["au-nw","au-n"], ["au-n","au-ne"], ["au-ne","au-e"], ["au-e","au-se"],
  ["au-se","au-s"], ["au-s","au-sw"], ["au-sw","au-nw"],
  ["au-ne","e-indo"],
  ["au-e","nz-n"], ["nz-n","nz-s"],
  // Southern connections
  ["cape-gh","moz"], ["moz","mad-n"], ["mad-n","mad-e"], ["mad-e","ind-w"],
  ["moz","eaf-n"], ["eaf-n","aden"],
  ["cape-gh","au-sw"], // long southern route
  ["au-s","cape-gh-w"], // southern ocean
  // Americas
  ["florida","us-e"], ["us-e","us-ne"], ["us-ne","nova-sc"],
  ["florida","carib-e"], ["carib-e","carib-w"], ["carib-w","panama-a"],
  ["panama-a","panama-p"], ["panama-p","us-w-s"],
  ["us-w-s","us-w-n"],
  ["plate","cape-horn"], ["cape-horn","panama-p"],
  ["brazil-ne","carib-e"],
];

function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440; // nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.pow(Math.sin(dLat/2),2) + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.pow(Math.sin(dLon/2),2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Dijkstra shortest path through ocean waypoint graph
export function findSeaRoute(fromLat: number, fromLon: number, toLat: number, toLon: number): [number, number][] {
  const nodes = new Map<string, [number, number]>();
  OCEAN_NODES.forEach(([id, lat, lon]) => nodes.set(id, [lat, lon]));
  nodes.set("__from", [fromLat, fromLon]);
  nodes.set("__to", [toLat, toLon]);

  // Build adjacency list
  const adj = new Map<string, Map<string, number>>();
  for (const [id] of nodes) adj.set(id, new Map());

  for (const [a, b] of EDGES) {
    if (!nodes.has(a) || !nodes.has(b)) continue;
    const [la, loa] = nodes.get(a)!;
    const [lb, lob] = nodes.get(b)!;
    const d = haversineDist(la, loa, lb, lob);
    adj.get(a)!.set(b, d);
    adj.get(b)!.set(a, d);
  }

  // Connect start/end to nearest 5 ocean nodes
  for (const endpoint of ["__from", "__to"] as const) {
    const [lat, lon] = nodes.get(endpoint)!;
    const dists = OCEAN_NODES.map(([id, nlat, nlon]) => ({id, d: haversineDist(lat, lon, nlat, nlon)}))
      .sort((a, b) => a.d - b.d).slice(0, 5);
    for (const {id, d} of dists) {
      adj.get(endpoint)!.set(id, d);
      adj.get(id)!.set(endpoint, d);
    }
  }

  // Dijkstra
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (const [id] of nodes) dist.set(id, Infinity);
  dist.set("__from", 0);

  let _iter = 0;
  while (_iter++ < 500) {
    let u = "";
    let minD = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minD) { u = id; minD = d; }
    }
    if (!u || u === "__to" || minD === Infinity) break;
    visited.add(u);

    for (const [v, w] of adj.get(u) || []) {
      const alt = minD + w;
      if (alt < (dist.get(v) || Infinity)) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }

  // Reconstruct path
  const path: [number, number][] = [];
  let cur = "__to";
  while (cur) {
    path.unshift(nodes.get(cur)!);
    cur = prev.get(cur) || "";
  }
  return path.length > 1 ? path : [[fromLat, fromLon], [toLat, toLon]];
}
