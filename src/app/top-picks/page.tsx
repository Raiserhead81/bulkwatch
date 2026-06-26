"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Ship as ShipIcon,
  Award,
  Star,
  StarOff,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { SHIPS, SHIP_TYPES, type BulkCarrierType } from "@/data/ships";
import {
  estimatePrice,
  formatPrice,
  getRecommendationColor,
  getRecommendationEmoji,
  getRecommendationLabel,
} from "@/lib/priceEstimator";
import { getAllTopPicks, getOverallTopPick, type TopPick } from "@/lib/topPicks";
import { useWatchlist, toggleWatch } from "@/lib/useWatchlist";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TopPicksPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const watchlist = useWatchlist();
  const allTopPicks = useMemo(() => getAllTopPicks(), []);
  const overallTop = useMemo(() => getOverallTopPick(), []);

  const filteredPicks = useMemo(() => {
    if (typeFilter === "all") return allTopPicks;
    return allTopPicks.filter((t) => t.type === typeFilter);
  }, [allTopPicks, typeFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <h1 className="font-bold text-sm sm:text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            Top Kauf-Empfehlungen
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero */}
        <section className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20 mb-3">
            <Sparkles className="h-3 w-3" />
            Investment Intelligence
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
            Top 3{" "}
            <span className="bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
              Kauf-Empfehlungen
            </span>{" "}
            pro Schiffsgröße
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 leading-relaxed max-w-2xl">
            KI-basierte Analyse aller Bulk Carrier — bewertet nach Alter, Preis pro DWT,
            Marktstatus und Reederei-Qualität. Pro Schiffsgröße die 3 besten Kauf-Kandidaten.
          </p>
        </section>

        {/* Overall Top Pick Highlight */}
        {overallTop && (
          <Card className="mb-8 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/5 overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-3 shadow-lg shadow-amber-500/30 flex-shrink-0">
                  <Trophy className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300 font-semibold">
                      🏆 Gesamt-Top-Pick
                    </span>
                    <Badge className={`${getRecommendationColor(overallTop.price.recommendation)} border`}>
                      {getRecommendationEmoji(overallTop.price.recommendation)} {getRecommendationLabel(overallTop.price.recommendation)}
                    </Badge>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">
                      Score: {overallTop.score}/100
                    </Badge>
                  </div>
                  <Link href={`/schiff/${overallTop.ship.imo}`}>
                    <h2 className="text-2xl sm:text-3xl font-bold hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                      {overallTop.ship.name}
                    </h2>
                  </Link>
                  <p className="text-xs text-slate-500 dark:text-white/40 mt-1 mb-3">
                    {overallTop.ship.type} · IMO: {overallTop.ship.imo} · {overallTop.ship.flag}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Geschätzter Wert</p>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {formatPrice(overallTop.price.estimatedValueUSD)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Tonnage</p>
                      <p className="text-lg font-bold">{(overallTop.ship.dwt / 1000).toFixed(0)}K DWT</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Baujahr</p>
                      <p className="text-lg font-bold">{overallTop.ship.yearBuilt}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">$ pro DWT</p>
                      <p className="text-lg font-bold">
                        ${(overallTop.price.estimatedValueUSD / overallTop.ship.dwt).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-white/70 leading-relaxed bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg">
                    💡 {overallTop.reason}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/schiff/${overallTop.ship.imo}`}>
                      <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white">
                        Details ansehen
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleWatch(overallTop.ship.imo)}
                      className="border-amber-500/30"
                    >
                      {watchlist.includes(overallTop.ship.imo) ? (
                        <><Star className="h-4 w-4 mr-1 text-amber-500 fill-amber-500" /> Auf Watchlist</>
                      ) : (
                        <><StarOff className="h-4 w-4 mr-1" /> Zur Watchlist</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter */}
        <Card className="mb-6 border-blue-500/20">
          <CardContent className="p-4">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="bg-white dark:bg-slate-900 max-w-md">
                <SelectValue placeholder="Schiffsgröße" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Schiffsgrößen</SelectItem>
                {SHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Top Picks by Type */}
        <div className="space-y-8">
          {filteredPicks.map(({ type, picks, marketSummary }) => (
            <section key={type}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                    <ShipIcon className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                    {type}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{marketSummary}</p>
                </div>
                <Badge variant="outline" className="border-blue-500/20 text-blue-700 dark:text-cyan-400">
                  {picks.length} Top-Picks
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {picks.map((pick, idx) => (
                  <TopPickCard
                    key={pick.ship.imo}
                    pick={pick}
                    rank={idx + 1}
                    isWatched={watchlist.includes(pick.ship.imo)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {filteredPicks.length === 0 && (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <Trophy className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60">
                Keine Top-Picks für diesen Schiffstyp
              </p>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <Card className="mt-8 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              ⚠️ <strong>Wichtiger Hinweis:</strong> Diese Empfehlungen basieren auf
              öffentlich verfügbaren Daten und einer KI-gestützten Analyse. Sie stellen
              keine Anlageberatung dar. Vor jedem Schiffskauf ist eine professionelle
              Pre-Purchase Survey durch einen zertifizierten Superintendenten erforderlich.
              Siehe <Link href="/survey-haefen" className="underline">Survey-Häfen</Link> für
              empfohlene Inspektionshäfen.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function TopPickCard({ pick, rank, isWatched }: { pick: TopPick; rank: number; isWatched: boolean }) {
  const { ship, price, score, reason } = pick;
  const rankBadge = ["🥇", "🥈", "🥉"][rank - 1] || `#${rank}`;

  return (
    <Card className="overflow-hidden border-blue-500/10 dark:border-white/10 hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
        {/* Ship photo */}
        <img
          src={ship.imageUrl || ""}
          alt={ship.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {/* Rank badge */}
        <div className="absolute top-2 left-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full px-3 py-1 shadow-md flex items-center gap-1.5">
          <span className="text-xl">{rankBadge}</span>
          <span className="text-xs font-bold tabular-nums">Score: {score}</span>
        </div>
        {/* Watchlist button */}
        <button
          onClick={() => toggleWatch(ship.imo)}
          className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 p-1.5 backdrop-blur-sm transition-colors"
          aria-label="Zur Watchlist hinzufügen"
        >
          {isWatched ? (
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
          ) : (
            <StarOff className="h-3.5 w-3.5 text-white" />
          )}
        </button>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <div>
          <Link href={`/schiff/${ship.imo}`}>
            <h3 className="font-bold text-base hover:text-blue-600 dark:hover:text-cyan-400 transition-colors leading-tight">
              {ship.name}
            </h3>
          </Link>
          <p className="text-[10px] text-slate-500 dark:text-white/40 font-mono mt-0.5">
            IMO: {ship.imo} · {ship.flag}
          </p>
        </div>

        {/* Specs */}
        <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-slate-200 dark:border-white/10">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">DWT</p>
            <p className="text-sm font-bold tabular-nums">{(ship.dwt / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Baujahr</p>
            <p className="text-sm font-bold tabular-nums">{ship.yearBuilt}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Wert</p>
            <p className="text-sm font-bold text-blue-600 dark:text-cyan-400 tabular-nums">
              {formatPrice(price.estimatedValueUSD)}
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <Badge className={`${getRecommendationColor(price.recommendation)} border font-medium w-full justify-center`}>
          {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
        </Badge>

        {/* Reason */}
        <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
          💡 {reason}
        </p>

        <Link href={`/schiff/${ship.imo}`}>
          <Button variant="outline" size="sm" className="w-full border-blue-500/30 text-blue-700 dark:text-cyan-400">
            Details ansehen <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
