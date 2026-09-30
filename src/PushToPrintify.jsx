import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const PAGE_SIZE = 30;

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
  const [blueprintPage, setBlueprintPage] = useState(0);
  const [blueprintId, setBlueprintId] = useState(null);
  const [selectedBlueprintTitle, setSelectedBlueprintTitle] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState(null);
  const [variants, setVariants] = useState([]);
  const [placeholderPositions, setPlaceholderPositions] = useState([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const [costDollars, setCostDollars] = useState("");
  const [marginPercent, setMarginPercent] = useState("40");
  const [finalPriceDollars, setFinalPriceDollars] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);

  useEffect(() => {
    loadShops();
  }, []);

    useEffect(() => {
    if (priceTouched) return;
    const cost = parseFloat(costDollars);
    const margin = parseFloat(marginPercent);
    // True gross margin, not simple markup: price = cost / (1 - margin).
    // A 40% markup and a 40% margin are different numbers.
    if (!isNaN(cost) && !isNaN(margin) && margin < 100) {
      setFinalPriceDollars((cost / (1 - margin / 100)).toFixed(2));
    }
  }, [costDollars, marginPercent, priceTouched]);

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
      setBlueprintPage(0);
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
      const data = await authedFetch("/.netlify/functions/printify-catalog", { list: "providers", blueprint_id: bpId });
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
        list: "variants", blueprint_id: blueprintId, print_provider_id: provId,
      });
      const fetchedVariants = data.variants || [];
      setVariants(fetchedVariants);

      // Real compatibility check, using Printify's own data rather than
      // guessing from the product name: if this product needs more than
      // one print area (like a calendar needing one image per month),
      // warn before letting the user pick sizes, instead of failing later.
      const firstPlaceholders = fetchedVariants[0]?.placeholders || [];
      if (firstPlaceholders.length > 1) {
        setPlaceholderPositions(firstPlaceholders.map((p) => p.position).filter(Boolean));
        setStep("compat-warning");
      } else {
        setStep("pick-variants");
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function createProduct() {
    setError("");
    const priceCents = Math.round(parseFloat(finalPriceDollars || "0") * 100);
    if (!priceCents || priceCents <= 0) {
      setError("Enter a valid selling price before creating the product.");
      return;
    }
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
        price_cents: priceCents,
      });
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("pick-variants");
    }
  }

  const searchActive = blueprintSearch.trim().length > 0;
  const matchingBlueprints = searchActive
    ? blueprints.filter((bp) => bp.title.toLowerCase().includes(blueprintSearch.trim().toLowerCase()))
    : blueprints;
  const totalPages = Math.max(1, Math.ceil(blueprints.length / PAGE_SIZE));
  const displayedBlueprints = searchActive
    ? matchingBlueprints.slice(0, 60)
    : matchingBlueprints.slice(blueprintPage * PAGE_SIZE, blueprintPage * PAGE_SIZE + PAGE_SIZE);

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
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-shop")}>← Back</button>
          <label className="pb2-label">What kind of product?</label>
          <input
            className="pb2-input"
            placeholder="Search products (e.g. sticker, poster, mug)…"
            value={blueprintSearch}
            onChange={(e) => { setBlueprintSearch(e.target.value); setBlueprintPage(0); }}
            style={{ marginBottom: 12 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
            {displayedBlueprints.map((bp) => (
              <button key={bp.id} className="pb2-btn pb2-btn-ghost" style={{ fontSize: 12, textAlign: "left", padding: "10px 12px" }} onClick={() => loadProviders(bp.id, bp.title)}>
                {bp.title}
              </button>
            ))}
          </div>

          {searchActive ? (
            <p className="pb2-hint" style={{ marginTop: 10 }}>
              {matchingBlueprints.length} match{matchingBlueprints.length === 1 ? "" : "es"}
            </p>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <button className="pb2-btn pb2-btn-ghost" disabled={blueprintPage === 0} onClick={() => setBlueprintPage((p) => Math.max(0, p - 1))}>
                ← Previous
              </button>
              <span className="pb2-hint">Page {blueprintPage + 1} of {totalPages}</span>
              <button className="pb2-btn pb2-btn-ghost" disabled={blueprintPage >= totalPages - 1} onClick={() => setBlueprintPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
          <p className="pb2-hint" style={{ marginTop: 10 }}>
            Some product types (calendars, puzzles, photo books) aren't shown yet — they need multiple images per product, which isn't supported here yet.
          </p>
        </>
      )}

      {step === "pick-provider" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-blueprint")}>← Back</button>
          <label className="pb2-label">Which print provider for "{selectedBlueprintTitle}"?</label>
          <p className="pb2-hint" style={{ marginTop: 0 }}>Different providers mean different prices, locations, and blank quality.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {providers.map((p) => (
              <button key={p.id} className="pb2-btn pb2-btn-ghost" style={{ textAlign: "left" }} onClick={() => loadVariants(p.id)}>{p.title}</button>
            ))}
          </div>
        </>
      )}

      {step === "compat-warning" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-provider")}>← Back</button>
          <div className="pb2-error" style={{ background: "rgba(234,179,8,0.1)", borderColor: "rgba(234,179,8,0.4)", color: "#FDE68A" }}>
            This product has {placeholderPositions.length} separate print areas ({placeholderPositions.join(", ")}).
            Printsable currently only fills one of them, so the rest may print blank. Full support for
            multi-area products like this is coming later.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="pb2-btn" onClick={() => setStep("pick-variants")}>Continue anyway</button>
            <button className="pb2-btn pb2-btn-ghost" onClick={() => setStep("pick-blueprint")}>Choose a different product</button>
          </div>
        </>
      )}

      {step === "pick-variants" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-provider")}>← Back</button>
          <label className="pb2-label">Which sizes/colors to include?</label>
          <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--panel-border)", borderRadius: 10, padding: 10 }}>
            {variants.map((v) => (
              <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  checked={selectedVariantIds.includes(v.id)}
                  onChange={(e) => {
                    setSelectedVariantIds((prev) => (e.target.checked ? [...prev, v.id] : prev.filter((id) => id !== v.id)));
                  }}
                />
                {v.title}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
            <div className="pb2-section-label">Pricing</div>
            <label className="pb2-label">What Printify charges you per item ($)</label>
            <input className="pb2-input" type="number" step="0.01" placeholder="e.g. 12.50" value={costDollars} onChange={(e) => setCostDollars(e.target.value)} />

            <label className="pb2-label">Your target profit margin (%)</label>
            <input className="pb2-input" type="number" step="1" value={marginPercent} onChange={(e) => setMarginPercent(e.target.value)} />

            <label className="pb2-label">Your selling price ($)</label>
            <input
              className="pb2-input"
              type="number"
              step="0.01"
              value={finalPriceDollars}
              onChange={(e) => { setFinalPriceDollars(e.target.value); setPriceTouched(true); }}
            />
            <p className="pb2-hint">Suggested automatically from cost + margin — edit it directly any time.</p>
          </div>

          <button className="pb2-btn" style={{ marginTop: 14 }} disabled={selectedVariantIds.length === 0} onClick={createProduct}>
            Create draft product
          </button>
        </>
      )}

      {step === "creating" && <p>Creating your product on Printify…</p>}

      {step === "done" && (
        <>
          <p style={{ color: "var(--green)", fontWeight: 600 }}>
            Draft product created at your chosen price. It's saved in your Printify account — review it there before publishing.
          </p>
          <button className="pb2-btn" onClick={onDone}>Back to dashboard</button>
        </>
      )}
    </div>
  );
}
