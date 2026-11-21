import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { supabase } from "./supabaseClient";

export const checkerStyle = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%)," +
    "linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

const PREVIEW_BACKGROUNDS = [
  { name: "Clear", value: "checker" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#111111" },
  { name: "Gray", value: "#6b7280" },
];

const FONTS = ["Arial", "Georgia", "Courier New", "Impact", "Trebuchet MS"];

// The editing box has the same shape as the print area, so what you see
// is what prints. Size is capped to fit phone screens.
function computeCanvasSize(w, h) {
  const base = Math.min(500, Math.max(260, window.innerWidth - 90));
  if (!w || !h) return { width: base, height: base };
  const ratio = w / h;
  if (ratio >= 1) return { width: base, height: Math.max(80, Math.round(base / ratio)) };
  return { width: Math.max(80, Math.round(base * ratio)), height: base };
}

export default function DesignEditor({
  sourceImage,
  sourceType,
  brandId,
  label,
  areaName,
  canvasWidth,
  canvasHeight,
  session,
  onSaved,
  onSavedDesign,
  onCancel,
}) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const objectUrlsRef = useRef([]);
  const [size] = useState(() => computeCanvasSize(canvasWidth, canvasHeight));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewBg, setPreviewBg] = useState("checker");
  const [textColor, setTextColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(() => Math.max(18, Math.round(size.width / 10)));
  const [fontFamily, setFontFamily] = useState("Arial");

  useEffect(() => {
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: size.width,
      height: size.height,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    async function loadImage() {
      if (!sourceImage) {
        setReady(true);
        return;
      }
      try {
        // Download the image ourselves and load it from a local blob address.
        // This avoids a browser security restriction that otherwise blocks
        // saving the canvas, especially on Safari/iPhone.
        const resp = await fetch(sourceImage);
        if (!resp.ok) throw new Error("Could not download the image.");
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        objectUrlsRef.current.push(objectUrl);

        const img = await fabric.FabricImage.fromURL(objectUrl);
        const scale = Math.min((size.width * 0.9) / img.width, (size.height * 0.9) / img.height, 1);
        img.set({
          left: size.width / 2,
          top: size.height / 2,
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
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, [sourceImage]);

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.Textbox("Your text", {
      left: size.width / 2,
      top: size.height / 2,
      originX: "center",
      originY: "center",
      fontSize,
      fontFamily,
      fill: textColor,
      width: Math.round(size.width * 0.7),
      textAlign: "center",
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }

  function addImageFromDevice(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Please choose a PNG, JPG, or WEBP image.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("That image is larger than the 20 MB limit.");
      return;
    }
    setError("");
    const canvas = fabricRef.current;
    if (!canvas) return;
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.push(url);
    fabric.FabricImage.fromURL(url)
      .then((img) => {
        const scale = Math.min((size.width * 0.6) / img.width, (size.height * 0.6) / img.height, 1);
        img.set({
          left: size.width / 2,
          top: size.height / 2,
          originX: "center",
          originY: "center",
          scaleX: scale,
          scaleY: scale,
        });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      })
      .catch((err) => {
        console.error(err);
        setError("Could not add that image.");
      });
  }

  function applyToSelectedText(property, value) {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (active instanceof fabric.Textbox) {
      active.set(property, value);
      canvas.renderAll();
    }
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
    if (canvas.getObjects().length === 0) {
      setError("Add an image or some text before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      canvas.discardActiveObject();
      canvas.renderAll();
      const multiplier = Math.min(4, 2000 / Math.max(size.width, size.height));
      const dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier });
      const blob = await (await fetch(dataUrl)).blob();

      const path = `${session.user.id}/${Date.now()}-edited.png`;
      const { error: uploadErr } = await supabase.storage
        .from("designs")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from("designs").getPublicUrl(path);

      const { data: inserted, error: insertErr } = await supabase
        .from("designs")
        .insert([{
          brand_id: brandId || null,
          user_id: session.user.id,
          image_url: publicData.publicUrl,
          image_prompt: null,
          label: label || "Custom design",
          source: "edited_design",
        }])
        .select()
        .single();
      if (insertErr) throw insertErr;

      if (onSavedDesign) {
        onSavedDesign(inserted);
      } else if (onSaved) {
        onSaved();
      }
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

  const previewStyle = previewBg === "checker" ? checkerStyle : { background: previewBg };

  return (
    <div className="pb2-card">
      <button
        className="pb2-btn-ghost"
        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, padding: 0, marginBottom: 14, cursor: "pointer" }}
        onClick={onCancel}
      >
        ← Back
      </button>

      <div className="pb2-section-label">{areaName ? `Artwork for: ${areaName}` : "Design Editor"}</div>
      {error && <div className="pb2-error">{error}</div>}

      <p className="pb2-hint" style={{ marginTop: 0 }}>
        {areaName
          ? `The dashed box is the ${areaName} print area. Only what's inside the box will print.`
          : "Drag to move, corner handles to resize, the top handle to rotate."}
        {" "}Crop isn't available yet.
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "10px 0" }}>
        <span className="pb2-hint">Preview on:</span>
        {PREVIEW_BACKGROUNDS.map((bg) => (
          <button
            key={bg.value}
            className={`pb2-nav-link ${previewBg === bg.value ? "active" : ""}`}
            style={{ padding: "5px 10px", fontSize: 11 }}
            onClick={() => setPreviewBg(bg.value)}
          >
            {bg.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "14px 0", overflowX: "auto" }}>
        <div style={{ display: "inline-block", border: "2px dashed var(--accent2)", borderRadius: 4, lineHeight: 0, ...previewStyle }}>
          <canvas ref={canvasElRef} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button className="pb2-btn pb2-btn-ghost" onClick={addText}>+ Add Text</button>
        <label className="pb2-btn pb2-btn-ghost" style={{ display: "inline-block", cursor: "pointer" }}>
          + Add Image
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={addImageFromDevice} style={{ display: "none" }} />
        </label>
        <button className="pb2-btn pb2-btn-ghost" onClick={deleteSelected}>Delete Selected</button>
      </div>

      <div className="pb2-section-label">Text style (applies to the text you have selected)</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <label className="pb2-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Color
          <input
            type="color"
            value={textColor}
            onChange={(e) => { setTextColor(e.target.value); applyToSelectedText("fill", e.target.value); }}
          />
        </label>
        <label className="pb2-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Size
          <input
            className="pb2-input"
            type="number"
            min="8"
            max="400"
            style={{ width: 80, padding: "6px 8px" }}
            value={fontSize}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setFontSize(e.target.value === "" ? "" : n);
              if (!isNaN(n) && n > 0) applyToSelectedText("fontSize", n);
            }}
          />
        </label>
        <label className="pb2-hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Font
          <select
            className="pb2-select"
            style={{ width: "auto", padding: "6px 8px" }}
            value={fontFamily}
            onChange={(e) => { setFontFamily(e.target.value); applyToSelectedText("fontFamily", e.target.value); }}
          >
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      </div>

      <button className="pb2-btn" disabled={!ready || saving} onClick={handleSave} style={{ width: "100%" }}>
        {saving ? "Saving…" : onSavedDesign ? "Use this artwork" : "Save as New Design"}
      </button>
      <p className="pb2-hint" style={{ marginTop: 8 }}>
        Saving creates a new design — your original image or upload is never changed. The background stays transparent.
      </p>
    </div>
  );
}
