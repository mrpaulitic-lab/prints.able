import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function ConnectPrintify({ onConnected }) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/save-integration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ provider: "printify", api_key: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save that key.");
        return;
      }
      onConnected();
    } catch (err) {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb2-card">
      <div className="pb2-section-label">Connect Printify</div>
      <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
        Get your API token from Printify: My Account → Connections → Generate Token.
        This gets stored securely and only ever used server-side — Printable never
        exposes it in the browser.
      </p>
      <form onSubmit={handleSubmit}>
        <label className="pb2-label">Printify API token</label>
        <input
          className="pb2-input"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          required
        />
        {error && <div className="pb2-error">{error}</div>}
        <button className="pb2-btn" type="submit" disabled={busy} style={{ marginTop: 16 }}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
