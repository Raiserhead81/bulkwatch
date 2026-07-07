// Shared toShip() mapper — single source of truth for DB row → Ship JSON

function flagEmoji(flag: string | null | undefined): string {
  if (!flag || flag === "Unknown") return "";
  const n = flag.trim().toUpperCase();
  if (n.length === 2 && /^[A-Z]{2}$/.test(n)) {
    return String.fromCodePoint(0x1F1E6 + n.charCodeAt(0) - 65, 0x1F1E6 + n.charCodeAt(1) - 65);
  }
  const m: Record<string, string> = {
    "PANAMA":"PA","LIBERIA":"LR","MARSHALL ISLANDS":"MH","HONG KONG":"HK",
    "SINGAPORE":"SG","BAHAMAS":"BS","MALTA":"MT","CHINA":"CN","GREECE":"GR",
    "JAPAN":"JP","NORWAY":"NO","UNITED KINGDOM":"GB","GERMANY":"DE","DENMARK":"DK",
    "ITALY":"IT","FRANCE":"FR","NETHERLANDS":"NL","TURKEY":"TR","INDIA":"IN",
    "SOUTH KOREA":"KR","KOREA":"KR","UNITED STATES":"US","USA":"US","BRAZIL":"BR",
    "RUSSIA":"RU","INDONESIA":"ID","PHILIPPINES":"PH","VIETNAM":"VN","THAILAND":"TH",
    "CYPRUS":"CY","BERMUDA":"BM","ISLE OF MAN":"IM","ANTIGUA AND BARBUDA":"AG",
    "PORTUGAL":"PT","SPAIN":"ES","BELGIUM":"BE","SWEDEN":"SE","FINLAND":"FI",
    "AUSTRALIA":"AU","CANADA":"CA","UAE":"AE","SAUDI ARABIA":"SA","TAIWAN":"TW",
    "IRAN":"IR","EGYPT":"EG","MEXICO":"MX","VANUATU":"VU","TOGO":"TG",
    "COMOROS":"KM","MONGOLIA":"MN","CAMBODIA":"KH","BELIZE":"BZ","TANZANIA":"TZ",
    "TUVALU":"TV","PALAU":"PW","SIERRA LEONE":"SL","CAMEROON":"CM","BARBADOS":"BB",
    "CROATIA":"HR","POLAND":"PL","IRELAND":"IE","NIGERIA":"NG","PAKISTAN":"PK",
    "MALAYSIA":"MY","MYANMAR":"MM","GIBRALTAR":"GI",
  };
  const iso = m[n];
  if (iso) return String.fromCodePoint(0x1F1E6 + iso.charCodeAt(0) - 65, 0x1F1E6 + iso.charCodeAt(1) - 65);
  return "";
}

export function toShip(row: Record<string, unknown>) {
  return {
    id: `imo-${row.imo}`,
    imo: row.imo,
    name: row.name,
    mmsi: row.mmsi,
    type: row.type,
    dwt: row.dwt || 0,
    length: row.length || 0,
    beam: row.beam || 0,
    draft: row.draft || 0,
    yearBuilt: row.year_built || 0,
    builder: row.builder,
    flag: row.flag || "Unknown",
    flagEmoji: flagEmoji(row.flag as string),
    operator: row.operator,
    operatorWebsite: row.op_website || null,
    operatorEmail: row.op_email || null,
    operatorPhone: row.op_phone || null,
    operatorCity: row.op_city || null,
    operatorCountry: row.op_country || null,
    homePort: row.home_port,
    imageUrl: row.image_url,
    imageAttribution: row.image_attribution,
    position: row.lat ? { lat: row.lat, lon: row.lon } : undefined,
    lat: row.lat,
    lon: row.lon,
    lastSeen: row.last_seen,
    status: row.status || "active",
    deliveryDate: row.delivery_date,
    grossTonnage: row.gross_tonnage || 0,
    netTonnage: row.net_tonnage || 0,
    engineType: row.engine_type,
    enginePowerKw: row.engine_power_kw || 0,
    speedKnots: row.speed_knots || 0,
    fuelConsumption: row.fuel_consumption_tons_day || 0,
    fuelType: row.fuel_type,
    crewSize: row.crew_size || 0,
    teu: row.teu || 0,
    grainCapacity: row.grain_capacity || 0,
    holds: row.holds || 0,
    hatches: row.hatches || 0,
    cranes: row.cranes,
    classSociety: row.class_society,
    classification: row.classification,
    pAndI: row.p_and_i,
    flagParisMou: row.flag_paris_mou,
    flagTokyoMou: row.flag_tokyo_mou,
    detentionPct: row.detention_pct,
    callSign: row.call_sign,
    owner: row.owner,
    manager: row.manager,
    ismManager: row.ism_manager,
    inspectionsCount: row.inspections_count || 0,
    lastSurvey: row.last_survey,
    nextSurvey: row.next_survey,
    hasScrubber: row.has_scrubber,
    scrubberType: row.scrubber_type,
  };
}
