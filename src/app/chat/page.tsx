"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const NAV_LINKS: [string, string][] = [
  ["Ships", "/"], ["Map", "/karte"], ["Live", "/live"],
  ["Top Picks", "/top-picks"], ["Compare", "/vergleich"],
  ["Watchlist", "/watchlist"], ["Newbuilds", "/newbuilds"],
  ["Voyage Calc", "/voyage-calc"], ["AI Chat", "/chat"]
];

const SUGGESTIONS = [
  { label: "Market Overview", prompt: "Give me an overview of the current bulk carrier market. Include BDI, fleet composition, and key trends." },
  { label: "Top Ships to Watch", prompt: "Which ships in the database are the most valuable? Show me the top 10 by estimated value with their details." },
  { label: "Route Cost Calculator", prompt: "Calculate the voyage cost for a Capesize ship from Port Hedland (Australia) to Qingdao (China) with iron ore cargo." },
  { label: "Fleet by Operator", prompt: "Show me the top 10 operators by fleet size with their ship types and average age." },
  { label: "Newest Ships", prompt: "What are the 10 newest ships in the database? Show name, type, DWT, year built, and builder." },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("vessel-theme") || "dark";
    setTheme(saved as "dark" | "light");
    document.documentElement.classList.toggle("light", saved === "light");
    document.documentElement.classList.toggle("dark", saved !== "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("vessel-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
    document.documentElement.classList.toggle("dark", next !== "light");
  };

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
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.error || "Something went wrong"}` }]);
        setLoading(false);
        return;
      }

      // Stream SSE
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
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}` }]);
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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg, #0a0a0a)", color: "var(--fg, #e5e5e5)" }}>
      {/* Nav */}
      <nav style={{ borderBottom: "1px solid #222", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ fontWeight: 700, fontSize: 18, color: "#3b82f6", textDecoration: "none" }}>Vessel DB</a>
          <div className="nav-links" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NAV_LINKS.map(([label, href]) => (
              <a key={href} href={href} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 13,
                textDecoration: "none", color: href === "/chat" ? "#fff" : "#999",
                background: href === "/chat" ? "#3b82f6" : "transparent"
              }}>{label}</a>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>
            {theme === "dark" ? "\u2600\ufe0f" : "\ud83c\udf19"}
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="mobile-menu" style={{ display: "none", background: "none", border: "none", color: "#999", fontSize: 22, cursor: "pointer" }}>\u2630</button>
        </div>
      </nav>

      {/* Chat area */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 0", maxWidth: 900, width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>\u2693</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Vessel Database AI</h1>
            <p style={{ color: "#888", marginBottom: 32, maxWidth: 500, margin: "0 auto 32px" }}>
              Ask me anything about ships, routes, markets, and fleet data. I have access to the live database with real-time ship information.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {SUGGESTIONS.map(s => (
                <button key={s.label} onClick={() => sendMessage(s.prompt)} style={{
                  padding: "10px 16px", borderRadius: 10, border: "1px solid #333",
                  background: "#111", color: "#ccc", cursor: "pointer", fontSize: 13,
                  transition: "all 0.15s"
                }}
                onMouseOver={e => { (e.target as HTMLElement).style.borderColor = "#3b82f6"; (e.target as HTMLElement).style.color = "#fff"; }}
                onMouseOut={e => { (e.target as HTMLElement).style.borderColor = "#333"; (e.target as HTMLElement).style.color = "#ccc"; }}
                >{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12
          }}>
            <div style={{
              maxWidth: "85%", padding: "12px 16px", borderRadius: 12,
              background: msg.role === "user" ? "#1d4ed8" : "#1a1a1a",
              border: msg.role === "user" ? "none" : "1px solid #222",
              color: msg.role === "user" ? "#fff" : "#e5e5e5",
              fontSize: 14, lineHeight: 1.6
            }}>
              {msg.role === "assistant" ? (
                <div className="chat-markdown">
                  <ReactMarkdown
                    components={{
                      table: ({ children }) => (
                        <div style={{ overflowX: "auto", margin: "8px 0" }}>
                          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th style={{ border: "1px solid #333", padding: "6px 10px", background: "#222", textAlign: "left", fontWeight: 600 }}>{children}</th>
                      ),
                      td: ({ children }) => (
                        <td style={{ border: "1px solid #333", padding: "6px 10px" }}>{children}</td>
                      ),
                      code: ({ children, className }) => {
                        const isBlock = className?.includes("language-");
                        return isBlock
                          ? <pre style={{ background: "#111", padding: 12, borderRadius: 6, overflow: "auto", fontSize: 12 }}><code>{children}</code></pre>
                          : <code style={{ background: "#222", padding: "2px 5px", borderRadius: 3, fontSize: 12 }}>{children}</code>;
                      },
                      p: ({ children }) => <p style={{ margin: "6px 0" }}>{children}</p>,
                      ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ol>,
                      h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 6px" }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 4px" }}>{children}</h2>,
                      h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px" }}>{children}</h3>,
                      strong: ({ children }) => <strong style={{ color: "#60a5fa" }}>{children}</strong>,
                    }}
                  >{msg.content}</ReactMarkdown>
                  {loading && i === messages.length - 1 && msg.content === "" && (
                    <span style={{ display: "inline-block", animation: "pulse 1.5s infinite" }}>Thinking...</span>
                  )}
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px 16px", borderTop: "1px solid #222", flexShrink: 0 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 8 }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about ships, routes, markets..."
            rows={1}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid #333",
              background: "#111", color: "#e5e5e5", fontSize: 14, resize: "none",
              outline: "none", fontFamily: "inherit", lineHeight: 1.5
            }}
            onFocus={e => (e.target.style.borderColor = "#3b82f6")}
            onBlur={e => (e.target.style.borderColor = "#333")}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              padding: "12px 20px", borderRadius: 12, border: "none",
              background: loading || !input.trim() ? "#222" : "#3b82f6",
              color: loading || !input.trim() ? "#666" : "#fff",
              cursor: loading || !input.trim() ? "default" : "pointer",
              fontWeight: 600, fontSize: 14, transition: "all 0.15s"
            }}
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 11, color: "#555", marginTop: 8 }}>
          AI responses may contain inaccuracies. Database queries are read-only.
        </p>
      </div>

      <style>{"@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}"}</style>
    </div>
  );
}
