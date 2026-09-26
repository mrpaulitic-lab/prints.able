import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const PRODUCT_TYPES = ["T-Shirts", "Hoodies", "Mugs", "Hats", "Tote Bags", "Stickers", "Phone Cases"];

export default function Studio({ session, onSaved }) {
  const [prompt, setPrompt] = useState("");
  const [audience, setAudience] = useState("");
  const [style, setStyle] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function toggleType(type) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${freshSession.access_token}`,
        },
        body: JSON.stringify({ prompt, audience, style, productTypes: selectedTypes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Something went wrong.");
        return;
      }
      setResult(data);
      if (onSaved) onSaved();
    } catch (err) {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="pb2-card">
        <form onSubmit={handleSubmit}>
          <label className="pb2-label">What's your idea?</label>
          <textarea
            className="pb2-input"
            required
            maxLength={500}
            placeholder="e.g. A merch brand for people who love their weird, chaotic dogs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <label className="pb2-label">Who's it for? (optional)</label>
          <input
            className="pb2-input"
            placeholder="e.g. dog owners in their 20s and 30s"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />

          <label className="pb2-label">Style or vibe (optional)</label>
          <input
            className="pb2-input"
            placeholder="e.g. bold and funny, minimalist, vintage"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />

          <label className="pb2-label">Which products are you interested in? (optional)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {PRODUCT_TYPES.map((type) => (
              <label
                key={type}
                style={{
                  display: "flex", alignItems: "center", gap: 6, fontSize: 13,
                  border: "1px solid var(--panel-border)", borderRadius: "999px", padding: "6px 12px",
                  background: selectedTypes.includes(type) ? "var(--panel-border)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  style={{ margin: 0 }}
                />
                {type}
              </label>
            ))}
          </div>

          <div className="pb2-hint" style={{ marginTop: 12 }}>Be specific — the more detail, the better the result.</div>
          <button className="pb2-btn" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
            {busy ? "Generating…" : "Generate my brand"}
          </button>
        </form>
        {error && <div className="pb2-error">{error}</div>}
      </div>

      {result && (
        <>
          <div className="pb2-card">
            <div className="pb2-section-label">Brand Identity</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, margin: 0 }}>
              {result.brand_name}
            </h2>
            <p style={{ fontStyle: "italic", color: "var(--muted)", margin: "4px 0 12px" }}>{result.tagline}</p>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.mission}</p>
            {result.image_url && (
              <img
                src={result.image_url}
                alt="Concept design"
                style={{ width: "100%", maxWidth: 280, display: "block", margin: "16px auto", borderRadius: 12, border: "1px solid var(--panel-border)" }}
              />
            )}
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Merch Collection</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {(result.merch_collection || []).map((m, i) => (
                <div key={i} style={{ border: "1px solid var(--panel-border)", borderRadius: 10, padding: 12 }}>
                  <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{m.item}</strong>
                  <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{m.description}</p>
                </div>
              ))}
            </div>
            <p className="pb2-hint" style={{ marginTop: 10 }}>
              Go to "My Brands" to choose which of these appear on your public page.
            </p>
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Marketing Campaign</div>
            {["instagram", "facebook", "email"].map((k) =>
              result.marketing?.[k] ? (
                <div key={k} style={{ marginBottom: 12 }}>
                  <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, textTransform: "uppercase" }}>{k}</strong>
                  <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{result.marketing[k]}</p>
                </div>
              ) : null
            )}
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Launch Strategy</div>
            <ol style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
              {(result.launch_strategy || []).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Revenue Opportunities</div>
            <ul style={{ fontSize: 14, lineHeight: 1.7, paddingLeft: 20 }}>
              {(result.revenue_opportunities || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>

          {typeof result.generations_remaining === "number" && (
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>
              {result.generations_remaining > 0
                ? `You have ${result.generations_remaining} free generation${result.generations_remaining === 1 ? "" : "s"} left.`
                : "That was your last free generation."}
            </p>
          )}
        </>
      )}
    </div>
  );
}
