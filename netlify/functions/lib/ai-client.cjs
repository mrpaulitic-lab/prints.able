const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Calls the model expecting JSON back, and validates it before handing it
// to the caller — so a malformed AI response never gets saved as if it
// were good data.
async function chatJSON({ model = "gpt-4o-mini", system, user, maxTokens }) {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The AI returned an empty response.");

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error("The AI returned something that wasn't valid data. Try again.");
  }
}

async function chatJSONWithImage({ model = "gpt-4o-mini", system, text, imageUrl, maxTokens }) {
  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text },
        { type: "image_url", image_url: { url: imageUrl } },
      ] },
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The AI returned an empty response.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("The AI returned something that wasn't valid data. Try again.");
  }
}

module.exports = { openai, chatJSON, chatJSONWithImage };

