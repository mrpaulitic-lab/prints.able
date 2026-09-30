import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const FREE_GENERATION_LIMIT = 3;

export default function UsageBadge({ session }) {
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("profiles").select("plan, generation_count, bonus_generations").eq("id", session.user.id).single();
    if (data) setProfile(data);
  }, [session.user.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [load]);

  if (!profile || profile.plan !== "free") return null;

  const limit = FREE_GENERATION_LIMIT + (profile.bonus_generations || 0);
  const remaining = Math.max(0, limit - profile.generation_count);
  const color = remaining === 0 ? "var(--red)" : remaining === 1 ? "#FDE68A" : "var(--green)";

  return (
    <div
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace", padding: "5px 10px",
        borderRadius: 999, border: `1px solid ${color}`, color,
      }}
    >
      {remaining} free generation{remaining === 1 ? "" : "s"} left
      {remaining === 0 && <strong>— upgrade to continue</strong>}
    </div>
  );
}
