import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DesignEditor, { checkerStyle } from "./DesignEditor";

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

function areaLabel(position) {
  return String(position || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function shapeHint(area) {
  if (!area?.width || !area?.height) return "";
  const ratio = area.width / area.height;
  if (ratio > 1.3) return "wide";
  if (ratio < 0.77) return "tall";
  return "roughly square";
}

export default function PushToPrintify({ brand, design, sourceType = "design", session, onDone, onNeedsConnection }) {
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
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const [costDollars, setCostDollars] = useState("");
  const [costTouched, setCostTouched] = useState(false);
  const [marginPercent, setMarginPercent] = useState("40");
  const [finalPriceDollars, setFinalPriceDollars] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [createdProduct, setCreatedProduct] = useState(null);
  const [placements, setPlacements] = useState({});
  const [editingArea, setEditingArea] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);
  const [library, setLibrary] = useState({ loaded: false, items: [] });
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [placedSummary, setPlacedSummary] = useState([]);

  useEffect(() => {
    loadShops();
  }, []);

  // Auto-fill the cost from Printify's own data, using the first selected
  // size/color as the reference. Different options can cost slightly
  // different amounts, so this is a starting point you can override.
  useEffect(() => {
    if (costTouched) return;
    if (selectedVariantIds.length === 0) return;
    const firstSelected = variants.find((v) => v.id === selectedVariantIds[0]);
    if (firstSelected && typeof firstSelected.cost === "number") {
      setCostDollars((firstSelected.cost / 100).toFixed(2));
    }
  }, [selectedVariantIds, variants, costTouched]);

  useEffect(() => {
    if (priceTouched) return;
    const cost = parseFloat(costDollars);
    const margin = parseFloat(marginPercent);
    // True gross margin, not simple markup: price = cost / (1 - margin).
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
    setSelectedVariantIds([]);
    setCostTouched(false);
    setPlacements({});
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
    setSelectedVariantIds([]);
    setPlacements({});
    setStep("loading-catalog");
    try {
      const data = await authedFetch("/.netlify/functions/printify-catalog", {
        list: "variants", blueprint_id: blueprintId, print_provider_id: provId,
      });
      setVariants(data.variants || []);
      setStep("pick-variants");
    } catch (err) {
      setError(err.message);
    }
  }

  // The print areas this product offers, limited to the ones that exist
  // for every size/color currently selected.
  const selectedVariants = variants.filter((v) => selectedVariantIds.includes(v.id));
  let printAreas = [];
  if (selectedVariants.length > 0) {
    let common = null;
    for (const v of selectedVariants) {
      const list = (v.placeholders || []).filter((p) => p.position);
      common = common === null ? list : common.filter((p) => list.some((q) => q.position === p.position));
    }
    printAreas = common || [];
  }

  function goToPlacements() {
    setError("");
    const price = parseFloat(finalPriceDollars || "0");
    if (!price || price <= 0) {
      setError("Enter a valid selling price before continuing.");
      return;
    }
    setPlacements((prev) => {
      const next = {};
      for (const area of printAreas) {
        if (prev[area.position]) next[area.position] = prev[area.position];
      }
      // Start with the main design in the front area (or the first area).
      if (Object.keys(next).length === 0 && printAreas.length > 0 && design?.image_url) {
        const front = printAreas.find((a) => a.position === "front") || printAreas[0];
        next[front.position] = { image_url: design.image_url, label: brand?.brand_name || "Main design" };
      }
      return next;
    });
    setStep("placements");
  }

  function assign(position, image_url, label) {
    setPlacements((prev) => ({ ...prev, [position]: { image_url, label } }));
    setPickerFor(null);
  }

  function clearArea(position) {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[position];
      return next;
    });
  }

  async function openPicker(position) {
    setPickerFor(position);
    if (library.loaded) return;
    setLibraryLoading(true);
    try {
      const { data: designData } = await supabase
        .from("designs").select("*").order("created_at", { ascending: false }).limit(40);
      const { data: assetData } = await supabase
        .from("assets").select("*").order("created_at", { ascending: false }).limit(40);

      const items = [];
      for (const d of designData || []) {
        if (d.image_url) items.push({ key: `d-${d.id}`, label: d.label || "Design", image_url: d.image_url });
      }
      for (const a of assetData || []) {
        const { data: signed } = await supabase.storage.from("assets").createSignedUrl(a.storage_path, 3600);
        if (signed?.signedUrl) items.push({ key: `a-${a.id}`, label: a.filename, image_url: signed.signedUrl });
      }
      setLibrary({ loaded: true, items });
    } finally {
      setLibraryLoading(false);
    }
  }

  async function createProduct() {
    setError("");
    const priceCents = Math.round(parseFloat(finalPriceDollars || "0") * 100);
    if (!priceCents || priceCents <= 0) {
      setError("Enter a valid selling price before creating the product.");
      setStep("pick-variants");
      return;
    }

    const assigned = Object.entries(placements)
      .filter(([position, v]) => v && v.image_url && (printAreas.length === 0 || printAreas.some((a) => a.position === position)))
      .map(([position, v]) => ({ position, image_url: v.image_url, label: v.label }));

    if (printAreas.length > 0 && assigned.length === 0) {
      setError("Add artwork to at least one print area first.");
      return;
    }

    setStep("creating");
    try {
      const result = await authedFetch("/.netlify/functions/printify-create-product", {
        shop_id: shopId,
        blueprint_id: blueprintId,
        print_provider_id: providerId,
        variant_ids: selectedVariantIds,
        design_id: design.id,
        source_type: sourceType,
        image_url: assigned.length > 0 ? undefined : design.image_url,
        placements: assigned.map(({ position, image_url }) => ({ position, image_url })),
        title: brand?.brand_name || "Untitled product",
        description: brand?.mission || "",
        price_cents: priceCents,
      });
      setCreatedProduct(result.product);
      setPlacedSummary(assigned.map(({ position, label }) => ({ position, label })));
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("placements");
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

  // While editing one print area, show only the editor.
  if (step === "editing-area" && editingArea) {
    return (
      <DesignEditor
        sourceImage={placements[editingArea.position]?.image_url || null}
        canvasWidth={editingArea.width}
        canvasHeight={editingArea.height}
        areaName={areaLabel(editingArea.position)}
        brandId={brand?.id || null}
        label={`${areaLabel(editingArea.position)} artwork`}
        session={session}
        onSavedDesign={(saved) => {
          setPlacements((prev) => ({
            ...prev,
            [editingArea.position]: { image_url: saved.image_url, label: "Your edited artwork" },
          }));
          setEditingArea(null);
          setStep("placements");
        }}
        onCancel={() => { setEditingArea(null); setStep("placements"); }}
      />
    );
  }

  return (
    <div className="pb2-card">
      <button
        className="pb2-btn-ghost"
        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginBottom: 14, cursor: "pointer" }}
        onClick={onDone}
      >
        ← Back to My Brands
      </button>

      <div className="pb2-section-label">Push "{brand?.brand_name}" to Printify</div>
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
            Calendars, puzzles, journals, and photo books aren't shown — they need a different image on every page, which isn't supported yet.
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

      {step === "pick-variants" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-provider")}>← Back</button>
          <label className="pb2-label">Which sizes/colors to include?</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setSelectedVariantIds(variants.map((v) => v.id))}>Select all</button>
            <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setSelectedVariantIds([])}>Clear</button>
          </div>
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
                {typeof v.cost === "number" && (
                  <span className="pb2-hint" style={{ marginLeft: "auto" }}>Printify cost: ${(v.cost / 100).toFixed(2)}</span>
                )}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 20, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
            <div className="pb2-section-label">Pricing</div>
            <label className="pb2-label">What Printify charges you per item ($)</label>
            <input
              className="pb2-input"
              type="number"
              step="0.01"
              placeholder="e.g. 12.50"
              value={costDollars}
              onChange={(e) => { setCostDollars(e.target.value); setCostTouched(true); }}
            />
            <p className="pb2-hint">
              {selectedVariantIds.length > 0 && variants.find((v) => v.id === selectedVariantIds[0] && typeof v.cost === "number")
                ? "Auto-filled from Printify's real cost for your first selected option — edit if you've chosen multiple sizes with different costs."
                : "Select a size/color above to auto-fill this, or enter it yourself."}
            </p>

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
            <p className="pb2-hint">Suggested from true gross margin (cost ÷ (1 − margin)) — edit it directly any time.</p>

            {(() => {
              const cost = parseFloat(costDollars);
              const price = parseFloat(finalPriceDollars);
              if (isNaN(cost) || isNaN(price) || price <= 0) return null;
              const profit = price - cost;
              const actualMargin = (profit / price) * 100;
              return (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                  Estimated gross profit: <strong style={{ color: "var(--ink)" }}>${profit.toFixed(2)}</strong> per item
                  {" — "}actual gross margin at this price: <strong style={{ color: "var(--ink)" }}>{actualMargin.toFixed(1)}%</strong>
                  <br />
                  <span style={{ fontStyle: "italic" }}>Estimate only — doesn't include shipping or payment processing fees.</span>
                </div>
              );
            })()}
          </div>

          <button className="pb2-btn" style={{ marginTop: 14 }} disabled={selectedVariantIds.length === 0} onClick={goToPlacements}>
            Next: place your artwork →
          </button>
        </>
      )}

      {step === "placements" && (
        <>
          <button className="pb2-btn pb2-btn-ghost" style={{ marginBottom: 14 }} onClick={() => setStep("pick-variants")}>← Back</button>
          <label className="pb2-label">Place your artwork</label>
          <p className="pb2-hint" style={{ marginTop: 0 }}>
            Each box below is a separate spot on "{selectedBlueprintTitle}". Add an image or text to the spots you want — any spot left empty stays blank.
          </p>

          {printAreas.length === 0 ? (
            <div className="pb2-card" style={{ boxShadow: "none" }}>
              <p className="pb2-hint" style={{ margin: 0 }}>
                Printify didn't report separate print areas for this product, so your main design will go in the default spot.
              </p>
            </div>
          ) : (
            printAreas.map((area) => {
              const assigned = placements[area.position];
              const ratio = area.width && area.height ? area.width / area.height : 1;
              return (
                <div key={area.position} style={{ border: "1px solid var(--panel-border)", borderRadius: 12, padding: 12, marginTop: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{areaLabel(area.position)}</strong>
                    <span className="pb2-hint">
                      {area.width && area.height ? `${area.width} × ${area.height} px · ${shapeHint(area)}` : "size not provided"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div
                      style={{
                        width: 120, aspectRatio: ratio, maxHeight: 170, borderRadius: 8,
                        border: assigned ? "1px solid var(--panel-border)" : "1px dashed var(--muted)",
                        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
                        ...(assigned ? checkerStyle : {}),
                      }}
                    >
                      {assigned ? (
                        <img src={assigned.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span className="pb2-hint">Empty</span>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 170 }}>
                      <div className="pb2-hint">
                        {assigned ? `Printing here: ${assigned.label}` : "Nothing will print here."}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {design?.image_url && (
                          <button
                            className="pb2-btn pb2-btn-ghost"
                            style={{ fontSize: 11, padding: "5px 8px" }}
                            onClick={() => assign(area.position, design.image_url, brand?.brand_name || "Main design")}
                          >
                            Use main design
                          </button>
                        )}
                        <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "5px 8px" }} onClick={() => openPicker(area.position)}>
                          My library
                        </button>
                        <button
                          className="pb2-btn pb2-btn-ghost"
                          style={{ fontSize: 11, padding: "5px 8px" }}
                          onClick={() => { setEditingArea(area); setStep("editing-area"); }}
                        >
                          {assigned ? "Edit / add text" : "Create here (text & images)"}
                        </button>
                        {assigned && (
                          <button
                            className="pb2-btn pb2-btn-ghost"
                            style={{ fontSize: 11, padding: "5px 8px", color: "var(--red)" }}
                            onClick={() => clearArea(area.position)}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {pickerFor === area.position && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
                      <div className="pb2-hint" style={{ marginBottom: 8 }}>Pick an image for {areaLabel(area.position)}:</div>
                      {libraryLoading ? (
                        <p className="pb2-hint">Loading your library…</p>
                      ) : library.items.length === 0 ? (
                        <p className="pb2-hint">Nothing in your library yet — upload images in My Assets first.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                          {library.items.map((item) => (
                            <button
                              key={item.key}
                              onClick={() => assign(area.position, item.image_url, item.label)}
                              style={{ background: "none", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 4, cursor: "pointer", color: "var(--ink)" }}
                            >
                              <img src={item.image_url} alt={item.label} style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 4, ...checkerStyle }} />
                              <div className="pb2-hint" style={{ fontSize: 10, marginTop: 2, wordBreak: "break-word" }}>{item.label}</div>
                            </button>
                          ))}
                        </div>
                      )}
                      <button className="pb2-btn pb2-btn-ghost" style={{ marginTop: 8, fontSize: 12, padding: "6px 10px" }} onClick={() => setPickerFor(null)}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {printAreas.length > 0 && (
            <p className="pb2-hint" style={{ marginTop: 14 }}>
              {Object.keys(placements).length} of {printAreas.length} print area{printAreas.length === 1 ? "" : "s"} will have artwork.
              {" "}Selling price: ${parseFloat(finalPriceDollars || "0").toFixed(2)} per item.
            </p>
          )}

          <button className="pb2-btn" style={{ marginTop: 10 }} onClick={createProduct}>
            Create draft product
          </button>
        </>
      )}

      {step === "creating" && <p>Creating your product on Printify… this can take a little longer when there's artwork on several areas.</p>}

      {step === "done" && (
        <>
          <p style={{ color: "var(--green)", fontWeight: 600 }}>
            Here's what it looks like:
          </p>
          {createdProduct?.images?.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              {createdProduct.images.slice(0, 6).map((img, i) => (
                <img key={i} src={img.src || img} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid var(--panel-border)" }} />
              ))}
            </div>
          )}

          {placedSummary.length > 0 && (
            <div className="pb2-card" style={{ boxShadow: "none" }}>
              <div className="pb2-section-label">What went where</div>
              <ul style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
                {placedSummary.map((p) => (
                  <li key={p.position}><strong>{areaLabel(p.position)}:</strong> {p.label}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pb2-card" style={{ background: "rgba(34,211,238,0.06)", borderColor: "var(--accent2)" }}>
            <div className="pb2-section-label">Where to find this in Printify</div>
            <ol style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: 0 }}>
              <li>Open printify.com and log into your account (same account you connected here).</li>
              <li>Click <strong>My Products</strong> in the left menu.</li>
              <li>Click the <strong>Drafts</strong> tab — your product "{brand?.brand_name}" will be there.</li>
              <li>Open it to see full mockups, edit placement, or publish it to a store.</li>
            </ol>
          </div>
          <button className="pb2-btn" style={{ marginTop: 14 }} onClick={onDone}>Back to dashboard</button>
        </>
      )}
    </div>
  );
}
