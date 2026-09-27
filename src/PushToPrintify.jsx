import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function PushToPrintify({ brand, design, onDone, onNeedsConnection }) {
  const [step, setStep] = useState("loading-shops");
  const [error, setError] = useState("");
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState(null);
  const [blueprints, setBlueprints] = useState([]);
  const [blueprintSearch, setBlueprintSearch] = useState("");
  const [blueprintId, setBlueprintId] = useState(null);
  const [selectedBlueprintTitle, setSelectedBlueprintTitle] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState(null);
  const [variants, setVariants] = useState([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);

  useEffect(() => {
    loadShops();
  }, []);

  async function loadShops() {
    setError("");
    setStep("loading-shops");
    try {
      const data = await authedFetch("/.netlify/functions/printify-shops");
      if (data.needsConnection) {
        onNeedsConnection();
        return;
      }
      setShops(data.shops || []);
      setStep("pick-shop");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadBlueprints() {
    setError("");
    setStep("loading-catalog");
    try {
      const data = await authedFetch("/.netlify/functions/printify-catalog", { list: "blueprints" });
      setBlueprints(data.blueprints || []);
      setStep("pick-blueprint");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadProviders(bpId, bpTitle) {
    setError("");
    setBlueprintId(bpId);
    setSelectedBlueprintTitle(bpTitle);
    setStep("loading-catalog");
    try {
      const data = await authedFetch("/.netlify/functions/printify-catalog", {
        list: "providers",
        blueprint_id: bpId,
      });
      setProviders(data.providers || []);
      setStep("pick-provider");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadVariants(provId) {
    setError("");
    setProviderId(provId);
    setStep("loading-catalog");
    try {
      const data = await authedFetch("/.netlify/functions/printify-catalog", {
        list: "variants",
        blueprint_id: blueprintId,
        print_provider_id: provId,
      });
      setVariants(data.variants || []);
      setStep("pick-variants");
    } catch (err) {
      setError(err.message);
    }
  }

  async function createProduct() {
    setError("");
    setStep("creating");
    try {
      await authedFetch("/.netlify/functions/printify-create-product", {
        shop_id: shopId,
        blueprint_id: blueprintId,
        print_provider_id: providerId,
        variant_ids: selectedVariantIds,
        design_id: design.id,
        brand_id: brand.id,
        image_url: design.image_url,
        title: brand.brand_name,
        description: brand.mission,
      });
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("pick-variants");
    }
  }

  const filteredBlueprints = blueprintSearch.trim()
    ? blueprints.filter((bp) => bp.title.toLowerCase().includes(blueprintSearch.trim().toLowerCase()))
    : blueprints.slice(0, 40);

  return (
    <div className="pb2-card">
      <button
        className="pb2-btn-ghost"
        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginBottom: 14, cursor: "pointer" }}
        onClick={onDone}
      >
        ← Back to My Brands
      </button>

      <div className="pb2-section-label">Push "{brand.brand_name}" to Printify</div>
      {error && <div className="pb2-error">{error}</div>}

      {step === "loading-shops" && <p>Loading your Printify shops…</p>}

      {step === "pick-shop" && (
        <>
          <label className="pb2-label">Which shop?</label>
          <select className="pb2-select" onChange={(e) => setShopId(e.target.value)} defaultValue="">
            <option value="" disabled>Choose a shop</option>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <button className="pb2-btn" style={{ marginTop: 14 }} disabled={!shopId} onClick={loadBlueprints}>
            Next: choose a product
          </button>
        </>
      )}

      {step === "loading-catalog" && <p>Loading Printify's catalog…</p>}

      {step === "pick-blueprint" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-shop")}>
            ← Back
          </button>
          <label className="pb2-label">What kind of product?</label>
          <input
            className="pb2-input"
            placeholder="Search products (e.g. sticker, poster, mug)…"
            value={blueprintSearch}
            onChange={(e) => setBlueprintSearch(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div style={{ maxHeight: 340, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {filteredBlueprints.map((bp) => (
              <button
                key={bp.id}
                className="pb2-btn pb2-btn-ghost"
                style={{ fontSize: 12, textAlign: "left", padding: "10px 12px" }}
                onClick={() => loadProviders(bp.id, bp.title)}
              >
                {bp.title}
              </button>
            ))}
          </div>
          <p className="pb2-hint">
            {blueprintSearch.trim()
              ? `${filteredBlueprints.length} match${filteredBlueprints.length === 1 ? "" : "es"}`
              : `Showing the first 40 of ${blueprints.length} — search above to find more, like "poster," "sticker," or "postcard."`}
          </p>
        </>
      )}

      {step === "pick-provider" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-blueprint")}>
            ← Back
          </button>
          <label className="pb2-label">Which print provider for "{selectedBlueprintTitle}"?</label>
          <p className="pb2-hint" style={{ marginTop: 0 }}>Different providers mean different prices, locations, and blank quality.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {providers.map((p) => (
              <button key={p.id} className="pb2-btn pb2-btn-ghost" style={{ textAlign: "left" }} onClick={() => loadVariants(p.id)}>
                {p.title}
              </button>
            ))}
          </div>
        </>
      )}

      {step === "pick-variants" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-provider")}>
            ← Back
          </button>
          <label className="pb2-label">Which sizes/colors to include?</label>
          <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--panel-border)", borderRadius: 10, padding: 10 }}>
            {variants.map((v) => (
              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={selectedVariantIds.includes(v.id)}
                  onChange={(e) => {
                    setSelectedVariantIds((prev) =>
                      e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id)
                    );
                  }}
                />
                {v.title}
              </label>
            ))}
          </div>
          <button
            className="pb2-btn"
            style={{ marginTop: 14 }}
            disabled={selectedVariantIds.length === 0}
            onClick={createProduct}
          >
            Create draft product
          </button>
        </>
      )}

      {step === "creating" && <p>Creating your product on Printify…</p>}

      {step === "done" && (
        <>
          <p style={{ color: "var(--green)", fontWeight: 600 }}>
            Draft product created. It's saved in your Printify account — review it there before publishing.
          </p>
          <button className="pb2-btn" onClick={onDone}>Back to dashboard</button>
        </>
      )}
    </div>
  );
}
