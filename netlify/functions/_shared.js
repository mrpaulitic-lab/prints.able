import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getUserFromRequest(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export async function getPrintifyKey(userId) {
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("api_key")
    .eq("user_id", userId)
    .eq("provider", "printify")
    .maybeSingle();
  if (error || !data) return null;
  return data.api_key;
}
