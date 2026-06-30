"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const NAV_LINKS: [string,string,string][] = [
  ["Ships","/","⚓"],["Map","/karte","🗺️"],["Live","/live","📡"],["Top Picks","/top-picks","🏆"],
  ["Compare","/vergleich","⚖️"],["Watchlist","/watchlist","⭐"],["Newbuilds","/newbuilds","🚢"],
  ["Voyage Calc","/voyage-calc","🧮"],["Valuation","/valuation","💰"],["AI Chat","/chat","🤖"],
];

export default function GlobalNav() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");
  const [currentUser, setCurrentUser] = useState<{username:string;role:string}|null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [path, setPath] = useState("/");
  

  useEffect(() => {
    setPath(window.location.pathname);
    fetch("/api/auth/me").then(r=>r.json()).then(d=>{if(d.user) setCurrentUser(d.user)}).catch(()=>{});

    const saved = localStorage.getItem("vessel-theme") || "dark";
    setTheme(saved as "dark"|"light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("vessel-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next !== "light");
  };

  return (
    <>
      {/* Mobile overlay */}
      {menuOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setMenuOpen(false)} />}
      {/* Mobile menu */}
      <div className={`fixed top-0 right-0 h-full w-64 bg-slate-900 border-l border-slate-800 z-50 transform transition-transform ${menuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <button onClick={() => setMenuOpen(false)} className="absolute top-4 right-4 text-slate-400 text-xl">✕</button>
        <div className="pt-14 px-4 space-y-1">
          {NAV_LINKS.map(([label, href, icon]) => (
            <a key={href} href={href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg text-base ${path === href ? "bg-blue-500/10 text-blue-400 font-semibold" : "text-slate-300 hover:text-white hover:bg-slate-800"}`}>
              <span className="text-lg w-7 text-center">{icon}</span>
              {label}
            </a>
          ))}
          <button onClick={() => { toggleTheme(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white mt-4 border border-slate-700">
            {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          {currentUser?.role === "admin" && <a href="/users" className="flex items-center gap-3 px-3 py-3 rounded-lg text-base text-slate-300 hover:text-white hover:bg-slate-800"><span className="text-lg w-7 text-center">👤</span>Users</a>}
          <a href="/api/auth/logout" className="block px-3 py-2 text-sm text-slate-500 hover:text-red-400 mt-2">Logout</a>
        </div>
      </div>
      {/* Fixed top bar for sub-pages */}
      <nav className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[95%] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <img src="/icon-maritime-ai.png" alt="" className="w-7 h-7 rounded-full" />
              <span className="text-sm font-bold text-blue-400 hidden sm:inline">Maritime AI</span>
            </Link>
          </div>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(([label, href, icon]) => (
              <a key={href} href={href}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs ${path === href ? "text-blue-400 font-semibold" : "text-slate-500 hover:text-slate-200"}`}>
                <span className="text-sm">{icon}</span> {label}
              </a>
            ))}
            <button onClick={toggleTheme} className="ml-2 px-2 py-1 rounded border border-slate-700 text-sm cursor-pointer" title="Toggle theme">
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {currentUser?.role === "admin" && <a href="/users" className="ml-2 text-xs text-slate-500 hover:text-slate-200">👤 Users</a>}
            <a href="/api/auth/logout" className="ml-2 text-xs text-slate-600 hover:text-red-400">Logout</a>
          </div>
          {/* Mobile hamburger */}
          <button className="md:hidden text-xl text-slate-400" onClick={() => setMenuOpen(true)}>☰</button>
        </div>
      </nav>
    </>
  );
}
