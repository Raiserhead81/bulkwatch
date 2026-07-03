"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Star, StarOff, Ship as ShipIcon, MapPin, Trash2 } from "lucide-react";
import { type Ship } from "@/data/ships";
import { estimatePrice, formatPrice, getRecommendationColor, getRecommendationEmoji, getRecommendationLabel } from "@/lib/priceEstimator";
import { useWatchlist, toggleWatch, setWatchlist } from "@/lib/useWatchlist";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function WatchlistPage() {
  const watchlist = useWatchlist();
  const [ships, setShips] = useState<Ship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (watchlist.length === 0) { setShips([]); setLoading(false); return; }
    // Fetch all watchlisted ships from API
    Promise.all(
      watchlist.map(imo =>
        fetch(`/api/ships/${imo}`).then(r => r.ok ? r.json() : null).catch(() => null)
      )
    ).then(results => {
      setShips(results.filter(Boolean));
      setLoading(false);
    });
  }, [watchlist]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-white">
      

      <main className="max-w-[95%] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Your Watchlist</h1>
          <p className="text-sm text-slate-500">Ships you're monitoring. Click Save on any ship detail page to add.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading watchlist...</div>
        ) : ships.length === 0 ? (
          <Card className="border-slate-300 dark:border-slate-800">
            <CardContent className="p-12 text-center">
              <Star className="h-12 w-12 mx-auto text-slate-300 dark:text-white/20 mb-4" />
              <p className="text-slate-600 dark:text-white/60 mb-2">No ships on your watchlist</p>
              <p className="text-xs text-slate-500 mb-4">Browse ships and click "Save" to add them here.</p>
              <Link href="/"><Button><ShipIcon className="h-4 w-4 mr-1.5" /> Browse Ships</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">{ships.length} {ships.length === 1 ? "ship" : "ships"}</span>
              <Button variant="outline" size="sm" onClick={() => setWatchlist([])} className="border-rose-500/30 text-rose-600 dark:text-rose-400">
                <Trash2 className="h-4 w-4 mr-1.5" /> Clear All
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {ships.map(ship => {
                const price = estimatePrice(ship);
                return (
                  <Card key={ship.imo} className="overflow-hidden border-slate-300 dark:border-slate-800 group">
                    <div className="relative aspect-video bg-slate-200 dark:bg-slate-800">
                      {ship.imageUrl ? (
                        <img src={ship.imageUrl} alt={ship.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🚢</div>
                      )}
                      <button onClick={() => toggleWatch(ship.imo)}
                        className="absolute top-2 right-2 rounded-full bg-black/60 hover:bg-rose-500 p-1.5 text-white transition-colors">
                        <StarOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <Link href={`/schiff/${ship.imo}`}>
                        <h3 className="font-bold text-sm hover:text-blue-600 dark:hover:text-cyan-400 transition-colors truncate">{ship.name}</h3>
                      </Link>
                      <p className="text-[10px] text-slate-500">{ship.type} · IMO {ship.imo} · {ship.flag}</p>
                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">DWT</p>
                          <p className="text-xs font-bold">{ship.dwt > 0 ? (ship.dwt/1000).toFixed(0) + "K" : "-"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Built</p>
                          <p className="text-xs font-bold">{ship.yearBuilt > 0 ? ship.yearBuilt : "-"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Value</p>
                          <p className="text-xs font-bold">{ship.dwt > 0 ? formatPrice(price.estimatedValueUSD) : "-"}</p>
                        </div>
                      </div>
                      <Badge className={`${getRecommendationColor(price.recommendation)} border w-full justify-center text-[10px]`}>
                        {getRecommendationEmoji(price.recommendation)} {getRecommendationLabel(price.recommendation)}
                      </Badge>
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
