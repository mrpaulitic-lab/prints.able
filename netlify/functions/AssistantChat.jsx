import React, { useState, useRef, useEffect } from "react";
import { supabase } from "./supabaseClient";

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me about errors, which products to pick, or how anything in Printsable works." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong." }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error — try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000 }}>
      {open && (
        <div
          style={{
            width: 300, maxWidth: "85vw", height: 400, background: "var(--paper)",
            border: "1px solid var(--panel-border)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column", marginBottom: 12, overflow: "hidden",
          }}
        >
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--panel-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>Printsable Help</strong>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  background: m.role === "user" ? "linear-gradient(135deg, var(--red), #8B5CF6)" : "var(--panel)",
                  color: m.role === "user" ? "#fff" : "var(--ink)",
                  borderRadius: 12, padding: "8px 12px", fontSize: 13, maxWidth: "85%", lineHeight: 1.5,
                }}
              >
                {m.content}
              </div>
            ))}
            {busy && <div className="pb2-hint">Thinking…</div>}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={send} style={{ display: "flex", borderTop: "1px solid var(--panel-border)", padding: 8, gap: 6 }}>
            <input
              className="pb2-input"
              style={{ fontSize: 13, padding: "8px 10px" }}
              placeholder="Ask something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="pb2-btn" style={{ padding: "8px 14px", fontSize: 13 }} disabled={busy} type="submit">Send</button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 54, height: 54, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--red), #8B5CF6)", color: "#fff",
          border: "none", fontSize: 22, cursor: "pointer", boxShadow: "0 4px 20px rgba(99,102,241,0.5)",
        }}
      >
        💬
      </button>
    </div>
  );
}
