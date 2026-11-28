const { supabaseAdmin, getUserFromToken, getPrintifyKey } = require("./_shared.cjs");

const BASE = "https://api.printify.com/v1";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };

  const apiKey = await getPrintifyKey(user.id);
  if (!apiKey) return { statusCode: 400, body: JSON.stringify({ error: "Connect Printify first." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const {
    shop_id, blueprint_id, print_provider_id, variant_ids, design_id, image_url,
    placements, title, description, price_cents, variant_prices, source_type,
  } = body;

  const requested = Array.isArray(placements)
    ? placements.filter((p) => p && p.position && p.image_url)
    : [];

  if (!shop_id || !blueprint_id || !print_provider_id || !variant_ids?.length || (!image_url && requested.length === 0)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields to create a product." }) };
  }

  // Each size/color can have its own price (cost + the chosen margin).
  // If none were sent, every option uses the single fallback price.
  const fallbackPrice = Number.isInteger(price_cents) && price_cents > 0 ? price_cents : 2000;
  function priceFor(id) {
    const p = variant_prices ? variant_prices[id] : null;
    return Number.isInteger(p) && p > 0 ? p : fallbackPrice;
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const safeTitle = (title || "design").replace(/[^a-zA-Z0-9-_]+/g, "-");

  try {
    // Step 1: ask Printify which print areas this exact product has,
    // including their sizes, for the sizes/colors the user selected.
    const variantsResp = await fetch(
      `${BASE}/catalog/blueprints/${blueprint_id}/print_providers/${print_provider_id}/variants.json`,
      { headers }
    );
    if (!variantsResp.ok) {
      throw new Error("Could not look up this product's print areas from Printify.");
    }
    const variantsData = await variantsResp.json();
    const selected = (variantsData.variants || []).filter((v) => variant_ids.includes(v.id));

    let common = null;
    for (const v of selected) {
      const list = (v.placeholders || []).filter((p) => p.position);
      common = common === null ? list : common.filter((p) => list.some((q) => q.position === p.position));
    }
    common = common || [];
    const areaByPosition = {};
    common.forEach((a) => { areaByPosition[a.position] = a; });
    const availablePositions = common.map((a) => a.position);

    // Step 2: decide which areas get which image.
    let toPlace;
    if (requested.length > 0) {
      const invalid = availablePositions.length
        ? requested.filter((p) => !areaByPosition[p.position])
        : [];
      if (invalid.length) {
        throw new Error(
          `These print areas don't exist for every size/color you selected: ${invalid.map((p) => p.position).join(", ")}. ` +
          `Available: ${availablePositions.join(", ") || "none found"}.`
        );
      }
      toPlace = requested;
    } else {
      const position = availablePositions.length
        ? (availablePositions.includes("front") ? "front" : availablePositions[0])
        : "front";
      toPlace = [{ position, image_url }];
    }

    // Step 3: upload each distinct image to Printify once, all at the same time.
    const uniqueUrls = [...new Set(toPlace.map((p) => p.image_url))];
    const uploadedByUrl = {};
    await Promise.all(
      uniqueUrls.map(async (url, index) => {
        const payload = { file_name: `${safeTitle}-${index + 1}.png` };
        if (url.startsWith("data:")) {
          payload.contents = url.split(",")[1];
        } else {
          payload.url = url;
        }
        const resp = await fetch(`${BASE}/uploads/images.json`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`Printify rejected an image upload: ${errText}`);
        }
        uploadedByUrl[url] = await resp.json();
      })
    );

    // Step 4: build one placeholder per area. Scale each image so it fits
    // inside its area (never cropped), using Printify's reported sizes.
    const placeholders = toPlace.map((p) => {
      const uploaded = uploadedByUrl[p.image_url];
      const area = areaByPosition[p.position];
      let scale = 1;
      if (area?.width && area?.height && uploaded?.width && uploaded?.height) {
        scale = Math.min(1, (area.height / area.width) * (uploaded.width / uploaded.height));
      }
      return {
        position: p.position,
        images: [{ id: uploaded.id, x: 0.5, y: 0.5, scale: Number(scale.toFixed(4)), angle: 0 }],
      };
    });

    // Step 5: create the draft product.
    const productResp = await fetch(`${BASE}/shops/${shop_id}/products.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: title || "Untitled product",
        description: description || "",
        blueprint_id,
        print_provider_id,
        variants: variant_ids.map((id) => ({ id, price: priceFor(id), is_enabled: true })),
        print_areas: [{ variant_ids, placeholders }],
      }),
    });

    if (!productResp.ok) {
      const errText = await productResp.text();
      throw new Error(
        `Printify rejected the product (areas tried: ${toPlace.map((p) => p.position).join(", ")}; ` +
        `areas available: ${availablePositions.length ? availablePositions.join(", ") : "none found"}): ${errText}`
      );
    }
    const product = await productResp.json();
    const images = (product.images || []).map((img) => img.src).filter(Boolean);

    // The storefront shows one price per product, so store the lowest one.
    const lowestPrice = Math.min(...variant_ids.map((id) => priceFor(id)));

    const productRow = {
      user_id: user.id,
      provider: "printify",
      provider_product_id: product.id,
      status: "draft",
      images,
      price_cents: lowestPrice,
    };
    if (source_type === "asset") {
      productRow.asset_id = design_id;
    } else {
      productRow.design_id = design_id;
    }
    await supabaseAdmin.from("products").insert([productRow]);

    return { statusCode: 200, body: JSON.stringify({ product }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Could not create the product." }) };
  }
};
