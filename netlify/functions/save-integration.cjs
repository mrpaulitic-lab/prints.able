const { supabaseAdmin, getUserFromToken } = require("./_shared.cjs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
  const { provider, api_key } = body;
  if (!provider || !api_key) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing provider or API key." }) };
  }

  const testResp = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: `Bearer ${api_key}` },
  });
  if (!testResp.ok) {
    return { statusCode: 400, body: JSON.stringify({ error: "That API token didn't work. Double check it and try again." }) };
  }

  const { error } = await supabaseAdmin
    .from("integrations")
    .upsert([{ user_id: user.id, provider, api_key }], { onConflict: "user_id,provider" });

  if (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not save that key." }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
