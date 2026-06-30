"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Radio, ArrowLeft } from "lucide-react";
import AISLivePanel from "@/components/ais-live-panel";

export default function LivePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-[95%] mx-auto px-4 py-6 sm:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <Radio className="h-8 w-8 text-cyan-400 animate-pulse" />
            <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Live AIS Stream
            </span>
          </h1>
          <p className="text-white/60 mt-2 text-sm">
            Real ship positions in real-time from AISStream.io · worldwide · all ship types
          </p>
        </div>

        <AISLivePanel />
      </div>
    </div>
  );
}
