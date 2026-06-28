"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error("Top Picks error:", error); }, [error]);
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 500, textAlign: "center" }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Top Picks Error</h2>
        <pre style={{ background: "#1e293b", padding: 16, borderRadius: 8, fontSize: 12, textAlign: "left", overflow: "auto", maxHeight: 300, color: "#f87171" }}>{error.message}{"\n\n"}{error.stack}</pre>
        <button onClick={reset} style={{ marginTop: 16, padding: "10px 24px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Try again</button>
      </div>
    </div>
  );
}
