"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, MapPin, Ship as ShipIcon, Loader2, Search, X } from "lucide-react";
import type { Ship } from "@/data/ships";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
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
  const [operatorFilter, setOperatorFilter] = useState("");
  const [ships, setShips] = useState<Ship[]>([]);
  const [totalWithPosition, setTotalWithPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShips = useCallback((operator: string) => {
    setIsLoading(true);
    const params = new URLSearchParams({ has_position: "true", limit: "5000" });
    if (operator.trim()) params.set("operator", operator.trim());
    fetch(`/api/ships?${params}`)
      .then(r => r.json())
      .then(d => {
        setShips(d.ships || []);
        setTotalWithPosition(d.total || 0);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    // Load total count without filter
    fetch("/api/ships?has_position=true&limit=1")
      .then(r => r.json())
      .then(d => setTotalWithPosition(d.total || 0));
    fetchShips("");
  }, [fetchShips]);

  const handleOperatorChange = (val: string) => {
    setOperatorFilter(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchShips(val), 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <h1 className="font-bold text-sm sm:text-base">{t("map.title")}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 border border-blue-500/20 mb-3">
            <MapPin className="h-3 w-3" /> Live Map
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">
            {t("map.title")}
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/50 max-w-2xl">
            {totalWithPosition.toLocaleString()} ships with GPS positions
          </p>
        </section>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-blue-500/20 text-blue-700 dark:text-cyan-400">
            <ShipIcon className="h-3 w-3 mr-1" />
            {isLoading ? "..." : ships.length.toLocaleString()} ships shown
          </Badge>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by shipping company or name..."
              value={operatorFilter}
              onChange={(e) => handleOperatorChange(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-xs rounded-lg border border-blue-500/20 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
            {operatorFilter && (
              <button
                onClick={() => { setOperatorFilter(""); fetchShips(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="w-full h-[600px] rounded-2xl bg-slate-200 dark:bg-slate-800 border border-blue-500/20 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <WorldMap ships={ships} height="600px" />
        )}

        <Card className="mt-6 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              {t("voyage.liveNote")}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}