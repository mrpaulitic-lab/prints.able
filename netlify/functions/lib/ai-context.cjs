// Turns full database rows into short, focused context for one specific
// AI operation — so we never send more of the user's data than needed.

function buildBrandContext(brand) {
  if (!brand) return "";
  return [
    `Brand name: ${brand.brand_name || "(none yet)"}`,
    `Tagline: ${brand.tagline || "(none yet)"}`,
    `Mission: ${brand.mission || "(none yet)"}`,
    `Original idea: ${brand.prompt || "(unknown)"}`,
  ].join("\n");
}

function buildDesignContext(designs) {
  if (!designs || designs.length === 0) return "No designs created yet.";
  return designs.map((d) => `- ${d.label || "Design"}: ${d.image_prompt || "(no description)"}`).join("\n");
}

function buildProductContext(products) {
  if (!products || products.length === 0) return "No products created yet.";
  return products.map((p) => `- ${p.provider} product, status: ${p.status}`).join("\n");
}

function buildMarketingContext(brand) {
  if (!brand?.marketing) return "No marketing copy yet.";
  const m = brand.marketing;
  return [
    m.instagram ? `Instagram draft: ${m.instagram}` : null,
    m.facebook ? `Facebook draft: ${m.facebook}` : null,
    m.email ? `Email draft: ${m.email}` : null,
  ].filter(Boolean).join("\n") || "No marketing copy yet.";
}

module.exports = { buildBrandContext, buildDesignContext, buildProductContext, buildMarketingContext };
