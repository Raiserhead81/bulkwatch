"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, MapPin, Ship as ShipIcon, Loader2 } from "lucide-react";
import { SHIPS } from "@/data/ships";
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
            {t("map.desc")}
          </p>
        </section>

        <div className="mb-4 flex items-center gap-2">
          <Badge variant="outline" className="border-blue-500/20 text-blue-700 dark:text-cyan-400">
            <ShipIcon className="h-3 w-3 mr-1" />
            {t("map.shipCount", { count: SHIPS.length })}
          </Badge>
        </div>

        <WorldMap ships={SHIPS} height="600px" />

        <Card className="mt-6 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4">
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {t("voyage.mockNote")}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
