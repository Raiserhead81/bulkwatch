"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const NAV_LINKS: [string, string][] = [
  ["Ships", "/"], ["Map", "/karte"], ["Live", "/live"],
  ["Top Picks", "/top-picks"], ["Compare", "/vergleich"],
  ["Newbuilds", "/newbuilds"], ["Voyage Calc", "/voyage-calc"],
  ["AI Chat", "/chat"]
];

const SUGGESTIONS_DE = [
  { icon: "\u{1F4CA}", label: "Markt-Intelligence", prompt: "Analysiere den aktuellen Dry-Bulk-Markt: BDI-Trend, Capesize vs Panamax Raten, Flottenauslastung und deine 3-Monats-Prognose. Mit konkreten $/Tag TCE-Raten." },
  { icon: "\u{1F6A2}", label: "Live Schiffstracker", prompt: "Welche Schiffe befinden sich gerade in der N\u00e4he des Suezkanals, der Stra\u00dfe von Malakka und Singapur? Zeige Namen, Typen, DWT und vermutliche Ladung." },
  { icon: "\u{1F4B0}", label: "Top Investments", prompt: "Finde die 10 am meisten unterbewerteten Schiffe: junges Alter, hohe DWT, niedriger Preis pro DWT. Zeige gesch\u00e4tzten Wert, Alter, Typ und warum jedes ein guter Kauf ist." },
  { icon: "\u{1F30D}", label: "Voyage-\u00d6konomie", prompt: "Vergleiche die Wirtschaftlichkeit von Eisenerztransport von Port Hedland nach Qingdao mit Capesize vs Kamsarmax. Inklusive Treibstoffkosten, Kanalgeb\u00fchren, TCE und Break-Even Frachtrate." },
  { icon: "\u2693", label: "Flottenanalyse", prompt: "Ranke die Top 10 Operatoren nach Gesamtflottenwert. Pro Operator zeige: Anzahl Schiffe, Gesamt-DWT, Durchschnittsalter, h\u00e4ufigster Typ und gesch\u00e4tzter Flottenwert." },
  { icon: "\u{1F3D7}\uFE0F", label: "Orderbuch", prompt: "Zeige das komplette Neubau-Orderbuch: Wie viele Schiffe sind nach Typ im Bau? Welche Werften bauen sie? Wann werden sie geliefert? Was ist der Gesamtwert des Orderbuchs?" },
];

const SUGGESTIONS_EN = [
  { icon: "\u{1F4CA}", label: "Market Intelligence", prompt: "Analyze the current dry bulk market: BDI trend, Capesize vs Panamax rates, fleet utilization, and your 3-month outlook. Include specific $/day TCE rates." },
  { icon: "\u{1F6A2}", label: "Live Ship Tracker", prompt: "Which ships are currently near the Suez Canal, Strait of Malacca, and Singapore? Show their names, types, DWT and likely cargo." },
  { icon: "\u{1F4B0}", label: "Best Buys Now", prompt: "Find the top 10 undervalued ships right now: young age, large DWT, low price per DWT. Show estimated value, age, type and why each is a good buy." },
  { icon: "\u{1F30D}", label: "Voyage Economics", prompt: "Compare the economics of shipping iron ore from Port Hedland to Qingdao with a Capesize vs Kamsarmax. Include fuel cost, canal fees, TCE, and break-even freight rate." },
  { icon: "\u2693", label: "Fleet Analysis", prompt: "Rank the top 10 operators by total fleet value. For each show: number of ships, total DWT, average age, most common type, and estimated fleet value." },
  { icon: "\u{1F3D7}\uFE0F", label: "Orderbook", prompt: "Show the complete newbuilding orderbook: how many ships are under construction by type? Which yards are building them? When are they delivering? What is the total orderbook value?" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LiveStats {
  ships: number;
  bdi: number;
  aisLive: number;
}

// Convert IMO numbers and ship names to clickable links
function linkifyContent(text: string): string {
  // Link ship names followed by IMO reference: "SHIP NAME (IMO 1234567)" or "SHIP NAME, IMO 1234567"
  text = text.replace(/\*\*([A-Z][A-Z0-9\s\.\-]{2,30})\*\*\s*[\(\[,\s]*IMO[:\s]*([0-9]{7})/gi,
    '<a href="/schiff/$2" class="vdb-ship-link"><strong>$1</strong></a> <a href="/schiff/$2" class="vdb-imo-link">IMO $2</a>');
  // Link IMO numbers: IMO 1234567 or IMO: 1234567
  text = text.replace(/(?<!href="[^"]*?)IMO[:\s]*([0-9]{7})(?![^<]*<\/a>)/gi,
    '<a href="/schiff/$1" class="vdb-imo-link">IMO $1</a>');
  // Link standalone 7-digit numbers in tables that look like IMOs
  text = text.replace(/\|\s*([0-9]{7})\s*\|/g,
    (m, imo) => `| <a href="/schiff/${imo}" class="vdb-imo-link">${imo}</a> |`);
  return text;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"de"|"en">("en");
  const [stats, setStats] = useState<LiveStats>({ ships: 0, bdi: 0, aisLive: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const SUGGESTIONS = lang === "de" ? SUGGESTIONS_DE : SUGGESTIONS_EN;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch live stats on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/ships/stats").then(r => r.json()).catch(() => ({ total: 0 })),
      fetch("/api/ais/stats").then(r => r.json()).catch(() => ({ activeShips: 0 })),
    ]).then(([shipStats, aisStats]) => {
      setStats({
        ships: shipStats.total || 0,
        bdi: 2524,
        aisLive: aisStats.activeShips || 0,
      });
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages(prev => [...prev, { role: "assistant", content: "Error: " + (err.error || "Something went wrong") }]);
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setLoading(false); return; }

      const decoder = new TextDecoder();
      let assistantContent = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error: " + e.message }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, messages, loading]);

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Markdown-to-html with premium styling

  function renderAutoChart(html: string): string {
    const tableRegex = /<table class="vdb-table">([\s\S]*?)<\/table>/g;
    let result = html;
    let chartHtml = "";
    let m;

    while ((m = tableRegex.exec(html)) !== null) {
      const tbl = m[1];
      const rows = tbl.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
      if (!rows || rows.length < 3) continue;

      // Get headers
      const hCells = rows[0].match(/<th[^>]*>([\s\S]*?)<\/th>/g);
      if (!hCells) continue;
      const headers = hCells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());

      // Get data rows
      const data: { label: string; val: number }[] = [];
      for (let i = 1; i < rows.length && i < 15; i++) {
        const cells = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/g);
        if (!cells || cells.length < 2) continue;
        const texts = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
        const label = texts[0].substring(0, 22);
        // Find first numeric value
        let val = 0;
        for (let j = 1; j < texts.length; j++) {
          const n = parseFloat(texts[j].replace(/[^0-9.-]/g, ""));
          if (!isNaN(n) && n > 0) { val = n; break; }
        }
        if (val > 0) data.push({ label, val });
      }

      if (data.length < 2) continue;

      const maxVal = Math.max(...data.map(d => d.val));
      const h = data.length * 34 + 20;
      const colors = ["#38bdf8","#818cf8","#34d399","#fbbf24","#f87171","#a78bfa","#fb923c","#22d3ee","#e879f9","#84cc16"];

      let bars = "";
      data.forEach((d, i) => {
        const w = Math.max((d.val / maxVal) * 320, 4);
        const y = i * 34 + 16;
        const col = colors[i % colors.length];
        const fv = d.val >= 1e6 ? "$" + (d.val/1e6).toFixed(1) + "M" :
                   d.val >= 1e3 ? "$" + (d.val/1e3).toFixed(0) + "k" :
                   d.val.toLocaleString();
        bars += '<g><text x="0" y="' + (y+4) + '" fill="#94a3b8" font-size="11" font-family="system-ui">' + d.label + '</text>' +
                '<rect x="160" y="' + (y-9) + '" width="' + w + '" height="22" rx="4" fill="' + col + '" opacity="0.85">' +
                '<animate attributeName="width" from="0" to="' + w + '" dur="0.6s" fill="freeze"/></rect>' +
                '<text x="' + (165+w) + '" y="' + (y+4) + '" fill="#e2e8f0" font-size="11" font-weight="700" font-family="system-ui">' + fv + '</text></g>';
      });

      chartHtml += '<div style="margin:12px 0;padding:16px 12px;background:rgba(15,23,42,0.8);border:1px solid #1e3a5f;border-radius:12px;overflow-x:auto">' +
        '<div style="font-size:10px;color:#64748b;font-weight:600;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">\u{1F4CA} Chart</div>' +
        '<svg viewBox="0 0 550 ' + h + '" style="width:100%;height:' + h + 'px">' + bars + '</svg></div>';
    }

    return result + chartHtml;
  }

  function renderMarkdown(text: string) {
    let html = linkifyContent(text);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g,
      '<pre class="vdb-code-block"><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g,
      '<code class="vdb-inline-code">$1</code>');
    // Bold — ship names in cyan
    html = html.replace(/\*\*([^*]+)\*\*/g,
      '<strong class="vdb-bold">$1</strong>');
    // Headers
    html = html.replace(/^### (.+)$/gm,
      '<h3 class="vdb-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm,
      '<h2 class="vdb-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm,
      '<h1 class="vdb-h1">$1</h1>');

    // Tables with alternating rows
    let rowIndex = 0;
    html = html.replace(/^\|(.+)\|\s*$/gm, (match) => {
      const cells = match.split("|").filter(c => c.trim());
      const isHeader = cells.some(c => /^[\s-:]+$/.test(c));
      if (isHeader) return "";
      rowIndex++;
      const isEven = rowIndex % 2 === 0;
      return `<tr class="${isEven ? 'vdb-row-even' : 'vdb-row-odd'}">` + cells.map(c =>
        `<td class="vdb-td">${c.trim()}</td>`
      ).join("") + "</tr>";
    });
    // Wrap consecutive tr elements in table
    html = html.replace(/((?:<tr[^>]*>.*<\/tr>\s*)+)/g,
      '<div class="vdb-table-wrap"><table class="vdb-table">$1</table></div>');
    // First row in each table = header
    html = html.replace(/<table class="vdb-table">\s*<tr[^>]*>(.*?)<\/tr>/g, (m, cells) =>
      m.replace(/<td class="vdb-td"/g, '<th class="vdb-th"').replace(/<\/td>/g, '</th>').replace(/<tr[^>]*>/, '<tr class="vdb-header-row">'));
    // Reset row counter for next table
    rowIndex = 0;

    // Lists
    html = html.replace(/^- (.+)$/gm,
      '<div class="vdb-list-item"><span class="vdb-bullet">&bull;</span><span>$1</span></div>');
    html = html.replace(/^\d+\. (.+)$/gm,
      '<div class="vdb-list-item"><span class="vdb-bullet">&bull;</span><span>$1</span></div>');

    // Paragraphs
    html = html.replace(/\n\n/g, '<div class="vdb-paragraph-break"></div>');
    html = html.replace(/\n/g, '<br>');

    return renderAutoChart(html);
  }

  return (
    <div className="vdb-root">
      <div className="vdb-bg-gradient" />

      {/* Header */}
      <div className="vdb-header">
        <div className="vdb-header-inner">
          <a href="/" className="vdb-logo-link">
            <span className="vdb-logo-anchor">{"\u2693"}</span>
            <span className="vdb-logo-text">Vessel AI</span>
          </a>
          <div className="vdb-nav">
            {NAV_LINKS.map(([l,h]) => (
              <a key={h} href={h} className={`vdb-nav-link ${h === "/chat" ? "vdb-nav-active" : ""}`}>{l}</a>
            ))}
          </div>
          <div className="vdb-lang-toggle">
            <button onClick={() => setLang("de")} className={`vdb-lang-btn ${lang === "de" ? "vdb-lang-active" : ""}`}>DE</button>
            <button onClick={() => setLang("en")} className={`vdb-lang-btn ${lang === "en" ? "vdb-lang-active" : ""}`}>EN</button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="vdb-messages-area" ref={messagesContainerRef}>
        <div className="vdb-messages-inner">
          {messages.length === 0 && (
            <div className="vdb-welcome">
              <div className="vdb-welcome-logo">
                <div className="vdb-welcome-logo-glow" />
                <div className="vdb-welcome-logo-icon">{"\u2693"}</div>
              </div>
              <h1 className="vdb-welcome-title">Vessel Database AI</h1>
              <p className="vdb-welcome-subtitle">
                {lang === "de"
                  ? "Maritime Intelligence auf Knopfdruck. Zugriff auf \u00fcber 10.000 Schiffe, Live-AIS, M\u00e4rkte und Flottendaten."
                  : "Maritime intelligence at your fingertips. Access to 10,000+ vessels, live AIS, markets and fleet analytics."}
              </p>
              <div className="vdb-suggestions-grid">
                {SUGGESTIONS.map(s => (
                  <button key={s.label} onClick={() => sendMessage(s.prompt)} className="vdb-suggestion-card">
                    <span className="vdb-suggestion-icon">{s.icon}</span>
                    <span className="vdb-suggestion-label">{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`vdb-message ${msg.role === "user" ? "vdb-message-user" : "vdb-message-ai"}`}>
              <div className={`vdb-avatar ${msg.role === "user" ? "vdb-avatar-user" : "vdb-avatar-ai"}`}>
                {msg.role === "user" ? "\u{1F464}" : "\u2693"}
              </div>
              <div className="vdb-message-body">
                <div className="vdb-message-sender">
                  {msg.role === "user" ? "You" : "Vessel AI"}
                </div>
                {msg.role === "assistant" ? (
                  <div className="vdb-message-content vdb-ai-content"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content) ||
                        (loading && i === messages.length - 1
                          ? '<span class="vdb-typing-indicator"><span class="vdb-typing-dot"></span><span class="vdb-typing-dot"></span><span class="vdb-typing-dot"></span></span>'
                          : '')
                    }}
                  />
                ) : (
                  <div className="vdb-message-content vdb-user-content">{msg.content}</div>
                )}
                {msg.role === "assistant" && loading && i === messages.length - 1 && msg.content && (
                  <span className="vdb-cursor-blink">|</span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} style={{ height: 20 }} />
        </div>
      </div>

      {/* Input Area */}
      <div className="vdb-input-area">
        <div className="vdb-input-inner">
          {messages.length > 0 && (
            <button onClick={clearChat} className="vdb-clear-btn" title="Clear chat">
              {"\u2715"}
            </button>
          )}
          <div className={`vdb-input-wrap ${inputFocused ? "vdb-input-focused" : ""}`}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={lang === "de" ? "Frag nach Schiffen, Routen, M\u00e4rkten..." : "Ask about ships, routes, markets..."}
              rows={1}
              className="vdb-input"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`vdb-send-btn ${loading || !input.trim() ? "vdb-send-disabled" : ""}`}
            >{loading ? "\u2026" : "\u27A4"}</button>
          </div>
        </div>
        {/* Live Stats Bar */}
        <div className="vdb-stats-bar">
          <span className="vdb-stat">
            <span className="vdb-stat-dot vdb-dot-blue" />
            {stats.ships.toLocaleString()} ships
          </span>
          <span className="vdb-stat-sep">&middot;</span>
          <span className="vdb-stat">
            <span className="vdb-stat-dot vdb-dot-green" />
            BDI {stats.bdi.toLocaleString()}
          </span>
          <span className="vdb-stat-sep">&middot;</span>
          <span className="vdb-stat">
            <span className="vdb-stat-dot vdb-dot-cyan" />
            {stats.aisLive.toLocaleString()} AIS live
          </span>
        </div>
      </div>

      <style>{`
        /* ── Base ── */
        .vdb-root {
          min-height: 100vh; display: flex; flex-direction: column;
          background: #050810; color: #e2e8f0;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          position: relative; overflow: hidden;
        }

        /* ── Animated Background ── */
        .vdb-bg-gradient {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14, 50, 100, 0.35), transparent),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(6, 40, 80, 0.25), transparent),
            radial-gradient(ellipse 50% 50% at 20% 80%, rgba(10, 60, 90, 0.15), transparent);
          animation: bgPulse 8s ease-in-out infinite alternate;
        }
        @keyframes bgPulse {
          0% { opacity: 0.7; transform: scale(1); }
          100% { opacity: 1; transform: scale(1.05); }
        }

        /* ── Scanline overlay ── */
        .vdb-root::before {
          content: ''; position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0, 180, 255, 0.015) 2px, rgba(0, 180, 255, 0.015) 4px
          );
        }

        /* ── Header ── */
        .vdb-header {
          background: rgba(10, 15, 25, 0.85); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(56, 189, 248, 0.15);
          padding: 10px 16px; flex-shrink: 0; position: relative; z-index: 10;
        }
        .vdb-header-inner {
          max-width: 960px; margin: 0 auto;
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
        }
        .vdb-logo-link {
          display: flex; align-items: center; gap: 8px; text-decoration: none;
        }
        .vdb-logo-anchor {
          font-size: 22px;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.6));
          animation: anchorGlow 3s ease-in-out infinite;
        }
        @keyframes anchorGlow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(56, 189, 248, 0.8)) drop-shadow(0 0 30px rgba(37, 99, 235, 0.3)); }
        }
        .vdb-logo-text {
          font-weight: 800; font-size: 16px; color: #38bdf8;
          letter-spacing: -0.5px;
        }
        .vdb-nav {
          display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end;
        }
        .vdb-nav-link {
          padding: 4px 10px; border-radius: 6px; font-size: 12px;
          text-decoration: none; color: #64748b; transition: all 0.2s;
          font-weight: 400;
        }
        .vdb-nav-link:hover { color: #94a3b8; }
        .vdb-nav-active {
          color: #fff !important; background: linear-gradient(135deg, #2563eb, #1d4ed8);
          font-weight: 600; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }
        .vdb-lang-toggle {
          display: flex; border-radius: 8px; overflow: hidden;
          border: 1px solid rgba(56, 189, 248, 0.2);
        }
        .vdb-lang-btn {
          padding: 4px 10px; font-size: 11px; font-weight: 700;
          border: none; cursor: pointer; background: rgba(15, 23, 42, 0.8);
          color: #64748b; transition: all 0.2s;
        }
        .vdb-lang-active {
          background: linear-gradient(135deg, #2563eb, #1d4ed8) !important;
          color: #fff !important;
        }

        /* ── Messages Area ── */
        .vdb-messages-area {
          flex: 1; overflow: auto; padding: 0 16px; position: relative; z-index: 1;
        }
        .vdb-messages-inner { max-width: 960px; margin: 0 auto; }

        /* ── Welcome Screen ── */
        .vdb-welcome { text-align: center; padding-top: 60px; }
        .vdb-welcome-logo {
          position: relative; width: 90px; height: 90px;
          margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;
        }
        .vdb-welcome-logo-glow {
          position: absolute; inset: -10px; border-radius: 24px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          opacity: 0.3; filter: blur(20px);
          animation: logoGlow 4s ease-in-out infinite;
        }
        @keyframes logoGlow {
          0%, 100% { opacity: 0.2; transform: scale(0.95); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .vdb-welcome-logo-icon {
          position: relative; width: 90px; height: 90px; border-radius: 22px;
          background: linear-gradient(135deg, #1e3a5f, #0f172a);
          border: 1px solid rgba(56, 189, 248, 0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 40px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(56, 189, 248, 0.1);
        }
        .vdb-welcome-title {
          font-size: 32px; font-weight: 800; margin: 0 0 10px;
          background: linear-gradient(180deg, #fff 30%, #64748b);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }
        .vdb-welcome-subtitle {
          color: #64748b; font-size: 15px; max-width: 480px;
          margin: 0 auto 40px; line-height: 1.7;
        }

        /* ── Suggestion Cards ── */
        .vdb-suggestions-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; max-width: 640px; margin: 0 auto;
        }
        .vdb-suggestion-card {
          padding: 20px 16px; border-radius: 14px;
          border: 1px solid rgba(56, 189, 248, 0.12);
          background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(10px);
          color: #94a3b8; cursor: pointer; font-size: 13px;
          text-align: left; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          line-height: 1.4; display: flex; flex-direction: column; gap: 6px;
          font-family: inherit; position: relative; overflow: hidden;
        }
        .vdb-suggestion-card::before {
          content: ''; position: absolute; inset: 0; border-radius: 14px;
          background: radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.08), transparent 70%);
          opacity: 0; transition: opacity 0.3s;
        }
        .vdb-suggestion-card:hover {
          border-color: rgba(56, 189, 248, 0.4); color: #e2e8f0;
          transform: translateY(-4px);
          box-shadow: 0 8px 32px rgba(56, 189, 248, 0.15), 0 0 20px rgba(56, 189, 248, 0.08);
        }
        .vdb-suggestion-card:hover::before { opacity: 1; }
        .vdb-suggestion-icon { font-size: 24px; }
        .vdb-suggestion-label { font-weight: 600; font-size: 13px; }

        /* ── Messages ── */
        .vdb-message {
          display: flex; gap: 12px; padding: 20px 0;
          animation: msgSlideIn 0.3s ease-out;
        }
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vdb-message + .vdb-message {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
        }

        .vdb-message-user { flex-direction: row-reverse; }
        .vdb-message-user .vdb-message-body { align-items: flex-end; }
        .vdb-message-user .vdb-message-sender { text-align: right; }

        .vdb-avatar {
          width: 36px; height: 36px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; font-weight: 700;
        }
        .vdb-avatar-user {
          background: linear-gradient(135deg, #2563eb, #3b82f6);
          color: #fff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .vdb-avatar-ai {
          background: linear-gradient(135deg, #0f2847, #1e3a5f);
          border: 1px solid rgba(56, 189, 248, 0.3);
          color: #38bdf8;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          animation: anchorGlow 3s ease-in-out infinite;
        }

        .vdb-message-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .vdb-message-sender {
          font-size: 11px; color: #64748b; margin-bottom: 6px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .vdb-message-content { font-size: 14px; line-height: 1.7; }

        .vdb-user-content {
          background: linear-gradient(135deg, #1e40af, #2563eb);
          padding: 12px 18px; border-radius: 16px 16px 4px 16px;
          display: inline-block; max-width: 80%;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
        }
        .vdb-ai-content { color: #e2e8f0; }

        /* ── Typing indicator ── */
        .vdb-typing-indicator { display: inline-flex; gap: 4px; padding: 8px 0; }
        .vdb-typing-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #38bdf8; animation: typingBounce 1.4s infinite ease-in-out;
        }
        .vdb-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .vdb-typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }

        /* Blinking cursor */
        .vdb-cursor-blink {
          color: #38bdf8; font-weight: 300; font-size: 16px;
          animation: cursorBlink 0.8s step-end infinite;
        }
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        /* ── AI Content Styles ── */
        .vdb-ship-link {
          color: #22d3ee !important; text-decoration: none;
          border-bottom: 1px dotted rgba(34, 211, 238, 0.4);
          transition: all 0.2s;
        }
        .vdb-ship-link:hover {
          color: #67e8f9 !important;
          border-bottom-color: #67e8f9;
          text-shadow: 0 0 8px rgba(34, 211, 238, 0.3);
        }
        .vdb-imo-link {
          color: #38bdf8 !important; text-decoration: none; font-weight: 600;
          border-bottom: 1px dotted rgba(56, 189, 248, 0.4);
          transition: all 0.2s; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px;
        }
        .vdb-imo-link:hover {
          color: #7dd3fc !important;
          text-shadow: 0 0 8px rgba(56, 189, 248, 0.3);
        }
        .vdb-bold { color: #22d3ee; font-weight: 600; }
        .vdb-code-block {
          background: rgba(10, 15, 30, 0.8); padding: 14px 18px;
          border-radius: 10px; overflow-x: auto; font-size: 12px;
          border: 1px solid rgba(56, 189, 248, 0.15); margin: 10px 0;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .vdb-inline-code {
          background: rgba(30, 41, 59, 0.8); padding: 2px 7px;
          border-radius: 5px; font-size: 12px; color: #38bdf8;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .vdb-h1 {
          font-size: 20px; font-weight: 800; color: #38bdf8;
          margin: 18px 0 8px;
        }
        .vdb-h2 {
          font-size: 17px; font-weight: 700; color: #e2e8f0;
          margin: 16px 0 8px; border-bottom: 1px solid rgba(56, 189, 248, 0.15);
          padding-bottom: 6px;
        }
        .vdb-h3 {
          font-size: 15px; font-weight: 700; color: #e2e8f0;
          margin: 14px 0 6px; border-bottom: 1px solid rgba(56, 189, 248, 0.1);
          padding-bottom: 4px;
        }

        /* Tables */
        .vdb-table-wrap {
          overflow-x: auto; margin: 10px 0;
          border: 1px solid rgba(56, 189, 248, 0.15);
          border-radius: 10px;
        }
        .vdb-table { width: 100%; border-collapse: collapse; }
        .vdb-th {
          padding: 10px 14px; background: rgba(15, 23, 42, 0.9);
          font-weight: 600; font-size: 12px; text-align: left;
          color: #94a3b8; border-bottom: 2px solid rgba(56, 189, 248, 0.3);
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .vdb-td {
          padding: 8px 14px; border-bottom: 1px solid rgba(30, 58, 95, 0.5);
          font-size: 13px; white-space: nowrap;
        }
        .vdb-row-even { background: rgba(15, 23, 42, 0.3); }
        .vdb-row-odd { background: rgba(10, 15, 25, 0.3); }
        .vdb-row-even:hover, .vdb-row-odd:hover {
          background: rgba(56, 189, 248, 0.05);
        }

        /* Lists */
        .vdb-list-item { display: flex; gap: 8px; margin: 4px 0; }
        .vdb-bullet { color: #38bdf8; flex-shrink: 0; }
        .vdb-paragraph-break { height: 12px; }

        /* ── Input Area ── */
        .vdb-input-area {
          background: rgba(10, 15, 25, 0.9); backdrop-filter: blur(20px);
          border-top: 1px solid rgba(56, 189, 248, 0.1);
          padding: 12px 16px 8px; flex-shrink: 0; position: relative; z-index: 10;
        }
        .vdb-input-inner {
          max-width: 960px; margin: 0 auto;
          display: flex; gap: 8px; align-items: flex-end;
        }
        .vdb-input-wrap {
          flex: 1; display: flex; align-items: flex-end;
          border-radius: 14px; border: 1px solid rgba(56, 189, 248, 0.15);
          background: rgba(15, 23, 42, 0.8); transition: all 0.3s;
          overflow: hidden;
        }
        .vdb-input-focused {
          border-color: rgba(56, 189, 248, 0.5) !important;
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.1), 0 0 40px rgba(56, 189, 248, 0.05);
        }
        .vdb-input {
          flex: 1; padding: 12px 16px; border: none; outline: none;
          background: transparent; color: #e2e8f0; font-size: 14px;
          resize: none; font-family: inherit; line-height: 1.5;
          min-height: 44px; max-height: 120px;
        }
        .vdb-input::placeholder { color: #475569; }
        .vdb-send-btn {
          padding: 10px 18px; border: none; height: 44px;
          background: linear-gradient(135deg, #2563eb, #38bdf8);
          color: #fff; cursor: pointer; font-weight: 700; font-size: 16px;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        .vdb-send-disabled {
          background: rgba(30, 41, 59, 0.8) !important;
          color: #475569 !important; cursor: default !important;
          box-shadow: none !important;
        }
        .vdb-send-btn:not(.vdb-send-disabled):hover {
          box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
        }
        .vdb-clear-btn {
          width: 44px; height: 44px; border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(30, 15, 15, 0.6);
          color: #ef4444; cursor: pointer; font-size: 14px;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; flex-shrink: 0;
        }
        .vdb-clear-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.15);
        }

        /* ── Stats Bar ── */
        .vdb-stats-bar {
          max-width: 960px; margin: 8px auto 0; padding: 0 4px;
          display: flex; justify-content: center; gap: 16px;
          font-size: 11px; color: #475569;
        }
        .vdb-stat { display: flex; align-items: center; gap: 5px; }
        .vdb-stat-dot {
          width: 5px; height: 5px; border-radius: 50%;
          animation: dotPulse 3s ease-in-out infinite;
        }
        .vdb-dot-blue { background: #3b82f6; box-shadow: 0 0 6px rgba(59, 130, 246, 0.5); }
        .vdb-dot-green { background: #22c55e; box-shadow: 0 0 6px rgba(34, 197, 94, 0.5); }
        .vdb-dot-cyan { background: #22d3ee; box-shadow: 0 0 6px rgba(34, 211, 238, 0.5); }
        @keyframes dotPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .vdb-stat-sep { color: #334155; }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .vdb-suggestions-grid { grid-template-columns: repeat(2, 1fr); }
          .vdb-nav { display: none; }
          .vdb-welcome-title { font-size: 26px; }
          .vdb-welcome { padding-top: 40px; }
          .vdb-user-content { max-width: 90%; }
        }
        @media (max-width: 480px) {
          .vdb-suggestions-grid { grid-template-columns: 1fr; }
          .vdb-welcome-title { font-size: 22px; }
          .vdb-suggestion-card { padding: 14px 12px; }
        }

        /* ── Scrollbar ── */
        .vdb-messages-area::-webkit-scrollbar { width: 6px; }
        .vdb-messages-area::-webkit-scrollbar-track { background: transparent; }
        .vdb-messages-area::-webkit-scrollbar-thumb {
          background: rgba(56, 189, 248, 0.15); border-radius: 3px;
        }
        .vdb-messages-area::-webkit-scrollbar-thumb:hover {
          background: rgba(56, 189, 248, 0.3);
        }
      `}</style>
    </div>
  );
}
