"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ── Types ── */
interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ── Nav Links ── */
const NAV_LINKS: [string, string, string][] = [
  ["Ships", "Schiffe", "/"],
  ["Map", "Karte", "/karte"],
  ["Newbuilds", "Neubauten", "/newbuilds"],
  ["Voyage Calc", "Voyage Calc", "/voyage-calc"],
  ["AI Chat", "AI Chat", "/chat"],
];

/* ── Suggestions ── */
const SUGGESTIONS_EN = [
  { icon: "📊", label: "Market Intelligence", prompt: "Analyze the current dry bulk market: BDI trend, Capesize vs Panamax rates, fleet utilization, and your 3-month outlook. Include specific $/day TCE rates." },
  { icon: "🚢", label: "Live Ship Tracker", prompt: "Which ships are currently near the Suez Canal, Strait of Malacca, and Singapore? Show their names, types, DWT and likely cargo." },
  { icon: "💰", label: "Best Buys Now", prompt: "Find the top 10 undervalued ships right now: young age, large DWT, low price per DWT. Show estimated value, age, type and why each is a good buy." },
  { icon: "🌍", label: "Voyage Economics", prompt: "Compare the economics of shipping iron ore from Port Hedland to Qingdao with a Capesize vs Kamsarmax. Include fuel cost, canal fees, TCE, and break-even freight rate." },
  { icon: "⚓", label: "Fleet Analysis", prompt: "Rank the top 10 operators by total fleet value. For each show: number of ships, total DWT, average age, most common type, and estimated fleet value." },
  { icon: "🏗️", label: "Orderbook", prompt: "Show the complete newbuilding orderbook: how many ships are under construction by type? Which yards are building them? When are they delivering? What is the total orderbook value?" },
];

const SUGGESTIONS_DE = [
  { icon: "📊", label: "Markt-Intelligence", prompt: "Analysiere den aktuellen Dry-Bulk-Markt: BDI-Trend, Capesize vs Panamax Raten, Flottenauslastung und deine 3-Monats-Prognose. Mit konkreten $/Tag TCE-Raten." },
  { icon: "🚢", label: "Live Schiffstracker", prompt: "Welche Schiffe befinden sich gerade in der Nähe des Suezkanals, der Straße von Malakka und Singapur? Zeige Namen, Typen, DWT und vermutliche Ladung." },
  { icon: "💰", label: "Top Investments", prompt: "Finde die 10 am meisten unterbewerteten Schiffe: junges Alter, hohe DWT, niedriger Preis pro DWT. Zeige geschätzten Wert, Alter, Typ und warum jedes ein guter Kauf ist." },
  { icon: "🌍", label: "Voyage-Ökonomie", prompt: "Vergleiche die Wirtschaftlichkeit von Eisenerztransport von Port Hedland nach Qingdao mit Capesize vs Kamsarmax. Inklusive Treibstoffkosten, Kanalgebühren, TCE und Break-Even Frachtrate." },
  { icon: "⚓", label: "Flottenanalyse", prompt: "Ranke die Top 10 Operatoren nach Gesamtflottenwert. Pro Operator zeige: Anzahl Schiffe, Gesamt-DWT, Durchschnittsalter, häufigster Typ und geschätzter Flottenwert." },
  { icon: "🏗️", label: "Orderbuch", prompt: "Zeige das komplette Neubau-Orderbuch: Wie viele Schiffe sind nach Typ im Bau? Welche Werften bauen sie? Wann werden sie geliefert? Was ist der Gesamtwert des Orderbuchs?" },
];

/* ── Chart colors ── */
const CHART_COLORS = ["#38bdf8", "#818cf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

/* ── Markdown renderer ── */
function renderMarkdown(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="vdb-codeblock"><code>${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="vdb-inline-code">$1</code>');

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="vdb-h4">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="vdb-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="vdb-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="vdb-h1">$1</h1>');

  // Bold (cyan)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="vdb-bold">$1</strong>');

  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Tables
  html = html.replace(/((?:\|.+\|\n?)+)/g, (_match, tableBlock: string) => {
    const lines = tableBlock.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) return tableBlock;
    // Check for separator line
    const sepIdx = lines.findIndex(l => /^\|[\s\-:|]+\|$/.test(l.trim()));
    const headerLine = sepIdx > 0 ? lines[0] : null;
    const dataStart = sepIdx >= 0 ? sepIdx + 1 : 0;
    const dataLines = lines.slice(dataStart);

    let t = '<div style="overflow-x:auto;margin:8px 0;border-radius:8px;border:1px solid #1e3a5f"><table class="vdb-table">';
    if (headerLine) {
      const cells = headerLine.split("|").filter(c => c.trim());
      t += "<thead><tr>" + cells.map(c => `<th>${c.trim()}</th>`).join("") + "</tr></thead>";
    }
    t += "<tbody>";
    dataLines.forEach((line, i) => {
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) return;
      const cells = line.split("|").filter(c => c.trim());
      const cls = i % 2 === 0 ? "vdb-row-even" : "vdb-row-odd";
      t += `<tr class="${cls}">` + cells.map(c => `<td>${c.trim()}</td>`).join("") + "</tr>";
    });
    t += "</tbody></table></div>";
    return t;
  });

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="vdb-li">$1</li>');
  html = html.replace(/(<li class="vdb-li">.*<\/li>\n?)+/g, (m) => `<ul class="vdb-ul">${m}</ul>`);

  // Numbered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="vdb-li">$1</li>');

  // IMO links
  html = html.replace(/IMO[:\s]*([0-9]{7})/gi,
    '<a href="/schiff/$1" class="vdb-imo-link">IMO $1</a>'
  );

  // Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

/* ── Extract chart data from raw markdown ── */
function extractChartData(text: string): { label: string; value: number }[] | null {
  const lines = text.split("\n");
  const tableLines = lines.filter(l => l.trim().startsWith("|") && l.trim().endsWith("|"));
  if (tableLines.length < 3) return null; // header + sep + at least 1 data row

  // Find separator
  const sepIdx = tableLines.findIndex(l => /^\|[\s\-:|]+\|$/.test(l.trim()));
  if (sepIdx < 1) return null;

  const dataLines = tableLines.slice(sepIdx + 1);
  const results: { label: string; value: number }[] = [];

  for (const line of dataLines) {
    const cells = line.split("|").filter(c => c.trim());
    if (cells.length < 2) continue;
    // Smart label: if first cell is just a number (rank), use second cell as label
    let label = cells[0].trim().replace(/\*\*/g, "").replace(/<[^>]+>/g, "").replace(/[🟢🟡🔴🚢⚓]/g, "").trim();
    let dataStartIdx = 1;
    if (/^\d+$/.test(label) && cells.length >= 3) {
      // First cell is rank number — use second cell as label
      label = cells[1].trim().replace(/\*\*/g, "").replace(/<[^>]+>/g, "").replace(/[🟢🟡🔴🚢⚓]/g, "").trim();
      dataStartIdx = 2;
    }
    label = label.substring(0, 30);
    // Find the LARGEST numeric value in remaining cells
    let bestVal = 0;
    for (let i = dataStartIdx; i < cells.length; i++) {
      const numMatch = cells[i].replace(/[$,%€B]/g, "").replace(/,/g, "").match(/([\d.]+)/);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        if (val > bestVal && isFinite(val)) {
          bestVal = val;
        }
      }
    }
    if (results.length >= 12) break;
  }

  return results.length >= 2 ? results : null;
}

/* ── Component ── */
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"en" | "de">("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    if (!text) setInput("");

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    // Add empty assistant message for streaming
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages([...newMessages, { role: "assistant", content: `Error: ${err.error || res.statusText}` }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages([...newMessages, { role: "assistant", content: "Error: No response stream" }]);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              chunkCount++;
              if (chunkCount % 3 === 0) {
                setMessages([...newMessages, { role: "assistant", content: accumulated }]);
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (true) {
        setMessages([...newMessages, { role: "assistant", content: accumulated || "No response received." }]);
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const suggestions = lang === "de" ? SUGGESTIONS_DE : SUGGESTIONS_EN;
  const hasMessages = messages.length > 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* ── Reset ── */
        .vdb-root * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Layout ── */
        .vdb-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #0a0d14;
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 15px;
          line-height: 1.6;
        }

        /* ── Header ── */
        .vdb-header {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 56px;
          background: #0f1219;
          border-bottom: 1px solid #1e293b;
        }
        .vdb-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 700;
          color: #38bdf8;
          text-decoration: none;
        }
        .vdb-logo span { font-size: 22px; }
        .vdb-nav { display: flex; gap: 6px; }
        .vdb-nav a {
          color: #94a3b8;
          text-decoration: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
        }
        .vdb-nav a:hover { color: #e2e8f0; background: #1e293b; }
        .vdb-nav a.active { color: #38bdf8; background: #172033; }
        .vdb-header-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .vdb-lang-toggle {
          background: #1e293b;
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }
        .vdb-lang-toggle:hover { color: #e2e8f0; border-color: #38bdf8; }

        /* ── Hamburger ── */
        .vdb-hamburger {
          display: none;
          background: none;
          border: none;
          color: #94a3b8;
          font-size: 26px;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }
        .vdb-hamburger:hover { color: #e2e8f0; }

        /* ── Mobile menu overlay ── */
        .vdb-mobile-menu {
          display: none;
          position: fixed;
          top: 56px;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 99;
          background: rgba(10, 13, 20, 0.95);
          flex-direction: column;
          padding: 20px;
        }
        .vdb-mobile-menu.open { display: flex; }
        .vdb-mobile-menu a {
          display: block;
          color: #e2e8f0;
          text-decoration: none;
          padding: 14px 16px;
          font-size: 18px;
          border-bottom: 1px solid #1e293b;
        }
        .vdb-mobile-menu a:hover { background: #1e293b; }
        .vdb-mobile-menu a.active { color: #38bdf8; }

        /* ── Messages area ── */
        .vdb-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .vdb-messages-inner {
          max-width: 95%;
          margin: 0 auto;
        }

        /* ── Message bubbles ── */
        .vdb-msg {
          margin-bottom: 16px;
          display: flex;
        }
        .vdb-msg-user { justify-content: flex-end; }
        .vdb-msg-ai { justify-content: flex-start; }
        .vdb-msg-bubble {
          max-width: 90%;
          padding: 12px 16px;
          border-radius: 12px;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .vdb-msg-user .vdb-msg-bubble {
          background: #1d4ed8;
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .vdb-msg-ai .vdb-msg-bubble {
          background: #1e293b;
          border: 1px solid #1e3a5f;
          border-bottom-left-radius: 4px;
        }

        /* ── Typing indicator ── */
        .vdb-typing {
          display: inline-block;
          font-size: 24px;
          letter-spacing: 3px;
          color: #64748b;
        }
        @keyframes vdb-blink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .vdb-typing span:nth-child(1) { animation: vdb-blink 1.4s infinite 0s; }
        .vdb-typing span:nth-child(2) { animation: vdb-blink 1.4s infinite 0.2s; }
        .vdb-typing span:nth-child(3) { animation: vdb-blink 1.4s infinite 0.4s; }

        /* ── Markdown styles ── */
        .vdb-bold { color: #38bdf8; }
        .vdb-h1, .vdb-h2, .vdb-h3, .vdb-h4 { color: #38bdf8; margin: 12px 0 6px; font-weight: 700; }
        .vdb-h1 { font-size: 22px; }
        .vdb-h2 { font-size: 19px; }
        .vdb-h3 { font-size: 17px; }
        .vdb-h4 { font-size: 15px; }
        .vdb-ul { padding-left: 20px; margin: 6px 0; }
        .vdb-li { margin: 3px 0; }
        .vdb-inline-code {
          background: #0f172a;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: "SF Mono", "Fira Code", monospace;
          font-size: 13px;
          color: #34d399;
        }
        .vdb-codeblock {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 12px;
          overflow-x: auto;
          margin: 8px 0;
          font-family: "SF Mono", "Fira Code", monospace;
          font-size: 13px;
          color: #e2e8f0;
        }
        .vdb-table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 13px;
        }
        .vdb-table th {
          background: #172033;
          color: #38bdf8;
          padding: 8px 10px;
          text-align: left;
          border-bottom: 2px solid #1e3a5f;
          font-weight: 600;
          white-space: nowrap;
        }
        .vdb-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #1e293b;
          white-space: nowrap;
        }
        .vdb-row-even { background: #0f1219; }
        .vdb-row-odd { background: #131825; }
        .vdb-imo-link {
          color: #38bdf8;
          text-decoration: underline;
          cursor: pointer;
        }
        .vdb-imo-link:hover { color: #7dd3fc; }

        /* ── Chart ── */
        .vdb-chart {
          margin: 12px 0;
          padding: 12px;
          background: #0f1219;
          border: 1px solid #1e293b;
          border-radius: 8px;
        }
        .vdb-chart-title {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .vdb-chart-row {
          display: flex;
          align-items: center;
          margin-bottom: 6px;
          gap: 8px;
        }
        .vdb-chart-label {
          width: 120px;
          font-size: 12px;
          color: #94a3b8;
          text-align: right;
          flex-shrink: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vdb-chart-bar-bg {
          flex: 1;
          height: 22px;
          background: #1e293b;
          border-radius: 4px;
          overflow: hidden;
        }
        .vdb-chart-bar {
          height: 100%;
          border-radius: 4px;
          display: flex;
          align-items: center;
          padding-left: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
        }

        /* ── Welcome ── */
        .vdb-welcome {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          overflow-y: auto;
        }
        .vdb-welcome-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        .vdb-welcome-title {
          font-size: 28px;
          font-weight: 700;
          color: #38bdf8;
          margin-bottom: 8px;
        }
        .vdb-welcome-sub {
          color: #64748b;
          margin-bottom: 32px;
          font-size: 15px;
        }
        .vdb-suggestions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          max-width: 95%;
          width: 100%;
        }
        .vdb-sug-card {
          background: #0f1219;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 16px;
          cursor: pointer;
          text-align: center;
        }
        .vdb-sug-card:hover {
          border-color: #38bdf8;
          background: #131825;
        }
        .vdb-sug-icon { font-size: 28px; margin-bottom: 6px; }
        .vdb-sug-label { font-size: 13px; font-weight: 600; color: #e2e8f0; }

        /* ── Input area ── */
        .vdb-input-area {
          position: sticky;
          bottom: 0;
          background: #0a0d14;
          border-top: 1px solid #1e293b;
          padding: 12px 20px;
        }
        .vdb-input-inner {
          max-width: 95%;
          margin: 0 auto;
        }
        .vdb-input-row {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .vdb-textarea {
          flex: 1;
          background: #0f1219;
          border: 1px solid #334155;
          border-radius: 10px;
          color: #e2e8f0;
          padding: 10px 14px;
          font-size: 15px;
          font-family: inherit;
          resize: none;
          outline: none;
          line-height: 1.5;
          min-height: 42px;
          max-height: 120px;
        }
        .vdb-textarea:focus { border-color: #38bdf8; }
        .vdb-textarea::placeholder { color: #475569; }
        .vdb-send-btn {
          background: #1d4ed8;
          border: none;
          color: #fff;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .vdb-send-btn:hover { background: #2563eb; }
        .vdb-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Stats line ── */
        .vdb-stats {
          text-align: center;
          font-size: 12px;
          color: #475569;
          margin-top: 8px;
        }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .vdb-nav { display: none; }
          .vdb-hamburger { display: block; }
          .vdb-suggestions { grid-template-columns: repeat(2, 1fr); }
          .vdb-welcome-title { font-size: 22px; }
          .vdb-welcome-icon { font-size: 48px; }
          .vdb-msg-bubble { max-width: 92%; }
          .vdb-chart-label { width: 80px; font-size: 11px; }
          .vdb-header { padding: 0 12px; }
          .vdb-messages { padding: 12px; }
          .vdb-input-area { padding: 10px 12px; }
        }
        @media (max-width: 480px) {
          .vdb-suggestions { grid-template-columns: 1fr; }
        }
      `}} />

      <div className="vdb-root">
        {/* ── Header ── */}
        <header className="vdb-header">
          <a href="/" className="vdb-logo">
            <span>⚓</span> Vessel AI
          </a>
          <nav className="vdb-nav">
            {NAV_LINKS.map(([en, de, href]) => (
              <a
                key={href}
                href={href}
                className={href === "/chat" ? "active" : ""}
              >
                {lang === "de" ? de : en}
              </a>
            ))}
          </nav>
          <div className="vdb-header-right">
            <button
              className="vdb-lang-toggle"
              onClick={() => setLang(l => l === "en" ? "de" : "en")}
            >
              {lang === "en" ? "DE" : "EN"}
            </button>
            <button
              className="vdb-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Menu"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </header>

        {/* ── Mobile Menu ── */}
        <div className={`vdb-mobile-menu${menuOpen ? " open" : ""}`}>
          {NAV_LINKS.map(([en, de, href]) => (
            <a
              key={href}
              href={href}
              className={href === "/chat" ? "active" : ""}
              onClick={() => setMenuOpen(false)}
            >
              {lang === "de" ? de : en}
            </a>
          ))}
        </div>

        {/* ── Welcome or Messages ── */}
        {!hasMessages ? (
          <div className="vdb-welcome">
            <div className="vdb-welcome-icon">⚓</div>
            <div className="vdb-welcome-title">Maritime AI AI</div>
            <div className="vdb-welcome-sub">
              {lang === "de"
                ? "Fragen Sie nach Schiffen, Märkten, Routen und Investments"
                : "Ask about ships, markets, routes and investments"}
            </div>
            <div className="vdb-suggestions">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="vdb-sug-card"
                  onClick={() => sendMessage(s.prompt)}
                >
                  <div className="vdb-sug-icon">{s.icon}</div>
                  <div className="vdb-sug-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="vdb-messages">
            <div className="vdb-messages-inner">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isLastAi = !isUser && i === messages.length - 1;
                const showTyping = isLastAi && loading && !msg.content;

                return (
                  <div key={i}>
                    <div className={`vdb-msg ${isUser ? "vdb-msg-user" : "vdb-msg-ai"}`}>
                      <div className="vdb-msg-bubble">
                        {showTyping ? (
                          <div className="vdb-typing">
                            <span>.</span><span>.</span><span>.</span>
                          </div>
                        ) : isUser ? (
                          msg.content
                        ) : (
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        )}
                      </div>
                    </div>
                    {/* Auto-chart after AI messages */}
                    {!isUser && msg.content && (() => {
                      const chartData = (!loading || i !== messages.length - 1) ? extractChartData(msg.content) : null;
                      if (!chartData) return null;
                      const maxVal = Math.max(...chartData.map(d => d.value));
                      return (
                        <div className="vdb-chart">
                          <div className="vdb-chart-title">
                            {lang === "de" ? "Automatische Visualisierung" : "Auto Visualization"}
                          </div>
                          {chartData.map((d, ci) => (
                            <div key={ci} className="vdb-chart-row">
                              <div className="vdb-chart-label">{d.label}</div>
                              <div className="vdb-chart-bar-bg">
                                <div
                                  className="vdb-chart-bar"
                                  style={{
                                    width: `${Math.max((d.value / maxVal) * 100, 8)}%`,
                                    background: `linear-gradient(90deg, ${CHART_COLORS[ci % CHART_COLORS.length]}, ${CHART_COLORS[ci % CHART_COLORS.length]}88)`,
                                  }}
                                >
                                  {d.value.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* ── Input ── */}
        <div className="vdb-input-area">
          <div className="vdb-input-inner">
            <div className="vdb-input-row">
              <textarea
                ref={textareaRef}
                className="vdb-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={lang === "de"
                  ? "Fragen Sie nach Schiffen, Routen, Märkten..."
                  : "Ask about ships, routes, markets..."}
                rows={1}
                disabled={loading}
              />
              <button
                className="vdb-send-btn"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >
                ➤
              </button>
            </div>
            <div className="vdb-stats">
              10,000+ ships &middot; BDI 2,524 &middot; Powered by GLM-4
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
