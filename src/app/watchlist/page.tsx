"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Star,
  StarOff,
  Ship as ShipIcon,
  MapPin,
  Trash2,
} from "lucide-react";
import { SHIPS } from "@/data/ships";
import {
  estimatePrice,
  formatPrice,
  getRecommendationColor,
  getRecommendationEmoji,
  getRecommendationLabel,
} from "@/lib/priceEstimator";
import { generateMockVoyage, getStatusLabel, getStatusColor } from "@/lib/mockVoyages";
import { useWatchlist, toggleWatch, setWatchlist } from "@/lib/useWatchlist";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WatchlistPage() {
  const { t } = useI18n();
  const watchlist = useWatchlist();
  const watchedShips = SHIPS.filter((s) => watchlist.includes(s.imo));

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
          <h1 className="font-bold text-sm sm:text-base">{t("watchlist.title")}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20 mb-3">
            <Star className="h-3 w-3" /> Watchlist
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">
            {t("watchlist.title")}
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/50 max-w-2xl">
            {t("watchlist.desc")}
          </p>
        </section>

        {watchedShips.length === 0 ? (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <Star className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">{t("watchlist.empty")}</p>
              <p className="text-xs text-slate-500 dark:text-white/40 mb-4">{t("watchlist.emptyDesc")}</p>
              <Link href="/">
                <Button>
                  <ShipIcon className="h-4 w-4 mr-1.5" />
                  {t("watchlist.browse")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <Badge variant="outline" className="border-amber-500/20 text-amber-700 dark:text-amber-300">
                {watchedShips.length} {watchedShips.length === 1 ? "Schiff" : "Schiffe"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWatchlist([])}
                className="border-rose-500/30 text-rose-700 dark:text-rose-400"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {t("watchlist.clearAll")}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchedShips.map((ship) => {
                const price = estimatePrice(ship);
                const voyage = generateMockVoyage(ship);
                return (
                  <Card key={ship.imo} className="overflow-hidden border-blue-500/10 dark:border-white/10 group">
                    <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
                      <img
                        src={ship.imageUrl || ""}
                        alt={ship.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <button
                        onClick={() => toggleWatch(ship.imo)}
                        className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-rose-500 p-1.5 text-white transition-colors"
                      >
                        <StarOff className="h-3.5 w-3.5" />
                      </button>
                      <div className="absolute bottom-2 left-2">
                        <Badge className={`${getStatusColor(voyage.currentStatus)} border-0 backdrop-blur-sm`}>
                          {getStatusLabel(voyage.currentStatus)}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-3">
                      <div>
                        <Link href={`/schiff/${ship.imo}`}>
                          <h3 className="font-bold text-base hover:text-blue-600 dark:hover:text-cyan-400 transition-colors leading-tight">
                            {ship.name}
                          </h3>
                        </Link>
                        <p className="text-[10px] text-slate-500 dark:text-white/40 font-mono mt-0.5">
                          {ship.type} · IMO: {ship.imo} · {ship.flag}
                        </p>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {voyage.from.name} → {voyage.to.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center py-2 border-t border-slate-200 dark:border-white/10">
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">DWT</p>
                          <p className="text-sm font-bold tabular-nums">{(ship.dwt / 1000).toFixed(0)}K</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">{t("ship.built")}</p>
                          <p className="text-sm font-bold tabular-nums">{ship.yearBuilt}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">{t("ship.value")}</p>
                          <p className="text-sm font-bold text-blue-600 dark:text-cyan-400 tabular-nums">
                            {formatPrice(price.estimatedValueUSD)}
                          </p>
                        </div>
                      </div>

                      <Badge className={`${getRecommendationColor(price.recommendation)} border w-full justify-center`}>
                        {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                      </Badge>

                      <Link href={`/schiff/${ship.imo}`}>
                        <Button variant="outline" size="sm" className="w-full border-blue-500/30 text-blue-700 dark:text-cyan-400">
                          {t("ship.details")}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
