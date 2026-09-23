const { createClient } = require("@supabase/supabase-js");

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromToken(authHeader) {
  const token = (authHeader || "").replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function getPrintifyKey(userId) {
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("api_key")
    .eq("user_id", userId)
    .eq("provider", "printify")
    .maybeSingle();
  if (error || !data) return null;
  return data.api_key;
}

module.exports = { supabaseAdmin, getUserFromToken, getPrintifyKey };
