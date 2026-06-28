"use client";

import { getRoutingFactors } from "@/lib/voyageRouting";
import { calculateFreightRates, getRateForDwt } from "@/lib/freightRates";

import { useState, useMemo, useEffect } from "react";

interface Port {
  code: string; name: string; country: string;
  lat: number; lon: number; primaryCargo: string;
}

const PORTS: Port[] = [
  {code:"ABB",name:"Abbot Point",country:"Australia",lat:-19.867,lon:148.083,primaryCargo:"coal"},
  {code:"ALX",name:"Alexandria",country:"Egypt",lat:31.2,lon:29.917,primaryCargo:"grain"},
  {code:"ALG",name:"Algeciras",country:"Spain",lat:36.133,lon:-5.433,primaryCargo:"container"},
  {code:"AMP",name:"Amsterdam",country:"Netherlands",lat:52.379,lon:4.9,primaryCargo:"coal"},
  {code:"ANR",name:"Antwerp",country:"Belgium",lat:51.26,lon:4.4,primaryCargo:"container"},
  {code:"BAH",name:"Bahia Blanca",country:"Argentina",lat:-38.799,lon:-62.267,primaryCargo:"grain"},
  {code:"BAN",name:"Balikpapan",country:"Indonesia",lat:-1.237,lon:116.825,primaryCargo:"coal"},
  {code:"BAL",name:"Baltimore",country:"USA",lat:39.267,lon:-76.583,primaryCargo:"coal"},
  {code:"BND",name:"Bandar Abbas",country:"Iran",lat:27.183,lon:56.283,primaryCargo:"container"},
  {code:"BCN",name:"Barcelona",country:"Spain",lat:41.367,lon:2.167,primaryCargo:"container"},
  {code:"BAS",name:"Basra",country:"Iraq",lat:30.513,lon:47.783,primaryCargo:"crude_oil"},
  {code:"BHV",name:"Bremerhaven",country:"Germany",lat:53.533,lon:8.583,primaryCargo:"container"},
  {code:"BUE",name:"Buenos Aires",country:"Argentina",lat:-34.6,lon:-58.367,primaryCargo:"container"},
  {code:"PUS",name:"Busan",country:"South Korea",lat:35.104,lon:129.032,primaryCargo:"container"},
  {code:"CPQ",name:"Callao",country:"Peru",lat:-12.05,lon:-77.133,primaryCargo:"container"},
  {code:"CPT",name:"Cape Town",country:"South Africa",lat:-33.917,lon:18.433,primaryCargo:"container"},
  {code:"CAR",name:"Cartagena",country:"Colombia",lat:10.4,lon:-75.517,primaryCargo:"container"},
  {code:"CHR",name:"Charleston",country:"USA",lat:32.783,lon:-79.933,primaryCargo:"container"},
  {code:"CHL",name:"Chennai",country:"India",lat:13.1,lon:80.3,primaryCargo:"container"},
  {code:"CHB",name:"Chiba",country:"Japan",lat:35.605,lon:140.083,primaryCargo:"iron_ore"},
  {code:"COL",name:"Colon",country:"Panama",lat:9.35,lon:-79.9,primaryCargo:"container"},
  {code:"CST",name:"Constanta",country:"Romania",lat:44.167,lon:28.65,primaryCargo:"grain"},
  {code:"DLC",name:"Dalian",country:"China",lat:38.914,lon:121.615,primaryCargo:"iron_ore"},
  {code:"DAM",name:"Dammam",country:"Saudi Arabia",lat:26.435,lon:50.11,primaryCargo:"fertilizer"},
  {code:"DKG",name:"Dampier",country:"Australia",lat:-20.661,lon:116.711,primaryCargo:"iron_ore"},
  {code:"DAR",name:"Dar es Salaam",country:"Tanzania",lat:-6.833,lon:39.283,primaryCargo:"container"},
  {code:"DJI",name:"Djibouti",country:"Djibouti",lat:11.583,lon:43.15,primaryCargo:"container"},
  {code:"DUR",name:"Durban",country:"South Africa",lat:-29.867,lon:31.017,primaryCargo:"container"},
  {code:"FLX",name:"Felixstowe",country:"UK",lat:51.953,lon:1.305,primaryCargo:"container"},
  {code:"FRE",name:"Fremantle",country:"Australia",lat:-32.05,lon:115.733,primaryCargo:"grain"},
  {code:"FUJ",name:"Fujairah",country:"UAE",lat:25.117,lon:56.35,primaryCargo:"bunker"},
  {code:"FZH",name:"Fuzhou",country:"China",lat:26.062,lon:119.306,primaryCargo:"container"},
  {code:"GGP",name:"Gangavaram",country:"India",lat:17.63,lon:83.233,primaryCargo:"coal"},
  {code:"GDK",name:"Gdansk",country:"Poland",lat:54.367,lon:18.65,primaryCargo:"coal"},
  {code:"GEN",name:"Genoa",country:"Italy",lat:44.417,lon:8.9,primaryCargo:"container"},
  {code:"GIO",name:"Gioia Tauro",country:"Italy",lat:38.417,lon:15.9,primaryCargo:"container"},
  {code:"GLT",name:"Gladstone",country:"Australia",lat:-23.848,lon:151.272,primaryCargo:"coal"},
  {code:"GBG",name:"Gothenburg",country:"Sweden",lat:57.7,lon:11.967,primaryCargo:"container"},
  {code:"GZH",name:"Guangzhou",country:"China",lat:23.108,lon:113.318,primaryCargo:"container"},
  {code:"GYQ",name:"Guayaquil",country:"Ecuador",lat:-2.183,lon:-79.917,primaryCargo:"container"},
  {code:"HPH",name:"Hai Phong",country:"Vietnam",lat:20.85,lon:106.683,primaryCargo:"container"},
  {code:"HAI",name:"Haifa",country:"Israel",lat:32.817,lon:35.0,primaryCargo:"container"},
  {code:"HDL",name:"Haldia",country:"India",lat:22.05,lon:88.067,primaryCargo:"coal"},
  {code:"HAL",name:"Halifax",country:"Canada",lat:44.65,lon:-63.567,primaryCargo:"container"},
  {code:"HAM",name:"Hamburg",country:"Germany",lat:53.539,lon:9.98,primaryCargo:"container"},
  {code:"HAY",name:"Hay Point",country:"Australia",lat:-21.283,lon:149.3,primaryCargo:"coal"},
  {code:"HEL",name:"Helsinki",country:"Finland",lat:60.167,lon:24.967,primaryCargo:"container"},
  {code:"HCM",name:"Ho Chi Minh City",country:"Vietnam",lat:10.767,lon:106.7,primaryCargo:"container"},
  {code:"HOU",name:"Houston",country:"USA",lat:29.76,lon:-95.27,primaryCargo:"crude_oil"},
  {code:"IJM",name:"IJmuiden",country:"Netherlands",lat:52.464,lon:4.602,primaryCargo:"iron_ore"},
  {code:"IMM",name:"Immingham",country:"UK",lat:53.633,lon:-0.183,primaryCargo:"coal"},
  {code:"INO",name:"Incheon",country:"South Korea",lat:37.456,lon:126.593,primaryCargo:"container"},
  {code:"SKD",name:"Iskenderun",country:"Turkey",lat:36.583,lon:36.167,primaryCargo:"iron_ore"},
  {code:"IST",name:"Istanbul (Ambarli)",country:"Turkey",lat:41.0,lon:28.683,primaryCargo:"container"},
  {code:"ITA",name:"Itaqui",country:"Brazil",lat:-2.583,lon:-44.367,primaryCargo:"grain"},
  {code:"JKT",name:"Jakarta",country:"Indonesia",lat:-6.105,lon:106.88,primaryCargo:"container"},
  {code:"JEA",name:"Jebel Ali",country:"UAE",lat:25.012,lon:55.067,primaryCargo:"container"},
  {code:"JED",name:"Jeddah",country:"Saudi Arabia",lat:21.485,lon:39.173,primaryCargo:"container"},
  {code:"KMB",name:"Kamsar",country:"Guinea",lat:10.636,lon:-14.602,primaryCargo:"bauxite"},
  {code:"KSM",name:"Kashima",country:"Japan",lat:35.942,lon:140.68,primaryCargo:"iron_ore"},
  {code:"KNG",name:"Kingston",country:"Jamaica",lat:17.967,lon:-76.8,primaryCargo:"container"},
  {code:"KLI",name:"Klaipeda",country:"Lithuania",lat:55.717,lon:21.117,primaryCargo:"container"},
  {code:"KOB",name:"Kobe",country:"Japan",lat:34.69,lon:135.196,primaryCargo:"container"},
  {code:"KOC",name:"Kochi",country:"India",lat:9.967,lon:76.267,primaryCargo:"container"},
  {code:"KRP",name:"Krishnapatnam",country:"India",lat:14.253,lon:80.13,primaryCargo:"coal"},
  {code:"KWY",name:"Kwangyang",country:"South Korea",lat:34.93,lon:127.7,primaryCargo:"iron_ore"},
  {code:"LCB",name:"Laem Chabang",country:"Thailand",lat:13.083,lon:100.883,primaryCargo:"container"},
  {code:"LGS",name:"Lagos (Apapa)",country:"Nigeria",lat:6.433,lon:3.383,primaryCargo:"container"},
  {code:"LYG",name:"Lianyungang",country:"China",lat:34.73,lon:119.46,primaryCargo:"iron_ore"},
  {code:"LGB",name:"Long Beach",country:"USA",lat:33.77,lon:-118.194,primaryCargo:"container"},
  {code:"LAX",name:"Los Angeles",country:"USA",lat:33.74,lon:-118.27,primaryCargo:"container"},
  {code:"MNL",name:"Manila",country:"Philippines",lat:14.583,lon:120.967,primaryCargo:"container"},
  {code:"MZL",name:"Manzanillo",country:"Mexico",lat:19.05,lon:-104.317,primaryCargo:"container"},
  {code:"MSL",name:"Marsaxlokk",country:"Malta",lat:35.833,lon:14.533,primaryCargo:"container"},
  {code:"MRS",name:"Marseille/Fos",country:"France",lat:43.383,lon:5.067,primaryCargo:"container"},
  {code:"MEL",name:"Melbourne",country:"Australia",lat:-37.817,lon:144.95,primaryCargo:"container"},
  {code:"MER",name:"Mersin",country:"Turkey",lat:36.783,lon:34.633,primaryCargo:"container"},
  {code:"MZR",name:"Mizushima",country:"Japan",lat:34.517,lon:133.75,primaryCargo:"iron_ore"},
  {code:"MOM",name:"Mombasa",country:"Kenya",lat:-4.067,lon:39.667,primaryCargo:"container"},
  {code:"MTR",name:"Montreal",country:"Canada",lat:45.5,lon:-73.55,primaryCargo:"grain"},
  {code:"MAA",name:"Mumbai (JNPT)",country:"India",lat:19.076,lon:72.876,primaryCargo:"container"},
  {code:"MDR",name:"Mundra",country:"India",lat:22.739,lon:69.725,primaryCargo:"container"},
  {code:"NGY",name:"Nagoya",country:"Japan",lat:35.081,lon:136.881,primaryCargo:"container"},
  {code:"NOL",name:"New Orleans",country:"USA",lat:29.95,lon:-90.067,primaryCargo:"grain"},
  {code:"NYK",name:"New York/New Jersey",country:"USA",lat:40.667,lon:-74.05,primaryCargo:"container"},
  {code:"NCT",name:"Newcastle",country:"Australia",lat:-32.927,lon:151.776,primaryCargo:"coal"},
  {code:"NBO",name:"Ningbo-Zhoushan",country:"China",lat:29.873,lon:121.883,primaryCargo:"iron_ore"},
  {code:"NOR",name:"Norfolk (VA)",country:"USA",lat:36.846,lon:-76.286,primaryCargo:"coal"},
  {code:"NVR",name:"Novorossiysk",country:"Russia",lat:44.717,lon:37.783,primaryCargo:"grain"},
  {code:"OSK",name:"Osaka",country:"Japan",lat:34.643,lon:135.438,primaryCargo:"container"},
  {code:"PAR",name:"Paradip",country:"India",lat:20.267,lon:86.617,primaryCargo:"iron_ore"},
  {code:"PRG",name:"Paranagua",country:"Brazil",lat:-25.501,lon:-48.517,primaryCargo:"grain"},
  {code:"PIR",name:"Piraeus",country:"Greece",lat:37.933,lon:23.633,primaryCargo:"container"},
  {code:"POH",name:"Pohang",country:"South Korea",lat:35.977,lon:129.578,primaryCargo:"iron_ore"},
  {code:"PNT",name:"Ponta da Madeira",country:"Brazil",lat:-2.533,lon:-44.367,primaryCargo:"iron_ore"},
  {code:"PDA",name:"Port Hedland",country:"Australia",lat:-20.312,lon:118.608,primaryCargo:"iron_ore"},
  {code:"PKL",name:"Port Klang",country:"Malaysia",lat:3.0,lon:101.383,primaryCargo:"container"},
  {code:"PTD",name:"Port Said",country:"Egypt",lat:31.267,lon:32.3,primaryCargo:"container"},
  {code:"PDX",name:"Portland (OR)",country:"USA",lat:45.59,lon:-122.833,primaryCargo:"grain"},
  {code:"QIN",name:"Qingdao",country:"China",lat:36.067,lon:120.383,primaryCargo:"iron_ore"},
  {code:"RKH",name:"Ras Al Khaimah",country:"UAE",lat:25.8,lon:55.95,primaryCargo:"cement"},
  {code:"RLT",name:"Ras Laffan",country:"Qatar",lat:25.9,lon:51.533,primaryCargo:"lng"},
  {code:"RTA",name:"Ras Tanura",country:"Saudi Arabia",lat:26.633,lon:50.167,primaryCargo:"crude_oil"},
  {code:"RGT",name:"Richards Bay",country:"South Africa",lat:-28.801,lon:32.078,primaryCargo:"coal"},
  {code:"RNO",name:"Rizhao",country:"China",lat:35.382,lon:119.527,primaryCargo:"iron_ore"},
  {code:"ROS",name:"Rosario",country:"Argentina",lat:-32.944,lon:-60.639,primaryCargo:"grain"},
  {code:"RTM",name:"Rotterdam",country:"Netherlands",lat:51.924,lon:4.479,primaryCargo:"container"},
  {code:"SAL",name:"Salalah",country:"Oman",lat:16.942,lon:54.004,primaryCargo:"container"},
  {code:"SDL",name:"Saldanha Bay",country:"South Africa",lat:-33.024,lon:17.945,primaryCargo:"iron_ore"},
  {code:"SAN",name:"San Antonio",country:"Chile",lat:-33.6,lon:-71.617,primaryCargo:"container"},
  {code:"STS",name:"Santos",country:"Brazil",lat:-23.95,lon:-46.3,primaryCargo:"container"},
  {code:"SVN",name:"Savannah",country:"USA",lat:32.083,lon:-81.1,primaryCargo:"container"},
  {code:"SHA",name:"Shanghai",country:"China",lat:31.23,lon:121.474,primaryCargo:"container"},
  {code:"SHZ",name:"Shenzhen",country:"China",lat:22.535,lon:114.054,primaryCargo:"container"},
  {code:"SIN",name:"Singapore",country:"Singapore",lat:1.264,lon:103.84,primaryCargo:"container"},
  {code:"SOT",name:"Southampton",country:"UK",lat:50.89,lon:-1.404,primaryCargo:"container"},
  {code:"STP",name:"St. Petersburg",country:"Russia",lat:59.933,lon:30.3,primaryCargo:"container"},
  {code:"SYD",name:"Sydney",country:"Australia",lat:-33.85,lon:151.233,primaryCargo:"container"},
  {code:"TAN",name:"Tanger Med",country:"Morocco",lat:35.883,lon:-5.5,primaryCargo:"container"},
  {code:"TJP",name:"Tanjung Bara",country:"Indonesia",lat:-0.85,lon:117.45,primaryCargo:"coal"},
  {code:"TPN",name:"Tanjung Pelepas",country:"Malaysia",lat:1.363,lon:103.551,primaryCargo:"container"},
  {code:"TJN",name:"Tianjin",country:"China",lat:38.975,lon:117.778,primaryCargo:"coal"},
  {code:"TOK",name:"Tokyo",country:"Japan",lat:35.652,lon:139.77,primaryCargo:"container"},
  {code:"TUB",name:"Tubarao (Vitoria)",country:"Brazil",lat:-20.323,lon:-40.283,primaryCargo:"iron_ore"},
  {code:"TYN",name:"Tyne",country:"UK",lat:54.983,lon:-1.433,primaryCargo:"coal"},
  {code:"VAL",name:"Valencia",country:"Spain",lat:39.45,lon:-0.317,primaryCargo:"container"},
  {code:"VAN",name:"Vancouver",country:"Canada",lat:49.283,lon:-123.117,primaryCargo:"coal"},
  {code:"VIZ",name:"Visakhapatnam",country:"India",lat:17.7,lon:83.3,primaryCargo:"iron_ore"},
  {code:"WEP",name:"Weipa",country:"Australia",lat:-12.667,lon:141.867,primaryCargo:"bauxite"},
  {code:"XMN",name:"Xiamen",country:"China",lat:24.48,lon:118.089,primaryCargo:"container"},
  {code:"YNT",name:"Yantai",country:"China",lat:37.54,lon:121.4,primaryCargo:"coal"},
  {code:"YOK",name:"Yokohama",country:"Japan",lat:35.444,lon:139.638,primaryCargo:"container"},
  {code:"ZJG",name:"Zhanjiang",country:"China",lat:21.196,lon:110.395,primaryCargo:"iron_ore"},
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NAV: [string,string][] = [["Ships","/"],["Map","/karte"],["Live","/live"],["Top Picks","/top-picks"],["Compare","/vergleich"],["Watchlist","/watchlist"],["Newbuilds","/newbuilds"],["Voyage Calc","/voyage-calc"],["AI Chat","/chat"]];
const inpStyle: React.CSSProperties = { padding: "10px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 14, width: "100%" };

export default function VoyageCalcPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [fromCode, setFromCode] = useState("");
  const [toCode, setToCode] = useState("");
  const [dwt, setDwt] = useState(80000);
  const [speed, setSpeed] = useState(13);
  const [fuelPrice, setFuelPrice] = useState(590);
  const [fuelConsumption, setFuelConsumption] = useState(35);

  // Auto-calculate fuel consumption from DWT
  useMemo(() => {
    if (dwt >= 200000) setFuelConsumption(55);
    else if (dwt >= 150000) setFuelConsumption(45);
    else if (dwt >= 80000) setFuelConsumption(32);
    else if (dwt >= 60000) setFuelConsumption(28);
    else if (dwt >= 45000) setFuelConsumption(25);
    else if (dwt >= 30000) setFuelConsumption(20);
    else if (dwt >= 15000) setFuelConsumption(15);
    else setFuelConsumption(10);
  }, [dwt]);
  const [freightRate, setFreightRate] = useState(15);
  const [liveRates, setLiveRates] = useState<any>(null);

  // Auto-calculate freight rate from current BDI
  useMemo(() => {
    const rates = calculateFreightRates(2524, "28 Jun 2026");
    setLiveRates(rates);
    const match = getRateForDwt(rates, dwt, "Bulk Carrier");
    if (match && match.spotRate > 0) {
      setFreightRate(+match.spotRate.toFixed(1));
    }
  }, [dwt]);
  const [portDays, setPortDays] = useState(4);
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

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

  // Fetch live weather for selected route
  const fetchWeather = () => {
    const from = PORTS.find(p => p.code === fromCode);
    const to = PORTS.find(p => p.code === toCode);
    if (!from || !to || from.code === to.code) return;
    setWeatherLoading(true);
    fetch(`/api/weather/route?fromLat=${from.lat}&fromLon=${from.lon}&toLat=${to.lat}&toLon=${to.lon}`)
      .then(r => r.json())
      .then(data => { setWeather(data); setWeatherLoading(false); })
      .catch(() => setWeatherLoading(false));
  };

  const box: React.CSSProperties = { background: "#1e293b", borderRadius: 12, border: "1px solid #1e3a5f", padding: 20 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", marginBottom: 4, display: "block" };
  const bigNum: React.CSSProperties = { fontSize: 28, fontWeight: 700, color: "#38bdf8" };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {/* Mobile menu */}
      <div className={`mobile-nav-overlay${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(false)} />
      <div className={`mobile-nav-panel${menuOpen ? " open" : ""}`}>
        <button className="mobile-nav-close" onClick={() => setMenuOpen(false)}>&#x2715;</button>
        {NAV.map(([l,h]: [string,string]) => (
          <a key={h} href={h} className={h==="/voyage-calc" ? "active" : ""}>{l}</a>
        ))}
      </div>

      <div className="page-header" style={{ background: "#1e293b", borderBottom: "1px solid #1e3a5f", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#38bdf8" }}>Voyage Calculator</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>Estimate costs, duration and TCE</p>
          </div>
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)}>&#9776;</button>
          <nav className="nav-links">
            {NAV.map(([l, h]) => (
              <a key={h} href={h} style={{ color: h==="/voyage-calc" ? "#38bdf8" : "#94a3b8", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
        </div>
      </div>

      <div className="page-content" style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div className="voyage-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
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
              <div className="vessel-params-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
              <div className="market-params-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                  <div className="route-summary-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <div>
                      <div style={labelStyle}>Distance</div>
                      <div className="big-number" style={bigNum}>{result.distNm.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>nautical miles</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Sea Days</div>
                      <div className="big-number" style={bigNum}>{result.seaDays}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>at {speed} kn</div>
                    </div>
                    <div>
                      <div style={labelStyle}>Total Voyage</div>
                      <div className="big-number" style={bigNum}>{result.totalDays}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>incl. port days</div>
                    </div>
                  </div>
                </div>

                <div style={box}>
                  <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#38bdf8" }}>Fuel &amp; Costs</h2>
                  <div className="fuel-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
                  <div className="economics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <div>
                      <div style={labelStyle}>TCE (Time Charter Equivalent)</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: result.tce >= 0 ? "#4ade80" : "#f87171" }}>
                        ${result.tce.toLocaleString(undefined, { maximumFractionDigits: 0 })}/day
                      </div>
                    </div>
                    <div>
                      <div style={labelStyle}>Break-Even Freight Rate</div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: "#fbbf24" }}>
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
