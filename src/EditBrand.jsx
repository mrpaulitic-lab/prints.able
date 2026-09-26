import React, { useState } from "react";
import { supabase } from "./supabaseClient";

export default function EditBrand({ brand, onSaved, onCancel }) {
  const [brandName, setBrandName] = useState(brand.brand_name || "");
  const [tagline, setTagline] = useState(brand.tagline || "");
  const [mission, setMission] = useState(brand.mission || "");
  const [merch, setMerch] = useState(
    (brand.merch_collection || []).map((m) => ({ ...m, included: m.included !== false }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleItem(index) {
    setMerch((prev) => prev.map((m, i) => (i === index ? { ...m, included: !m.included } : m)));
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("brands")
      .update({
        brand_name: brandName,
        tagline,
        mission,
        merch_collection: merch,
      })
      .eq("id", brand.id);
    setBusy(false);
    if (error) {
      setError("Could not save your changes. Try again.");
      return;
    }
    onSaved();
  }

  return (
    <div className="pb2-card">
      <div className="pb2-section-label">Edit "{brand.brand_name}"</div>

      <label className="pb2-label">Brand name</label>
      <input className="pb2-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />

      <label className="pb2-label">Tagline</label>
      <input className="pb2-input" value={tagline} onChange={(e) => setTagline(e.target.value)} />

      <label className="pb2-label">Mission / description</label>
      <textarea className="pb2-input" value={mission} onChange={(e) => setMission(e.target.value)} />

      <label className="pb2-label">Which products should show on your public page?</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        {merch.map((m, i) => (
          <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, border: "1px solid var(--panel-border)", borderRadius: 10, padding: "10px 12px" }}>
            <input type="checkbox" checked={m.included} onChange={() => toggleItem(i)} style={{ marginTop: 3 }} />
            <span>
              <strong style={{ display: "block" }}>{m.item}</strong>
              <span style={{ color: "var(--muted)" }}>{m.description}</span>
            </span>
          </label>
        ))}
      </div>

      {error && <div className="pb2-error">{error}</div>}

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="pb2-btn" disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button className="pb2-btn pb2-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
