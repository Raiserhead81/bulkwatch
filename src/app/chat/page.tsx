"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const NAV_LINKS: [string, string][] = [
  ["Ships", "/"], ["Map", "/karte"], ["Live", "/live"],
  ["Top Picks", "/top-picks"], ["Compare", "/vergleich"],
  ["Newbuilds", "/newbuilds"], ["Voyage Calc", "/voyage-calc"],
  ["AI Chat", "/chat"]
];

const SUGGESTIONS_DE = [
  { icon: "\u{1F4CA}", label: "Markt\u00fcbersicht", prompt: "Gib mir eine \u00dcbersicht zum aktuellen Schiffsmarkt. BDI, Frachtraten, Trends und Prognose." },
  { icon: "\u{1F6A2}", label: "Wo sind die Schiffe?", prompt: "Zeige mir Schiffe die sich gerade in wichtigen Gew\u00e4ssern befinden: Suezkanal, Singapur, Rotterdam." },
  { icon: "\u{1F4B0}", label: "Top Investments", prompt: "Welche Schiffe lohnen sich aktuell als Investment? Zeige die Top 10 nach Preis/DWT-Verh\u00e4ltnis mit Alter und Empfehlung." },
  { icon: "\u{1F30D}", label: "Route berechnen", prompt: "Berechne die Kosten und Dauer f\u00fcr eine Bulk-Carrier-Fahrt von Australien nach China mit Eisenerz. Welcher Schiffstyp ist am wirtschaftlichsten?" },
  { icon: "\u{2693}", label: "Reedereien vergleichen", prompt: "Welche sind die gr\u00f6\u00dften Reedereien in der Datenbank? Vergleiche ihre Flottengr\u00f6\u00dfe, Durchschnittsalter und Schiffstypen." },
  { icon: "\u{1F3D7}", label: "Neubauten & Werften", prompt: "Welche Schiffe werden gerade gebaut? Gruppiere nach Schiffstyp und zeige Werft, Reederei und Liefertermin." },
];

const SUGGESTIONS_EN = [
  { icon: "\u{1F4CA}", label: "Market Intelligence", prompt: "Analyze the current dry bulk market: BDI trend, Capesize vs Panamax rates, fleet utilization, and your 3-month outlook. Include specific $/day TCE rates." },
  { icon: "\u{1F6A2}", label: "Live Ship Tracker", prompt: "Which ships are currently near the Suez Canal, Strait of Malacca, and Singapore? Show their names, types, DWT and likely cargo." },
  { icon: "\u{1F4B0}", label: "Best Buys Now", prompt: "Find the top 10 undervalued ships right now: young age, large DWT, low price per DWT. Show estimated value, age, type and why each is a good buy." },
  { icon: "\u{1F30D}", label: "Voyage Economics", prompt: "Compare the economics of shipping iron ore from Port Hedland to Qingdao with a Capesize vs Kamsarmax. Include fuel cost, canal fees, TCE, and break-even freight rate." },
  { icon: "\u{2693}", label: "Fleet Analysis", prompt: "Rank the top 10 operators by total fleet value. For each show: number of ships, total DWT, average age, most common type, and estimated fleet value." },
  { icon: "\u{1F3D7}", label: "Orderbook", prompt: "Show the complete newbuilding orderbook: how many ships are under construction by type? Which yards are building them? When are they delivering? What is the total orderbook value?" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Convert IMO numbers and ship names to clickable links
function linkifyContent(text: string): string {
  // Link IMO numbers: IMO 1234567 or IMO: 1234567
  text = text.replace(/IMO[:\s]*([0-9]{7})/gi, '<a href="/schiff/$1" style="color:#38bdf8;text-decoration:underline;font-weight:600">IMO $1</a>');
  // Link standalone 7-digit numbers that look like IMOs (in tables, after |)
  text = text.replace(/\|\s*([0-9]{7})\s*\|/g, (m, imo) => `| <a href="/schiff/${imo}" style="color:#38bdf8;text-decoration:underline">${imo}</a> |`);
  return text;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<"de"|"en">("en");
  const SUGGESTIONS = lang === "de" ? SUGGESTIONS_DE : SUGGESTIONS_EN;
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
        setMessages(prev => [...prev, { role: "assistant", content: "Fehler: " + (err.error || "Etwas ist schiefgelaufen") }]);
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
      setMessages(prev => [...prev, { role: "assistant", content: "Fehler: " + e.message }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [input, messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown-to-html (tables, bold, code, links, lists)
  function renderMarkdown(text: string) {
    // First linkify IMOs
    let html = linkifyContent(text);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:#0f172a;padding:12px 16px;border-radius:10px;overflow-x:auto;font-size:12px;border:1px solid #1e3a5f;margin:8px 0"><code>$1</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px;color:#38bdf8">$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#38bdf8;font-weight:600">$1</strong>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;color:#e2e8f0;margin:14px 0 6px;border-bottom:1px solid #1e3a5f;padding-bottom:4px">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;color:#e2e8f0;margin:16px 0 8px;border-bottom:1px solid #1e3a5f;padding-bottom:4px">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;color:#38bdf8;margin:16px 0 8px">$1</h1>');

    // Tables
    html = html.replace(/^\|(.+)\|\s*$/gm, (match) => {
      const cells = match.split("|").filter(c => c.trim());
      const isHeader = cells.some(c => /^[\s-:]+$/.test(c));
      if (isHeader) return ""; // skip separator row
      return "<tr>" + cells.map(c =>
        `<td style="padding:6px 12px;border-bottom:1px solid #1e3a5f;font-size:13px;white-space:nowrap">${c.trim()}</td>`
      ).join("") + "</tr>";
    });
    // Wrap consecutive tr elements in table
    html = html.replace(/((?:<tr>.*<\/tr>\s*)+)/g,
      '<div style="overflow-x:auto;margin:8px 0;border:1px solid #1e3a5f;border-radius:10px"><table style="width:100%;border-collapse:collapse">$1</table></div>');
    // First row in each table = header
    html = html.replace(/<table[^>]*>\s*<tr>(.*?)<\/tr>/g, (m, cells) =>
      m.replace(/<td/g, '<th').replace(/<\/td/g, '</th').replace(/style="[^"]*"/g,
        'style="padding:8px 12px;background:#1e293b;font-weight:600;font-size:12px;text-align:left;color:#94a3b8;border-bottom:2px solid #38bdf8"'));

    // Lists
    html = html.replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#38bdf8">\u2022</span><span>$1</span></div>');
    html = html.replace(/^\d+\. (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0"><span style="color:#38bdf8;font-weight:600;min-width:18px">\u2022</span><span>$1</span></div>');

    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '<div style="height:10px"></div>');
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:"#0a0d14", color:"#e2e8f0", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#0f172a", borderBottom:"1px solid #1e3a5f", padding:"10px 16px", flexShrink:0 }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <a href="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
            <span style={{ fontSize:20 }}>\u2693</span>
            <span style={{ fontWeight:800, fontSize:16, color:"#38bdf8" }}>Vessel AI</span>
          </a>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
            {NAV_LINKS.map(([l,h]) => (
              <a key={h} href={h} style={{
                padding:"4px 10px", borderRadius:6, fontSize:12, textDecoration:"none",
                color: h==="/chat" ? "#fff" : "#64748b",
                background: h==="/chat" ? "#2563eb" : "transparent",
                fontWeight: h==="/chat" ? 600 : 400,
              }}>{l}</a>
            ))}
          </div>
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid #1e3a5f" }}>
            <button onClick={() => setLang("de")} style={{ padding:"4px 10px", fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background: lang==="de" ? "#2563eb" : "#0f172a", color: lang==="de" ? "#fff" : "#64748b" }}>DE</button>
            <button onClick={() => setLang("en")} style={{ padding:"4px 10px", fontSize:11, fontWeight:700, border:"none", cursor:"pointer", background: lang==="en" ? "#2563eb" : "#0f172a", color: lang==="en" ? "#fff" : "#64748b" }}>EN</button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflow:"auto", padding:"0 16px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          {messages.length === 0 && (
            <div style={{ textAlign:"center", paddingTop:80 }}>
              <div style={{ width:80, height:80, borderRadius:20, background:"linear-gradient(135deg,#2563eb,#38bdf8)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px", boxShadow:"0 8px 32px rgba(37,99,235,0.4)", fontSize:36 }}>\u2693</div>
              <h1 style={{ fontSize:28, fontWeight:800, margin:"0 0 8px", background:"linear-gradient(180deg,#fff,#94a3b8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Vessel Database AI</h1>
              <p style={{ color:"#64748b", fontSize:14, maxWidth:450, margin:"0 auto 32px", lineHeight:1.6 }}>
                {lang === "de"
                  ? "Frag mich alles \u00fcber Schiffe, Routen, M\u00e4rkte und Flottendaten. Ich habe Zugriff auf die Live-Datenbank mit \u00fcber 10.000 Schiffen."
                  : "Ask me anything about ships, routes, markets and fleet data. I have access to the live database with over 10,000 ships."}
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10, maxWidth:600, margin:"0 auto" }}>
                {SUGGESTIONS.map(s => (
                  <button key={s.label} onClick={() => sendMessage(s.prompt)} style={{
                    padding:"14px 12px", borderRadius:12, border:"1px solid #1e3a5f",
                    background:"#0f172a", color:"#94a3b8", cursor:"pointer", fontSize:12,
                    textAlign:"left", transition:"all 0.15s", lineHeight:1.4,
                  }}
                  onMouseOver={e => { (e.target as HTMLElement).style.borderColor="#38bdf8"; (e.target as HTMLElement).style.color="#e2e8f0"; }}
                  onMouseOut={e => { (e.target as HTMLElement).style.borderColor="#1e3a5f"; (e.target as HTMLElement).style.color="#94a3b8"; }}
                  ><span style={{ fontSize:18, display:"block", marginBottom:4 }}>{s.icon}</span>{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display:"flex", gap:10, padding:"16px 0", borderBottom: i < messages.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{
                width:32, height:32, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14,
                background: msg.role === "user" ? "#2563eb" : "linear-gradient(135deg,#1e293b,#0f172a)",
                border: msg.role === "user" ? "none" : "1px solid #1e3a5f",
                color: msg.role === "user" ? "#fff" : "#38bdf8",
                fontWeight:700,
              }}>{msg.role === "user" ? "\u{1F464}" : "\u2693"}</div>
              <div style={{ flex:1, minWidth:0, paddingTop:4 }}>
                <div style={{ fontSize:11, color:"#64748b", marginBottom:4, fontWeight:600 }}>
                  {msg.role === "user" ? "Du" : "Vessel AI"}
                </div>
                {msg.role === "assistant" ? (
                  <div style={{ fontSize:14, lineHeight:1.7, color:"#e2e8f0" }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) || (loading && i === messages.length - 1 ? '<span style="color:#38bdf8;animation:pulse 1.5s infinite">Denke nach...</span>' : '') }}
                  />
                ) : (
                  <div style={{ fontSize:14, lineHeight:1.6 }}>{msg.content}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} style={{ height:20 }} />
        </div>
      </div>

      {/* Input */}
      <div style={{ background:"#0f172a", borderTop:"1px solid #1e3a5f", padding:"12px 16px 20px", flexShrink:0 }}>
        <div style={{ maxWidth:900, margin:"0 auto", display:"flex", gap:8, alignItems:"flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === "de" ? "Frag nach Schiffen, Routen, M\u00e4rkten..." : "Ask about ships, routes, markets..."}
            rows={1}
            style={{
              flex:1, padding:"12px 16px", borderRadius:12, border:"1px solid #1e3a5f",
              background:"#1e293b", color:"#e2e8f0", fontSize:14, resize:"none",
              outline:"none", fontFamily:"inherit", lineHeight:1.5, minHeight:44, maxHeight:120,
            }}
            onFocus={e => e.target.style.borderColor="#38bdf8"}
            onBlur={e => e.target.style.borderColor="#1e3a5f"}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              padding:"12px 20px", borderRadius:12, border:"none", height:44,
              background: loading || !input.trim() ? "#1e293b" : "linear-gradient(135deg,#2563eb,#38bdf8)",
              color: loading || !input.trim() ? "#64748b" : "#fff",
              cursor: loading || !input.trim() ? "default" : "pointer",
              fontWeight:700, fontSize:14, transition:"all 0.15s",
              boxShadow: loading || !input.trim() ? "none" : "0 4px 12px rgba(37,99,235,0.3)",
            }}
          >{loading ? "..." : "\u27A4"}</button>
        </div>
      </div>

      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}"}</style>
    </div>
  );
}
