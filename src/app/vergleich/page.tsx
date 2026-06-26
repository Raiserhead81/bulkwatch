"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Scale,
  Plus,
  X,
  Search,
  Trophy,
  TrendingUp,
  Ship as ShipIcon,
} from "lucide-react";
import { SHIPS, type Ship } from "@/data/ships";
import {
  estimatePrice,
  formatPrice,
  getRecommendationColor,
  getRecommendationEmoji,
  getRecommendationLabel,
} from "@/lib/priceEstimator";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ComparePage() {
  const { t } = useI18n();
  const [selectedImos, setSelectedImos] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const selectedShips = useMemo(
    () => SHIPS.filter((s) => selectedImos.includes(s.imo)),
    [selectedImos],
  );

  const searchResults = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return SHIPS.filter(
      (s) =>
        !selectedImos.includes(s.imo) &&
        (s.name.toLowerCase().includes(q) || s.imo.includes(q)),
    ).slice(0, 10);
  }, [search, selectedImos]);

  const addShip = (imo: string) => {
    if (selectedImos.length >= 5) return;
    if (!selectedImos.includes(imo)) {
      setSelectedImos([...selectedImos, imo]);
    }
    setSearch("");
    setShowSearch(false);
  };

  const removeShip = (imo: string) => {
    setSelectedImos(selectedImos.filter((i) => i !== imo));
  };

  // Compute "best" values
  const prices = selectedShips.map((s) => estimatePrice(s).estimatedValueUSD);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const newestYear = Math.max(...selectedShips.map((s) => s.yearBuilt));
  const oldestYear = Math.min(...selectedShips.map((s) => s.yearBuilt));
  const bestDwt = Math.max(...selectedShips.map((s) => s.dwt));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <h1 className="font-bold text-sm sm:text-base">{t("compare.title")}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 border border-blue-500/20 mb-3">
            <Scale className="h-3 w-3" /> Comparison
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">
            {t("compare.title")}
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/50 max-w-2xl">
            {t("compare.desc")}
          </p>
        </section>

        {selectedShips.length === 0 ? (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <Scale className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">{t("compare.empty")}</p>
              <p className="text-xs text-slate-500 dark:text-white/40 mb-4">{t("compare.emptyDesc")}</p>
              <Button onClick={() => setShowSearch(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t("compare.addShip")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Add ship search */}
            <Card className="mb-6 border-blue-500/20">
              <CardContent className="p-4">
                {showSearch || selectedImos.length < 5 ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder={t("compare.searchPlaceholder")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-white dark:bg-slate-900"
                        autoFocus
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {searchResults.map((ship) => (
                          <button
                            key={ship.imo}
                            onClick={() => addShip(ship.imo)}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-500/10 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <ShipIcon className="h-4 w-4 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium">{ship.name}</p>
                                <p className="text-xs text-slate-500">{ship.type} · IMO {ship.imo}</p>
                              </div>
                            </div>
                            <Plus className="h-4 w-4 text-blue-500" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedImos([])}
                    className="border-rose-500/30 text-rose-700 dark:text-rose-400"
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    {t("compare.clearAll")}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Comparison grid */}
            <div className="grid gap-4" style={{
              gridTemplateColumns: `repeat(${Math.min(selectedShips.length, 5)}, minmax(0, 1fr))`
            }}>
              {selectedShips.map((ship) => {
                const price = estimatePrice(ship);
                const isLowest = price.estimatedValueUSD === lowestPrice && selectedShips.length > 1;
                const isHighest = price.estimatedValueUSD === highestPrice && selectedShips.length > 1;
                const isNewest = ship.yearBuilt === newestYear && selectedShips.length > 1;
                const isOldest = ship.yearBuilt === oldestYear && selectedShips.length > 1;
                const hasBestDwt = ship.dwt === bestDwt && selectedShips.length > 1;

                return (
                  <Card key={ship.imo} className="border-blue-500/10 dark:border-white/10 overflow-hidden">
                    {/* Image */}
                    <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
                      <img
                        src={ship.imageUrl || ""}
                        alt={ship.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeShip(ship.imo)}
                        className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-rose-500 p-1.5 text-white transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <CardContent className="p-3 space-y-3">
                      {/* Name */}
                      <div>
                        <Link href={`/schiff/${ship.imo}`}>
                          <h3 className="font-bold text-sm hover:text-blue-600 dark:hover:text-cyan-400 transition-colors leading-tight">
                            {ship.name}
                          </h3>
                        </Link>
                        <p className="text-[10px] text-slate-500 dark:text-white/40 font-mono">
                          {ship.type} · IMO {ship.imo}
                        </p>
                      </div>

                      {/* Spec rows */}
                      <div className="space-y-2 text-xs">
                        <CompareRow
                          label={t("spec.dwt")}
                          value={`${(ship.dwt / 1000).toFixed(0)}K`}
                          highlight={hasBestDwt}
                          highlightLabel={t("compare.bestValue")}
                        />
                        <CompareRow
                          label={t("spec.built")}
                          value={String(ship.yearBuilt)}
                          highlight={isNewest}
                          highlightLabel={t("compare.newest")}
                          negative={isOldest}
                          negativeLabel={t("compare.oldest")}
                        />
                        <CompareRow label={t("spec.length")} value={`${ship.length} m`} />
                        <CompareRow label={t("spec.beam")} value={`${ship.beam} m`} />
                        <CompareRow label={t("spec.flag")} value={ship.flag} />
                      </div>

                      {/* Price */}
                      <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                        <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase mb-1">
                          {t("compare.price")}
                        </p>
                        <p className={`text-lg font-bold tabular-nums ${
                          isLowest ? "text-emerald-600 dark:text-emerald-400" :
                          isHighest ? "text-rose-600 dark:text-rose-400" :
                          "text-blue-600 dark:text-cyan-400"
                        }`}>
                          {formatPrice(price.estimatedValueUSD)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-white/40">
                          ${(price.estimatedValueUSD / ship.dwt).toFixed(0)}/DWT
                        </p>
                      </div>

                      {/* Recommendation */}
                      <div>
                        <Badge className={`${getRecommendationColor(price.recommendation)} border w-full justify-center text-[10px]`}>
                          {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                        </Badge>
                      </div>

                      <Link href={`/schiff/${ship.imo}`}>
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          {t("ship.details")}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedImos.length < 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => setShowSearch(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t("compare.addShip")} ({selectedImos.length}/5)
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function CompareRow({
  label,
  value,
  highlight = false,
  highlightLabel,
  negative = false,
  negativeLabel,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  highlightLabel?: string;
  negative?: boolean;
  negativeLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500 dark:text-white/40">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`font-medium ${highlight ? "text-emerald-600 dark:text-emerald-400" : negative ? "text-rose-600 dark:text-rose-400" : ""}`}>
          {value}
        </span>
        {highlight && highlightLabel && (
          <span className="text-[8px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-1 rounded">
            ★
          </span>
        )}
        {negative && negativeLabel && (
          <span className="text-[8px] bg-rose-500/15 text-rose-700 dark:text-rose-400 px-1 rounded">
            ↓
          </span>
        )}
      </div>
    </div>
  );
}
