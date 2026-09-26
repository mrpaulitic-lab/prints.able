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
      .from("sites")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (siteError || !siteData) {
      setStatus("not-found");
      return;
    }

    const { data: brandData } = await supabase
      .from("brands")
      .select("*")
      .eq("id", siteData.brand_id)
      .maybeSingle();
    setBrand(brandData);

    const { data: designData } = await supabase
      .from("designs")
      .select("*")
      .eq("brand_id", siteData.brand_id)
      .limit(1)
      .maybeSingle();
    setDesign(designData);

    if (designData) {
      const { data: productData } = await supabase
        .from("products")
        .select("*")
        .eq("design_id", designData.id);
      setProducts(productData || []);
    }

    setStatus("found");
  }

  if (status === "loading") {
    return <div className="pb2-app" style={{ padding: 40 }}>Loading…</div>;
  }

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

  // Only show merch items the owner chose to include (defaults to true
  // for older brands generated before this option existed).
  const visibleMerch = (brand.merch_collection || []).filter((m) => m.included !== false);
  const allProductImages = products.flatMap((p) => p.images || []);

  return (
    <div className="pb2-app">
      <GlobalStyle />
      <div className="pb2-wrap" style={{ textAlign: "center" }}>
        {design?.image_url && (
          <img
            src={design.image_url}
            alt={brand.brand_name}
            style={{ width: 180, borderRadius: 16, border: "1px solid var(--panel-border)", margin: "20px auto" }}
          />
        )}
        <h1 className="pb2-title" style={{ fontSize: 44 }}>{brand.brand_name}</h1>
        <p style={{ fontStyle: "italic", fontSize: 18, color: "var(--muted)", marginTop: 6 }}>{brand.tagline}</p>
        <p style={{ maxWidth: 480, margin: "18px auto", fontSize: 15, lineHeight: 1.7 }}>{brand.mission}</p>

        {allProductImages.length > 0 && (
          <div className="pb2-card" style={{ textAlign: "left", marginTop: 30 }}>
            <div className="pb2-section-label" style={{ textAlign: "center" }}>Product Photos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginTop: 10 }}>
              {allProductImages.map((img, i) => (
                <img key={i} src={img} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, border: "1px solid var(--panel-border)" }} />
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

        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 40 }}>Made with Printsable</p>
      </div>
    </div>
  );
}
