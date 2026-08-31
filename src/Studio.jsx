import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function Studio({ session, onSaved }) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
        body: JSON.stringify({ prompt }),
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
          <div className="pb2-hint">Be specific — the more detail, the better the result.</div>
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
            <h2 style={{ fontFamily: "'Anton', sans-serif", fontSize: 30, textTransform: "uppercase", margin: 0 }}>
              {result.brand_name}
            </h2>
            <p style={{ fontStyle: "italic", color: "#5C5347", margin: "4px 0 12px" }}>{result.tagline}</p>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{result.mission}</p>
            {result.image_url && (
              <img
                src={result.image_url}
                alt="Concept design"
                style={{ width: "100%", maxWidth: 280, display: "block", margin: "16px auto", border: "2px solid var(--ink)", borderRadius: 4 }}
              />
            )}
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Merch Collection</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {(result.merch_collection || []).map((m, i) => (
                <div key={i} style={{ border: "1.5px solid var(--line)", borderRadius: 4, padding: 12 }}>
                  <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{m.item}</strong>
                  <p style={{ fontSize: 13, margin: 0, color: "#5C5347" }}>{m.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pb2-card">
            <div className="pb2-section-label">Marketing Campaign</div>
            {["instagram", "facebook", "email"].map((k) =>
              result.marketing?.[k] ? (
                <div key={k} style={{ marginBottom: 12 }}>
                  <strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, textTransform: "uppercase" }}>{k}</strong>
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
            <p style={{ textAlign: "center", fontSize: 13, color: "#8A8072" }}>
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
