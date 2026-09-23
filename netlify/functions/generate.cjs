const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

const FREE_GENERATION_LIMIT = 3;

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const prompt = (body.prompt || "").trim();
  if (!prompt || prompt.length < 5) {
    return { statusCode: 400, body: JSON.stringify({ error: "Tell us a bit more about your idea." }) };
  }
  if (prompt.length > 500) {
    return { statusCode: 400, body: JSON.stringify({ error: "Keep your idea under 500 characters." }) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error(profileError);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not load your account. Try again shortly." }) };
  }

  if (profile.plan === "free" && profile.generation_count >= FREE_GENERATION_LIMIT) {
    return {
      statusCode: 402,
      body: JSON.stringify({ error: "paywall", message: "You've used all your free brand packages. Upgrade to keep generating." }),
    };
  }

  let brandPackage;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You help small business owners and creators launch print-on-demand merch brands. " +
            "Return ONLY a JSON object with this exact shape: " +
            '{"brand_name": string, "tagline": string, "mission": string, ' +
            '"merch_collection": [{"item": string, "description": string}], ' +
            '"marketing": {"instagram": string, "facebook": string, "email": string}, ' +
            '"launch_strategy": [string], "revenue_opportunities": [string], ' +
            '"image_prompt": string}. ' +
            "image_prompt should describe a simple logo or graphic design concept suitable " +
            "for printing on merch — no text or letters in the image, just a visual mark. " +
            "Be concrete and specific to what the user described, not generic.",
        },
        { role: "user", content: prompt },
      ],
    });
    brandPackage = JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error("OpenAI text generation failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Generation failed. Try again shortly." }) };
  }

  let imageUrl = null;
  try {
    const imageResp = await openai.images.generate({
      model: "gpt-image-1",
      prompt: brandPackage.image_prompt || `A simple logo concept for a brand about: ${prompt}`,
      size: "1024x1024",
    });
    const b64 = imageResp.data[0]?.b64_json;
    imageUrl = b64 ? `data:image/png;base64,${b64}` : null;
  } catch (err) {
    console.error("OpenAI image generation failed:", err);
  }

  const { data: savedBrand, error: brandInsertError } = await supabaseAdmin
    .from("brands")
    .insert([{
      user_id: user.id,
      prompt,
      brand_name: brandPackage.brand_name,
      tagline: brandPackage.tagline,
      mission: brandPackage.mission,
      merch_collection: brandPackage.merch_collection,
      marketing: brandPackage.marketing,
      launch_strategy: brandPackage.launch_strategy,
      revenue_opportunities: brandPackage.revenue_opportunities,
    }])
    .select()
    .single();

  if (brandInsertError) console.error(brandInsertError);

  if (savedBrand) {
    const { error: designInsertError } = await supabaseAdmin
      .from("designs")
      .insert([{
        brand_id: savedBrand.id,
        user_id: user.id,
        image_url: imageUrl,
        image_prompt: brandPackage.image_prompt,
      }]);
    if (designInsertError) console.error(designInsertError);
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ generation_count: profile.generation_count + 1 })
    .eq("id", user.id);
  if (updateError) console.error(updateError);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...brandPackage,
      image_url: imageUrl,
      generations_remaining:
        profile.plan === "free" ? FREE_GENERATION_LIMIT - (profile.generation_count + 1) : null,
    }),
  };
};
