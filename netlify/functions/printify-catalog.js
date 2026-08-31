import { getUserFromRequest, getPrintifyKey } from "./_shared.js";

const BASE = "https://api.printify.com/v1";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  const user = await getUserFromRequest(req);
  if (!user) return new Response(JSON.stringify({ error: "Please sign in first." }), { status: 401 });

  const apiKey = await getPrintifyKey(user.id);
  if (!apiKey) return new Response(JSON.stringify({ error: "Connect Printify first." }), { status: 400 });

  const body = await req.json().catch(() => ({}));
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    if (body.list === "blueprints") {
      const resp = await fetch(`${BASE}/catalog/blueprints.json`, { headers });
      if (!resp.ok) throw new Error("Could not load Printify's product catalog.");
      const blueprints = await resp.json();
      return new Response(JSON.stringify({ blueprints }), { status: 200 });
    }

    if (body.list === "providers") {
      if (!body.blueprint_id) return new Response(JSON.stringify({ error: "Missing blueprint_id" }), { status: 400 });
      const resp = await fetch(`${BASE}/catalog/blueprints/${body.blueprint_id}/print_providers.json`, { headers });
      if (!resp.ok) throw new Error("Could not load print providers for that product.");
      const providers = await resp.json();
      return new Response(JSON.stringify({ providers }), { status: 200 });
    }

    if (body.list === "variants") {
      if (!body.blueprint_id || !body.print_provider_id) {
        return new Response(JSON.stringify({ error: "Missing blueprint_id or print_provider_id" }), { status: 400 });
      }
      const resp = await fetch(
        `${BASE}/catalog/blueprints/${body.blueprint_id}/print_providers/${body.print_provider_id}/variants.json`,
        { headers }
      );
      if (!resp.ok) throw new Error("Could not load variants for that provider.");
      const data = await resp.json();
      return new Response(JSON.stringify({ variants: data.variants || [] }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Unknown list requested." }), { status: 400 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message || "Printify request failed." }), { status: 500 });
  }
};
