import { getUserFromRequest, getPrintifyKey } from "./_shared.js";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  const user = await getUserFromRequest(req);
  if (!user) return new Response(JSON.stringify({ error: "Please sign in first." }), { status: 401 });

  const apiKey = await getPrintifyKey(user.id);
  if (!apiKey) {
    return new Response(JSON.stringify({ needsConnection: true }), { status: 200 });
  }

  try {
    const resp = await fetch("https://api.printify.com/v1/shops.json", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error("Printify rejected the stored key.");
    const shops = await resp.json();
    return new Response(JSON.stringify({ shops }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Could not reach Printify. Try reconnecting your account." }), { status: 500 });
  }
};
