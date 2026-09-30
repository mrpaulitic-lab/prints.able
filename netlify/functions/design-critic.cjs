const { createClient } = require("@supabase/supabase-js");
const { chatJSONWithImage } = require("./lib/ai-client.cjs");
const { buildBrandContext } = require("./lib/ai-context.cjs");

const FREE_GENERATION_LIMIT = 3;
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromToken(authHeader) {
  const token = (authHeader || "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const designId = body.design_id;
  if (!designId) return { statusCode: 400, body: JSON.stringify({ error: "Missing design_id." }) };

  const { data: design, error: designError } = await supabaseAdmin
    .from("designs").select("*").eq("id", designId).eq("user_id", user.id).single();
  if (designError || !design) {
    return { statusCode: 404, body: JSON.stringify({ error: "Design not found." }) };
  }
  if (!design.image_url) {
    return { statusCode: 400, body: JSON.stringify({ error: "This design has no image to review." }) };
  }

  let brand = null;
  if (design.brand_id) {
    const { data: brandData } = await supabaseAdmin.from("brands").select("*").eq("id", design.brand_id).single();
    brand = brandData;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("*").eq("id", user.id).single();
  if (profileError) {
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load your account." }) };
  }
  const limit = FREE_GENERATION_LIMIT + (profile.bonus_generations || 0);
  if (profile.plan === "free" && profile.generation_count >= limit) {
    return { statusCode: 402, body: JSON.stringify({ error: "paywall", message: "You've used all your free generations. Upgrade to keep using AI review." }) };
  }

  const context = brand ? buildBrandContext(brand) : "No brand context available for this design.";

  let review;
  try {
    review = await chatJSONWithImage({
      text: `Brand context:\n${context}\n\nLook at the attached design image and give a brief AI assessment for print-on-demand merch use.`,
      imageUrl: design.image_url,
      system:
        "You review print-on-demand merch designs. Use cautious, non-definitive language throughout " +
        '(e.g. "potential improvement", "AI assessment", "consider testing") — never claim a design ' +
        "will or won't sell, and never state opinions as objective fact. " +
        "Return ONLY JSON with this shape: " +
        '{"brand_consistency": string, "audience_relevance": string, "print_suitability": string, ' +
        '"composition": string, "overall_note": string}. Each value should be one short sentence.',
      maxTokens: 350,
    });
  } catch (err) {
    console.error("Design critic failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Could not review this design. Try again." }) };
  }

  await supabaseAdmin.from("profiles").update({ generation_count: profile.generation_count + 1 }).eq("id", user.id);

  return {
    statusCode: 200,
    body: JSON.stringify({
      review,
      generations_remaining: profile.plan === "free" ? limit - (profile.generation_count + 1) : null,
    }),
  };
};
