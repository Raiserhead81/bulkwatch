// ports für Schiffsinspektionen (Pre-Purchase Surveys)
// Diese ports haben:
// - Drydock / Slipway Zugang
// - Zertifizierte Marine Surveyors
// - Taucher-Teams für Unterwasserinspektion
// - Tiefwasser-Ankerplätze
// - Tankreinigungs-Service (für Tanker, aber auch Bulker Belly-Reinigung)
// - Luboil-Slop-Tanks

export interface SurveyPort {
  id: string;
  name: string;
  country: string;
  countryFlag: string;
  lat: number;
  lon: number;
  rating: number; // 0-100, wie gut geeignet für Surveys
  facilities: SurveyFacility[];
  certifications: string[];
  typicalSurveyCost: { min: number; max: number; currency: string }; // USD
  typicalDuration: number; // days
  contactInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  notes: string;
  airport: string; // nearest intl airport code
  airportDistance: number; // km
}

export type SurveyFacility =
  | "drydock"
  | "slipway"
  | "diving_team"
  | "ultrasonic_thickness"
  | "tank_cleaning"
  | "luboil_slop"
  | "anchor_berth"
  | "anchor_in_sheltered_water"
  | "warehousing"
  | "laboratory"
  | "class_society_office"
  | "fresh_water"
  | "bunkering"
  | "crew_change"
  | "helipad";

export const FACILITY_LABELS: Record<SurveyFacility, string> = {
  drydock: "Trockendock",
  slipway: "Slipway",
  diving_team: "Taucherteam",
  ultrasonic_thickness: "UT-Dickenmessung",
  tank_cleaning: "Tankreinigung",
  luboil_slop: "Luboil/Slop-Tanks",
  anchor_berth: "Ankerliegeplatz",
  anchor_in_sheltered_water: "Geschützter Ankerplatz",
  warehousing: "Lagerhaus",
  laboratory: "Labor",
  class_society_office: "Class Society Office",
  fresh_water: "Süßwasser",
  bunkering: "Bunkering",
  crew_change: "Crew Change",
  helipad: "Hubschrauberlandeplatz",
};

export const FACILITY_ICONS: Record<SurveyFacility, string> = {
  drydock: "🚢",
  slipway: "🛠️",
  diving_team: "🤿",
  ultrasonic_thickness: "📡",
  tank_cleaning: "🧹",
  luboil_slop: "🛢️",
  anchor_berth: "⚓",
  anchor_in_sheltered_water: "🏝️",
  warehousing: "📦",
  laboratory: "🔬",
  class_society_office: "🏛️",
  fresh_water: "💧",
  bunkering: "⛽",
  crew_change: "👨‍✈️",
  helipad: "🚁",
};

// Top ports für Schiffs-Surveys weltweit (echte Survey-Hubs)
export const SURVEY_PORTS: SurveyPort[] = [
  // === Singapore — Weltweit #1 für Schiffs-Surveys ===
  {
    id: "SGSIN",
    name: "Singapore Anchorage",
    country: "Singapore",
    countryFlag: "🇸🇬",
    lat: 1.264,
    lon: 103.840,
    rating: 98,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
      "warehousing",
    ],
    certifications: ["ABS", "DNV", "LR", "BV", "NK", "RINA", "CCS"],
    typicalSurveyCost: { min: 35000, max: 85000, currency: "USD" },
    typicalDuration: 4,
    contactInfo: {
      website: "https://www.mpa.gov.sg",
    },
    notes:
      "World-leading for ship surveys. Sheltered waters, experienced diving teams, all classification societies on site. Very efficient — standard survey completed in 3-5 days.",
    airport: "SIN",
    airportDistance: 25,
  },

  // === Hong Kong ===
  {
    id: "HKHKG",
    name: "Hong Kong Anchorage",
    country: "Hong Kong",
    countryFlag: "🇭🇰",
    lat: 22.286,
    lon: 114.159,
    rating: 95,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "warehousing",
    ],
    certifications: ["ABS", "DNV", "LR", "BV", "NK"],
    typicalSurveyCost: { min: 30000, max: 75000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Excellent for Asia-Pacific trades. Good diving teams, moderate costs. Sheltered anchorage at Lamma Island.",
    airport: "HKG",
    airportDistance: 35,
  },

  // === Rotterdam ===
  {
    id: "NLRTM",
    name: "Rotterdam Anchorage (Maasvlakte)",
    country: "Netherlands",
    countryFlag: "🇳🇱",
    lat: 51.924,
    lon: 4.479,
    rating: 94,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
      "warehousing",
    ],
    certifications: ["DNV", "LR", "BV", "ABS", "RINA"],
    typicalSurveyCost: { min: 38000, max: 95000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Largest port in Europe, excellent infrastructure. Drydock access within the port. Higher costs than Asia, but high quality.",
    airport: "AMS",
    airportDistance: 70,
  },

  // === Dubai / Fujairah ===
  {
    id: "AEFJR",
    name: "Fujairah Anchorage",
    country: "UAE",
    countryFlag: "🇦🇪",
    lat: 25.169,
    lon: 56.361,
    rating: 93,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "luboil_slop",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "warehousing",
    ],
    certifications: ["ABS", "DNV", "LR", "BV", "NK"],
    typicalSurveyCost: { min: 28000, max: 70000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Most important hub for Middle East business. Very good for tanker and bulker surveys alike. Gulf of Oman is sheltered.",
    airport: "DXB",
    airportDistance: 130,
  },

  // === Busan, South Korea ===
  {
    id: "KRPUS",
    name: "Busan Anchorage",
    country: "South Korea",
    countryFlag: "🇰🇷",
    lat: 35.078,
    lon: 129.040,
    rating: 92,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
    ],
    certifications: ["NK", "ABS", "DNV", "LR", "BV", "CCS"],
    typicalSurveyCost: { min: 32000, max: 80000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Korea is a leader in shipbuilding — excellent yards for thorough inspections. Drydock surveys also available. NK (Nippon Kaiji Kyokai) is headquartered here.",
    airport: "PUS",
    airportDistance: 15,
  },

  // === Shanghai / China ===
  {
    id: "CNSHA",
    name: "Shanghai Yangshan Anchorage",
    country: "China",
    countryFlag: "🇨🇳",
    lat: 30.634,
    lon: 122.066,
    rating: 90,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["CCS", "ABS", "DNV", "LR", "BV", "NK"],
    typicalSurveyCost: { min: 22000, max: 55000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Most cost-effective option in Asia. Good infrastructure, but language barrier possible. Yangshan anchorage is sheltered.",
    airport: "PVG",
    airportDistance: 100,
  },

  // === Houston, USA ===
  {
    id: "USHOU",
    name: "Houston Anchorage (Galveston Bay)",
    country: "USA",
    countryFlag: "🇺🇸",
    lat: 29.363,
    lon: -94.879,
    rating: 89,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
    ],
    certifications: ["ABS", "DNV", "LR", "BV"],
    typicalSurveyCost: { min: 40000, max: 100000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Top choice for US Gulf trades. ABS has a branch office here. Galveston Bay is sheltered, good for anchor surveys.",
    airport: "IAH",
    airportDistance: 50,
  },

  // === Santos, Brazil ===
  {
    id: "BRSSZ",
    name: "Santos Anchorage",
    country: "Brazil",
    countryFlag: "🇧🇷",
    lat: -23.961,
    lon: -46.330,
    rating: 84,
    facilities: [
      "drydock",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["BV", "ABS", "DNV", "LR"],
    typicalSurveyCost: { min: 28000, max: 65000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Important for Brazil trades (iron ore exports). Mid-tier quality, moderate costs. BV has a strong presence here.",
    airport: "GRU",
    airportDistance: 90,
  },

  // === Las Palmas, Canary Islands ===
  {
    id: "ESLPA",
    name: "Las Palmas Anchorage",
    country: "Spain",
    countryFlag: "🇪🇸",
    lat: 28.131,
    lon: -15.428,
    rating: 88,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "warehousing",
    ],
    certifications: ["DNV", "LR", "BV", "ABS", "RINA"],
    typicalSurveyCost: { min: 30000, max: 70000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Strategic position between Europe, Africa and South America. Sheltered harbor, ideal for transit surveys.",
    airport: "LPA",
    airportDistance: 25,
  },

  // === Cape Town, South Africa ===
  {
    id: "ZACPT",
    name: "Cape Town Anchorage (Table Bay)",
    country: "South Africa",
    countryFlag: "🇿🇦",
    lat: -33.908,
    lon: 18.421,
    rating: 82,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["LR", "DNV", "ABS", "BV"],
    typicalSurveyCost: { min: 26000, max: 60000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Important for South Africa routes (coal/iron ore exports). Table Bay is partly sheltered, can be rough in south-westerly winds.",
    airport: "CPT",
    airportDistance: 20,
  },

  // === Gibraltar ===
  {
    id: "GIGIB",
    name: "Gibraltar Anchorage (Algeciras Bay)",
    country: "Gibraltar / Spain",
    countryFlag: "🇬🇮",
    lat: 36.131,
    lon: -5.439,
    rating: 87,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "warehousing",
    ],
    certifications: ["LR", "DNV", "ABS", "BV", "RINA"],
    typicalSurveyCost: { min: 30000, max: 70000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Important bunkering hub. Algeciras Bay is sheltered, very good for anchor surveys. Fast turnaround.",
    airport: "GIB",
    airportDistance: 10,
  },

  // === Istanbul, Turkey ===
  {
    id: "TRIST",
    name: "Istanbul / Tuzla Anchorage",
    country: "Turkey",
    countryFlag: "🇹🇷",
    lat: 40.821,
    lon: 29.295,
    rating: 88,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
      "warehousing",
    ],
    certifications: ["Turkish Lloyd", "DNV", "LR", "ABS", "BV", "RINA"],
    typicalSurveyCost: { min: 24000, max: 55000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Tuzla yards are well-equipped and cost-effective. Many experienced surveyors available. Sea of Marmara is sheltered.",
    airport: "IST",
    airportDistance: 60,
  },

  // === Mumbai, India ===
  {
    id: "INBOM",
    name: "Mumbai Anchorage",
    country: "India",
    countryFlag: "🇮🇳",
    lat: 19.076,
    lon: 72.876,
    rating: 80,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["IRS", "DNV", "LR", "ABS", "BV"],
    typicalSurveyCost: { min: 20000, max: 50000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Indian Register of Shipping (IRS) is headquartered here. Cost-effective, but monsoon season (Jun-Sep) can complicate surveys.",
    airport: "BOM",
    airportDistance: 25,
  },

  // === Colombo, Sri Lanka ===
  {
    id: "LKCMB",
    name: "Colombo Anchorage",
    country: "Sri Lanka",
    countryFlag: "🇱🇰",
    lat: 6.927,
    lon: 79.840,
    rating: 83,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["DNV", "LR", "ABS", "BV"],
    typicalSurveyCost: { min: 22000, max: 55000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Popular for transit surveys on east-west routes. Cost-effective and efficient. Good diving teams.",
    airport: "CMB",
    airportDistance: 35,
  },

  // === Suez / Port Said ===
  {
    id: "EGPSD",
    name: "Port Said Anchorage",
    country: "Egypt",
    countryFlag: "🇪🇬",
    lat: 31.265,
    lon: 32.318,
    rating: 78,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["DNV", "LR", "ABS", "BV"],
    typicalSurveyCost: { min: 25000, max: 60000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Strategically located at the Suez Canal. Often used for quick surveys before canal transit. Mid-tier quality.",
    airport: "CAI",
    airportDistance: 220,
  },

  // === Antwerp ===
  {
    id: "BEANR",
    name: "Antwerp Anchorage",
    country: "Belgium",
    countryFlag: "🇧🇪",
    lat: 51.260,
    lon: 4.400,
    rating: 87,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
      "warehousing",
    ],
    certifications: ["BV", "DNV", "LR", "ABS", "RINA"],
    typicalSurveyCost: { min: 36000, max: 88000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Second largest port in Europe. Very good shipyards (e.g. Ship Repair). High quality, but expensive.",
    airport: "BRU",
    airportDistance: 50,
  },

  // === Panama ===
  {
    id: "PAPCA",
    name: "Balboa / Cristobal Anchorage (Panama)",
    country: "Panama",
    countryFlag: "🇵🇦",
    lat: 8.966,
    lon: -79.566,
    rating: 85,
    facilities: [
      "drydock",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["ABS", "DNV", "LR", "BV"],
    typicalSurveyCost: { min: 28000, max: 65000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Important for trans-Pacific and Atlantic trades. Often used for surveys before/after canal transit.",
    airport: "PTY",
    airportDistance: 40,
  },

  // === Hamburg ===
  {
    id: "DEHAM",
    name: "Hamburg Anchorage",
    country: "Germany",
    countryFlag: "🇩🇪",
    lat: 53.539,
    lon: 9.980,
    rating: 86,
    facilities: [
      "drydock",
      "slipway",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
      "laboratory",
      "warehousing",
    ],
    certifications: ["DNV", "LR", "BV", "ABS", "RINA"],
    typicalSurveyCost: { min: 38000, max: 92000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "Germanischer Lloyd (DNV) has its roots here. Very high quality, but also high costs. BRIDGE yard for drydock.",
    airport: "HAM",
    airportDistance: 12,
  },

  // === Newcastle, Australia ===
  {
    id: "AUNTL",
    name: "Newcastle Anchorage",
    country: "Australia",
    countryFlag: "🇦🇺",
    lat: -32.927,
    lon: 151.776,
    rating: 81,
    facilities: [
      "drydock",
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["DNV", "LR", "ABS", "BV"],
    typicalSurveyCost: { min: 35000, max: 80000, currency: "USD" },
    typicalDuration: 5,
    notes:
      "World's largest coal export port. Good survey infrastructure for Capesize bulkers. High Australian standards.",
    airport: "NTL",
    airportDistance: 25,
  },

  // === Port Klang, Malaysia ===
  {
    id: "MYPKG",
    name: "Port Klang Anchorage",
    country: "Malaysia",
    countryFlag: "🇲🇾",
    lat: 3.005,
    lon: 101.396,
    rating: 85,
    facilities: [
      "diving_team",
      "ultrasonic_thickness",
      "tank_cleaning",
      "anchor_berth",
      "anchor_in_sheltered_water",
      "fresh_water",
      "bunkering",
      "crew_change",
      "class_society_office",
    ],
    certifications: ["DNV", "LR", "ABS", "BV", "NK"],
    typicalSurveyCost: { min: 25000, max: 60000, currency: "USD" },
    typicalDuration: 4,
    notes:
      "Lower-cost alternative to Singapore. Good survey infrastructure, but less experienced than Singapore.",
    airport: "KUL",
    airportDistance: 50,
  },
];

// Hilfsfunktion: Beste Survey-ports nach Bewertung sortieren
export function getTopSurveyPorts(limit = 10): SurveyPort[] {
  return [...SURVEY_PORTS].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

// Hilfsfunktion: ports in der Nähe einer Position finden
export function getNearbySurveyPorts(
  lat: number,
  lon: number,
  maxDistanceNm = 500,
): Array<{ port: SurveyPort; distanceNm: number }> {
  const results = SURVEY_PORTS.map((port) => {
    const distance = haversineDistanceNm(lat, lon, port.lat, port.lon);
    return { port, distanceNm: distance };
  })
    .filter((r) => r.distanceNm <= maxDistanceNm)
    .sort((a, b) => a.distanceNm - b.distanceNm);
  return results;
}

function haversineDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Hilfsfunktion: Rating als Sterne anzeigen
export function getRatingStars(rating: number): string {
  const fullStars = Math.floor(rating / 20);
  const halfStar = rating % 20 >= 10;
  return "⭐".repeat(fullStars) + (halfStar ? "✨" : "");
}

// Hilfsfunktion: Kosten formatieren
export function formatSurveyCost(cost: {
  min: number;
  max: number;
  currency: string;
}): string {
  if (cost.min >= 1000) {
    return `$${(cost.min / 1000).toFixed(0)}K – $${(cost.max / 1000).toFixed(0)}K`;
  }
  return `$${cost.min} – $${cost.max}`;
}
