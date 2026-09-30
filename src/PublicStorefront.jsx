import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import GlobalStyle from "./GlobalStyle";

export default function PublicStorefront({ slug }) {
  const [brand, setBrand] = useState(null);
  const [design, setDesign] = useState(null);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    load();
  }, [slug]);

  async function load() {
    const { data: siteData, error: siteError } = await supabase
      .from("sites").select("*").eq("slug", slug).eq("published", true).maybeSingle();

    if (siteError || !siteData) {
      setStatus("not-found");
      return;
    }

    const { data: brandData } = await supabase.from("brands").select("*").eq("id", siteData.brand_id).maybeSingle();
    setBrand(brandData);

    const { data: designData } = await supabase.from("designs").select("*").eq("brand_id", siteData.brand_id).limit(1).maybeSingle();
    setDesign(designData);

    if (designData) {
      const { data: productData } = await supabase.from("products").select("*").eq("design_id", designData.id);
      setProducts(productData || []);
    }

    setStatus("found");
    document.title = `${brandData?.brand_name || "Brand"} — ${brandData?.tagline || "Made with Printsable"}`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = (brandData?.mission || "").slice(0, 160);
  }

  if (status === "loading") return <div className="pb2-app" style={{ padding: 40 }}>Loading…</div>;

  if (status === "not-found" || !brand) {
    return (
      <div className="pb2-app">
        <GlobalStyle />
        <div className="pb2-wrap" style={{ textAlign: "center", marginTop: 80 }}>
          <h1 className="pb2-title">Not found</h1>
          <p>This page doesn't exist or isn't published yet.</p>
        </div>
      </div>
    );
  }

  const visibleMerch = (brand.merch_collection || []).filter((m) => m.included !== false);

  return (
    <div className="pb2-app">
      <GlobalStyle />
      <div className="pb2-wrap" style={{ textAlign: "center" }}>
        {design?.image_url && (
          <img src={design.image_url} alt={brand.brand_name} style={{ width: 180, borderRadius: 16, border: "1px solid var(--panel-border)", margin: "20px auto" }} />
        )}
        <h1 className="pb2-title" style={{ fontSize: 44 }}>{brand.brand_name}</h1>
        <p style={{ fontStyle: "italic", fontSize: 18, color: "var(--muted)", marginTop: 6 }}>{brand.tagline}</p>
        <p style={{ maxWidth: 480, margin: "18px auto", fontSize: 15, lineHeight: 1.7 }}>{brand.mission}</p>

        {products.length > 0 && (
          <div className="pb2-card" style={{ textAlign: "left", marginTop: 30 }}>
            <div className="pb2-section-label" style={{ textAlign: "center" }}>Shop</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginTop: 10 }}>
              {products.map((p) => (
                <div key={p.id} style={{ border: "1px solid var(--panel-border)", borderRadius: 10, padding: 12, textAlign: "center" }}>
                  {p.images?.[0] && (
                    <img src={p.images[0]} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
                  )}
                  {p.price_cents && (
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, marginBottom: 8 }}>
                      ${(p.price_cents / 100).toFixed(2)}
                    </div>
                  )}
                  {p.buy_url ? (
                    <a href={p.buy_url} target="_blank" rel="noreferrer" className="pb2-btn" style={{ display: "block", textDecoration: "none", fontSize: 13 }}>
                      Buy Now
                    </a>
                  ) : (
                    <span className="pb2-hint">Coming soon</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleMerch.length > 0 && (
          <div className="pb2-card" style={{ textAlign: "left", marginTop: 20 }}>
            <div className="pb2-section-label" style={{ textAlign: "center" }}>The Collection</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginTop: 10 }}>
              {visibleMerch.map((m, i) => (
                <div key={i} style={{ border: "1px solid var(--panel-border)", borderRadius: 10, padding: 12 }}>
                  <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{m.item}</strong>
                  <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(brand.contact_email || brand.site_note) && (
          <div className="pb2-card" style={{ textAlign: "left", marginTop: 20 }}>
            <div className="pb2-section-label" style={{ textAlign: "center" }}>Good to Know</div>
            {brand.site_note && <p style={{ fontSize: 14, lineHeight: 1.6 }}>{brand.site_note}</p>}
            {brand.contact_email && (
              <p style={{ fontSize: 14 }}>
                Contact: <a href={`mailto:${brand.contact_email}`} style={{ color: "var(--accent2)" }}>{brand.contact_email}</a>
              </p>
            )}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 40 }}>
          Made with <a href={`${window.location.origin}/?ref=${brand.user_id}`} style={{ color: "var(--accent2)" }}>Printsable</a>
        </p>
      </div>
    </div>
  );
}
