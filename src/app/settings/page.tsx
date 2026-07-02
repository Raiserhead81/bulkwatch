"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, ChevronUp, ChevronDown, Settings, KeyRound, LayoutList } from "lucide-react";

const DEFAULT_NAV: [string, string, string][] = [
  ["Ships", "/", "⚓"],
  ["Map", "/karte", "🗺️"],
  ["Top Picks", "/top-picks", "🏆"],
  ["Compare", "/vergleich", "⚖️"],
  ["Watchlist", "/watchlist", "⭐"],
  ["Newbuilds", "/newbuilds", "🚢"],
  ["Voyage Calc", "/voyage-calc", "🧮"],
  ["Valuation", "/valuation", "💰"],
  ["OPEX Calc", "/opex-calc", "⚙️"],
  ["AI Chat", "/chat", "🤖"],
];

export default function SettingsPage() {
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  // Password change state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // Nav order state
  const [navItems, setNavItems] = useState<[string, string, string][]>(DEFAULT_NAV);
  const [navMsg, setNavMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});

    const saved = localStorage.getItem("nav-order");
    if (saved) {
      try {
        const order: string[] = JSON.parse(saved);
        const reordered = order
          .map(href => DEFAULT_NAV.find(n => n[1] === href))
          .filter(Boolean) as [string, string, string][];
        // Append any items not in saved order (new items added later)
        const missing = DEFAULT_NAV.filter(n => !order.includes(n[1]));
        setNavItems([...reordered, ...missing]);
      } catch {}
    }
  }, []);

  const inp = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500";

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (newPw !== confirmPw) {
      setPwMsg({ msg: "New passwords do not match", ok: false });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ msg: "Password must be at least 6 characters", ok: false });
      return;
    }
    if (!currentUser) {
      setPwMsg({ msg: "Not logged in", ok: false });
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser.username, password: newPw }),
      });
      const data = await res.json();
      if (data.ok) {
        setPwMsg({ msg: "Password updated successfully", ok: true });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setPwMsg({ msg: data.error || "Failed to update password", ok: false });
      }
    } catch {
      setPwMsg({ msg: "Network error", ok: false });
    } finally {
      setPwLoading(false);
    }
  }

  function moveItem(index: number, direction: "up" | "down") {
    const next = [...navItems];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setNavItems(next);
    localStorage.setItem("nav-order", JSON.stringify(next.map(n => n[1])));
    setNavMsg("");
    setTimeout(() => setNavMsg(null), 2000);
  }

  function resetNavOrder() {
    setNavItems(DEFAULT_NAV);
    localStorage.removeItem("nav-order");
    setNavMsg("Reset to default");
    setTimeout(() => setNavMsg(null), 2000);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-blue-500/10 bg-background/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-400 hover:text-blue-400">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-400" /> Settings
          </h1>
          <span className="text-xs text-slate-500">{currentUser?.username || ""}</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {/* Section 1: Change Password */}
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-5 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" /> Change Password
          </h2>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            {/* Current password */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Current Password</label>
              <div className="relative">
                <input
                  className={inp + " pr-10"}
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">New Password</label>
              <div className="relative">
                <input
                  className={inp + " pr-10"}
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm new password */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  className={inp + " pr-10"}
                  type={showConfirm ? "text" : "password"}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {pwMsg && (
              <p className={`text-sm ${pwMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{pwMsg.msg}</p>
            )}

            <button
              type="submit"
              disabled={pwLoading || !newPw || !confirmPw}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold px-5 py-2 rounded-lg text-sm"
            >
              {pwLoading ? "Saving…" : "Save Password"}
            </button>
          </form>
        </div>

        {/* Section 2: Navigation Order */}
        <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <LayoutList className="h-4 w-4 text-blue-400" /> Navigation Order
            </h2>
            <button
              onClick={resetNavOrder}
              className="text-xs text-slate-400 hover:text-slate-200 border border-slate-600 px-3 py-1 rounded-lg"
            >
              Reset to Default
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">Use the arrows to reorder nav items. Changes apply on next page load.</p>
          <div className="space-y-2">
            {navItems.map(([label, href, icon], idx) => (
              <div
                key={href}
                className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/60 rounded-xl px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-7 text-center">{icon}</span>
                  <span className="text-sm font-medium text-slate-200">{label}</span>
                  <span className="text-xs text-slate-500 hidden sm:inline">{href}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveItem(idx, "up")}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveItem(idx, "down")}
                    disabled={idx === navItems.length - 1}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {navMsg && (
            <p className="text-xs text-emerald-400 mt-3">{navMsg}</p>
          )}
        </div>

      </div>
    </div>
  );
}
