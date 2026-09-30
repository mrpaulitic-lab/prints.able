import React, { useState } from "react";
import { supabase } from "./supabaseClient";

async function regenerateField(brandId, field) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/.netlify/functions/brand-regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ brand_id: brandId, field }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Could not regenerate.");
  return data.value;
}

export default function EditBrand({ brand, onSaved, onCancel }) {
  const [brandName, setBrandName] = useState(brand.brand_name || "");
  const [tagline, setTagline] = useState(brand.tagline || "");
  const [mission, setMission] = useState(brand.mission || "");
  const [contactEmail, setContactEmail] = useState(brand.contact_email || "");
  const [siteNote, setSiteNote] = useState(brand.site_note || "");
  const [merch, setMerch] = useState(
    (brand.merch_collection || []).map((m) => ({ ...m, included: m.included !== false }))
  );
  const [busy, setBusy] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [error, setError] = useState("");

  function toggleItem(index) {
    setMerch((prev) => prev.map((m, i) => (i === index ? { ...m, included: !m.included } : m)));
  }

  async function handleRegenerate(field) {
    setRegeneratingField(field);
    setError("");
    try {
      const value = await regenerateField(brand.id, field);
      if (field === "brand_name") setBrandName(value);
      if (field === "tagline") setTagline(value);
      if (field === "mission") setMission(value);
      if (field === "merch_collection") setMerch(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegeneratingField(null);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    const { error } = await supabase
      .from("brands")
      .update({
        brand_name: brandName, tagline, mission, merch_collection: merch,
        contact_email: contactEmail.trim() || null,
        site_note: siteNote.trim() || null,
      })
      .eq("id", brand.id);
    setBusy(false);
    if (error) {
      setError("Could not save your changes. Try again.");
      return;
    }
    onSaved();
  }

  const RegenBtn = ({ field }) => (
    <button
      type="button"
      className="pb2-btn pb2-btn-ghost"
      style={{ fontSize: 11, padding: "4px 8px", marginLeft: 8 }}
      disabled={regeneratingField === field}
      onClick={() => handleRegenerate(field)}
    >
      {regeneratingField === field ? "…" : "🔄 Regenerate"}
    </button>
  );

  return (
    <div className="pb2-card">
      <div className="pb2-section-label">Edit "{brand.brand_name}"</div>
      {error && <div className="pb2-error">{error}</div>}

      <label className="pb2-label">Brand name <RegenBtn field="brand_name" /></label>
      <input className="pb2-input" value={brandName} onChange={(e) => setBrandName(e.target.value)} />

      <label className="pb2-label">Tagline <RegenBtn field="tagline" /></label>
      <input className="pb2-input" value={tagline} onChange={(e) => setTagline(e.target.value)} />

      <label className="pb2-label">Mission / description <RegenBtn field="mission" /></label>
      <textarea className="pb2-input" value={mission} onChange={(e) => setMission(e.target.value)} />

      <label className="pb2-label">Contact email (shown on your public page)</label>
      <input className="pb2-input" type="email" placeholder="you@yourbrand.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      <p className="pb2-hint">Optional — only add an inbox you actually check.</p>

      <label className="pb2-label">Other business info (hours, shipping notes, etc.)</label>
      <textarea className="pb2-input" placeholder="e.g. Orders ship within 3-5 business days." value={siteNote} onChange={(e) => setSiteNote(e.target.value)} />

      <label className="pb2-label">Which products should show on your public page? <RegenBtn field="merch_collection" /></label>
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

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="pb2-btn" disabled={busy} onClick={handleSave}>{busy ? "Saving…" : "Save changes"}</button>
        <button className="pb2-btn pb2-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
