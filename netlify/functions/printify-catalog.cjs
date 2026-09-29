const { getUserFromToken, getPrintifyKey } = require("./_shared.cjs");

const BASE = "https://api.printify.com/v1";

// Product types with structures our simple "one image, one spot" flow
// can't handle yet — calendars need one image per month, photo books
// need one per page, and so on. Filtered out by title rather than left
// to fail with a confusing error later.
const EXCLUDED_KEYWORDS = [
  "calendar", "planner", "puzzle", "jigsaw", "journal", "notebook",
  "photo book", "playing card", "book",
];

function isSupported(title) {
  const lower = title.toLowerCase();
  return !EXCLUDED_KEYWORDS.some((kw) => lower.includes(kw));
}

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
  const headers = { Authorization: `Bearer ${apiKey}` };

  try {
    if (body.list === "blueprints") {
      const resp = await fetch(`${BASE}/catalog/blueprints.json`, { headers });
      if (!resp.ok) throw new Error("Could not load Printify's product catalog.");
      const allBlueprints = await resp.json();
      const blueprints = allBlueprints.filter((bp) => isSupported(bp.title));
      return { statusCode: 200, body: JSON.stringify({ blueprints, totalBeforeFilter: allBlueprints.length }) };
    }

    if (body.list === "providers") {
      if (!body.blueprint_id) return { statusCode: 400, body: JSON.stringify({ error: "Missing blueprint_id" }) };
      const resp = await fetch(`${BASE}/catalog/blueprints/${body.blueprint_id}/print_providers.json`, { headers });
      if (!resp.ok) throw new Error("Could not load print providers for that product.");
      const providers = await resp.json();
      return { statusCode: 200, body: JSON.stringify({ providers }) };
    }

    if (body.list === "variants") {
      if (!body.blueprint_id || !body.print_provider_id) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing blueprint_id or print_provider_id" }) };
      }
      const resp = await fetch(
        `${BASE}/catalog/blueprints/${body.blueprint_id}/print_providers/${body.print_provider_id}/variants.json`,
        { headers }
      );
      if (!resp.ok) throw new Error("Could not load variants for that provider.");
      const data = await resp.json();
      return { statusCode: 200, body: JSON.stringify({ variants: data.variants || [] }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: "Unknown list requested." }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || "Printify request failed." }) };
  }
};
