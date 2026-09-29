const { createClient } = require("@supabase/supabase-js");
const OpenAI = require("openai");

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
  const history = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  if (history.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "No message provided." }) };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are the in-app helper for Printsable, a tool that turns a business idea into an AI-generated " +
            "merch brand, real product designs, and lets users push products to Printify (a print-on-demand " +
            "service) and publish a storefront page. Help users understand errors, pick compatible products, " +
            "and use the app. Keep answers short, plain, and specific. If asked something outside Printsable's " +
            "scope, say so honestly. You cannot take actions yourself — only explain and guide.",
        },
        ...history.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || "").slice(0, 1000),
        })),
      ],
      max_tokens: 400,
    });
    const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't come up with an answer.";
    return { statusCode: 200, body: JSON.stringify({ reply }) };
  } catch (err) {
    console.error("Assistant failed:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "The assistant is having trouble right now. Try again shortly." }) };
  }
};
