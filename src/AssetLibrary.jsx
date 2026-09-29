import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export default function AssetLibrary({ session }) {
  const [assets, setAssets] = useState([]);
  const [previewUrls, setPreviewUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | failed
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setAssets(data || []);

    const urls = {};
    for (const asset of data || []) {
      const { data: signed } = await supabase.storage
        .from("assets")
        .createSignedUrl(asset.storage_path, 3600);
      if (signed?.signedUrl) urls[asset.id] = signed.signedUrl;
    }
    setPreviewUrls(urls);
    setLoading(false);
  }

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "That file type isn't supported. Please upload a PNG, JPG, or WEBP image.";
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "This image is larger than Printsable's current 20 MB upload limit.";
    }
    return null;
  }

  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      setUploadState("failed");
      return;
    }
    setPendingFile(file);
    doUpload(file);
  }

  async function doUpload(file) {
    setUploadState("uploading");
    setUploadError("");

    const { width, height } = await getImageDimensions(file);
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]+/g, "-");
    const path = `${session.user.id}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage.from("assets").upload(path, file, {
      contentType: file.type,
    });
    if (uploadErr) {
      console.error(uploadErr);
      setUploadError("The upload failed. Check your connection and try again.");
      setUploadState("failed");
      return;
    }

    const { error: insertErr } = await supabase.from("assets").insert([{
      user_id: session.user.id,
      filename: file.name,
      storage_path: path,
      mime_type: file.type,
      file_size: file.size,
      width,
      height,
      source: "user_upload",
      status: "ready",
    }]);

    if (insertErr) {
      console.error(insertErr);
      // Storage upload succeeded but the record didn't save — clean up
      // rather than leave an orphaned file no one can see or manage.
      await supabase.storage.from("assets").remove([path]);
      setUploadError("Something went wrong saving that image. Try again.");
      setUploadState("failed");
      return;
    }

    setUploadState("idle");
    setPendingFile(null);
    load();
  }

  async function handleDelete(asset) {
    if (!confirm(`Delete "${asset.filename}"? This can't be undone.`)) return;
    await supabase.storage.from("assets").remove([asset.storage_path]);
    await supabase.from("assets").delete().eq("id", asset.id);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
  }

  return (
    <div>
      <div className="pb2-card">
        <div className="pb2-section-label">Upload Artwork</div>
        <p className="pb2-hint" style={{ marginTop: 0, marginBottom: 12 }}>
          PNG, JPG, or WEBP, up to 20 MB. Your uploads are private to your account.
        </p>
        <label className="pb2-btn" style={{ display: "inline-block", cursor: "pointer" }}>
          {uploadState === "uploading" ? "Uploading…" : "Upload Image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChosen}
            disabled={uploadState === "uploading"}
            style={{ display: "none" }}
          />
        </label>
        {uploadState === "failed" && (
          <div className="pb2-error">
            {uploadError}{" "}
            {pendingFile && (
              <button className="pb2-btn pb2-btn-ghost" style={{ marginLeft: 10, fontSize: 12, padding: "4px 10px" }} onClick={() => doUpload(pendingFile)}>
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading your assets…</p>
      ) : assets.length === 0 ? (
        <div className="pb2-card">
          <p style={{ color: "var(--muted)", margin: 0 }}>No uploads yet — add your first image above.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {assets.map((asset) => (
            <div key={asset.id} className="pb2-card" style={{ padding: 10 }}>
              {previewUrls[asset.id] ? (
                <img
                  src={previewUrls[asset.id]}
                  alt={asset.filename}
                  style={{ width: "100%", aspectRatio: "1", objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.03)" }}
                />
              ) : (
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: 8, background: "rgba(255,255,255,0.03)" }} />
              )}
              <p className="pb2-hint" style={{ margin: "8px 0 4px", wordBreak: "break-word" }}>{asset.filename}</p>
              {asset.width && asset.height && (
                <p className="pb2-hint" style={{ margin: "0 0 8px" }}>{asset.width}×{asset.height}px</p>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "5px 8px" }} disabled title="Coming in the next update">
                  Edit
                </button>
                <button className="pb2-btn pb2-btn-ghost" style={{ fontSize: 11, padding: "5px 8px", color: "var(--red)" }} onClick={() => handleDelete(asset)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
