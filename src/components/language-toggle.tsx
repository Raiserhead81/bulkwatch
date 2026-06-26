"use client";

import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full border border-slate-500/20 bg-white/5 p-0.5">
      <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-white/40 mx-1.5" />
      <button
        type="button"
        onClick={() => setLang("de")}
        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
          lang === "de"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70"
        }`}
      >
        DE
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full transition-colors ${
          lang === "en"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70"
        }`}
      >
        EN
      </button>
    </div>
  );
}
