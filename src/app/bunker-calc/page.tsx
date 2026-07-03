"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BUNKER_PORTS, TANK_CAPACITY, findBunkerPortsAlongRoute, haversineNm, type BunkerPort } from "@/lib/bunkerPorts";

const SHIP_TYPES = Object.keys(TANK_CAPACITY);

const PORTS_LIST = [
  { name: "Singapore", lat: 1.26, lon: 103.84 },
  { name: "Rotterdam", lat: 51.90, lon: 4.50 },
  { name: "Fujairah", lat: 25.12, lon: 56.36 },
  { name: "Port Hedland", lat: -20.31, lon: 118.58 },
  { name: "Qingdao", lat: 36.07, lon: 120.38 },
  { name: "Santos", lat: -23.96, lon: -46.30 },
  { name: "Houston", lat: 29.76, lon: -95.36 },
  { name: "Busan", lat: 35.10, lon: 129.03 },
  { name: "Ras Tanura", lat: 26.68, lon: 50.17 },
  { name: "Durban", lat: -29.87, lon: 31.05 },
  { name: "Gibraltar", lat: 36.14, lon: -5.35 },
  { name: "New Orleans", lat: 29.95, lon: -90.07 },
  { name: "Tubarão", lat: -20.28, lon: -40.24 },
  { name: "Richards Bay", lat: -28.80, lon: 32.09 },
  { name: "Hay Point", lat: -21.28, lon: 149.29 },
  { name: "Newcastle (AU)", lat: -32.93, lon: 151.78 },
  { name: "Dampier", lat: -20.66, lon: 116.71 },
  { name: "Saldanha Bay", lat: -33.01, lon: 17.93 },
  { name: "Paradip", lat: 20.26, lon: 86.61 },
  { name: "Visakhapatnam", lat: 17.69, lon: 83.30 },
];

function defaultFuel(dwt: number, shipType: string): number {
  if (shipType === "LNG Tanker") return Math.round(dwt * 0.00027 + 55);
  if (shipType === "VLCC" || shipType === "Suezmax") return Math.round(dwt * 0.00020 + 25);
  if (shipType === "Aframax") return Math.round(dwt * 0.00022 + 18);
  if (shipType === "Container Ship") return Math.round(Math.pow(dwt, 0.6) * 0.18);
  return Math.round(dwt * 0.00035 + 6);
}

interface RouteData {
  distanceNm: number;
  waypoints: [number, number][];
}

export default function BunkerCalcPage() {
  const [shipType, setShipType] = useState("Capesize");
  const [dwt, setDwt] = useState(180000);
  const [fuelConsumption, setFuelConsumption] = useState(35);
  const [speed, setSpeed] = useState(12.5);
  const [tankCapacity, setTankCapacity] = useState(5000);
  const [currentBunker, setCurrentBunker] = useState(3000);
  const [hasScrubber, setHasScrubber] = useState(false);
  const [fromPort, setFromPort] = useState("Port Hedland");
  const [toPort, setToPort] = useState("Qingdao");
  const [maxDetour, setMaxDetour] = useState(150);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [vlsfoPrice, setVlsfoPrice] = useState(664);
  const [hsfoPrice, setHsfoPrice] = useState(451);
  const [mgoPrice, setMgoPrice] = useState(905);

  // Auto-set defaults when ship type changes
  useEffect(() => {
    const tank = TANK_CAPACITY[shipType];
    if (tank) {
      setTankCapacity(tank.typical);
      setCurrentBunker(Math.round(tank.typical * 0.6));
    }
    setFuelConsumption(defaultFuel(dwt, shipType));
  }, [shipType]);

  useEffect(() => {
    setFuelConsumption(defaultFuel(dwt, shipType));
  }, [dwt]);

  // Fetch live bunker prices
  useEffect(() => {
    fetch("/api/market").then(r => r.json()).then(data => {
      if (data.bunkerVLSFO) setVlsfoPrice(data.bunkerVLSFO);
      if (data.bunkerHSFO) setHsfoPrice(data.bunkerHSFO);
      if (data.bunkerMGO) setMgoPrice(data.bunkerMGO);
    }).catch(() => {});
  }, []);

  // Fetch route when ports change
  useEffect(() => {
    const from = PORTS_LIST.find(p => p.name === fromPort);
    const to = PORTS_LIST.find(p => p.name === toPort);
    if (!from || !to || from.name === to.name) return;

    setLoading(true);
    fetch(`/api/searoute?from=${from.lon},${from.lat}&to=${to.lon},${to.lat}`)
      .then(r => r.json())
      .then(data => {
        if (data.distanceNm && data.route?.coordinates) {
          setRouteData({ distanceNm: data.distanceNm, waypoints: data.route.coordinates });
        } else if (data.distanceKm) {
          setRouteData({
            distanceNm: Math.round(data.distanceKm / 1.852),
            waypoints: [[from.lon, from.lat], [to.lon, to.lat]]
          });
        }
      })
      .catch(() => {
        const dist = Math.round(haversineNm(from.lat, from.lon, to.lat, to.lon) * 1.15);
        setRouteData({ distanceNm: dist, waypoints: [[from.lon, from.lat], [to.lon, to.lat]] });
      })
      .finally(() => setLoading(false));
  }, [fromPort, toPort]);

  // Calculations
  const calc = useMemo(() => {
    if (!routeData) return null;

    const seaDays = routeData.distanceNm / (speed * 24);
    const totalFuelNeeded = fuelConsumption * seaDays;
    const reserve = tankCapacity * 0.10;
    const usableBunker = currentBunker - reserve;
    const rangeNm = (usableBunker / fuelConsumption) * speed * 24;
    const rangeDays = usableBunker / fuelConsumption;
    const canMakeIt = usableBunker >= totalFuelNeeded;
    const deficit = canMakeIt ? 0 : totalFuelNeeded - usableBunker;
    const tankFillPercent = (currentBunker / tankCapacity) * 100;

    const effectivePrice = hasScrubber
      ? hsfoPrice * 0.45 + vlsfoPrice * 0.35 + mgoPrice * 0.20
      : vlsfoPrice * 0.80 + mgoPrice * 0.20;
    const totalFuelCost = totalFuelNeeded * effectivePrice;

    const bunkerPorts = routeData.waypoints.length > 0
      ? findBunkerPortsAlongRoute(routeData.waypoints, maxDetour)
      : [];

    const portsWithPrice = bunkerPorts.map(port => {
      const pVlsfo = Math.round(vlsfoPrice * (1 + port.relativePremium / 100));
      const pHsfo = Math.round(hsfoPrice * (1 + port.relativePremium / 100));
      const pMgo = Math.round(mgoPrice * (1 + port.relativePremium / 100));
      const effPrice = hasScrubber && port.fuels.includes("HSFO")
        ? pHsfo * 0.45 + pVlsfo * 0.35 + pMgo * 0.20
        : pVlsfo * 0.80 + pMgo * 0.20;
      const bunkCost = deficit > 0 ? deficit * effPrice : 0;
      const detourCost = (port.detourNm * 2 / (speed * 24)) * fuelConsumption * effectivePrice;
      return { ...port, vlsfo: pVlsfo, hsfo: pHsfo, mgo: pMgo, effPrice: Math.round(effPrice), bunkCost, detourCost, totalCost: bunkCost + detourCost };
    });

    const sorted = [...portsWithPrice].sort((a, b) => a.effPrice - b.effPrice);

    return {
      seaDays: Math.round(seaDays * 10) / 10,
      totalFuelNeeded: Math.round(totalFuelNeeded),
      rangeNm: Math.round(rangeNm),
      rangeDays: Math.round(rangeDays * 10) / 10,
      canMakeIt,
      deficit: Math.round(deficit),
      tankFillPercent: Math.round(tankFillPercent),
      effectivePrice: Math.round(effectivePrice),
      totalFuelCost: Math.round(totalFuelCost),
      bunkerPorts: sorted,
    };
  }, [routeData, fuelConsumption, speed, tankCapacity, currentBunker, hasScrubber, vlsfoPrice, hsfoPrice, mgoPrice, maxDetour]);

  const inputCls = "w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none";
  const labelCls = "block text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-semibold mb-1";
  const selectCls = inputCls;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-200 to-slate-100 dark:from-[#0a0a0f] dark:to-[#0f0f1a] text-slate-900 dark:text-white">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold tracking-tight">Bunker Calculator</h1>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">LIVE PRICES</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-white/40">Range estimation, bunker port suggestions &amp; cost comparison along route</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* === LEFT: Ship + Route Inputs === */}
          <div className="space-y-4">
            <Card className="border-slate-300 dark:border-slate-800 p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold mb-3">Vessel</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Ship Type</label>
                  <select className={selectCls} value={shipType} onChange={e => setShipType(e.target.value)}>
                    {SHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>DWT</label>
                    <input type="number" className={inputCls} value={dwt} onChange={e => setDwt(+e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Speed (kn)</label>
                    <input type="number" step="0.5" className={inputCls} value={speed} onChange={e => setSpeed(+e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Fuel (t/day)</label>
                    <input type="number" step="0.5" className={inputCls} value={fuelConsumption} onChange={e => setFuelConsumption(+e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Tank Cap (t)</label>
                    <input type="number" className={inputCls} value={tankCapacity} onChange={e => setTankCapacity(+e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Current Bunker (t)</label>
                  <input type="range" min={0} max={tankCapacity} step={10} value={currentBunker}
                    onChange={e => setCurrentBunker(+e.target.value)}
                    className="w-full accent-blue-500" />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{currentBunker} t</span>
                    <span>{calc ? calc.tankFillPercent : Math.round(currentBunker/tankCapacity*100)}%</span>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={hasScrubber} onChange={e => setHasScrubber(e.target.checked)} className="accent-blue-500" />
                  Exhaust Gas Scrubber (HSFO capable)
                </label>
              </div>
            </Card>

            <Card className="border-slate-300 dark:border-slate-800 p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold mb-3">Route</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>From</label>
                  <select className={selectCls} value={fromPort} onChange={e => setFromPort(e.target.value)}>
                    {PORTS_LIST.map(p => <option key={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>To</label>
                  <select className={selectCls} value={toPort} onChange={e => setToPort(e.target.value)}>
                    {PORTS_LIST.map(p => <option key={p.name}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Max Detour (nm)</label>
                  <input type="number" className={inputCls} value={maxDetour} onChange={e => setMaxDetour(+e.target.value)} />
                </div>
              </div>
            </Card>
          </div>

          {/* === CENTER: Range + Fuel Analysis === */}
          <div className="space-y-4">
            <Card className="border-slate-300 dark:border-slate-800 p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold mb-3">Range Analysis</p>
              {loading ? (
                <p className="text-sm text-slate-400 animate-pulse">Calculating sea route...</p>
              ) : calc ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-3 rounded-lg border ${calc.canMakeIt
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-red-500/5 border-red-500/20"}`}>
                    <p className={`text-sm font-semibold ${calc.canMakeIt ? "text-emerald-400" : "text-red-400"}`}>
                      {calc.canMakeIt ? "Can complete voyage" : "Bunkering required"}
                    </p>
                    {!calc.canMakeIt && (
                      <p className="text-xs text-red-300 mt-1">Deficit: {calc.deficit.toLocaleString()} t ({Math.round(calc.deficit / fuelConsumption * 10) / 10} days)</p>
                    )}
                  </div>

                  {/* Range Gauge */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>Range</span>
                      <span>{calc.rangeNm.toLocaleString()} nm / {calc.rangeDays} days</span>
                    </div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        calc.rangeNm >= (routeData?.distanceNm || 0) ? "bg-emerald-500" :
                        calc.rangeNm >= (routeData?.distanceNm || 0) * 0.7 ? "bg-yellow-500" : "bg-red-500"
                      }`} style={{ width: `${Math.min(100, (calc.rangeNm / Math.max(1, routeData?.distanceNm || 1)) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>0</span>
                      <span>Voyage: {routeData?.distanceNm?.toLocaleString()} nm</span>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Voyage Distance", `${routeData?.distanceNm?.toLocaleString()} nm`],
                      ["Sea Days", `${calc.seaDays} days`],
                      ["Fuel Required", `${calc.totalFuelNeeded.toLocaleString()} t`],
                      ["Fuel Cost", `$${(calc.totalFuelCost / 1000).toFixed(0)}k`],
                      ["Tank Fill", `${calc.tankFillPercent}%`],
                      ["Eff. Price", `$${calc.effectivePrice}/t`],
                    ].map(([label, value]) => (
                      <div key={label as string} className="p-2 rounded bg-slate-50 dark:bg-slate-900/50">
                        <p className="text-[9px] text-slate-400 uppercase">{label}</p>
                        <p className="text-sm font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Live Prices */}
                  <div className="pt-2 border-t border-slate-300 dark:border-slate-800">
                    <p className="text-[10px] text-slate-400 uppercase mb-2">Singapore Benchmark</p>
                    <div className="flex gap-3">
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400">VLSFO</p>
                        <p className="text-sm font-mono font-semibold">${vlsfoPrice}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400">HSFO</p>
                        <p className="text-sm font-mono font-semibold">${hsfoPrice}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-slate-400">MGO</p>
                        <p className="text-sm font-mono font-semibold">${mgoPrice}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Select different from/to ports</p>
              )}
            </Card>
          </div>

          {/* === RIGHT: Bunker Port Suggestions === */}
          <div className="space-y-4">
            <Card className="border-slate-300 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30 font-semibold">Bunker Ports Along Route</p>
                {calc && <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">{calc.bunkerPorts.length} found</Badge>}
              </div>
              {calc && calc.bunkerPorts.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {calc.bunkerPorts.map((port, i) => (
                    <div key={port.name} className={`p-3 rounded-lg border transition-colors ${
                      i === 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-300 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{port.name}</p>
                            {i === 0 && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[9px]">CHEAPEST</Badge>}
                          </div>
                          <p className="text-[10px] text-slate-400">{port.country} — {port.detourNm} nm detour</p>
                        </div>
                        <p className="text-sm font-mono font-semibold">${port.effPrice}/t</p>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {port.fuels.map(f => (
                          <Badge key={f} className={"text-[9px] border " + (
                            f === "HSFO" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                            f === "VLSFO" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                            "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          )}>{f} ${f === "VLSFO" ? port.vlsfo : f === "HSFO" ? port.hsfo : port.mgo}</Badge>
                        ))}
                      </div>
                      {port.notes && <p className="text-[9px] text-slate-500 mt-1">{port.notes}</p>}
                      {port.minStem > 0 && <p className="text-[9px] text-slate-500">Min stem: {port.minStem} t</p>}
                      {!calc.canMakeIt && calc.deficit > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-800">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">Bunker cost ({calc.deficit}t)</span>
                            <span className="font-mono">${(port.bunkCost / 1000).toFixed(0)}k</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-400">Detour fuel cost</span>
                            <span className="font-mono">${(port.detourCost / 1000).toFixed(0)}k</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-semibold mt-1">
                            <span>Total</span>
                            <span className="font-mono">${(port.totalCost / 1000).toFixed(0)}k</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : calc ? (
                <p className="text-sm text-slate-400">No bunker ports within {maxDetour} nm of route. Try increasing max detour.</p>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
