"use client";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function VergleichPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-950 text-slate-900 dark:text-white">
      <header className="border-b border-blue-500/10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm hover:text-blue-600 dark:hover:text-cyan-400">
            <ArrowLeft className="h-4 w-4" /> Zurück
          </Link>
          <h1 className="font-bold">⚖️ Schiffs-Vergleich</h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <Card className="border-blue-500/20">
          <CardContent className="p-12 text-center">
            <Scale className="h-12 w-12 mx-auto text-blue-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Vergleich in Entwicklung</h2>
            <p className="text-sm text-slate-600 dark:text-white/60 mb-4">
              Vergleiche 2-5 Schiffe nebeneinander: Specs, Preise, Empfehlungen.
            </p>
            <Link href="/">
              <Button>Zurück zur Schiffs-Liste</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
