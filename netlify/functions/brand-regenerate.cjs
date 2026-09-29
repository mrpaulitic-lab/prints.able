const { createClient } = require("@supabase/supabase-js");
const { chatJSON } = require("./lib/ai-client.cjs");
const { buildBrandContext } = require("./lib/ai-context.cjs");

const FREE_GENERATION_LIMIT = 3;
const ALLOWED_FIELDS = ["brand_name", "tagline", "mission", "merch_collection"];

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
  const { brand_id, field } = body;

  if (!brand_id || !ALLOWED_FIELDS.includes(field)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing or invalid field to regenerate." }) };
  }

  const { data: brand, error: brandError } = await supabaseAdmin
    .from("brands").select("*").eq("id", brand_id).eq("user_id", user.id).single();
  if (brandError || !brand) {
    return { statusCode: 404, body: JSON.stringify({ error: "Brand not found." }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("*").eq("id", user.id).single();
  if (profileError) {
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load your account." }) };
  }
  const limit = FREE_GENERATION_LIMIT + (profile.bonus_generations || 0);
  if (profile.plan === "free" && profile.generation_count >= limit) {
    return { statusCode: 402, body: JSON.stringify({ error: "paywall", message: "You've used all your free generations. Upgrade to keep regenerating." }) };
  }

  const context = buildBrandContext(brand);

  const fieldInstructions = {
    brand_name: 'Suggest ONE new brand name, different from the current one. Return ONLY JSON: {"brand_name": string}.',
    tagline: 'Suggest ONE new tagline, different from the current one. Return ONLY JSON: {"tagline": string}.',
    mission: 'Write ONE new mission/description, different in wording from the current one but consistent with the brand. Return ONLY JSON: {"mission": string}.',
    merch_collection:
      'Suggest a fresh set of merch/product ideas for this brand, different from the current ones. ' +
      'For each item include a one-sentence design_prompt (graphic only, no text/letters) describing artwork for that product. ' +
      'Return ONLY JSON: {"merch_collection": [{"item": string, "description": string, "design_prompt": string}]}.',
  };

  let result;
  try {
    result = await chatJSON({
      system:
        "You help refine an existing print-on-demand merch brand. Only change what's asked — keep it " +
        "consistent with the rest of the brand's identity below. " + fieldInstructions[field],
      user: context,
      maxTokens: field === "merch_collection" ? 700 : 200,
    });
  } catch (err) {
    console.error("Regenerate failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Could not regenerate that. Try again." }) };
  }

  if (!(field in result)) {
    return { statusCode: 500, body: JSON.stringify({ error: "The AI response was missing the expected data. Try again." }) };
  }

  let newValue = result[field];
  if (field === "merch_collection") {
    if (!Array.isArray(newValue)) {
      return { statusCode: 500, body: JSON.stringify({ error: "The AI response wasn't in the right format. Try again." }) };
    }
    newValue = newValue.map((m) => ({ ...m, included: true }));
  }

  const { error: updateError } = await supabaseAdmin
    .from("brands").update({ [field]: newValue }).eq("id", brand_id);
  if (updateError) {
    console.error(updateError);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save the new value." }) };
  }

  await supabaseAdmin.from("profiles").update({ generation_count: profile.generation_count + 1 }).eq("id", user.id);

  return {
    statusCode: 200,
    body: JSON.stringify({
      field,
      value: newValue,
      generations_remaining: profile.plan === "free" ? limit - (profile.generation_count + 1) : null,
    }),
  };
};
