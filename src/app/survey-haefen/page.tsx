"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Anchor,
  Search,
  MapPin,
  Plane,
  Clock,
  DollarSign,
  Award,
  Globe,
  Stethoscope,
  Filter,
} from "lucide-react";
import {
  SURVEY_PORTS,
  FACILITY_LABELS,
  FACILITY_ICONS,
  formatSurveyCost,
  type SurveyFacility,
  type SurveyPort,
} from "@/lib/surveyPorts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SurveyPortsPage() {
  const [search, setSearch] = useState("");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"rating" | "cost_low" | "cost_high" | "duration">(
    "rating",
  );

  const allFacilities = useMemo(() => {
    const set = new Set<SurveyFacility>();
    SURVEY_PORTS.forEach((p) => p.facilities.forEach((f) => set.add(f)));
    return Array.from(set).sort();
  }, []);

  const filteredPorts = useMemo(() => {
    let result = [...SURVEY_PORTS];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q) ||
          p.notes.toLowerCase().includes(q),
      );
    }
    if (facilityFilter !== "all") {
      result = result.filter((p) =>
        p.facilities.includes(facilityFilter as SurveyFacility),
      );
    }
    if (sortBy === "rating") result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === "cost_low")
      result.sort((a, b) => a.typicalSurveyCost.min - b.typicalSurveyCost.min);
    else if (sortBy === "cost_high")
      result.sort((a, b) => b.typicalSurveyCost.max - a.typicalSurveyCost.max);
    else if (sortBy === "duration")
      result.sort((a, b) => a.typicalDuration - b.typicalDuration);
    return result;
  }, [search, facilityFilter, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="sticky top-0 z-20 border-b border-blue-500/10 backdrop-blur-md bg-white/80 dark:bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <h1 className="font-bold text-sm sm:text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-purple-600 dark:text-purple-300" />
            Survey-Häfen
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <section className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-500/20 mb-3">
            <Award className="h-3 w-3" /> Pre-Purchase Survey
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-2">
            Beste Häfen für{" "}
            <span className="bg-gradient-to-r from-purple-600 to-fuchsia-500 bg-clip-text text-transparent">
              Schiffsinspektion
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-white/50 leading-relaxed max-w-2xl">
            Bevor ein Superintendent ein Schiff vor dem Kauf inspiziert, braucht es den
            richtigen Hafen. Hier sind die weltweit besten Survey-Häfen mit Drydock,
            Taucher-Teams und Klassifikationsgesellschaften.
          </p>
        </section>

        <Card className="mb-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-fuchsia-500/5">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2 flex-shrink-0">
                <Stethoscope className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-sm">Was passiert bei einer Schiffsinspektion?</h3>
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed">
                  Ein <strong>Superintendent</strong> (erfahrener Kapitän oder Schiffbauingenieur)
                  inspiziert das Schiff vor dem Kauf. Er prüft:
                </p>
                <ul className="text-xs text-slate-600 dark:text-white/60 ml-4 space-y-0.5 list-disc">
                  <li>Hüllenzustand (UT-Dickenmessung per Taucher oder Drydock)</li>
                  <li>Maschinenraum und Antrieb</li>
                  <li>Tankzustand (Reinigung + Inspektion)</li>
                  <li>Sicherheitsausrüstung und Zertifikate</li>
                  <li>Ladungsumschlags-Systeme</li>
                </ul>
                <p className="text-xs text-slate-600 dark:text-white/60 leading-relaxed pt-1">
                  Dauer: 3-5 Tage. Kosten: $20K-$100K je nach Hafen und Schiffgröße.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border-blue-500/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Hafen, Land, Stichwort..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 bg-white dark:bg-slate-900"
                />
              </div>
              <Select value={facilityFilter} onValueChange={setFacilityFilter}>
                <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Einrichtung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Einrichtungen</SelectItem>
                  {allFacilities.map((f) => (
                    <SelectItem key={f} value={f}>{FACILITY_ICONS[f]} {FACILITY_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="bg-white dark:bg-slate-900"><SelectValue placeholder="Sortierung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Bewertung (beste zuerst)</SelectItem>
                  <SelectItem value="cost_low">Kosten (niedrig zuerst)</SelectItem>
                  <SelectItem value="cost_high">Kosten (hoch zuerst)</SelectItem>
                  <SelectItem value="duration">Dauer (schnellste zuerst)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-white/50">
              <Filter className="h-3.5 w-3.5" />
              <span>{filteredPorts.length} von {SURVEY_PORTS.length} Häfen</span>
            </div>
          </CardContent>
        </Card>

        {sortBy === "rating" && !search && facilityFilter === "all" && (
          <Card className="mb-6 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-amber-600" />
                <h3 className="font-bold text-sm">🏆 Top 3 Survey-Häfen weltweit</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {filteredPorts.slice(0, 3).map((port, i) => (
                  <div key={port.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-slate-900/50">
                    <span className="text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{port.name}</p>
                      <p className="text-xs text-slate-500 dark:text-white/40">
                        {port.countryFlag} {port.country} · Rating {port.rating}/100
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPorts.map((port) => (
            <SurveyPortCard key={port.id} port={port} />
          ))}
        </div>

        {filteredPorts.length === 0 && (
          <Card className="border-blue-500/20">
            <CardContent className="p-12 text-center">
              <Anchor className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">Keine Häfen gefunden</p>
              <p className="text-xs text-slate-500 dark:text-white/40">Versuche andere Suchbegriffe oder Filter</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function SurveyPortCard({ port }: { port: SurveyPort }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="overflow-hidden border-blue-500/10 dark:border-white/10">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{port.countryFlag}</span>
              <h3 className="font-bold text-base sm:text-lg leading-tight">{port.name}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-white/40">{port.country}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Award className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold tabular-nums">{port.rating}</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-white/40">/ 100</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-slate-200 dark:border-white/10">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Kosten</p>
            <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
              {formatSurveyCost(port.typicalSurveyCost)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Dauer</p>
            <p className="text-sm font-semibold flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />{port.typicalDuration} Tage
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase">Flughafen</p>
            <p className="text-sm font-semibold flex items-center justify-center gap-1">
              <Plane className="h-3 w-3" />{port.airport}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase mb-1.5">Einrichtungen</p>
          <div className="flex flex-wrap gap-1.5">
            {port.facilities.map((f) => (
              <Badge key={f} variant="outline" className="text-[10px] py-0.5 border-blue-500/20 bg-blue-500/5">
                {FACILITY_ICONS[f]} {FACILITY_LABELS[f]}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase mb-1.5">Klassifikationsgesellschaften</p>
          <div className="flex flex-wrap gap-1.5">
            {port.certifications.map((c) => (
              <Badge key={c} className="text-[10px] py-0.5 bg-stone-700 text-white border-0">{c}</Badge>
            ))}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
        >
          {expanded ? "Weniger anzeigen" : "Mehr Details"} {expanded ? "▲" : "▼"}
        </button>

        {expanded && (
          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
            <div>
              <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase mb-1">Notizen</p>
              <p className="text-xs text-slate-700 dark:text-white/70 leading-relaxed">{port.notes}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-white/60">
              <MapPin className="h-3 w-3" />
              <span>{port.lat.toFixed(3)}, {port.lon.toFixed(3)} · {port.airportDistance} km zum Flughafen {port.airport}</span>
            </div>
            {port.contactInfo?.website && (
              <a href={port.contactInfo.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-cyan-400 hover:underline">
                <Globe className="h-3 w-3" /> Website
              </a>
            )}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/40">
              <DollarSign className="h-3 w-3" />
              <span>Geschätzte Kosten: {formatSurveyCost(port.typicalSurveyCost)} USD</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
