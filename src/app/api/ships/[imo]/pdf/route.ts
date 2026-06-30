import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toShip(row: Record<string, unknown>) {
  return {
    imo: row.imo as string,
    name: row.name as string,
    mmsi: row.mmsi as string,
    type: row.type as string,
    dwt: (row.dwt as number) || 0,
    length: (row.length as number) || 0,
    beam: (row.beam as number) || 0,
    draft: (row.draft as number) || 0,
    yearBuilt: (row.year_built as number) || 0,
    builder: row.builder as string,
    flag: row.flag as string || "Unknown",
    operator: row.operator as string,
    homePort: row.home_port as string,
    imageUrl: row.image_url as string,
    status: (row.status as string) || "active",
    grossTonnage: (row.gross_tonnage as number) || 0,
    netTonnage: (row.net_tonnage as number) || 0,
    engineType: row.engine_type as string,
    enginePowerKw: (row.engine_power_kw as number) || 0,
    speedKnots: (row.speed_knots as number) || 0,
    fuelConsumption: (row.fuel_consumption_tons_day as number) || 0,
    fuelType: row.fuel_type as string,
    crewSize: (row.crew_size as number) || 0,
    grainCapacity: (row.grain_capacity as number) || 0,
    holds: (row.holds as number) || 0,
    hatches: (row.hatches as number) || 0,
    cranes: row.cranes as string,
    classSociety: row.class_society as string,
    deliveryDate: row.delivery_date as string,
    lat: row.lat as number,
    lon: row.lon as number,
  };
}

// Price estimation (server-side copy to avoid client imports)
const BASE_PRICES: Record<string, number> = {
  Valemax: 95_000_000, VLOC: 85_000_000, Newcastlemax: 65_000_000,
  Capesize: 38_000_000, "Post-Panamax": 32_000_000, Kamsarmax: 28_000_000,
  Panamax: 22_000_000, Ultramax: 21_000_000, Supramax: 19_000_000,
  Handymax: 18_000_000, Handysize: 12_000_000, "Mini-Bulker": 6_000_000,
  "Bulk Carrier": 22_000_000, Gearless: 25_000_000, Geared: 20_000_000,
  "Crude Oil Tanker": 65_000_000, Tanker: 45_000_000,
  "Product Tanker": 40_000_000, "Chemical Tanker": 30_000_000,
  "LNG Tanker": 200_000_000, "LPG Tanker": 75_000_000,
  "Container Ship": 55_000_000, "General Cargo": 12_000_000,
  RoRo: 35_000_000, "Car Carrier": 70_000_000, Ferry: 20_000_000,
  Passenger: 30_000_000, Offshore: 20_000_000, Tug: 4_000_000,
  Other: 10_000_000,
};

function estimateValue(ship: ReturnType<typeof toShip>) {
  const base = BASE_PRICES[ship.type] ?? 10_000_000;
  const age = new Date().getFullYear() - (ship.yearBuilt > 1900 ? ship.yearBuilt : new Date().getFullYear() - 10);
  let mult = 1.0;
  if (age <= 2) mult = 1.05;
  else if (age <= 5) mult = 1.0;
  else if (age <= 10) mult = 0.85;
  else if (age <= 15) mult = 0.65;
  else if (age <= 20) mult = 0.45;
  else if (age <= 25) mult = 0.30;
  else mult = 0.15;

  if (ship.status === "scrapped") mult *= 0.20;
  else if (ship.status === "under_construction") mult *= 1.15;
  else if (ship.status === "lost") mult *= 0;

  const dwtBonus = (ship.dwt / 1000) * 250;
  const raw = Math.round((base + dwtBonus) * mult);
  const scrap = Math.round(ship.dwt * 0.35 * 450);
  const value = Math.max(raw, ship.status === "active" ? scrap : 0);

  let rec: "BUY" | "HOLD" | "SELL" = "HOLD";
  let reason = "Balanced risk-return profile.";
  if (age > 25) { rec = "SELL"; reason = "Scrap-ready. Sell before further depreciation."; }
  else if (age <= 5) { rec = "BUY"; reason = "Young ship, strong appreciation potential."; }
  else if (age > 15) { rec = "SELL"; reason = "Aging vessel, consider selling in current market."; }

  return { value, rec, reason, age };
}

function fmtUSD(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function recColor(r: string) {
  if (r === "BUY") return "#10b981";
  if (r === "SELL") return "#f43f5e";
  return "#f59e0b";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ imo: string }> }
) {
  const { imo } = await params;
  const db = getDb();
  const row = db.prepare("SELECT * FROM ships WHERE imo = ?").get(imo) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ship = toShip(row);
  const est = estimateValue(ship);
  const now = new Date().toISOString().split("T")[0];

  // Voyage simulation (simplified server-side)
  const voyageHtml = ship.lat && ship.lon
    ? `<div style="margin-top:8px;font-size:13px;color:#94a3b8;">Last known position: ${ship.lat.toFixed(3)}, ${ship.lon.toFixed(3)}</div>`
    : "";

  const specs = [
    ["Type", ship.type],
    ["DWT", ship.dwt > 0 ? `${ship.dwt.toLocaleString("en-US")} t` : "-"],
    ["Length", ship.length > 0 ? `${ship.length} m` : "-"],
    ["Beam", ship.beam > 0 ? `${ship.beam} m` : "-"],
    ["Draft", ship.draft > 0 ? `${ship.draft} m` : "-"],
    ["Year Built", ship.yearBuilt > 0 ? `${ship.yearBuilt}` : "-"],
    ["Builder", ship.builder || "-"],
    ["Flag", ship.flag],
    ["Operator", ship.operator || "-"],
    ["Home Port", ship.homePort || "-"],
    ["Status", ship.status],
    ["Gross Tonnage", ship.grossTonnage > 0 ? `${ship.grossTonnage.toLocaleString("en-US")} GT` : "-"],
    ["Net Tonnage", ship.netTonnage > 0 ? `${ship.netTonnage.toLocaleString("en-US")} NT` : "-"],
    ["Engine", ship.engineType || "-"],
    ["Engine Power", ship.enginePowerKw > 0 ? `${(ship.enginePowerKw / 1000).toFixed(0)} MW` : "-"],
    ["Speed", ship.speedKnots > 0 ? `${ship.speedKnots} kn` : "-"],
    ["Fuel", ship.fuelType || "-"],
    ["Fuel Consumption", ship.fuelConsumption > 0 ? `${ship.fuelConsumption} t/day` : "-"],
    ["Crew", ship.crewSize > 0 ? `${ship.crewSize}` : "-"],
    ["Holds/Hatches", ship.holds > 0 ? `${ship.holds} / ${ship.hatches}` : "-"],
    ["Grain Capacity", ship.grainCapacity > 0 ? `${ship.grainCapacity.toLocaleString("en-US")} m3` : "-"],
    ["Cranes", ship.cranes || "-"],
    ["Class Society", ship.classSociety || "-"],
    ["IMO", ship.imo],
  ].filter(([, v]) => v !== "-");

  const specsRows = specs.map(([l, v]) =>
    `<tr><td style="padding:6px 12px;color:#94a3b8;border-bottom:1px solid #1e3a5f;font-size:13px;">${l}</td><td style="padding:6px 12px;color:#e2e8f0;border-bottom:1px solid #1e3a5f;font-size:13px;font-weight:600;">${v}</td></tr>`
  ).join("\n");

  const imageBlock = ship.imageUrl
    ? `<div style="text-align:center;margin-bottom:24px;"><img src="${ship.imageUrl}" alt="${ship.name}" style="max-width:100%;max-height:400px;border-radius:12px;border:1px solid #334155;" onerror="this.style.display='none'"/></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${ship.name} (IMO ${ship.imo}) - Ship Report</title>
<style>
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    @page { margin: 15mm; size: A4; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }
</style>
</head>
<body>
<div style="max-width:900px;margin:0 auto;padding:32px 24px;">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:2px solid #334155;padding-bottom:16px;">
    <div>
      <div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Maritime AI - Ship Report</div>
      <h1 style="font-size:28px;font-weight:800;color:#38bdf8;margin:4px 0;">${ship.name}</h1>
      <div style="font-size:14px;color:#94a3b8;">IMO ${ship.imo} &middot; ${ship.type} &middot; ${ship.flag}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:12px;color:#64748b;">Generated</div>
      <div style="font-size:14px;color:#e2e8f0;">${now}</div>
    </div>
  </div>

  ${imageBlock}

  <!-- Price Estimate -->
  <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:24px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div>
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Estimated Value</div>
        <div style="font-size:32px;font-weight:800;color:#38bdf8;">${fmtUSD(est.value)}</div>
        <div style="font-size:13px;color:#94a3b8;">Age: ${est.age} years &middot; Status: ${ship.status}</div>
      </div>
      <div style="text-align:center;">
        <div style="background:${recColor(est.rec)}22;border:2px solid ${recColor(est.rec)};border-radius:12px;padding:12px 24px;">
          <div style="font-size:24px;font-weight:800;color:${recColor(est.rec)};">${est.rec}</div>
        </div>
      </div>
    </div>
    <div style="font-size:13px;color:#94a3b8;border-top:1px solid #334155;padding-top:12px;">${est.reason}</div>
    ${voyageHtml}
  </div>

  <!-- Specs Table -->
  <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;overflow:hidden;margin-bottom:24px;">
    <div style="padding:16px 20px;border-bottom:1px solid #334155;">
      <h2 style="font-size:16px;font-weight:700;color:#e2e8f0;">Ship Specifications</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${specsRows}
    </table>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:16px;font-size:11px;color:#475569;">
    Maritime AI &middot; ships.gemivo.de &middot; Report generated ${now}<br/>
    Disclaimer: Price estimates are indicative only. Not financial advice.
  </div>

  <!-- Print Button -->
  <div class="no-print" style="text-align:center;margin-top:24px;">
    <button onclick="window.print()" style="background:#38bdf8;color:#0f172a;border:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
  </div>
</div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${ship.name.replace(/[^a-zA-Z0-9]/g, "_")}_Report.html"`,
    },
  });
}
