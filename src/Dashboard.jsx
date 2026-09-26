import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { slugify } from "./slugify";

export default function Dashboard({ session, onOpenPush, onOpenEdit }) {
  const [brands, setBrands] = useState([]);
  const [designsByBrand, setDesignsByBrand] = useState({});
  const [sitesByBrand, setSitesByBrand] = useState({});
  const [productsByDesign, setProductsByDesign] = useState({});
  const [loading, setLoading] = useState(true);
  const [busySiteFor, setBusySiteFor] = useState(null);

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

    const { data: designData } = await supabase.from("designs").select("*").order("created_at", { ascending: false });
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
        const { error } = await supabase
          .from("sites")
          .update({ published: !existing.published })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const slug = slugify(brand.brand_name);
        const { error } = await supabase
          .from("sites")
          .insert([{ brand_id: brand.id, user_id: session.user.id, slug, published: true }]);
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
        const mainDesign = designs[0];
        const site = sitesByBrand[b.id];
        const isPublished = site?.published;
        const siteUrl = site ? `${window.location.origin}/b/${site.slug}` : null;
        const products = mainDesign ? productsByDesign[mainDesign.id] || [] : [];
        const allProductImages = products.flatMap((p) => p.images || []);

        return (
          <div key={b.id} className="pb2-card">
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, margin: 0 }}>
              {b.brand_name}
            </h3>
            <p style={{ fontStyle: "italic", color: "var(--muted)", margin: "4px 0 10px" }}>{b.tagline}</p>
            {mainDesign?.image_url && (
              <img
                src={mainDesign.image_url}
                alt={b.brand_name}
                style={{ width: 140, borderRadius: 10, border: "1px solid var(--panel-border)", marginBottom: 12 }}
              />
            )}

            {allProductImages.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div className="pb2-hint" style={{ marginBottom: 6 }}>Real product photos from Printify:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {allProductImages.slice(0, 4).map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--panel-border)" }} />
                  ))}
                </div>
              </div>
            )}

            {isPublished && siteUrl && (
              <p style={{ fontSize: 13, marginBottom: 12 }}>
                Live at:{" "}
                <a href={siteUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent2)" }}>
                  {siteUrl}
                </a>
              </p>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="pb2-btn pb2-btn-ghost" onClick={() => onOpenEdit(b)}>
                Edit
              </button>
              {mainDesign && (
                <button className="pb2-btn" onClick={() => onOpenPush(b, mainDesign)}>
                  Push to Printify
                </button>
              )}
              <button
                className="pb2-btn pb2-btn-ghost"
                disabled={busySiteFor === b.id}
                onClick={() => togglePublish(b)}
              >
                {busySiteFor === b.id ? "Working…" : isPublished ? "Unpublish site" : "Publish site"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
