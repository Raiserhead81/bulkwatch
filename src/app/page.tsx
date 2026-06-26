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

          <nav className="flex items-center gap-1 sm:gap-2 text-xs">
            <Link href="/" className="px-2.5 py-1.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-cyan-400 font-medium">
              Schiffe
            </Link>
            <Link
              href="/survey-haefen"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              🔬 Survey-Häfen
            </Link>
            <Link
              href="/karte"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              🗺️ Karte
            </Link>
            <Link
              href="/vergleich"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              ⚖️ Vergleich
            </Link>
            <Link
              href="/watchlist"
              className="px-2.5 py-1.5 rounded-md hover:bg-slate-500/10 transition-colors text-slate-700 dark:text-white/70"
            >
              ⭐ Watchlist
              {watchlist.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
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
            Bulk Carrier Datenbank
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
            Alle{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Bulk Carrier
            </span>{" "}
            der Welt
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 leading-relaxed max-w-2xl">
            Live-Positionen, Specs, Preis-Schätzungen und Buy/Hold/Sell Empfehlungen für{" "}
            <strong className="text-slate-900 dark:text-white">
              {stats.total} Bulk Carrier
            </strong>{" "}
            weltweit. Gesamtkapazität:{" "}
            <strong className="text-slate-900 dark:text-white">
              {(stats.totalDwt / 1_000_000).toFixed(2)} Mio. DWT
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
                  Gesamt
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-white/40">Schiffe</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Anchor className="h-4 w-4 text-emerald-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Aktiv
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">{stats.active}</p>
              <p className="text-xs text-slate-500 dark:text-white/40">Im Einsatz</p>
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
                Tonnage pro Schiff
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-600" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-white/40 font-mono">
                  Ø Wert
                </p>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {formatPrice(stats.avgValue)}
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Schätzwert pro Schiff
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Filter Bar */}
        <Card className="mb-6 border-blue-500/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Name, IMO, Reederei..."
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
                  <SelectValue placeholder="Schiffstyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Typen</SelectItem>
                  {SHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={flagFilter} onValueChange={(v) => { setFlagFilter(v); setPage(1); }}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Flagge" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Flaggen</SelectItem>
                  {allFlags.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
                  <SelectValue placeholder="Sortierung" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dwt_desc">Tonnage (groß→klein)</SelectItem>
                  <SelectItem value="dwt_asc">Tonnage (klein→groß)</SelectItem>
                  <SelectItem value="year_new">Baujahr (neu→alt)</SelectItem>
                  <SelectItem value="year_old">Baujahr (alt→neu)</SelectItem>
                  <SelectItem value="value_high">Wert (hoch→niedrig)</SelectItem>
                  <SelectItem value="value_low">Wert (niedrig→hoch)</SelectItem>
                  <SelectItem value="name">Name (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-white/50">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                <span>
                  {filteredShips.length} von {SHIPS.length} Schiffen
                </span>
              </div>
              {(search || typeFilter !== "all" || flagFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("all");
                    setFlagFilter("all");
                    setPage(1);
                  }}
                  className="text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  Filter zurücksetzen
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
                  {/* Ship photo */}
                  <img
                    src={ship.imageUrl || ""}
                    alt={ship.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Top overlay: Type + Watchlist */}
                  <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2">
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white border-0 backdrop-blur-sm">
                      {ship.type}
                    </Badge>
                    <button
                      onClick={() => toggleWatch(ship.imo)}
                      className="rounded-full bg-black/50 hover:bg-black/70 p-1.5 backdrop-blur-sm transition-colors"
                      aria-label={isWatched ? "Von Watchlist entfernen" : "Zur Watchlist hinzufügen"}
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
                        Baujahr
                      </p>
                      <p className="text-sm font-bold tabular-nums">{ship.yearBuilt}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">
                        Wert
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
                      Konfidenz: {price.confidenceScore}%
                    </span>
                  </div>

                  <Link href={`/schiff/${ship.imo}`}>
                    <Button variant="outline" size="sm" className="w-full border-blue-500/30 text-blue-700 dark:text-cyan-400 hover:bg-blue-500/10">
                      Details ansehen
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
              ← Zurück
            </Button>
            <span className="text-sm text-slate-600 dark:text-white/60 px-3">
              Seite <strong>{page}</strong> / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="border-blue-500/30"
            >
              Weiter →
            </Button>
          </div>
        )}

        {filteredShips.length === 0 && (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <ShipIcon className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">
                Keine Schiffe gefunden
              </p>
              <p className="text-xs text-slate-500 dark:text-white/40">
                Versuche andere Suchbegriffe oder Filter
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-blue-500/10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-500 dark:text-white/40">
          <p>
            BulkWatch · Daten aus öffentlichen Quellen · Preis-Schätzungen KI-basiert ·{" "}
            <span className="text-amber-600 dark:text-amber-400">Mock-AIS</span> (Live-AIS in Entwicklung)
          </p>
        </div>
      </footer>
    </div>
  );
}
