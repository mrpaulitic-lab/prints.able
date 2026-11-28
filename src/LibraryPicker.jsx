import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { checkerStyle } from "./checker";

export default function LibraryPicker({ title, onPick, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: designData } = await supabase
          .from("designs").select("*").order("created_at", { ascending: false }).limit(40);
        const { data: assetData } = await supabase
          .from("assets").select("*").order("created_at", { ascending: false }).limit(40);

        const list = [];
        for (const d of designData || []) {
          if (d.image_url) list.push({ key: `d-${d.id}`, label: d.label || "Design", image_url: d.image_url });
        }

        const paths = (assetData || []).map((a) => a.storage_path);
        if (paths.length > 0) {
          const { data: signedList } = await supabase.storage.from("assets").createSignedUrls(paths, 3600);
          (assetData || []).forEach((a) => {
            const match = (signedList || []).find((s) => s.path === a.storage_path);
            if (match?.signedUrl) list.push({ key: `a-${a.id}`, label: a.filename, image_url: match.signedUrl });
          });
        }

        if (!cancelled) setItems(list);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not load your library.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--panel-border)", paddingTop: 12 }}>
      <div className="pb2-hint" style={{ marginBottom: 8 }}>{title || "Pick an image"}</div>
      {error && <div className="pb2-error">{error}</div>}
      {loading ? (
        <p className="pb2-hint">Loading your library…</p>
      ) : items.length === 0 ? (
        <p className="pb2-hint">Nothing in your library yet — upload images in My Assets first.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onPick(item)}
              style={{ background: "none", border: "1px solid var(--panel-border)", borderRadius: 8, padding: 4, cursor: "pointer", color: "var(--ink)" }}
            >
              <img
                src={item.image_url}
                alt={item.label}
                style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 4, ...checkerStyle }}
              />
              <div className="pb2-hint" style={{ fontSize: 10, marginTop: 2, wordBreak: "break-word" }}>{item.label}</div>
            </button>
          ))}
        </div>
      )}
      <button className="pb2-btn pb2-btn-ghost" style={{ marginTop: 8, fontSize: 12, padding: "6px 10px" }} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
