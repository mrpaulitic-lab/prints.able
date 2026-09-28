const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const MAX_DESIGNS_PER_BRAND = 6;

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getUserFromToken(authHeader) {
  const token = (authHeader || "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function saveImage(userId, b64) {
  try {
    const buffer = Buffer.from(b64, "base64");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error } = await supabaseAdmin.storage
      .from("designs")
      .upload(path, buffer, { contentType: "image/png" });
    if (error) {
      console.error("Storage upload failed:", error);
      return null;
    }
    const { data } = supabaseAdmin.storage.from("designs").getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("Storage upload crashed:", err);
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const brandId = body.brand_id;
  const itemIndex = Number.isInteger(body.item_index) ? body.item_index : -1;
  if (!brandId || itemIndex < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing brand_id or item_index." }) };
  }

  const { data: brand, error: brandError } = await supabaseAdmin
    .from("brands").select("*").eq("id", brandId).eq("user_id", user.id).single();
  if (brandError || !brand) {
    return { statusCode: 404, body: JSON.stringify({ error: "Brand not found." }) };
  }

  const item = (brand.merch_collection || [])[itemIndex];
  if (!item) {
    return { statusCode: 400, body: JSON.stringify({ error: "That product doesn't exist for this brand." }) };
  }

  // If this product already has a design, return it instead of paying for another.
  const { data: existing } = await supabaseAdmin
    .from("designs").select("*").eq("brand_id", brandId).eq("label", item.item).limit(1);
  if (existing && existing.length > 0) {
    return { statusCode: 200, body: JSON.stringify({ design: existing[0], reused: true }) };
  }

  const { count } = await supabaseAdmin
    .from("designs").select("id", { count: "exact", head: true }).eq("brand_id", brandId);
  if ((count || 0) >= MAX_DESIGNS_PER_BRAND) {
    return { statusCode: 400, body: JSON.stringify({ error: "This brand has reached its design limit." }) };
  }

  const basePrompt =
    item.design_prompt ||
    `Artwork for a ${item.item} for the brand ${brand.brand_name}, ${brand.tagline}`;
  const fullPrompt =
    `${basePrompt}. Bold, simple graphic suitable for printing on merchandise, ` +
    `centered on a plain background. No text or letters.`;

  let imageResp;
  try {
    imageResp = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "medium",
    });
  } catch (err) {
    console.error("Design generation failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not create this design. Try again shortly." }) };
  }

  const b64 = imageResp.data[0]?.b64_json;
  if (!b64) {
    return { statusCode: 500, body: JSON.stringify({ error: "The image service returned nothing." }) };
  }
  const imageUrl = (await saveImage(user.id, b64)) || `data:image/png;base64,${b64}`;

  const { data: design, error: insertError } = await supabaseAdmin
    .from("designs")
    .insert([{
      brand_id: brandId,
      user_id: user.id,
      image_url: imageUrl,
      image_prompt: fullPrompt,
      label: item.item,
    }])
    .select()
    .single();

  if (insertError) {
    console.error(insertError);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save the design." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ design }) };
};
