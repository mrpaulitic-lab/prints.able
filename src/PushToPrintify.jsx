import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import DesignEditor from "./DesignEditor";
import LibraryPicker from "./LibraryPicker";
import { checkerStyle } from "./checker";

const PAGE_SIZE = 30;

async function authedFetch(path, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  const rawText = await res.text();
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { error: `The server sent an unreadable reply (status ${res.status}).` };
  }
  if (!res.ok) {
    throw new Error(
      data.error || data.errorMessage || `Request failed (status ${res.status}). The server may have timed out or crashed.`
    );
  }
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

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function moneyRange(min, max) {
  return min === max ? money(min) : `${money(min)} – ${money(max)}`;
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
  const [marginPercent, setMarginPercent] = useState("40");
  const [manualPrice, setManualPrice] = useState("");
  const [createdProduct, setCreatedProduct] = useState(null);
  const [placements, setPlacements] = useState({});
  const [editingArea, setEditingArea] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);
  const [copyFor, setCopyFor] = useState(null);
  const [copyTargets, setCopyTargets] = useState([]);
  const [placedSummary, setPlacedSummary] = useState([]);
  const [priceSummary, setPriceSummary] = useState("");

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

  // Pricing comes straight from Printify's cost for each size/color.
  // One profit margin is applied to all of them: price = cost / (1 - margin).
  const hasCosts = selectedVariants.length > 0 && selectedVariants.every((v) => typeof v.cost === "number");
  const marginNum = parseFloat(marginPercent);
  const marginValid = !isNaN(marginNum) && marginNum >= 0 && marginNum <= 90;
  function priceCentsFor(v) {
    return Math.ceil(v.cost / (1 - marginNum / 100));
  }

  let pricingSummary = null;
  if (hasCosts && marginValid) {
    const costs = selectedVariants.map((v) => v.cost);
    const prices = selectedVariants.map((v) => priceCentsFor(v));
    const profits = selectedVariants.map((v) => priceCentsFor(v) - v.cost);
    pricingSummary = {
      minCost: Math.min(...costs), maxCost: Math.max(...costs),
      minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
      minProfit: Math.min(...profits), maxProfit: Math.max(...profits),
    };
  }

  function goToPlacements() {
    setError("");
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

  function applyCopy(fromPosition) {
    const source = placements[fromPosition];
    if (!source) return;
    setPlacements((prev) => {
      const next = { ...prev };
      copyTargets.forEach((position) => { next[position] = { ...source }; });
      return next;
    });
    setCopyFor(null);
    setCopyTargets([]);
  }

  async function createProduct() {
    setError("");

    let variantPrices = null;
    let fallbackPriceCents = null;
    if (hasCosts) {
      if (!marginValid) {
        setError("Enter a profit margin between 0 and 90%.");
        return;
      }
      variantPrices = {};
      selectedVariants.forEach((v) => { variantPrices[v.id] = priceCentsFor(v); });
    } else {
      fallbackPriceCents = Math.round(parseFloat(manualPrice || "0") * 100);
      if (!fallbackPriceCents || fallbackPriceCents <= 0) {
        setError("Enter a selling price before creating the product.");
        return;
      }
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
        variant_prices: variantPrices || undefined,
        price_cents: fallbackPriceCents || undefined,
      });
      setCreatedProduct(result.product);
      setPlacedSummary(assigned.map(({ position, label }) => ({ position, label })));
      if (variantPrices) {
        const all = Object.values(variantPrices);
        setPriceSummary(moneyRange(Math.min(...all), Math.max(...all)));
      } else {
        setPriceSummary(money(fallbackPriceCents));
      }
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
          <p className="pb2-hint" style={{ marginTop: 0 }}>
            Printify's cost for each option is shown on the right. You'll set your profit margin on the last step.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setSelectedVariantIds(variants.map((v) => v.id))}>Select all</button>
            <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setSelectedVariantIds([])}>Clear</button>
          </div>
          <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--panel-border)", borderRadius: 10, padding: 10 }}>
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
                  <span className="pb2-hint" style={{ marginLeft: "auto" }}>Printify cost: {money(v.cost)}</span>
                )}
              </label>
            ))}
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
            Each box below is a separate spot on "{selectedBlueprintTitle}". Add artwork to the spots you want — any spot left empty stays blank.
            To put several images (and text) in one spot, use "Create here" and add as many as you like.
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
              const otherAreas = printAreas.filter((a) => a.position !== area.position);
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
                        <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "5px 8px" }} onClick={() => { setCopyFor(null); setPickerFor(area.position); }}>
                          My library
                        </button>
                        <button
                          className="pb2-btn pb2-btn-ghost"
                          style={{ fontSize: 11, padding: "5px 8px" }}
                          onClick={() => { setEditingArea(area); setStep("editing-area"); }}
                        >
                          {assigned ? "Edit / add images & text" : "Create here (images & text)"}
                        </button>
                        {assigned && otherAreas.length > 0 && (
                          <button
                            className="pb2-btn pb2-btn-ghost"
                            style={{ fontSize: 11, padding: "5px 8px" }}
                            onClick={() => { setPickerFor(null); setCopyTargets([]); setCopyFor(area.position); }}
                          >
                            Copy to…
                          </button>
                        )}
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
                    <LibraryPicker
                      title={`Pick an image for ${areaLabel(area.position)}`}
                      onPick={(item) => assign(area.position, item.image_url, item.label)}
                      onClose={() => setPickerFor(null)}
                    />
                  )}

                  {copyFor === area.position && assigned && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
                      <div className="pb2-hint" style={{ marginBottom: 8 }}>Also print "{assigned.label}" on:</div>
                      {otherAreas.map((other) => (
                        <label key={other.position} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
                          <input
                            type="checkbox"
                            checked={copyTargets.includes(other.position)}
                            onChange={(e) =>
                              setCopyTargets((prev) =>
                                e.target.checked ? [...prev, other.position] : prev.filter((p) => p !== other.position)
                              )
                            }
                          />
                          {areaLabel(other.position)}
                          {other.width && other.height && (
                            <span className="pb2-hint" style={{ marginLeft: "auto" }}>{other.width} × {other.height} px</span>
                          )}
                        </label>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button className="pb2-btn" style={{ fontSize: 12, padding: "6px 12px" }} disabled={copyTargets.length === 0} onClick={() => applyCopy(area.position)}>
                          Apply
                        </button>
                        <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => { setCopyFor(null); setCopyTargets([]); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {printAreas.length > 0 && (
            <p className="pb2-hint" style={{ marginTop: 14 }}>
              {Object.keys(placements).length} of {printAreas.length} print area{printAreas.length === 1 ? "" : "s"} will have artwork.
            </p>
          )}

          <div style={{ marginTop: 20, borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
            <div className="pb2-section-label">Pricing</div>
            {hasCosts ? (
              <>
                <p className="pb2-hint" style={{ marginTop: 0 }}>
                  Printify's cost for each size/color is loaded automatically. Choose one profit margin and every option is priced from its own cost.
                </p>
                <label className="pb2-label">Profit margin (%)</label>
                <input
                  className="pb2-input"
                  type="number"
                  step="1"
                  min="0"
                  max="90"
                  value={marginPercent}
                  onChange={(e) => setMarginPercent(e.target.value)}
                />
                {pricingSummary ? (
                  <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.8 }}>
                    <div><span className="pb2-hint">Printify cost: </span><strong>{moneyRange(pricingSummary.minCost, pricingSummary.maxCost)}</strong></div>
                    <div><span className="pb2-hint">Your selling price: </span><strong>{moneyRange(pricingSummary.minPrice, pricingSummary.maxPrice)}</strong></div>
                    <div><span className="pb2-hint">Estimated profit per item: </span><strong>{moneyRange(pricingSummary.minProfit, pricingSummary.maxProfit)}</strong></div>
                    <div className="pb2-hint" style={{ fontStyle: "italic" }}>
                      Estimate only — doesn't include shipping or payment processing fees.
                    </div>
                  </div>
                ) : (
                  <div className="pb2-hint" style={{ marginTop: 8 }}>Enter a margin between 0 and 90 to see prices.</div>
                )}
              </>
            ) : (
              <>
                <p className="pb2-hint" style={{ marginTop: 0 }}>
                  Printify didn't provide costs for this product, so enter one selling price for every option.
                </p>
                <label className="pb2-label">Selling price ($)</label>
                <input
                  className="pb2-input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 24.99"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                />
              </>
            )}
          </div>

          <button className="pb2-btn" style={{ marginTop: 16 }} onClick={createProduct}>
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

          {priceSummary && (
            <p style={{ fontSize: 13 }}>
              <span className="pb2-hint">Selling price set to: </span><strong>{priceSummary}</strong>
            </p>
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
