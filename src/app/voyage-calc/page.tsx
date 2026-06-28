"use client";

import { getRoutingFactors } from "@/lib/voyageRouting";

import { useState, useMemo } from "react";

interface Port {
  code: string; name: string; country: string;
  lat: number; lon: number; primaryCargo: string;
}

const PORTS: Port[] = [
  {code:"PDA",name:"Port Hedland",country:"Australia",lat:-20.312,lon:118.608,primaryCargo:"iron_ore"},
  {code:"DKG",name:"Dampier",country:"Australia",lat:-20.661,lon:116.711,primaryCargo:"iron_ore"},
  {code:"TUB",name:"Tubarao (Vitoria)",country:"Brazil",lat:-20.323,lon:-40.283,primaryCargo:"iron_ore"},
  {code:"PNT",name:"Ponta da Madeira",country:"Brazil",lat:-2.533,lon:-44.367,primaryCargo:"iron_ore"},
  {code:"SDL",name:"Saldanha Bay",country:"South Africa",lat:-33.024,lon:17.945,primaryCargo:"iron_ore"},
  {code:"NCT",name:"Newcastle",country:"Australia",lat:-32.927,lon:151.776,primaryCargo:"coal"},
  {code:"GLT",name:"Gladstone",country:"Australia",lat:-23.848,lon:151.272,primaryCargo:"coal"},
  {code:"RGT",name:"Richards Bay",country:"South Africa",lat:-28.801,lon:32.078,primaryCargo:"coal"},
  {code:"TJP",name:"Tanjung Bara",country:"Indonesia",lat:-0.85,lon:117.45,primaryCargo:"coal"},
  {code:"BAN",name:"Balikpapan",country:"Indonesia",lat:-1.237,lon:116.825,primaryCargo:"coal"},
  {code:"NOR",name:"Norfolk (VA)",country:"USA",lat:36.846,lon:-76.286,primaryCargo:"grain"},
  {code:"NOL",name:"New Orleans",country:"USA",lat:29.950,lon:-90.067,primaryCargo:"grain"},
  {code:"PDX",name:"Portland (OR)",country:"USA",lat:45.590,lon:-122.833,primaryCargo:"grain"},
  {code:"BAH",name:"Bahia Blanca",country:"Argentina",lat:-38.799,lon:-62.267,primaryCargo:"grain"},
  {code:"PRG",name:"Paranagua",country:"Brazil",lat:-25.501,lon:-48.517,primaryCargo:"grain"},
  {code:"ROS",name:"Rosario",country:"Argentina",lat:-32.944,lon:-60.639,primaryCargo:"grain"},
  {code:"QIN",name:"Qingdao",country:"China",lat:36.067,lon:120.383,primaryCargo:"iron_ore"},
  {code:"NBO",name:"Ningbo-Zhoushan",country:"China",lat:29.873,lon:121.883,primaryCargo:"iron_ore"},
  {code:"SHA",name:"Shanghai",country:"China",lat:31.230,lon:121.474,primaryCargo:"iron_ore"},
  {code:"TJN",name:"Tianjin",country:"China",lat:38.975,lon:117.778,primaryCargo:"iron_ore"},
  {code:"RNO",name:"Rizhao",country:"China",lat:35.382,lon:119.527,primaryCargo:"iron_ore"},
  {code:"RTM",name:"Rotterdam",country:"Netherlands",lat:51.924,lon:4.479,primaryCargo:"coal"},
  {code:"AMP",name:"Amsterdam",country:"Netherlands",lat:52.379,lon:4.900,primaryCargo:"coal"},
  {code:"HAM",name:"Hamburg",country:"Germany",lat:53.539,lon:9.980,primaryCargo:"coal"},
  {code:"ANR",name:"Antwerp",country:"Belgium",lat:51.260,lon:4.400,primaryCargo:"coal"},
  {code:"IJM",name:"IJmuiden",country:"Netherlands",lat:52.464,lon:4.602,primaryCargo:"iron_ore"},
  {code:"YOK",name:"Yokohama",country:"Japan",lat:35.444,lon:139.638,primaryCargo:"coal"},
  {code:"CHB",name:"Chiba",country:"Japan",lat:35.605,lon:140.083,primaryCargo:"iron_ore"},
  {code:"POH",name:"Pohang",country:"South Korea",lat:35.977,lon:129.578,primaryCargo:"iron_ore"},
  {code:"KRP",name:"Krishnapatnam",country:"India",lat:14.253,lon:80.130,primaryCargo:"coal"},
  {code:"MAA",name:"Mumbai",country:"India",lat:19.076,lon:72.876,primaryCargo:"coal"},
  {code:"SIN",name:"Singapore",country:"Singapore",lat:1.264,lon:103.840,primaryCargo:"empty"},
  {code:"KMB",name:"Kamsar",country:"Guinea",lat:10.636,lon:-14.602,primaryCargo:"bauxite"},
  {code:"WEP",name:"Weipa",country:"Australia",lat:-12.667,lon:141.867,primaryCargo:"bauxite"},
  {code:"DAM",name:"Damman",country:"Saudi Arabia",lat:26.435,lon:50.110,primaryCargo:"fertilizer"},
  {code:"JEA",name:"Jebel Ali",country:"UAE",lat:25.012,lon:55.067,primaryCargo:"fertilizer"},
  {code:"LGB",name:"Long Beach",country:"USA",lat:33.770,lon:-118.194,primaryCargo:"empty"},
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NAV = [["Ships", "/"], ["Map", "/karte"], ["Live", "/live"], ["Top Picks", "/top-picks"], ["Compare", "/vergleich"], ["Watchlist", "/watchlist"], ["Newbuilds", "/newbuilds"]];
const inpStyle: React.CSSProperties = { padding: "10px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, width: "100%" };

export default function VoyageCalcPage() {
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  const [dwt, setDwt] = useState(80000);
  const [speed, setSpeed] = useState(13);
  const [fuelPrice, setFuelPrice] = useState(600);
  const [fuelConsumption, setFuelConsumption] = useState(35);
  const [freightRate, setFreightRate] = useState(15);
  const [portDays, setPortDays] = useState(4);

  const result = useMemo(() => {
    const from = PORTS.find(p => p.code === fromCode);
    const to = PORTS.find(p => p.code === toCode);
    if (!from || !to || from.code === to.code) return null;

    const gcDist = haversine(from.lat, from.lon, to.lat, to.lon);
    const rf = getRoutingFactors(from.lat, from.lon, to.lat, to.lon, from.country, to.country);

    // Apply routing multiplier (coastal deviation, canal routing)
    const routeDist = gcDist * rf.routingMultiplier;

    // Effective speed after weather and current
    const weatherLoss = speed * (rf.weatherMargin / 100);
    const currentGain = speed * (rf.currentEffect / 100);
    const effectiveSpeed = Math.max(speed - weatherLoss + currentGain, speed * 0.6);

    const seaDays = routeDist / (effectiveSpeed * 24);
    const canalDays = rf.canalTransit?.days || 0;
    const totalDays = seaDays + portDays + canalDays;

    const fuelTonsTotal = fuelConsumption * seaDays;
    const fuelCost = fuelTonsTotal * fuelPrice;
    const portCosts = portDays * 15000;
    const canalCost = rf.canalTransit?.cost || 0;
    const warRiskPremium = rf.piracyRisk ? dwt * 0.15 : 0; // ~$0.15/DWT
    const totalVoyageCost = fuelCost + portCosts + canalCost + warRiskPremium;

    const revenue = dwt * freightRate;
    const profit = revenue - totalVoyageCost;
    const tce = (revenue - totalVoyageCost) / totalDays;
    const breakEvenRate = totalVoyageCost / dwt;

    return {
      from, to,
      gcDist: Math.round(gcDist),
      distNm: Math.round(routeDist),
      effectiveSpeed: effectiveSpeed.toFixed(1),
      seaDays: seaDays.toFixed(1),
      canalDays,
      totalDays: totalDays.toFixed(1),
      fuelTons: Math.round(fuelTonsTotal),
      fuelCost, portCosts, canalCost, warRiskPremium,
      totalVoyageCost, revenue, profit, tce, breakEvenRate,
      routing: rf,
    };
  }, [fromCode, toCode, dwt, speed, fuelPrice, fuelConsumption, freightRate, portDays]);

  const box: React.CSSProperties = { background: "#1e293b", borderRadius: 12, border: "1px solid #1e3a5f", padding: 20 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", marginBottom: 4, display: "block" };
  const bigNum: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: "#38bdf8" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8" }}>Voyage Calculator</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>Estimate costs, duration and TCE for bulk voyages</p>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            {NAV.map(([l, h]) => (
              <a key={h} href={h} style={{ color: "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={box}>
              <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Route</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Loading Port</label>
                  <select value={fromCode} onChange={e => setFromCode(e.target.value)} style={inpStyle}>
                    <option value="">Select port...</option>
                    {PORTS.map(p => <option key={p.code} value={p.code}>{p.name}, {p.country}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Discharge Port</label>
                  <select value={toCode} onChange={e => setToCode(e.target.value)} style={inpStyle}>
                    <option value="">Select port...</option>
                    {PORTS.map(p => <option key={p.code} value={p.code}>{p.name}, {p.country}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={box}>
              <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Vessel Parameters</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>DWT (tonnes)</label>
                  <input type="number" value={dwt} onChange={e => setDwt(Number(e.target.value))} style={inpStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Speed (knots)</label>
                  <input type="number" value={speed} onChange={e => setSpeed(Number(e.target.value))} style={inpStyle} step="0.5" />
                </div>
                <div>
                  <label style={labelStyle}>Fuel Consumption (t/day)</label>
                  <input type="number" value={fuelConsumption} onChange={e => setFuelConsumption(Number(e.target.value))} style={inpStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Port Days (load+discharge)</label>
                  <input type="number" value={portDays} onChange={e => setPortDays(Number(e.target.value))} style={inpStyle} />
                </div>
              </div>
            </div>

            <div style={box}>
              <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Market Parameters</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>VLSFO Price ($/t)</label>
                  <input type="number" value={fuelPrice} onChange={e => setFuelPrice(Number(e.target.value))} style={inpStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Freight Rate ($/t)</label>
                  <input type="number" value={freightRate} onChange={e => setFreightRate(Number(e.target.value))} style={inpStyle} step="0.5" />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!result ? (
              <div style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#64748b" }}>
                Select loading and discharge ports to calculate
              </div>
            ) : (
              <>
                <div style={box}>
                  <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Route Summary</h2>
                  <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 12 }}>
                    {result.from.name} &rarr; {result.to.name}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={labelStyle}>Distance</div>
                      <div style={bigNum}>{result.distNm.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>nautical miles</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Sea Days</div>
                      <div style={bigNum}>{result.seaDays}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>at {speed} kn</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Total Voyage</div>
                      <div style={bigNum}>{result.totalDays}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>incl. port days</div>
                    </div>
                  </div>
                </div>

                <div style={box}>
                  <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Fuel &amp; Costs</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={labelStyle}>Fuel Consumption</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>{result.fuelTons.toLocaleString()} t</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Fuel Cost</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#f87171" }}>${(result.fuelCost / 1000).toFixed(0)}k</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Port Costs</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#f87171" }}>${(result.portCosts / 1000).toFixed(0)}k</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Total Voyage Cost</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#f87171" }}>${(result.totalVoyageCost / 1000).toFixed(0)}k</div>
                    </div>
                  </div>
                </div>

                <div style={{ ...box, background: "linear-gradient(135deg, #1e293b, #0f2744)" }}>
                  <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Economics</h2>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <div style={labelStyle}>TCE (Time Charter Equivalent)</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: result.tce >= 0 ? "#4ade80" : "#f87171" }}>
                        ${result.tce.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Break-Even Freight Rate</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: "#fbbf24" }}>
                        ${result.breakEvenRate.toFixed(2)}/t
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Gross Revenue</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>${(result.revenue / 1_000_000).toFixed(2)}M</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Voyage P&amp;L</div>
                      <div style={{ fontSize: 20, fontWeight: 600, color: result.profit >= 0 ? "#4ade80" : "#f87171" }}>
                        {result.profit >= 0 ? "+" : ""}${(result.profit / 1000).toFixed(0)}k
                      </div>
                    </div>
                  </div>
                </div>

                <div style={box}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Quick Routes</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      ["PDA", "QIN", "Port Hedland - Qingdao"],
                      ["TUB", "NBO", "Tubarao - Ningbo"],
                      ["NCT", "YOK", "Newcastle - Yokohama"],
                      ["NOL", "RTM", "New Orleans - Rotterdam"],
                      ["RGT", "SHA", "Richards Bay - Shanghai"],
                    ].map(([f, t, lbl]) => (
                      <button key={f + t} onClick={() => { setFromCode(f); setToCode(t); }}
                        style={{ padding: "6px 12px", background: fromCode === f && toCode === t ? "#2563eb" : "#0f172a",
                          border: "1px solid #334155", borderRadius: 20, color: fromCode === f && toCode === t ? "#fff" : "#94a3b8",
                          fontSize: 11, cursor: "pointer" }}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
