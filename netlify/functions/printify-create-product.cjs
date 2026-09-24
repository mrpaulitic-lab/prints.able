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
  const { shop_id, blueprint_id, print_provider_id, variant_ids, design_id, image_url, title, description } = body;

  if (!shop_id || !blueprint_id || !print_provider_id || !variant_ids?.length || !image_url) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing required fields to create a product." }) };
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  try {
    const uploadResp = await fetch(`${BASE}/uploads/images.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({ file_name: `${(title || "design").replace(/\s+/g, "-")}.png`, url: image_url }),
    });
    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      throw new Error(`Printify rejected the image upload: ${errText}`);
    }
    const uploaded = await uploadResp.json();

    const productResp = await fetch(`${BASE}/shops/${shop_id}/products.json`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: title || "Untitled product",
        description: description || "",
        blueprint_id,
        print_provider_id,
        variants: variant_ids.map((id) => ({ id, price: 2000, is_enabled: true })),
        print_areas: [
          {
            variant_ids,
            placeholders: [
              { position: "front", images: [{ id: uploaded.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] },
            ],
          },
        ],
      }),
    });

    if (!productResp.ok) {
      const errText = await productResp.text();
      throw new Error(`Printify rejected the product: ${errText}`);
    }
    const product = await productResp.json();

    await supabaseAdmin.from("products").insert([{
      design_id, user_id: user.id, provider: "printify", provider_product_id: product.id, status: "draft",
    }]);

    return { statusCode: 200, body: JSON.stringify({ product }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Could not create the product." }) };
  }
};
