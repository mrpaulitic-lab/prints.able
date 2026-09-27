const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const FREE_GENERATION_LIMIT = 3;

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const brandId = body.brand_id;
  if (!brandId) return { statusCode: 400, body: JSON.stringify({ error: "Missing brand_id." }) };

  const { data: brand, error: brandError } = await supabaseAdmin
    .from("brands").select("*").eq("id", brandId).eq("user_id", user.id).single();
  if (brandError || !brand) {
    return { statusCode: 404, body: JSON.stringify({ error: "Brand not found." }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles").select("*").eq("id", user.id).single();
  if (profileError) {
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load your account." }) };
  }
  if (profile.plan === "free" && profile.generation_count >= FREE_GENERATION_LIMIT) {
    return { statusCode: 402, body: JSON.stringify({ error: "paywall", message: "You've used all your free generations. Upgrade to keep refreshing content." }) };
  }

  let marketing;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Write a fresh new set of social/email marketing copy for this existing brand — " +
            "a different angle and wording than a typical first draft, so it feels new each time. " +
            'Return ONLY JSON: {"instagram": string, "facebook": string, "email": string}.',
        },
        { role: "user", content: `Brand: ${brand.brand_name}\nTagline: ${brand.tagline}\nMission: ${brand.mission}` },
      ],
    });
    marketing = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error("Refresh generation failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not generate new content. Try again shortly." }) };
  }

  const { error: updateError } = await supabaseAdmin.from("brands").update({ marketing }).eq("id", brandId);
  if (updateError) {
    console.error(updateError);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save the new content." }) };
  }

  await supabaseAdmin.from("profiles").update({ generation_count: profile.generation_count + 1 }).eq("id", user.id);

  return {
    statusCode: 200,
    body: JSON.stringify({
      marketing,
      generations_remaining: profile.plan === "free" ? FREE_GENERATION_LIMIT - (profile.generation_count + 1) : null,
    }),
  };
};
