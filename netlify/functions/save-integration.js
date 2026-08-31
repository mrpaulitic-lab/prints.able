import { supabaseAdmin, getUserFromRequest } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  const user = await getUserFromRequest(req);
  if (!user) return new Response(JSON.stringify({ error: "Please sign in first." }), { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { provider, api_key } = body;
  if (!provider || !api_key) {
    return new Response(JSON.stringify({ error: "Missing provider or API key." }), { status: 400 });
  }

  const testResp = await fetch("https://api.printify.com/v1/shops.json", {
    headers: { Authorization: `Bearer ${api_key}` },
  });
  if (!testResp.ok) {
    return new Response(JSON.stringify({ error: "That API token didn't work. Double check it and try again." }), { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("integrations")
    .upsert([{ user_id: user.id, provider, api_key }], { onConflict: "user_id,provider" });

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Could not save that key." }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
