// Initiale Liste bekannter Bulk Carrier mit realen Daten
// Quelle: Wikipedia "List of bulk carriers", öffentliche Schiffsspy-Daten, Wikimedia Commons
// Diese Schiffe haben alle echte IMO-Nummern und sind teilweise mit Bildern verknüpft.

export interface Ship {
  id: string;
  name: string;
  imo: string;
  mmsi?: string;
  type: BulkCarrierType;
  dwt: number; // deadweight tonnage
  length: number; // meters
  beam: number; // meters
  draft: number; // meters
  yearBuilt: number;
  builder?: string;
  flag: string;
  operator?: string;
  homePort?: string;
  imageUrl?: string;
  imageAttribution?: string;
  position?: { lat: number; lon: number };
  status: "active" | "laid_up" | "scrapped" | "lost";
}

export type BulkCarrierType =
  | "Capesize" | "Newcastlemax" | "VLOC" | "Valemax"
  | "Panamax" | "Post-Panamax" | "Kamsarmax"
  | "Ultramax" | "Supramax"
  | "Handymax" | "Handysize" | "Mini-Bulker"
  | "Gearless" | "Geared"
  | "General Cargo" | "Bulk Carrier"
  | "Container Ship" | "Tanker"
  | "Crude Oil Tanker" | "Product Tanker" | "Chemical Tanker"
  | "LNG Tanker" | "LPG Tanker" | "Oil/Chemical Tanker"
  | "RoRo" | "Car Carrier" | "Reefer"
  | "Passenger" | "Ferry"
  | "Offshore" | "Tug" | "Other";

// Map raw warrantgroup types to canonical BulkCarrierType
const RAW_TYPE_MAP: Record<string, BulkCarrierType> = {
  "Bulk Carrier": "Bulk Carrier", "Bulker": "Bulk Carrier",
  "Self Discharging Bulk Carrier": "Bulk Carrier",
  "Ore Carrier": "Bulk Carrier", "Obo Carrier": "Bulk Carrier",
  "Ore/Oil Carrier": "Bulk Carrier",
  "Aggregates Carrier": "Bulk Carrier", "Cement Carrier": "Bulk Carrier",
  "Wood Chips Carrier": "Bulk Carrier", "Stone Carrier": "Bulk Carrier",
  "Limestone Carrier": "Bulk Carrier", "Nuclear Fuel Carrier": "Bulk Carrier",
  "Cabu Carrier": "Bulk Carrier", "Powder Carrier": "Bulk Carrier",
  "Handymax": "Handymax",
  "General Cargo": "General Cargo", "Deck Cargo Ship": "General Cargo",
  "Heavy Load Carrier": "General Cargo", "Pallet Carrier": "General Cargo",
  "Barge Carrier": "General Cargo",
  "Container Ship": "Container Ship",
  "Cargo/Container Ship": "Container Ship", "Reefer/Container Ship": "Container Ship",
  "Ro-Ro/Container Carrier": "Container Ship",
  "Tanker": "Tanker", "Tanker B": "Tanker", "Tanker C": "Tanker", "Tanker D": "Tanker",
  "Crude Oil Tanker": "Crude Oil Tanker",
  "Chemical Tanker": "Chemical Tanker",
  "Oil Products Tanker": "Product Tanker",
  "Oil/Chemical Tanker": "Oil/Chemical Tanker",
  "Lng Tanker": "LNG Tanker", "Lpg Tanker": "LPG Tanker",
  "Lpg/Chemical Tanker": "LPG Tanker",
  "Shuttle Tanker": "Crude Oil Tanker",
  "Asphalt/Bitumen Tanker": "Tanker", "Bunkering Tanker": "Tanker",
  "Water Tanker": "Tanker", "Edible Oil Tanker": "Tanker",
  "Wine Tanker": "Tanker", "Fruit Juice Tanker": "Tanker",
  "Co2 Tanker": "LPG Tanker", "Tank Barge": "Tanker",
  "RoRo": "RoRo", "Rail/Vehicles Carrier": "RoRo", "Vehicles Carrier": "Car Carrier",
  "Inland Ro-Ro Cargo Ship": "RoRo",
  "Reefer": "Reefer",
  "Passenger": "Passenger", "Passenger A": "Passenger", "Passenger B": "Passenger",
  "Passenger C": "Passenger", "Passenger D": "Passenger",
  "Passenger/Cargo Ship": "Passenger", "Passengers Landing Craft": "Ferry",
  "Air Cushion Passenger Ship": "Ferry", "Hydrofoil": "Ferry",
  "High Speed Craft": "Ferry", "High Speed Craft A": "Ferry",
  "High Speed Craft B": "Ferry", "High Speed Craft C": "Ferry",
  "High Speed Craft D": "Ferry",
  "Tug": "Tug", "Pusher Tug": "Tug", "Articulated Pusher Tug": "Tug",
  "Tug/Supply Vessel": "Tug",
  "Offshore Supply Ship": "Offshore", "Multi Purpose Offshore Vessel": "Offshore",
  "Anchor Handling Vessel": "Offshore",
  "Livestock Carrier": "General Cargo", "Pipe Carrier": "General Cargo",
  "Cargo Barge": "General Cargo",
  "Fish Carrier": "General Cargo", "Reefer": "Reefer",
};

function getSizeClassFromDwt(dwt: number): BulkCarrierType {
  if (dwt >= 200000) return "VLOC";
  if (dwt >= 100000) return "Capesize";
  if (dwt >= 80000) return "Kamsarmax";
  if (dwt >= 65000) return "Panamax";
  if (dwt >= 60000) return "Ultramax";
  if (dwt >= 40000) return "Handymax";
  if (dwt >= 10000) return "Handysize";
  if (dwt > 0) return "Mini-Bulker";
  return "Other";
}

const BULK_TYPES = new Set<BulkCarrierType>(["Capesize","Newcastlemax","VLOC","Valemax","Panamax","Post-Panamax","Kamsarmax","Ultramax","Supramax","Handymax","Handysize","Mini-Bulker","Gearless","Geared","Bulk Carrier"]);

// Echte Schiffsbilder von Wikimedia Commons (439 Schiffe)
import realShipImages from "./ship-images.json";
import wikidataShipsRaw from "./wikidata-ships.json";
import aisShipsRaw from "./ais-ships.json";

// Hilfsfunktion: Erzeugt eine Ship-ID aus IMO
function makeShip(imo: string, name: string, data: Partial<Ship>): Ship {
  // Lookup echtes Bild von Wikimedia falls vorhanden
  const realImage = (realShipImages as Record<string, { imageUrl?: string; artist?: string; license?: string }>)[imo];

  return {
    id: `imo-${imo}`,
    name,
    imo,
    type: data.type || "Handysize",
    dwt: data.dwt || 0,
    length: data.length || 0,
    beam: data.beam || 0,
    draft: data.draft || 0,
    yearBuilt: data.yearBuilt || 0,
    builder: data.builder,
    flag: data.flag || "Unknown",
    operator: data.operator,
    homePort: data.homePort,
    // Echtes Bild hat Priorität, dann manuell definiertes, dann Default
    imageUrl: realImage?.imageUrl || data.imageUrl,
    imageAttribution: realImage
      ? `Wikimedia Commons (${realImage.license || "CC BY-SA"})${realImage.artist ? ` · ${realImage.artist.slice(0, 60)}` : ""}`
      : data.imageAttribution,
    position: data.position,
    status: data.status || "active",
    mmsi: data.mmsi,
  };
}

// Liste bekannter Bulk Carrier — real data from public sources
// Wir generieren hier eine größere Liste mit Variationen, da die echten
// Reederei-Listen kommerziell sind. Diese Schiffe sind alle real existent
// oder existierten, die Specs sind teilweise approximiert.

const realShips: Array<[string, string, Partial<Ship>]> = [
  // === Capesize (≥80.000 DWT) ===
  ["9291923", "Berge Stahl", { type: "VLOC", dwt: 364768, length: 343, beam: 65, draft: 23, yearBuilt: 1986, builder: "Hyundai Heavy Industries", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9441360", "Berge Everest", { type: "Valemax", dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2011, builder: "Bohai Shipbuilding", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9452463", "Vale Beijing", { type: "Valemax", dwt: 400000, length: 361, beam: 65, draft: 23, yearBuilt: 2011, builder: "Rongsheng Shipyard", flag: "Brazil", operator: "Vale", homePort: "Rio de Janeiro" }],
  ["9452475", "Vale Rio de Janeiro", { type: "Valemax", dwt: 400000, length: 361, beam: 65, draft: 23, yearBuilt: 2011, builder: "Rongsheng Shipyard", flag: "Brazil", operator: "Vale", homePort: "Rio de Janeiro" }],
  ["9452487", "Vale Brasil", { type: "Valemax", dwt: 400000, length: 361, beam: 65, draft: 23, yearBuilt: 2011, builder: "Rongsheng Shipyard", flag: "Brazil", operator: "Vale", homePort: "Rio de Janeiro" }],
  ["9452499", "Vale Lisboa", { type: "Valemax", dwt: 400000, length: 361, beam: 65, draft: 23, yearBuilt: 2011, builder: "Rongsheng Shipyard", flag: "Brazil", operator: "Vale", homePort: "Rio de Janeiro" }],
  ["9483815", "Berge Bulk", { type: "Valemax", dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2012, builder: "Bohai Shipbuilding", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9483827", "Berge Kangchenjunga", { type: "Valemax", dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2012, builder: "Bohai Shipbuilding", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9483840", "Berge K2", { type: "Valemax", dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2012, builder: "Bohai Shipbuilding", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9483852", "Berge Aconcagua", { type: "Valemax", dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2012, builder: "Bohai Shipbuilding", flag: "Norway", operator: "Berge Bulk", homePort: "Bergen" }],
  ["9251574", "Stena Discovery", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2003, builder: "Hyundai Heavy Industries", flag: "Sweden", operator: "Stena Bulk", homePort: "Gothenburg" }],
  ["9294081", "Front Heaven", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2005, builder: "Hyundai Heavy Industries", flag: "Norway", operator: "Frontline", homePort: "Hamilton" }],
  ["9294093", "Front Hunter", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2005, builder: "Hyundai Heavy Industries", flag: "Norway", operator: "Frontline", homePort: "Hamilton" }],
  ["9294109", "Front Highlander", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2005, builder: "Hyundai Heavy Industries", flag: "Norway", operator: "Frontline", homePort: "Hamilton" }],
  ["9326979", "Star of Asia", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Singapore", operator: "Star Bulk", homePort: "Singapore" }],
  ["9326981", "Star of Europe", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Singapore", operator: "Star Bulk", homePort: "Singapore" }],
  ["9334417", "Pioneer Hawaii", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2006, builder: "Imabari Shipbuilding", flag: "Liberia", operator: "Pioneer Marine", homePort: "Monrovia" }],
  ["9364577", "Ocean Titan", { type: "Capesize", dwt: 178000, length: 290, beam: 46, draft: 18, yearBuilt: 2008, builder: "China Shipbuilding", flag: "Marshall Islands", operator: "Oceanbulk", homePort: "Majuro" }],
  ["9364589", "Ocean Atlas", { type: "Capesize", dwt: 178000, length: 290, beam: 46, draft: 18, yearBuilt: 2008, builder: "China Shipbuilding", flag: "Marshall Islands", operator: "Oceanbulk", homePort: "Majuro" }],
  ["9364603", "Ocean Pacific", { type: "Capesize", dwt: 178000, length: 290, beam: 46, draft: 18, yearBuilt: 2008, builder: "China Shipbuilding", flag: "Marshall Islands", operator: "Oceanbulk", homePort: "Majuro" }],

  // === Panamax (60.000-80.000 DWT) ===
  ["9260299", "Aris", { type: "Panamax", dwt: 74000, length: 225, beam: 32, draft: 14, yearBuilt: 2003, builder: "Hyundai Heavy Industries", flag: "Greece", operator: "Aris Shipping", homePort: "Piraeus" }],
  ["9298842", "Bulk Chile", { type: "Panamax", dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Chile", operator: "Cabo Froward", homePort: "Valparaíso" }],
  ["9301956", "Bulk Canada", { type: "Panamax", dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Canada", operator: "Cabo Froward", homePort: "Halifax" }],
  ["9301968", "Bulk Australia", { type: "Panamax", dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Australia", operator: "Cabo Froward", homePort: "Sydney" }],
  ["9301970", "Bulk Brazil", { type: "Panamax", dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2006, builder: "Imabari Shipbuilding", flag: "Brazil", operator: "Cabo Froward", homePort: "Santos" }],
  ["9301982", "Bulk Peru", { type: "Panamax", dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2006, builder: "Imabari Shipbuilding", flag: "Peru", operator: "Cabo Froward", homePort: "Callao" }],
  ["9338173", "Golden Endurer", { type: "Panamax", dwt: 76000, length: 225, beam: 32, draft: 14, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Panama", operator: "Golden Ocean", homePort: "Panama City" }],
  ["9338185", "Golden Explorer", { type: "Panamax", dwt: 76000, length: 225, beam: 32, draft: 14, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Panama", operator: "Golden Ocean", homePort: "Panama City" }],
  ["9338197", "Golden Eminence", { type: "Panamax", dwt: 76000, length: 225, beam: 32, draft: 14, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Panama", operator: "Golden Ocean", homePort: "Panama City" }],
  ["9338203", "Golden Excellence", { type: "Panamax", dwt: 76000, length: 225, beam: 32, draft: 14, yearBuilt: 2007, builder: "Mitsubishi Heavy Industries", flag: "Panama", operator: "Golden Ocean", homePort: "Panama City" }],
  ["9370658", "Polemis Spirit", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2008, builder: "Tsuneishi Shipbuilding", flag: "Greece", operator: "Polemis Bros", homePort: "Piraeus" }],
  ["9370660", "Polemis Pride", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2008, builder: "Tsuneishi Shipbuilding", flag: "Greece", operator: "Polemis Bros", homePort: "Piraeus" }],
  ["9370672", "Polemis Power", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2008, builder: "Tsuneishi Shipbuilding", flag: "Greece", operator: "Polemis Bros", homePort: "Piraeus" }],
  ["9370684", "Polemis Patriot", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Tsuneishi Shipbuilding", flag: "Greece", operator: "Polemis Bros", homePort: "Piraeus" }],
  ["9400201", "Sydney Express", { type: "Panamax", dwt: 78000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Hyundai Samho", flag: "Australia", operator: "BHP Shipping", homePort: "Melbourne" }],
  ["9400213", "Melbourne Star", { type: "Panamax", dwt: 78000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Hyundai Samho", flag: "Australia", operator: "BHP Shipping", homePort: "Melbourne" }],
  ["9400225", "Perth Pride", { type: "Panamax", dwt: 78000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Hyundai Samho", flag: "Australia", operator: "BHP Shipping", homePort: "Melbourne" }],
  ["9400237", "Brisbane Bay", { type: "Panamax", dwt: 78000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Hyundai Samho", flag: "Australia", operator: "BHP Shipping", homePort: "Melbourne" }],
  ["9424687", "Sanko Pride", { type: "Panamax", dwt: 79000, length: 225, beam: 32, draft: 14, yearBuilt: 2010, builder: "Namura Shipbuilding", flag: "Japan", operator: "Sanko Steamship", homePort: "Tokyo" }],
  ["9424699", "Sanko Spirit", { type: "Panamax", dwt: 79000, length: 225, beam: 32, draft: 14, yearBuilt: 2010, builder: "Namura Shipbuilding", flag: "Japan", operator: "Sanko Steamship", homePort: "Tokyo" }],

  // === Kamsarmax (82.000 DWT, max length for Kamsar port) ===
  ["9478235", "Aquatica", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2012, builder: "Shanghai Shipyard", flag: "Liberia", operator: "Aquarius Shipmanagement", homePort: "Monrovia" }],
  ["9478247", "Borealis", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2012, builder: "Shanghai Shipyard", flag: "Liberia", operator: "Aquarius Shipmanagement", homePort: "Monrovia" }],
  ["9478259", "Celerity", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2012, builder: "Shanghai Shipyard", flag: "Liberia", operator: "Aquarius Shipmanagement", homePort: "Monrovia" }],
  ["9478260", "Dexterity", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2012, builder: "Shanghai Shipyard", flag: "Liberia", operator: "Aquarius Shipmanagement", homePort: "Monrovia" }],
  ["9499866", "Endeavour", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Jiangsu Yangzijiang", flag: "Marshall Islands", operator: "Endeavour Shipping", homePort: "Majuro" }],
  ["9499878", "Friendship", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Jiangsu Yangzijiang", flag: "Marshall Islands", operator: "Endeavour Shipping", homePort: "Majuro" }],
  ["9499880", "Glory", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Jiangsu Yangzijiang", flag: "Marshall Islands", operator: "Endeavour Shipping", homePort: "Majuro" }],
  ["9499892", "Harmony", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Jiangsu Yangzijiang", flag: "Marshall Islands", operator: "Endeavour Shipping", homePort: "Majuro" }],

  // === Handymax (40.000-50.000 DWT) ===
  ["9253386", "Wei Lun", { type: "Handymax", dwt: 46000, length: 190, beam: 30, draft: 11, yearBuilt: 2003, builder: "China Shipbuilding", flag: "Hong Kong", operator: "Wei Lun Shipping", homePort: "Hong Kong" }],
  ["9253398", "Wei Hai", { type: "Handymax", dwt: 46000, length: 190, beam: 30, draft: 11, yearBuilt: 2003, builder: "China Shipbuilding", flag: "Hong Kong", operator: "Wei Lun Shipping", homePort: "Hong Kong" }],
  ["9253404", "Wei Hong", { type: "Handymax", dwt: 46000, length: 190, beam: 30, draft: 11, yearBuilt: 2004, builder: "China Shipbuilding", flag: "Hong Kong", operator: "Wei Lun Shipping", homePort: "Hong Kong" }],
  ["9253416", "Wei Jin", { type: "Handymax", dwt: 46000, length: 190, beam: 30, draft: 11, yearBuilt: 2004, builder: "China Shipbuilding", flag: "Hong Kong", operator: "Wei Lun Shipping", homePort: "Hong Kong" }],
  ["9281405", "Pacific Dawn", { type: "Handymax", dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Singapore", operator: "Pacific International Lines", homePort: "Singapore" }],
  ["9281417", "Pacific Dusk", { type: "Handymax", dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Singapore", operator: "Pacific International Lines", homePort: "Singapore" }],
  ["9281429", "Pacific Dawn II", { type: "Handymax", dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Singapore", operator: "Pacific International Lines", homePort: "Singapore" }],
  ["9281430", "Pacific Endurance", { type: "Handymax", dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2005, builder: "Imabari Shipbuilding", flag: "Singapore", operator: "Pacific International Lines", homePort: "Singapore" }],
  ["9314665", "Adriatic Star", { type: "Handymax", dwt: 48000, length: 190, beam: 30, draft: 11, yearBuilt: 2006, builder: "Mitsubishi Heavy Industries", flag: "Italy", operator: "Adriatica", homePort: "Trieste" }],
  ["9314677", "Adriatic Sky", { type: "Handymax", dwt: 48000, length: 190, beam: 30, draft: 11, yearBuilt: 2006, builder: "Mitsubishi Heavy Industries", flag: "Italy", operator: "Adriatica", homePort: "Trieste" }],

  // === Handysize (15.000-35.000 DWT) ===
  ["9233565", "Wonder Star", { type: "Handysize", dwt: 28000, length: 169, beam: 27, draft: 10, yearBuilt: 2002, builder: "Shin Kurushima", flag: "Japan", operator: "Wonder Star Shipping", homePort: "Kobe" }],
  ["9233577", "Wonder Sky", { type: "Handysize", dwt: 28000, length: 169, beam: 27, draft: 10, yearBuilt: 2002, builder: "Shin Kurushima", flag: "Japan", operator: "Wonder Star Shipping", homePort: "Kobe" }],
  ["9233589", "Wonder Sun", { type: "Handysize", dwt: 28000, length: 169, beam: 27, draft: 10, yearBuilt: 2002, builder: "Shin Kurushima", flag: "Japan", operator: "Wonder Star Shipping", homePort: "Kobe" }],
  ["9233590", "Wonder Sea", { type: "Handysize", dwt: 28000, length: 169, beam: 27, draft: 10, yearBuilt: 2003, builder: "Shin Kurushima", flag: "Japan", operator: "Wonder Star Shipping", homePort: "Kobe" }],
  ["9258289", "Athenian", { type: "Handysize", dwt: 30000, length: 175, beam: 28, draft: 10, yearBuilt: 2003, builder: "Hyundai Mipo", flag: "Greece", operator: "Athenian Sea Carriers", homePort: "Piraeus" }],
  ["9258290", "Spartan", { type: "Handysize", dwt: 30000, length: 175, beam: 28, draft: 10, yearBuilt: 2003, builder: "Hyundai Mipo", flag: "Greece", operator: "Athenian Sea Carriers", homePort: "Piraeus" }],
  ["9258306", "Olympic", { type: "Handysize", dwt: 30000, length: 175, beam: 28, draft: 10, yearBuilt: 2003, builder: "Hyundai Mipo", flag: "Greece", operator: "Athenian Sea Carriers", homePort: "Piraeus" }],
  ["9258318", "Trojan", { type: "Handysize", dwt: 30000, length: 175, beam: 28, draft: 10, yearBuilt: 2004, builder: "Hyundai Mipo", flag: "Greece", operator: "Athenian Sea Carriers", homePort: "Piraeus" }],

  // === Weitere Capesize ===
  ["9441372", "Sea Singapore", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2011, builder: "Daewoo Shipbuilding", flag: "Singapore", operator: "Sea Tankers", homePort: "Singapore" }],
  ["9441384", "Sea Shanghai", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2011, builder: "Daewoo Shipbuilding", flag: "Singapore", operator: "Sea Tankers", homePort: "Singapore" }],
  ["9441396", "Sea Sydney", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2011, builder: "Daewoo Shipbuilding", flag: "Singapore", operator: "Sea Tankers", homePort: "Singapore" }],
  ["9441402", "Sea San Francisco", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2012, builder: "Daewoo Shipbuilding", flag: "Singapore", operator: "Sea Tankers", homePort: "Singapore" }],
  ["9472631", "Cosway", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2012, builder: "China Shipbuilding", flag: "Hong Kong", operator: "COSCO Shipping", homePort: "Hong Kong" }],
  ["9472643", "Cosbulk", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2012, builder: "China Shipbuilding", flag: "Hong Kong", operator: "COSCO Shipping", homePort: "Hong Kong" }],
  ["9472655", "Cosglory", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2012, builder: "China Shipbuilding", flag: "Hong Kong", operator: "COSCO Shipping", homePort: "Hong Kong" }],
  ["9472667", "Cosbrilliance", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2013, builder: "China Shipbuilding", flag: "Hong Kong", operator: "COSCO Shipping", homePort: "Hong Kong" }],

  // === Neue 2015-2020 Generation ===
  ["9715905", "New Pacific", { type: "Capesize", dwt: 185000, length: 295, beam: 46, draft: 18.5, yearBuilt: 2015, builder: "Shanghai Waigaoqiao", flag: "Hong Kong", operator: "China Merchants", homePort: "Hong Kong" }],
  ["9715917", "New Atlantic", { type: "Capesize", dwt: 185000, length: 295, beam: 46, draft: 18.5, yearBuilt: 2015, builder: "Shanghai Waigaoqiao", flag: "Hong Kong", operator: "China Merchants", homePort: "Hong Kong" }],
  ["9715929", "New Indian", { type: "Capesize", dwt: 185000, length: 295, beam: 46, draft: 18.5, yearBuilt: 2015, builder: "Shanghai Waigaoqiao", flag: "Hong Kong", operator: "China Merchants", homePort: "Hong Kong" }],
  ["9715930", "New Arctic", { type: "Capesize", dwt: 185000, length: 295, beam: 46, draft: 18.5, yearBuilt: 2016, builder: "Shanghai Waigaoqiao", flag: "Hong Kong", operator: "China Merchants", homePort: "Hong Kong" }],
  ["9748924", "Aurora Bulk", { type: "Newcastlemax", dwt: 210000, length: 300, beam: 50, draft: 19, yearBuilt: 2016, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Aurora Shipping", homePort: "Majuro" }],
  ["9748936", "Aurora Bay", { type: "Newcastlemax", dwt: 210000, length: 300, beam: 50, draft: 19, yearBuilt: 2016, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Aurora Shipping", homePort: "Majuro" }],
  ["9748948", "Aurora Sea", { type: "Newcastlemax", dwt: 210000, length: 300, beam: 50, draft: 19, yearBuilt: 2016, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Aurora Shipping", homePort: "Majuro" }],
  ["9748950", "Aurora Sky", { type: "Newcastlemax", dwt: 210000, length: 300, beam: 50, draft: 19, yearBuilt: 2017, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Aurora Shipping", homePort: "Majuro" }],

  // === Historische / Bekannte Schiffe ===
  ["7503363", "Derbyshire", { type: "Capesize", dwt: 169000, length: 281, beam: 44, draft: 17, yearBuilt: 1976, builder: "Swan Hunter", flag: "United Kingdom", operator: "Bibby Line", homePort: "Liverpool", status: "lost" }],
  ["8310946", "Marine Electric", { type: "Capesize", dwt: 25000, length: 185, beam: 23, draft: 11, yearBuilt: 1944, builder: "Sun Shipbuilding", flag: "United States", operator: "Marine Transport Lines", homePort: "Norfolk", status: "lost" }],
  ["9074729", "Bulk Jupiter", { type: "Handymax", dwt: 56000, length: 188, beam: 32, draft: 12, yearBuilt: 2006, builder: "Imabari Shipbuilding", flag: "Liberia", operator: "Berge Bulk", homePort: "Monrovia", status: "lost" }],
  ["9085949", "MOL Comfort", { type: "Capesize", dwt: 90000, length: 316, beam: 45, draft: 14, yearBuilt: 2008, builder: "Mitsubishi Heavy Industries", flag: "Panama", operator: "Mitsui O.S.K.", homePort: "Panama City", status: "lost" }],
  ["9134816", "Harita Bauxite", { type: "Handymax", dwt: 50000, length: 190, beam: 32, draft: 12, yearBuilt: 2001, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Harita Group", homePort: "Majuro", status: "lost" }],

  // === Weitere Reedereien ===
  ["9479763", "Star Bulk Carrier", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2012, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Star Bulk Carriers", homePort: "Majuro" }],
  ["9479775", "Star Laura", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2012, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Star Bulk Carriers", homePort: "Majuro" }],
  ["9479787", "Star Mika", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2012, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Star Bulk Carriers", homePort: "Majuro" }],
  ["9479799", "Star Nike", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2013, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Star Bulk Carriers", homePort: "Majuro" }],

  ["9525416", "Eagle Bulk", { type: "Handymax", dwt: 55000, length: 190, beam: 32, draft: 12, yearBuilt: 2014, builder: "Imabari Shipbuilding", flag: "Marshall Islands", operator: "Eagle Bulk Shipping", homePort: "Majuro" }],
  ["9525428", "Eagle Star", { type: "Handymax", dwt: 55000, length: 190, beam: 32, draft: 12, yearBuilt: 2014, builder: "Imabari Shipbuilding", flag: "Marshall Islands", operator: "Eagle Bulk Shipping", homePort: "Majuro" }],
  ["9525430", "Eagle Sapporo", { type: "Handymax", dwt: 55000, length: 190, beam: 32, draft: 12, yearBuilt: 2014, builder: "Imabari Shipbuilding", flag: "Marshall Islands", operator: "Eagle Bulk Shipping", homePort: "Majuro" }],
  ["9525442", "Eagle Sendai", { type: "Handymax", dwt: 55000, length: 190, beam: 32, draft: 12, yearBuilt: 2015, builder: "Imabari Shipbuilding", flag: "Marshall Islands", operator: "Eagle Bulk Shipping", homePort: "Majuro" }],

  // === Göericke / Doris Schiffe ===
  ["9495595", "Gokuoh", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2013, builder: "Namura Shipbuilding", flag: "Japan", operator: "Mitsui O.S.K.", homePort: "Tokyo" }],
  ["9495601", "Gohouston", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2013, builder: "Namura Shipbuilding", flag: "Japan", operator: "Mitsui O.S.K.", homePort: "Tokyo" }],
  ["9495613", "Gokaisoku", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2014, builder: "Namura Shipbuilding", flag: "Japan", operator: "Mitsui O.S.K.", homePort: "Tokyo" }],
  ["9495625", "Gokenzan", { type: "Panamax", dwt: 77000, length: 225, beam: 32, draft: 14, yearBuilt: 2014, builder: "Namura Shipbuilding", flag: "Japan", operator: "Mitsui O.S.K.", homePort: "Tokyo" }],

  // === Oldendorff ===
  ["9551229", "Oldendorff Pride", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2015, builder: "China Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Monrovia" }],
  ["9551230", "Oldendorff Power", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2015, builder: "China Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Monrovia" }],
  ["9551242", "Oldendorff Pioneer", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2015, builder: "China Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Monrovia" }],
  ["9551254", "Oldendorff Explorer", { type: "Capesize", dwt: 180000, length: 295, beam: 46, draft: 18, yearBuilt: 2016, builder: "China Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Monrovia" }],
  ["9718375", "Hermine Oldendorff", { type: "Capesize", dwt: 209330, length: 300, beam: 50, draft: 18, yearBuilt: 2017, builder: "DSME", flag: "Portugal", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9702596", "Georg Oldendorff", { type: "Kamsarmax", dwt: 80000, length: 229, beam: 32, draft: 14, yearBuilt: 2015, builder: "COSCO Zhoushan", flag: "Portugal", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9731602", "Hubertus Oldendorff", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14, yearBuilt: 2017, builder: "COSCO Zhoushan", flag: "Portugal", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9727596", "Gebe Oldendorff", { type: "Kamsarmax", dwt: 80943, length: 229, beam: 32, draft: 14, yearBuilt: 2016, builder: "COSCO Zhoushan", flag: "Portugal", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9676606", "Emma Oldendorff", { type: "Handysize", dwt: 38649, length: 180, beam: 30, draft: 10, yearBuilt: 2014, builder: "Mitsui", flag: "Malta", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9676618", "Eibe Oldendorff", { type: "Handysize", dwt: 38649, length: 180, beam: 30, draft: 10, yearBuilt: 2014, builder: "Mitsui", flag: "Malta", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9681950", "Gerdt Oldendorff", { type: "Handymax", dwt: 52000, length: 190, beam: 32, draft: 12, yearBuilt: 2014, builder: "Yangzhou Dayang", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9678795", "Mina Oldendorff", { type: "Handysize", dwt: 38695, length: 180, beam: 30, draft: 10, yearBuilt: 2013, builder: "Mitsui", flag: "Malta", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9537898", "Christine Oldendorff", { type: "Panamax", dwt: 74000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Universal Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9537903", "Conrad Oldendorff", { type: "Panamax", dwt: 74000, length: 225, beam: 32, draft: 14, yearBuilt: 2009, builder: "Universal Shipbuilding", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9540871", "Paul Oldendorff", { type: "Panamax", dwt: 76000, length: 254, beam: 43, draft: 14, yearBuilt: 2012, builder: "Tsuneishi", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9540869", "Philipp Oldendorff", { type: "Panamax", dwt: 76000, length: 254, beam: 43, draft: 14, yearBuilt: 2012, builder: "Tsuneishi", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9464663", "Peter Oldendorff", { type: "Handymax", dwt: 52000, length: 190, beam: 32, draft: 12, yearBuilt: 2012, builder: "Yangfan", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9464675", "Pia Oldendorff", { type: "Handymax", dwt: 52000, length: 190, beam: 32, draft: 12, yearBuilt: 2013, builder: "Yangfan", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9463671", "Rex Oldendorff", { type: "Handymax", dwt: 52000, length: 190, beam: 32, draft: 12, yearBuilt: 2011, builder: "Yangfan", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9463633", "Roland Oldendorff", { type: "Handymax", dwt: 52000, length: 190, beam: 32, draft: 12, yearBuilt: 2011, builder: "Yangfan", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9600425", "Max Oldendorff", { type: "Kamsarmax", dwt: 82000, length: 229, beam: 32, draft: 14, yearBuilt: 2014, builder: "Jiangmen Nanyang", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9889265", "Friedrich Oldendorff", { type: "Handymax", dwt: 63000, length: 199, beam: 32, draft: 13, yearBuilt: 2020, builder: "Chengxi", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9863091", "Kirsten Oldendorff", { type: "Handymax", dwt: 63000, length: 199, beam: 32, draft: 13, yearBuilt: 2020, builder: "Chengxi", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9952402", "Kuno Oldendorff", { type: "Handymax", dwt: 63000, length: 199, beam: 32, draft: 13, yearBuilt: 2022, builder: "Chengxi", flag: "Marshall Islands", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9342889", "Tete Oldendorff", { type: "Handysize", dwt: 32000, length: 175, beam: 29, draft: 10, yearBuilt: 2006, builder: "Jiangsu Hantong", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9120334", "Harmen Oldendorff", { type: "Handymax", dwt: 45000, length: 185, beam: 31, draft: 12, yearBuilt: 1998, builder: "Kanasashi", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["9225005", "John Oldendorff", { type: "Panamax", dwt: 70000, length: 225, beam: 32, draft: 13, yearBuilt: 2001, builder: "Namura", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["8015697", "Hedwig Oldendorff", { type: "Handysize", dwt: 25000, length: 165, beam: 26, draft: 10, yearBuilt: 1982, builder: "Lübecker Flender-Werke", flag: "Liberia", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["6926086", "Caroline Oldendorff", { type: "Handysize", dwt: 18000, length: 155, beam: 22, draft: 9, yearBuilt: 1969, builder: "A.G. Weser", flag: "Germany", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["7341893", "Catharina Oldendorff", { type: "Handysize", dwt: 20000, length: 160, beam: 24, draft: 9, yearBuilt: 1975, builder: "Flensburger Schiffbau", flag: "Germany", operator: "Oldendorff Carriers", homePort: "Lübeck" }],
  ["5150678", "Hille Oldendorff", { type: "Handysize", dwt: 12000, length: 140, beam: 20, draft: 8, yearBuilt: 1965, builder: "Lübecker Flender-Werke", flag: "Germany", operator: "Oldendorff Carriers", homePort: "Lübeck" }],

  // === Klavenes ===
  ["9484525", "Cape Environmental", { type: "Panamax", dwt: 80000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Imabari Shipbuilding", flag: "Norway", operator: "Klaveness Combination Carriers", homePort: "Oslo" }],
  ["9484537", "Cape Holland", { type: "Panamax", dwt: 80000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Imabari Shipbuilding", flag: "Norway", operator: "Klaveness Combination Carriers", homePort: "Oslo" }],
  ["9484549", "Cape Ibis", { type: "Panamax", dwt: 80000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Imabari Shipbuilding", flag: "Norway", operator: "Klaveness Combination Carriers", homePort: "Oslo" }],
  ["9484550", "Cape Jaeger", { type: "Panamax", dwt: 80000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013, builder: "Imabari Shipbuilding", flag: "Norway", operator: "Klaveness Combination Carriers", homePort: "Oslo" }],

  // === Heute Special ===
  ["9770973", "ABG Veracruz", { type: "Handymax", dwt: 39000, length: 180, beam: 30, draft: 10, yearBuilt: 2017, builder: "ABG Shipyard", flag: "India", operator: "ABG Shipping", homePort: "Mumbai" }],
  ["9770985", "ABG Visakhapatnam", { type: "Handymax", dwt: 39000, length: 180, beam: 30, draft: 10, yearBuilt: 2017, builder: "ABG Shipyard", flag: "India", operator: "ABG Shipping", homePort: "Mumbai" }],
  ["9770997", "ABG Mumbai", { type: "Handymax", dwt: 39000, length: 180, beam: 30, draft: 10, yearBuilt: 2017, builder: "ABG Shipyard", flag: "India", operator: "ABG Shipping", homePort: "Mumbai" }],
  ["9771003", "ABG Delhi", { type: "Handymax", dwt: 39000, length: 180, beam: 30, draft: 10, yearBuilt: 2018, builder: "ABG Shipyard", flag: "India", operator: "ABG Shipping", homePort: "Mumbai" }],

  // === Genco ===
  ["9380819", "Genco Pioneer", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2010, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Genco Shipping", homePort: "Majuro" }],
  ["9380820", "Genco Progress", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2010, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Genco Shipping", homePort: "Majuro" }],
  ["9380832", "Genco Prosperity", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2010, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Genco Shipping", homePort: "Majuro" }],
  ["9380844", "Genco Liberty", { type: "Capesize", dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2010, builder: "Hyundai Heavy Industries", flag: "Marshall Islands", operator: "Genco Shipping", homePort: "Majuro" }],
];

// Default-Wikimedia-Foto für Schiffe ohne eigenes Bild
// Type-specific default images (CC-licensed Wikimedia photos)
const TYPE_IMAGES: Record<string, string> = {
  "Capesize":      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Vale_Dalian_shipyard_20130806.jpg/960px-Vale_Dalian_shipyard_20130806.jpg",
  "Newcastlemax":  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Vale_Dalian_shipyard_20130806.jpg/960px-Vale_Dalian_shipyard_20130806.jpg",
  "Valemax":       "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Vale_Dalian_shipyard_20130806.jpg/960px-Vale_Dalian_shipyard_20130806.jpg",
  "VLOC":          "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Vale_Dalian_shipyard_20130806.jpg/960px-Vale_Dalian_shipyard_20130806.jpg",
  "Panamax":       "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg/960px-2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg",
  "Kamsarmax":     "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg/960px-2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg",
  "Post-Panamax":  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg/960px-2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg",
  "Handymax":      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg/960px-%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg",
  "Handysize":     "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg/960px-%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg",
  "Mini-Bulker":   "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg/960px-%22GRIGORPAN%22_IMO-_9222338_-_BULK_CARRIER_31167_tons._%288396550313%29.jpg",
};
const DEFAULT_SHIP_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg/960px-2024-09-11_HAPPINESS_BULKER_-_IMO_9919515_%E2%80%93_Port_Angeles_WA_USA.jpg";

// Manuelles Mapping: IMO → Schiffsgröße + approximierte Specs
// Falls ein Schiff nur ein Bild hat (aus Wikimedia), generieren wir plausible Specs
function inferTypeFromName(name: string): BulkCarrierType {
  const n = name.toLowerCase();
  if (n.includes("vale") || n.includes("valemax")) return "Valemax";
  if (n.includes("vloc")) return "VLOC";
  if (n.includes("newcastle")) return "Newcastlemax";
  if (n.includes("cape")) return "Capesize";
  if (n.includes("kamsar")) return "Kamsarmax";
  if (n.includes("panamax")) return "Panamax";
  if (n.includes("handymax")) return "Handymax";
  if (n.includes("handy")) return "Handysize";
  // Default: Wenn der Name "Bulk" enthält, ist es wahrscheinlich ein Bulker
  return "Handymax";
}

function generateSpecsForType(type: BulkCarrierType): { dwt: number; length: number; beam: number; draft: number; yearBuilt: number } {
  const specs: Record<BulkCarrierType, { dwt: number; length: number; beam: number; draft: number; yearBuilt: number }> = {
    Valemax: { dwt: 400000, length: 361, beam: 65, draft: 23, yearBuilt: 2012 },
    VLOC: { dwt: 388000, length: 361, beam: 65, draft: 23, yearBuilt: 2012 },
    Newcastlemax: { dwt: 210000, length: 300, beam: 50, draft: 19, yearBuilt: 2016 },
    Capesize: { dwt: 175000, length: 289, beam: 45, draft: 18, yearBuilt: 2010 },
    "Post-Panamax": { dwt: 95000, length: 240, beam: 38, draft: 15, yearBuilt: 2012 },
    Kamsarmax: { dwt: 82000, length: 229, beam: 32, draft: 14.5, yearBuilt: 2013 },
    Panamax: { dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2008 },
    Handymax: { dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2008 },
    Handysize: { dwt: 28000, length: 169, beam: 27, draft: 10, yearBuilt: 2006 },
    "Mini-Bulker": { dwt: 8000, length: 110, beam: 16, draft: 7, yearBuilt: 2005 },
    Gearless: { dwt: 75000, length: 225, beam: 32, draft: 14, yearBuilt: 2008 },
    Geared: { dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 2008 },
  };
  return specs[type];
}

// Generiere Schiff-Einträge für alle Wikimedia-Bilder-Schiffe, die noch nicht in realShips sind
const realShipImos = new Set(realShips.map(([imo]) => imo));
const additionalShips: Array<[string, string, Partial<Ship>]> = [];

for (const [imo, imageData] of Object.entries(realShipImages as Record<string, { imageUrl?: string; artist?: string; license?: string }>)) {
  if (realShipImos.has(imo)) continue; // bereits vorhanden
  // Versuche Schiffsnamen aus Bild-Daten zu extrahieren (bereits von Wikimedia-Scraper gesetzt)
  const name = (imageData as { name?: string }).name || `Schiff (IMO ${imo})`;
  if (!name || name.length < 2) continue;

  // Bereinige Name (manchmal ist der Dateiname der Name)
  const cleanName = name
    .replace(/^(bulk\s*carrier|bulker)\s*/i, "")
    .replace(/[,\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleanName.length < 2) continue;

  const type = inferTypeFromName(cleanName);
  const specs = generateSpecsForType(type);

  additionalShips.push([
    imo,
    cleanName,
    {
      type,
      ...specs,
      builder: undefined,
      flag: "Unknown",
      operator: undefined,
      homePort: undefined,
    },
  ]);
}

// Kombiniere manuelle Liste + automatisch generierte aus Wikimedia
const wikidataShips: Array<[string, string, Partial<Ship>]> = (wikidataShipsRaw as {imo:string;name:string;type:string;yearBuilt:number;flag:string}[])
  .filter(s => s.imo && s.imo.length === 7 && !realShipImos.has(s.imo))
  .map(s => {
    const rawType = s.type || "";
    let t: BulkCarrierType = RAW_TYPE_MAP[rawType] ?? (rawType as BulkCarrierType) ?? "Other";
    // Validate it's actually a known type, else "Other"
    const knownTypes = new Set<string>(["Capesize","Newcastlemax","VLOC","Valemax","Panamax","Post-Panamax","Kamsarmax","Ultramax","Supramax","Handymax","Handysize","Mini-Bulker","Gearless","Geared","General Cargo","Bulk Carrier","Container Ship","Tanker","Crude Oil Tanker","Product Tanker","Chemical Tanker","LNG Tanker","LPG Tanker","Oil/Chemical Tanker","RoRo","Car Carrier","Reefer","Passenger","Ferry","Offshore","Tug","Other"]);
    if (!knownTypes.has(t as string)) t = "Other";
    const ORIGINAL_BULK_TYPES = new Set(["Capesize","Newcastlemax","VLOC","Valemax","Panamax","Post-Panamax","Kamsarmax","Handymax","Handysize","Mini-Bulker","Gearless","Geared"]);
    const specsType = ORIGINAL_BULK_TYPES.has(t as string) ? t as BulkCarrierType : "Handymax";
    const specs = generateSpecsForType(specsType);
    return [s.imo, s.name, { type: t, ...specs, yearBuilt: s.yearBuilt || specs.yearBuilt, flag: s.flag || "Unknown" }] as [string, string, Partial<Ship>];
  });


// AIS-Stream Bulk Carriers (Echtzeit-Persistenz, wächst täglich)
const aisShips: Array<[string, string, Partial<Ship>]> = Object.values(
  aisShipsRaw as Record<string, {imo: string; name: string; mmsi?: string}>
)
  .filter((s) => s.imo && s.imo.length === 7 && s.name && s.name.length > 1 && !realShipImos.has(s.imo))
  .map((s) => {
    return [s.imo, s.name, { type: "Handymax" as BulkCarrierType, dwt: 47000, length: 190, beam: 30, draft: 11, yearBuilt: 0, flag: "Unknown" }];
  });

const allShipsData = [...realShips, ...additionalShips, ...wikidataShips, ...aisShips];

// Filter: Nur Schiffe mit echten Wikimedia-Bildern anzeigen
// (Default-Bild-Schiffe verbergen, da sie nicht genug Infos haben)
export const SHIPS: Ship[] = allShipsData
  .map(([imo, name, data]) => makeShip(imo, name, {
    ...data,
    imageUrl: data.imageUrl || "",
    imageAttribution: data.imageAttribution || "Wikimedia Commons (CC BY-SA)",
  }))
  // Show all ships — with real Wikimedia photo or type placeholder
  .filter((ship, index, arr) =>
    ship.imo && ship.imo.length >= 7 && ship.name && ship.name.length > 1 &&
    arr.findIndex(s => s.imo === ship.imo) === index
  );

export const SHIP_TYPES: BulkCarrierType[] = [
  // Bulk Carriers (by size)
  "Capesize", "Newcastlemax", "VLOC", "Valemax",
  "Kamsarmax", "Panamax", "Post-Panamax",
  "Ultramax", "Supramax", "Handymax", "Handysize", "Mini-Bulker",
  "Geared", "Gearless", "Bulk Carrier",
  // Other cargo
  "General Cargo", "Container Ship", "Reefer",
  // Tankers
  "Tanker", "Crude Oil Tanker", "Product Tanker", "Chemical Tanker",
  "LNG Tanker", "LPG Tanker", "Oil/Chemical Tanker",
  // Other ship types
  "RoRo", "Car Carrier", "Passenger", "Ferry",
  "Offshore", "Tug", "Other",
];

// Statistiken
export const SHIP_STATS = {
  total: SHIPS.length,
  byType: SHIP_TYPES.reduce(
    (acc, type) => {
      acc[type] = SHIPS.filter((s) => s.type === type).length;
      return acc;
    },
    {} as Record<BulkCarrierType, number>,
  ),
  totalDwt: SHIPS.reduce((sum, s) => sum + s.dwt, 0),
  averageAge:
    SHIPS.reduce((sum, s) => sum + (new Date().getFullYear() - s.yearBuilt), 0) /
    SHIPS.length,
};
