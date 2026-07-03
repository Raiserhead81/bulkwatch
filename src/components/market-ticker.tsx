"use client";

import { useState, useEffect } from "react";

interface MarketData {
  bdi: number;
  bunkerVLSFO: number;
  bunkerHSFO: number;
  bunkerMGO: number;
  scrapLDT: number;
  charterRates: Record<string, number>;
}

export default function MarketTicker() {
  const [market, setMarket] = useState<MarketData | null>(null);

  useEffect(() => {
    fetch("/api/market")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMarket(d); })
      .catch(() => {});
  }, []);

  if (!market) return null;

  return (
    <div className="border-b border-slate-400/40 dark:border-white/[0.03] bg-slate-400/30 dark:bg-white/[0.015] overflow-hidden">
      <div className="animate-marquee whitespace-nowrap py-1.5 text-[11px] font-mono">
        {Array.from({ length: 2 }).map((_, rep) => (
          <span key={rep} className="inline-flex gap-8 mr-8">
            <span className="text-slate-500 dark:text-white/25">BDI <span className="text-sky-500 font-semibold">{market.bdi.toLocaleString()}</span></span>
            <span className="text-slate-500 dark:text-white/25">VLSFO <span className="text-emerald-500 font-semibold">${market.bunkerVLSFO}</span>/t</span>
            <span className="text-slate-500 dark:text-white/25">HSFO <span className="text-amber-500 font-semibold">${market.bunkerHSFO}</span>/t</span>
            <span className="text-slate-500 dark:text-white/25">MGO <span className="text-red-400 font-semibold">${market.bunkerMGO}</span>/t</span>
            <span className="text-slate-500 dark:text-white/25">Scrap <span className="text-orange-400 font-semibold">${market.scrapLDT}</span>/LDT</span>
            <span className="text-slate-500 dark:text-white/25">Cape TCE <span className="text-sky-400 font-semibold">${market.charterRates.capesize?.toLocaleString()}</span>/d</span>
            <span className="text-slate-500 dark:text-white/25">Panamax <span className="text-sky-400 font-semibold">${market.charterRates.panamax?.toLocaleString()}</span>/d</span>
            <span className="text-slate-500 dark:text-white/25">Supra <span className="text-sky-400 font-semibold">${market.charterRates.supramax?.toLocaleString()}</span>/d</span>
            <span className="text-slate-500 dark:text-white/25">Handy <span className="text-sky-400 font-semibold">${market.charterRates.handysize?.toLocaleString()}</span>/d</span>
          </span>
        ))}
      </div>
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
          display: inline-flex;
          width: max-content;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
