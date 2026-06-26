// Häfen für Schiffsinspektionen (Pre-Purchase Surveys)
// Diese Häfen haben:
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
  class_society_office: "Klassifikationsgesellschaft",
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

// Top Häfen für Schiffs-Surveys weltweit (echte Survey-Hubs)
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
      "Weltweit führend für Schiffs-Surveys. Sheltered waters, erfahrene Taucher-Teams, alle Klassifikationsgesellschaften vor Ort. Sehr effizient — Standard-Survey in 3-5 Tagen abgeschlossen.",
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
      "Ausgezeichnet für Asien-Pazifik-Trades. Gute Taucher-Teams, moderate Kosten. Sheltered anchorage bei Lamma Island.",
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
      "Größter Hafen Europas, exzellente Infrastruktur. Drydock-Zugang im Hafen. Höhere Kosten als Asien, aber hohe Qualität.",
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
      "Wichtigster Hub für Middle East-Geschäfte. Sehr gut für Tanker, aber auch Bulker-Surveys. Gulf of Oman ist sheltered.",
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
      "Korea ist führend im Schiffbau — exzellente Werften für ausführliche Inspektionen. Auch Drydock-Surveys möglich. NK (Nippon Kaiji Kyokai) hat hier Hauptsitz.",
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
      "Kostengünstigste Option in Asien. Gute Infrastruktur, aber Sprachbarriere möglich. Yangshan ist sheltered.",
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
      "Top für US-Gulf-Trades. ABS hat hier eine Niederlassung. Galveston Bay ist sheltered, gut für Anker-Surveys.",
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
      "Wichtig für Brasilien-Handel (Eisenerz-Exporte). Mittlere Qualität, moderate Kosten. BV ist hier stark vertreten.",
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
      "Strategischer Punkt zwischen Europa, Afrika und Südamerika. Sheltered harbor, ideal für Transit-Surveys.",
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
      "Wichtig für Südafrika-Routen (Kohle/Eisenerz-Exporte). Table Bay ist teilweise sheltered, kann bei Südwest-Wind rau sein.",
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
      "Wichtiger Bunkering-Hub. Algeciras Bay ist sheltered, sehr gut für Anker-Surveys. Schnelle Abwicklung.",
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
      "Tuzla-Werften sind gut ausgestattet und kostengünstig. Viele erfahrene Surveyors. Marmara-Meer ist sheltered.",
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
      "Indische Register (IRS) hat hier Hauptsitz. Kostengünstig, aber Monsunzeit (Jun-Sep) kann Survey erschweren.",
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
      "Beliebt für transit-Surveys auf Ost-West-Routen. Kostengünstig, effizient. Gute Taucher-Teams.",
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
      "Strategisch am Suez-Kanal. Wird oft für schnelle Surveys vor Kanal-Transit genutzt. Mittlere Qualität.",
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
      "Zweitgrößter Hafen Europas. Sehr gute Werften (z.B. Ship Repair). Hohe Qualität, aber teuer.",
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
      "Wichtig für Trans-Pazifik- und Atlantik-Trades. Wird oft für Survey vor/ nach Kanal-Transit genutzt.",
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
      "Germanischer Lloyd (DNV) hat Wurzeln hier. Sehr hohe Qualität, aber auch hohe Kosten. BRIDGE-Werft für Drydock.",
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
      "Wichtigster Kohle-Export-Hafen der Welt. Gute Survey-Infrastruktur für Capesize-Bulker. Hohe australische Standards.",
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
      "Alternative zu Singapore zu niedrigeren Kosten. Gute Survey-Infrastruktur, aber weniger ervahren als Singapore.",
    airport: "KUL",
    airportDistance: 50,
  },
];

// Hilfsfunktion: Beste Survey-Häfen nach Bewertung sortieren
export function getTopSurveyPorts(limit = 10): SurveyPort[] {
  return [...SURVEY_PORTS].sort((a, b) => b.rating - a.rating).slice(0, limit);
}

// Hilfsfunktion: Häfen in der Nähe einer Position finden
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
