// Realistic voyage routing factors
// Sources: MAN Energy Solutions CEAS, Clarksons Shipping Intelligence, BIMCO

export interface RouteFactor {
  routingMultiplier: number;  // actual sailing distance vs great circle
  weatherMargin: number;      // % speed loss from weather (seasonal)
  currentEffect: number;      // % speed gain/loss from ocean currents
  canalTransit?: { name: string; days: number; cost: number };
  piracyRisk: boolean;
  iceRisk: boolean;
  notes: string;
}

// Seasonal weather factors by ocean region (Beaufort scale averages)
// Source: UK Met Office / NOAA wave climate data
const SEASON_MONTHS = new Date().getMonth(); // 0-11
const IS_NH_WINTER = SEASON_MONTHS >= 10 || SEASON_MONTHS <= 2; // Nov-Feb
const IS_NH_SUMMER = SEASON_MONTHS >= 5 && SEASON_MONTHS <= 8;  // Jun-Aug
const IS_MONSOON = SEASON_MONTHS >= 5 && SEASON_MONTHS <= 9;     // Jun-Sep

// Weather margin by region (% speed reduction)
const WEATHER_MARGINS: Record<string, number> = {
  "north_atlantic_winter": 15,
  "north_atlantic_summer": 5,
  "south_atlantic": 7,
  "north_pacific_winter": 18,
  "north_pacific_summer": 5,
  "south_pacific": 8,
  "indian_ocean_monsoon": 12,
  "indian_ocean_calm": 4,
  "mediterranean": 3,
  "south_china_sea": 6,
  "caribbean": 4,
  "arctic": 20,
  "tropical_calm": 3,
};

// Current effects (% speed change, positive = favorable)
// Source: NOAA Ocean Currents data
const CURRENT_EFFECTS: Record<string, number> = {
  "gulf_stream_with": 5,        // US East Coast → Europe
  "gulf_stream_against": -5,    // Europe → US East Coast
  "kuroshio_with": 4,           // Japan → US West Coast
  "kuroshio_against": -4,
  "agulhas_with": 3,            // South Africa eastbound
  "agulhas_against": -6,        // South Africa westbound (notoriously bad)
  "equatorial_counter": 2,
  "benguela_with": 3,
  "brazil_current": 2,
  "none": 0,
};

export function getRoutingFactors(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  fromCountry: string, toCountry: string
): RouteFactor {
  let routingMultiplier = 1.10; // base: 10% more than great circle
  let weatherMargin = 5;
  let currentEffect = 0;
  let canalTransit: { name: string; days: number; cost: number } | undefined;
  let piracyRisk = false;
  let iceRisk = false;
  let notes = "";

  // Determine ocean regions
  const crossesAtlantic = (fromLon < -20 && toLon > 20) || (fromLon > 20 && toLon < -20);
  const crossesPacific = (fromLon > 100 && toLon < -60) || (fromLon < -60 && toLon > 100);
  const crossesIndian = (fromLon > 40 && fromLon < 120 && toLon > 40 && toLon < 120);
  const bothInAsia = fromLon > 100 && toLon > 100;
  const fromAustralia = fromLat < -10 && fromLon > 100 && fromLon < 160;
  const toChina = toLat > 20 && toLat < 45 && toLon > 100 && toLon < 125;
  const fromBrazil = fromLat < 0 && fromLon > -60 && fromLon < -30;
  const toEurope = toLat > 35 && toLon > -15 && toLon < 30;
  const fromUSEast = fromLat > 25 && fromLat < 45 && fromLon > -85 && fromLon < -60;
  const fromGulf = fromLat > 20 && fromLat < 35 && fromLon > 40 && fromLon < 60;
  const fromWestAfrica = fromLat > -5 && fromLat < 15 && fromLon > -20 && fromLon < 5;

  // === Suez Canal ===
  // Routes from Europe/Med to Asia, or Indian Ocean to Med
  const needsSuez = (
    (toEurope && (toLon < 30) && (fromLon > 40 || fromAustralia || toChina)) ||
    (fromLon < 30 && fromLat > 30 && toLon > 40) ||
    (fromGulf && toEurope)
  );
  if (needsSuez) {
    canalTransit = { name: "Suez Canal", days: 1, cost: 350000 }; // avg transit cost
    routingMultiplier = 1.08;
    notes += "Via Suez Canal. ";
  }

  // === Panama Canal ===
  const needsPanama = (
    (fromLon < -60 && toLon > 100 && fromLat > 10) || // US East → Asia
    (fromLon > 100 && toLon < -60 && toLat > 10)       // Asia → US East
  );
  if (needsPanama && !needsSuez) {
    canalTransit = { name: "Panama Canal", days: 1, cost: 400000 };
    routingMultiplier = 1.12;
    notes += "Via Panama Canal. ";
  }

  // === Cape of Good Hope ===
  if (fromBrazil && toChina) {
    routingMultiplier = 1.20; // long route via Cape
    notes += "Via Cape of Good Hope. ";
  }

  // === Weather ===
  // North Atlantic
  if ((fromLat > 35 && fromLon < -10) || (toLat > 35 && toLon < -10) ||
      (fromLat > 35 && fromLon < 20 && toLon < -10)) {
    weatherMargin = IS_NH_WINTER ? WEATHER_MARGINS.north_atlantic_winter : WEATHER_MARGINS.north_atlantic_summer;
    if (IS_NH_WINTER) notes += "North Atlantic winter weather expected. ";
  }
  // North Pacific
  else if ((fromLat > 30 && fromLon > 120) || (toLat > 30 && toLon > 120) || crossesPacific) {
    weatherMargin = IS_NH_WINTER ? WEATHER_MARGINS.north_pacific_winter : WEATHER_MARGINS.north_pacific_summer;
    if (IS_NH_WINTER) notes += "North Pacific winter weather expected. ";
  }
  // Indian Ocean monsoon
  else if (crossesIndian || fromGulf) {
    weatherMargin = IS_MONSOON ? WEATHER_MARGINS.indian_ocean_monsoon : WEATHER_MARGINS.indian_ocean_calm;
    if (IS_MONSOON) notes += "SW Monsoon season — rough seas expected. ";
  }
  // Mediterranean
  else if (fromLat > 30 && fromLat < 45 && fromLon > -10 && fromLon < 35) {
    weatherMargin = WEATHER_MARGINS.mediterranean;
  }
  // Australia → China (relatively calm)
  else if (fromAustralia && toChina) {
    weatherMargin = WEATHER_MARGINS.south_china_sea;
    routingMultiplier = 1.08;
  }
  // Tropical
  else {
    weatherMargin = WEATHER_MARGINS.tropical_calm;
  }

  // === Currents ===
  if (fromUSEast && toEurope) {
    currentEffect = CURRENT_EFFECTS.gulf_stream_with;
    notes += "Gulf Stream favorable. ";
  } else if (toEurope && fromLon < -20) {
    currentEffect = CURRENT_EFFECTS.gulf_stream_with;
  } else if (fromLat > 30 && fromLon > 120 && toLon < -100) {
    currentEffect = CURRENT_EFFECTS.kuroshio_with;
    notes += "Kuroshio Current favorable. ";
  } else if (fromLat < -25 && fromLon > 20 && fromLon < 40) {
    // Agulhas current off South Africa
    if (toLon > fromLon) {
      currentEffect = CURRENT_EFFECTS.agulhas_with;
    } else {
      currentEffect = CURRENT_EFFECTS.agulhas_against;
      notes += "Agulhas Current adverse — speed reduction expected. ";
    }
  }

  // === Piracy risk ===
  // Gulf of Aden / Somalia
  if ((fromLon > 40 && fromLon < 55 && fromLat > 0 && fromLat < 15) ||
      (toLon > 40 && toLon < 55 && toLat > 0 && toLat < 15)) {
    piracyRisk = true;
    notes += "High Risk Area (Gulf of Aden) — war risk premium applies. ";
  }
  // Gulf of Guinea
  if (fromWestAfrica || (toLat > -5 && toLat < 10 && toLon > -5 && toLon < 5)) {
    piracyRisk = true;
    notes += "Gulf of Guinea piracy risk zone. ";
  }

  // === Ice risk ===
  if (fromLat > 55 || toLat > 55 || fromLat < -55 || toLat < -55) {
    iceRisk = true;
    weatherMargin += 5;
    notes += "Ice navigation possible. ";
  }

  if (!notes) notes = "Standard routing conditions.";

  return {
    routingMultiplier,
    weatherMargin,
    currentEffect,
    canalTransit,
    piracyRisk,
    iceRisk,
    notes: notes.trim(),
  };
}
