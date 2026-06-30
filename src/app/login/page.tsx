"use client";

import { useState } from "react";
import { Anchor, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (data.ok) {
        window.location.href = "/";
      } else {
        setError("Invalid username or password");
        setLoading(false);
      }
    } catch {
      setError("Connection error");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0d14",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      {/* Background gradient */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: "radial-gradient(900px 500px at 50% 30%, rgba(56,189,248,0.08), transparent 60%), radial-gradient(600px 400px at 30% 70%, rgba(99,102,241,0.06), transparent 60%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "48px 40px",
        maxWidth: 400,
        width: "100%",
        backdropFilter: "blur(12px)",
        boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #2563eb, #38bdf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(37,99,235,0.4)",
          }}>
            <Anchor style={{ width: 32, height: 32, color: "#fff" }} />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: 0,
            background: "linear-gradient(180deg, #fff, #94a3b8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Vessel Database
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", marginTop: 6 }}>
            Global Ship Intelligence — Restricted Access
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "10px 14px", marginBottom: 16,
            fontSize: 13, color: "#fca5a5",
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label style={{
            display: "block", fontSize: 12, fontWeight: 650, color: "#94a3b8",
            marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Username
          </label>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Anchor style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, color: "#64748b",
            }} />
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
              autoComplete="off"
              style={{
                width: "100%", padding: "14px 16px 14px 42px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, background: "rgba(255,255,255,0.04)",
                color: "#fff", fontSize: 15, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>
          <label style={{
            display: "block", fontSize: 12, fontWeight: 650, color: "#94a3b8",
            marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            Password
          </label>
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Lock style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 16, height: 16, color: "#64748b",
            }} />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              style={{
                width: "100%", padding: "14px 44px 14px 42px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12, background: "rgba(255,255,255,0.04)",
                color: "#fff", fontSize: 15, outline: "none",
                fontFamily: "inherit",
              }}
              onFocus={e => e.target.style.borderColor = "#38bdf8"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4,
              }}
            >
              {showPw ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", border: 0, padding: "14px 20px",
              borderRadius: 12, fontFamily: "inherit", fontWeight: 680, fontSize: 15,
              cursor: loading ? "wait" : "pointer", color: "#fff",
              background: "linear-gradient(135deg, #2563eb, #38bdf8)",
              boxShadow: "0 8px 26px rgba(37,99,235,0.4)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading && <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />}
            {loading ? "Authenticating..." : "Access Database"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#475569" }}>
          Authorized personnel only. Contact <a href="mailto:hallo@gemivo.de" style={{ color: "#38bdf8" }}>hallo@gemivo.de</a> for access.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
