"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, MapPin, Ship as ShipIcon, Loader2, Search, X } from "lucide-react";
import type { Ship } from "@/data/ships";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

const WorldMap = dynamic(() => import("@/components/world-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-2xl bg-slate-200 dark:bg-slate-800 border border-blue-500/20 flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
    </div>
  ),
});

export default function KartePage() {
  const { t } = useI18n();
  const [focusImo, setFocusImo] = useState<string>();
  const [focusLat, setFocusLat] = useState<number>();
  const [focusLon, setFocusLon] = useState<number>();
  const [focusZoom, setFocusZoom] = useState<number>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("imo")) setFocusImo(p.get("imo")!);
    if (p.get("lat")) setFocusLat(parseFloat(p.get("lat")!));
    if (p.get("lon")) setFocusLon(parseFloat(p.get("lon")!));
    if (p.get("zoom")) setFocusZoom(parseInt(p.get("zoom")!));
  }, []);
  const [operatorFilter, setOperatorFilter] = useState("");
  const [ships, setShips] = useState<Ship[]>([]);
  const [totalWithPosition, setTotalWithPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShips = useCallback((operator: string) => {
    setIsLoading(true);
    if (operator.trim()) {
      // When filtering: load ALL ships of this operator (even without position)
      // so Live AIS can match by name
      const params = new URLSearchParams({ limit: "5000", operator: operator.trim() });
      fetch(`/api/ships?${params}`)
        .then(r => r.json())
        .then(d => {
          setShips(d.ships || []);
          setTotalWithPosition(d.total || 0);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    } else {
      // No filter: only ships with position (too many otherwise)
      const params = new URLSearchParams({ has_position: "true", limit: "5000" });
      fetch(`/api/ships?${params}`)
        .then(r => r.json())
        .then(d => {
          setShips(d.ships || []);
          setTotalWithPosition(d.total || 0);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    }
  }, []);

  useEffect(() => {
    if (focusImo) {
      // Single ship mode: load only the focused ship
      fetch(`/api/ships/${focusImo}`)
        .then(r => r.json())
        .then(ship => {
          if (ship && ship.imo) { setShips([ship]); setTotalWithPosition(1); }
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    } else {
      fetch("/api/ships?has_position=true&limit=1")
        .then(r => r.json())
        .then(d => setTotalWithPosition(d.total || 0));
      fetchShips("");
    }
  }, [fetchShips, focusImo]);

  const handleOperatorChange = (val: string) => {
    setOperatorFilter(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchShips(val), 400);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-900 dark:text-white overflow-hidden">
      {/* Compact header */}
      <header className="flex-shrink-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-slate-950/90">
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400 transition-colors">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <MapPin className="h-3 w-3 text-cyan-400" />
              <span className="text-cyan-300 font-medium">{totalWithPosition.toLocaleString()}</span>
              <span>DB ships</span>
            </div>
            <Badge variant="outline" className="border-blue-500/20 text-blue-400 text-xs">
              <ShipIcon className="h-3 w-3 mr-1" />
              {isLoading ? "..." : operatorFilter.trim()
                ? `${ships.filter(s => s.position?.lat).length} on map / ${ships.length} total`
                : `${ships.length.toLocaleString()} shown`}
            </Badge>
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by operator..."
                value={operatorFilter}
                onChange={(e) => handleOperatorChange(e.target.value)}
                className="pl-8 pr-8 py-1 text-xs rounded-lg border border-slate-700 bg-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
              />
              {operatorFilter && (
                <button
                  onClick={() => { setOperatorFilter(""); fetchShips(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
          <h1 className="font-bold text-sm text-slate-200">{t("map.title")}</h1>
        </div>
      </header>

      {/* Map fills remaining viewport */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <WorldMap ships={ships} height="100%" focusLat={focusLat} focusLon={focusLon} focusZoom={focusZoom} focusImo={focusImo} />
        )}
      </div>
    </div>
  );
}