"use client";
import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("vessel-theme") || "dark";
    setTheme(saved as "dark"|"light");
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("vessel-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next !== "light");
  };

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 9999,
        width: 44, height: 44, borderRadius: "50%",
        background: theme === "dark" ? "#1e293b" : "#fff",
        border: `1px solid ${theme === "dark" ? "#334155" : "#e2e8f0"}`,
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, color: theme === "dark" ? "#fbbf24" : "#1e293b",
      }}
    >
      {theme === "dark" ? "\u2600\uFE0F" : "\u{1F319}"}
    </button>
  );
}
