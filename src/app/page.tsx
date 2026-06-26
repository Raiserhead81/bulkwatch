"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Ship as ShipIcon,
  Anchor,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  StarOff,
  MapPin,
  Calendar,
  Globe,
} from "lucide-react";
import { SHIPS, SHIP_TYPES, type Ship } from "@/data/ships";
import {
  estimatePrice,
  formatPrice,
  getRecommendationColor,
  getRecommendationEmoji,
  getRecommendationLabel,
} from "@/lib/priceEstimator";
import {
  generateMockVoyage,
  getStatusLabel,
  getStatusColor,
} from "@/lib/mockVoyages";
import { useWatchlist, toggleWatch } from "@/lib/useWatchlist";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SHIPS_PER_PAGE = 24;

type SortBy = "name" | "dwt_desc" | "dwt_asc" | "year_new" | "year_old" | "value_high" | "value_low";

export default function Home() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dwt_desc");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [page, setPage] = useState(1);
  const watchlist = useWatchlist();

  // Get unique flags
  const allFlags = useMemo(() => {
    const set = new Set(SHIPS.map((s) => s.flag));
    return Array.from(set).sort();
  }, []);

  // Filter + Sort
  const filteredShips = useMemo(() => {
    let result = [...SHIPS];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.imo.includes(q) ||
          (s.operator?.toLowerCase().includes(q) ?? false) ||
          (s.homePort?.toLowerCase().includes(q) ?? false),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }
    if (flagFilter !== "all") {
      result = result.filter((s) => s.flag === flagFilter);
    }
    if (operatorFilter.trim()) {
      const op = operatorFilter.toLowerCase();
      result = result.filter((s) => (s.operator || "").toLowerCase().includes(op));
    }
    if (sortBy === "name") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "dwt_desc") result.sort((a, b) => b.dwt - a.dwt);
    else if (sortBy === "dwt_asc") result.sort((a, b) => a.dwt - b.dwt);
    else if (sortBy === "year_new")
      result.sort((a, b) => b.yearBuilt - a.yearBuilt);
    else if (sortBy === "year_old")
      result.sort((a, b) => a.yearBuilt - b.yearBuilt);
    else if (sortBy === "value_high")
      result.sort(
        (a, b) =>
          estimatePrice(b).estimatedValueUSD -
          estimatePrice(a).estimatedValueUSD,
      );
    else if (sortBy === "value_low")
      result.sort(
        (a, b) =>
          estimatePrice(a).estimatedValueUSD -
          estimatePrice(b).estimatedValueUSD,
      );

    return result;
  }, [search, typeFilter, flagFilter, sortBy]);

  const paginatedShips = filteredShips.slice(
    (page - 1) * SHIPS_PER_PAGE,
    page * SHIPS_PER_PAGE,
  );

  const totalPages = Math.ceil(filteredShips.length / SHIPS_PER_PAGE);

  // Stats
  const stats = useMemo(() => {
    const totalDwt = SHIPS.reduce((sum, s) => sum + s.dwt, 0);
    const activeCount = SHIPS.filter((s) => s.status === "active").length;
    const avgValue =
      SHIPS.reduce((sum, s) => sum + estimatePrice(s).estimatedValueUSD, 0) /
      SHIPS.length;
    return {
      total: SHIPS.length,
      active: activeCount,
      totalDwt,
      avgValue,
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-2 shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
              <Anchor className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg leading-none tracking-tight">
                Bulk<span className="text-blue-600 dark:text-cyan-400">Watch</span>
              </h1>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-white/40 leading-none mt-0.5 font-mono">
                Bulk Carrier Intelligence
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2 text-xs flex-wrap">
            <Link href="/" className="px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-cyan-400 font-medium">
              Ships
            </Link>
            <Link
              href="/top-picks"
              className="px-2.5 py-1.5 rounded-md hover:bg-amber-500/10 transition-colors text-amber-700 dark:text-amber-400"
            >
              🏆 Top Picks
            </Link>
            <Link
              href="/survey-haefen"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              🔬 Survey Ports
            </Link>
            <Link
              href="/karte"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              🗺️ Map
            </Link>
            <Link
              href="/live"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70 flex items-center gap-1.5"
            >
              <span className="relative">
                📡
                <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              Live
            </Link>
            <Link
              href="/vergleich"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              ⚖️ Compare
            </Link>
            <Link
              href="/watchlist"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              ⭐ {watchlist.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
                  {watchlist.length}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero */}
        <section className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-cyan-300 border border-blue-500/20 mb-3">
            <Globe className="h-3 w-3" />
            Bulk Carrier Database
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
            All{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Bulk Carriers
            </span>{" "}
            Worldwide
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 leading-relaxed max-w-2xl">
            Live positions, specs, price estimates and Buy/Hold/Sell recommendations for{" "}
            <strong className="text-slate-900 dark:text-white">
              {stats.total} Bulk Carrier
            </strong>{" "}
            worldwide. Total capacity:{" "}
            <strong className="text-slate-900 dark:text-white">
              {(stats.totalDwt / 1_000_000).toFixed(2)} M DWT
            </strong>
            .
          </p>
        </section>

        {/* Stats Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-cyan-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShipIcon className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Total
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-white/40">Ships</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Anchor className="h-4 w-4 text-emerald-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Active
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{stats.active}</p>
              <p className="text-xs text-slate-500 dark:text-white/40">In Service</p>
            </CardContent>
          </Card>
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Ø DWT
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {(stats.totalDwt / stats.total / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Tonnage per Ship
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Ø Value
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatPrice(stats.avgValue)}
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Est. Value per Ship
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Filter Bar */}
        <Card className="mb-6 border-blue-500/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Name, IMO, operator..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-white dark:bg-slate-900"
                />
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Ship Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {SHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={flagFilter} onValueChange={(v) => { setFlagFilter(v); setPage(1); }}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Flag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Flags</SelectItem>
                  {allFlags.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Operator / Company..."
                  value={operatorFilter}
                  onChange={(e) => { setOperatorFilter(e.target.value); setPage(1); }}
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dwt_desc">Tonnage (high→low)</SelectItem>
                  <SelectItem value="dwt_asc">Tonnage (low→high)</SelectItem>
                  <SelectItem value="year_new">Year Built (new→old)</SelectItem>
                  <SelectItem value="year_old">Year Built (old→new)</SelectItem>
                  <SelectItem value="value_high">Value (high→low)</SelectItem>
                  <SelectItem value="value_low">Value (low→high)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-white/50">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <span>
                  {filteredShips.length} of {SHIPS.length} ships
                </span>
              </div>
              {(search || typeFilter !== "all" || flagFilter !== "all" || operatorFilter) && (
                <button
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setFlagFilter("all");
                    setOperatorFilter("");
                    setPage(1);
                  }}
                  className="text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ship Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedShips.map((ship) => {
            const price = estimatePrice(ship);
            const voyage = generateMockVoyage(ship);
            const isWatched = watchlist.includes(ship.imo);
            return (
              <Card
                key={ship.id}
                className="overflow-hidden hover:shadow-xl transition-shadow border-blue-500/10 dark:border-white/10 group"
              >
                {/* Ship Image */}
                <div className="relative aspect-video bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  {/* Gradient always shown — image overlays if it loads */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{
                      background: ship.type === "Capesize" || ship.type === "Newcastlemax" || ship.type === "Valemax" || ship.type === "VLOC"
                        ? "linear-gradient(135deg,#0f2744 0%,#1a3d6e 50%,#0f2744 100%)"
                        : ship.type === "Panamax" || ship.type === "Kamsarmax" || ship.type === "Post-Panamax"
                        ? "linear-gradient(135deg,#0f3320 0%,#1a5c38 50%,#0f3320 100%)"
                        : "linear-gradient(135deg,#2a1f0f 0%,#5c4020 50%,#2a1f0f 100%)"
                    }}
                  >
                    <svg viewBox="0 0 80 45" width="90" height="50" fill="none" xmlns="http://www.w3.org/2000/svg" opacity="0.45">
                      <path d="M5 35 L75 35 L70 42 L10 42Z" fill="#60a5fa"/>
                      <rect x="28" y="20" width="24" height="15" rx="1" fill="#3b82f6" opacity="0.8"/>
                      <path d="M15 35 L65 35 L65 28 L55 20 L25 20 L15 28Z" fill="#1d4ed8" opacity="0.6"/>
                      <line x1="40" y1="8" x2="40" y2="20" stroke="#60a5fa" strokeWidth="1.5"/>
                      <line x1="28" y1="13" x2="52" y2="13" stroke="#60a5fa" strokeWidth="1"/>
                    </svg>
                    <div className="text-center px-3">
                      <div className="text-xs font-bold text-blue-200 tracking-widest uppercase">{ship.type}</div>
                      <div className="text-xs text-blue-300/60 mt-0.5">{ship.dwt.toLocaleString("en-US")} DWT</div>
                    </div>
                  </div>
                  {/* Real photo overlays the gradient if it loads */}
                  {ship.imageUrl ? (
                    <img
                      src={ship.imageUrl}
                      alt={ship.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : null}
                  {/* Top overlay: Type + Watchlist */}
                  <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0 backdrop-blur-sm">
                      {ship.type}
                    </Badge>
                    <button
                      onClick={() => toggleWatch(ship.imo)}
                      className="rounded-full bg-black/50 hover:bg-black/70 p-1.5 backdrop-blur-sm transition-colors"
                      aria-label={isWatched ? "Remove from Watchlist" : "Add to Watchlist"}
                    >
                      {isWatched ? (
                        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      ) : (
                        <StarOff className="h-3.5 w-3.5 text-white" />
                      )}
                    </button>
                  </div>
                  {/* Bottom overlay: Status */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5">
                    <Badge className={`${getStatusColor(voyage.currentStatus)} border-0 backdrop-blur-sm`}>
                      {getStatusLabel(voyage.currentStatus)}
                    </Badge>
                  </div>
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
                      IMO: {ship.imo} · 🇺🇳 {ship.flag}
                    </p>
                  </div>

                  {/* Route */}
                  <div className="text-xs text-slate-600 dark:text-white/60 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">
                      {voyage.from.name} → {voyage.to.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-white/50 flex items-center gap-1.5">
                    <span className="text-base">{voyage.from.countryFlag}</span>
                    <span>{voyage.cargoDescription}</span>
                    <span className="text-base">{voyage.to.countryFlag}</span>
                  </div>

                  {/* Specs grid */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200 dark:border-white/10">
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">
                        DWT
                      </p>
                      <p className="text-sm font-bold tabular-nums">
                        {(ship.dwt / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">
                        Built
                      </p>
                      <p className="text-sm font-bold tabular-nums">{ship.yearBuilt}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">
                        Value
                      </p>
                      <p className="text-sm font-bold tabular-nums text-blue-600 dark:text-cyan-400">
                        {formatPrice(price.estimatedValueUSD)}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                    <Badge className={`${getRecommendationColor(price.recommendation)} border font-medium`}>
                      {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                    </Badge>
                    <span className="text-[10px] text-slate-500 dark:text-white/40">
                      Confidence: {price.confidenceScore}%
                    </span>
                  </div>

                  <Link href={`/schiff/${ship.imo}`}>
                    <Button variant="outline" size="sm" className="w-full border-blue-500/30 text-blue-700 dark:text-cyan-400 hover:bg-blue-500/10">
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="border-blue-500/30"
            >
              ← Previous
            </Button>
            <span className="text-sm text-slate-600 dark:text-white/60 px-3">
              Page <strong>{page}</strong> / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-blue-500/30"
            >
              Next →
            </Button>
          </div>
        )}

        {filteredShips.length === 0 && (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <ShipIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">
                No ships found
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Try different search terms or filters
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-blue-500/10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-500 dark:text-white/40">
          <p>
            BulkWatch · Data from public sources · Price estimates AI-based ·{" "}
            <span className="text-emerald-600 dark:text-emerald-400">Live-AIS</span> (via AISStream.io)
          </p>
        </div>
      </footer>
    </div>
  );
}
