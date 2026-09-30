import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { supabase } from "./supabaseClient";

export default function DesignEditor({ sourceImage, sourceType, brandId, label, session, onSaved, onCancel }) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: 500,
      height: 500,
      backgroundColor: "#ffffff",
    });
    fabricRef.current = canvas;

    async function loadImage() {
      if (!sourceImage) {
        setReady(true);
        return;
      }
      try {
        // Fetch the image ourselves and load it from a local blob URL
        // instead of pointing the canvas straight at a remote address.
        // This avoids a browser security restriction ("tainted canvas")
        // that otherwise silently blocks saving/exporting later,
        // especially on Safari/iPhone.
        const resp = await fetch(sourceImage);
        if (!resp.ok) throw new Error("Could not download the image.");
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        const img = await fabric.FabricImage.fromURL(objectUrl);
        const scale = Math.min(400 / img.width, 400 / img.height, 1);
        img.set({
          left: 250,
          top: 250,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      } catch (err) {
        console.error(err);
        setError("Could not load that image into the editor.");
      } finally {
        setReady(true);
      }
    }

    loadImage();

    return () => {
      canvas.dispose();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [sourceImage]);

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.Textbox("Your text here", {
      left: 250,
      top: 250,
      originX: "center",
      originY: "center",
      fontSize: 32,
      fill: "#000000",
      width: 250,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.renderAll();
    }
  }

  async function handleSave() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSaving(true);
    setError("");
    try {
      canvas.discardActiveObject();
      canvas.renderAll();
      const dataUrl = canvas.toDataURL({ format: "png", quality: 1 });
      const blob = await (await fetch(dataUrl)).blob();

      const path = `${session.user.id}/${Date.now()}-edited.png`;
      const { error: uploadErr } = await supabase.storage
        .from("designs")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from("designs").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("designs").insert([{
        brand_id: brandId || null,
        user_id: session.user.id,
        image_url: publicData.publicUrl,
        image_prompt: null,
        label: label || "Custom design",
        source: "edited_design",
      }]);
      if (insertErr) throw insertErr;

      onSaved();
    } catch (err) {
      console.error(err);
            const isTainted = err.message?.includes("Tainted") || err.name === "SecurityError";
      setError(
        isTainted
          ? "The image couldn't be exported due to a browser security restriction. Try re-uploading the image and editing again."
          : `Could not save your design: ${err.message || "unknown error"}`
      );

    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb2-card">
      <button
        className="pb2-btn-ghost"
        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginBottom: 14, cursor: "pointer" }}
        onClick={onCancel}
      >
        ← Back
      </button>

      <div className="pb2-section-label">Design Editor</div>
      {error && <div className="pb2-error">{error}</div>}
      <p className="pb2-hint" style={{ marginTop: 0 }}>
        Drag to move, corner handles to resize (drag freely to stretch), the top handle to rotate.
        Crop isn't available yet — that's a separate tool coming later.
      </p>

      <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
        <canvas ref={canvasElRef} style={{ border: "1px solid var(--panel-border)", borderRadius: 8, maxWidth: "100%" }} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button className="pb2-btn pb2-btn-ghost" onClick={addText}>+ Add Text</button>
        <button className="pb2-btn pb2-btn-ghost" onClick={deleteSelected}>Delete Selected</button>
      </div>

      <button className="pb2-btn" disabled={!ready || saving} onClick={handleSave} style={{ width: "100%" }}>
        {saving ? "Saving…" : "Save as New Design"}
      </button>
      <p className="pb2-hint" style={{ marginTop: 8 }}>
        Saving creates a new design — your original image or upload is never changed.
      </p>
    </div>
  );
}
