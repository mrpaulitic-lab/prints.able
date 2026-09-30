import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { slugify } from "./slugify";

export default function Dashboard({ session, onOpenPush, onOpenEdit, onOpenDesignEditor }) {
  const [brands, setBrands] = useState([]);
  const [designsByBrand, setDesignsByBrand] = useState({});
  const [sitesByBrand, setSitesByBrand] = useState({});
  const [productsByDesign, setProductsByDesign] = useState({});
  const [loading, setLoading] = useState(true);
  const [busySiteFor, setBusySiteFor] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
    const [refreshingId, setRefreshingId] = useState(null);
  const [refreshError, setRefreshError] = useState("");
  const [reviewingId, setReviewingId] = useState(null);
  const [reviews, setReviews] = useState({});
  const [reviewError, setReviewError] = useState("");

  async function runDesignReview(designId) {
    setReviewingId(designId);
    setReviewError("");
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/design-critic", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshSession.access_token}` },
        body: JSON.stringify({ design_id: designId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.message || data.error || "Could not review this design.");
        return;
      }
      setReviews((prev) => ({ ...prev, [designId]: data.review }));
    } catch (err) {
      setReviewError("Network error — try again.");
    } finally {
      setReviewingId(null);
    }
  }


  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: brandData, error } = await supabase
      .from("brands")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setBrands(brandData || []);

    const { data: designData } = await supabase
      .from("designs")
      .select("*")
      .order("created_at", { ascending: true });
    const groupedDesigns = {};
    (designData || []).forEach((d) => {
      if (!groupedDesigns[d.brand_id]) groupedDesigns[d.brand_id] = [];
      groupedDesigns[d.brand_id].push(d);
    });
    setDesignsByBrand(groupedDesigns);

    const { data: siteData } = await supabase.from("sites").select("*");
    const groupedSites = {};
    (siteData || []).forEach((s) => { groupedSites[s.brand_id] = s; });
    setSitesByBrand(groupedSites);

    const { data: productData } = await supabase.from("products").select("*");
    const groupedProducts = {};
    (productData || []).forEach((p) => {
      if (!groupedProducts[p.design_id]) groupedProducts[p.design_id] = [];
      groupedProducts[p.design_id].push(p);
    });
    setProductsByDesign(groupedProducts);

    setLoading(false);
  }

  async function togglePublish(brand) {
    setBusySiteFor(brand.id);
    const existing = sitesByBrand[brand.id];
    try {
      if (existing) {
        const { error } = await supabase.from("sites").update({ published: !existing.published }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const slug = slugify(brand.brand_name);
        const { error } = await supabase.from("sites").insert([{ brand_id: brand.id, user_id: session.user.id, slug, published: true }]);
        if (error) throw error;
      }
      await load();
    } catch (err) {
      console.error(err);
      alert("Could not update your site right now. Try again.");
    } finally {
      setBusySiteFor(null);
    }
  }

  async function refreshMarketing(brandId) {
    setRefreshingId(brandId);
    setRefreshError("");
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      const res = await fetch("/.netlify/functions/refresh-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshSession.access_token}` },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshError(data.message || data.error || "Could not refresh content.");
        return;
      }
      setBrands((prev) => prev.map((b) => (b.id === brandId ? { ...b, marketing: data.marketing } : b)));
    } catch (err) {
      setRefreshError("Network error — try again.");
    } finally {
      setRefreshingId(null);
    }
  }

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading your brands…</p>;

  if (brands.length === 0) {
    return (
      <div className="pb2-card">
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Nothing saved yet — generate your first brand in the Studio tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      {brands.map((b) => {
        const designs = designsByBrand[b.id] || [];
        const site = sitesByBrand[b.id];
        const isPublished = site?.published;
        const siteUrl = site ? `${window.location.origin}/b/${site.slug}` : null;
        const allProductImages = designs.flatMap((d) =>
          (productsByDesign[d.id] || []).flatMap((p) => p.images || [])
        );
        const isExpanded = expandedId === b.id;

        return (
          <div key={b.id} className="pb2-card">
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, margin: 0 }}>{b.brand_name}</h3>
            <p style={{ fontStyle: "italic", color: "var(--muted)", margin: "4px 0 10px" }}>{b.tagline}</p>

            {designs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="pb2-hint" style={{ marginBottom: 8 }}>Your designs — push any one to Printify:</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {designs.map((d) => (
                    <div key={d.id}>
                      <img src={d.image_url} alt={d.label || "Design"} style={{ width: "100%", borderRadius: 8, border: "1px solid var(--panel-border)" }} />
                      <div className="pb2-hint" style={{ margin: "4px 0" }}>{d.label || "Design"}</div>
                                          <button
                        className="pb2-btn"
                        style={{ fontSize: 12, padding: "6px 10px", width: "100%", marginBottom: 4 }}
                        onClick={() => onOpenPush(b, d)}
                      >
                        Push to Printify
                      </button>
                                            <button
                        className="pb2-btn pb2-btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px", width: "100%", marginBottom: 4 }}
                        onClick={() => onOpenDesignEditor({ sourceImage: d.image_url, sourceType: d.source || "ai_generated", label: d.label, brandId: b.id })}
                      >
                        Edit design
                      </button>
                      <button
                        className="pb2-btn pb2-btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px", width: "100%" }}
                        disabled={reviewingId === d.id}
                        onClick={() => runDesignReview(d.id)}
                      >
                        {reviewingId === d.id ? "Reviewing…" : "🔍 AI Review"}
                      </button>
                      {reviewError && reviewingId === null && <div className="pb2-error" style={{ marginTop: 6 }}>{reviewError}</div>}
                      {reviews[d.id] && (
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5, textAlign: "left" }}>
                          <div><strong>Brand fit:</strong> {reviews[d.id].brand_consistency}</div>
                          <div><strong>Audience:</strong> {reviews[d.id].audience_relevance}</div>
                          <div><strong>Print suitability:</strong> {reviews[d.id].print_suitability}</div>
                          <div><strong>Composition:</strong> {reviews[d.id].composition}</div>
                          <div style={{ marginTop: 4, fontStyle: "italic" }}>{reviews[d.id].overall_note}</div>
                        </div>
                      )}
                    </div>
                  ))}

                </div>
              </div>
            )}

            {allProductImages.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="pb2-hint" style={{ marginBottom: 6 }}>Real product photos from Printify:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {allProductImages.slice(0, 6).map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--panel-border)" }} />
                  ))}
                </div>
              </div>
            )}

            {isPublished && siteUrl && (
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Live at: <a href={siteUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent2)" }}>{siteUrl}</a>
              </p>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: isExpanded ? 18 : 0 }}>
              <button className="pb2-btn pb2-btn-ghost" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                {isExpanded ? "Hide full details" : "View full details"}
              </button>
              <button className="pb2-btn pb2-btn-ghost" onClick={() => onOpenEdit(b)}>Edit</button>
              <button className="pb2-btn pb2-btn-ghost" disabled={busySiteFor === b.id} onClick={() => togglePublish(b)}>
                {busySiteFor === b.id ? "Working…" : isPublished ? "Unpublish site" : "Publish site"}
              </button>
            </div>

            {isExpanded && (
              <div style={{ borderTop: "1px solid var(--panel-border)", paddingTop: 16 }}>
                <p style={{ fontSize: 14, lineHeight: 1.6 }}>{b.mission}</p>

                {b.merch_collection?.length > 0 && (
                  <>
                    <div className="pb2-section-label">Merch Collection</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
                      {b.merch_collection.map((m, i) => (
                        <div key={i} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, padding: 10, opacity: m.included === false ? 0.5 : 1 }}>
                          <strong style={{ display: "block", fontSize: 13 }}>{m.item}</strong>
                          <p style={{ fontSize: 12, margin: 0, color: "var(--muted)" }}>{m.description}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="pb2-section-label" style={{ marginBottom: 0 }}>Marketing Copy</div>
                  <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 12, padding: "6px 10px" }} disabled={refreshingId === b.id} onClick={() => refreshMarketing(b.id)}>
                    {refreshingId === b.id ? "Generating…" : "🔄 Refresh content"}
                  </button>
                </div>
                <p className="pb2-hint" style={{ marginTop: 4 }}>
                  This is draft copy for you to post yourself — any email or link mentioned here isn't live; it's a suggestion, not real infrastructure.
                </p>
                {refreshError && <div className="pb2-error">{refreshError}</div>}
                {["instagram", "facebook", "email"].map((k) =>
                  b.marketing?.[k] ? (
                    <div key={k} style={{ marginTop: 10 }}>
                      <strong style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textTransform: "uppercase" }}>{k}</strong>
                      <p style={{ fontSize: 13, whiteSpace: "pre-wrap", margin: "4px 0 0" }}>{b.marketing[k]}</p>
                    </div>
                  ) : null
                )}

                {b.launch_strategy?.length > 0 && (
                  <>
                    <div className="pb2-section-label" style={{ marginTop: 16 }}>Launch Strategy</div>
                    <ol style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18 }}>
                      {b.launch_strategy.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </>
                )}

                {b.revenue_opportunities?.length > 0 && (
                  <>
                    <div className="pb2-section-label">Revenue Opportunities</div>
                    <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18 }}>
                      {b.revenue_opportunities.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}

                <div className="pb2-section-label" style={{ marginTop: 16 }}>Recommended Next Steps</div>
                <p className="pb2-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                  Third-party services some sellers use when making a brand official — not required, and not audited by Printsable.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <a href="https://www.zenbusiness.com/" target="_blank" rel="noreferrer" className="pb2-btn pb2-btn-ghost" style={{ textAlign: "left", textDecoration: "none" }}>
                    Register an LLC — ZenBusiness
                  </a>
                  <a href="https://mercury.com/" target="_blank" rel="noreferrer" className="pb2-btn pb2-btn-ghost" style={{ textAlign: "left", textDecoration: "none" }}>
                    Open a business bank account — Mercury
                  </a>
                  <a href="https://www.namecheap.com/" target="_blank" rel="noreferrer" className="pb2-btn pb2-btn-ghost" style={{ textAlign: "left", textDecoration: "none" }}>
                    Register a domain — Namecheap
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
