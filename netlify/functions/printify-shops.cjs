const { getUserFromToken, getPrintifyKey } = require("./_shared.cjs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }
  const user = await getUserFromToken(event.headers.authorization || event.headers.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Please sign in first." }) };

  const apiKey = await getPrintifyKey(user.id);
  if (!apiKey) {
    return { statusCode: 200, body: JSON.stringify({ needsConnection: true }) };
  }

  try {
    const resp = await fetch("https://api.printify.com/v1/shops.json", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!resp.ok) throw new Error("Printify rejected the stored key.");
    const shops = await resp.json();
    return { statusCode: 200, body: JSON.stringify({ shops }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Could not reach Printify. Try reconnecting your account." }) };
  }
};
