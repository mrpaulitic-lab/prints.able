import React from "react";

export default function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
      :root {
        --ink: #E8ECF5;
        --paper: #0A0B14;
        --panel: rgba(255,255,255,0.04);
        --panel-border: rgba(255,255,255,0.09);
        --marigold: #7C6CF6;
        --red: #6366F1;
        --accent2: #22D3EE;
        --green: #34D399;
        --line: rgba(255,255,255,0.1);
        --muted: #8B90A8;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      .pb2-app {
        background:
          radial-gradient(ellipse 900px 500px at 15% -10%, rgba(124,108,246,0.25), transparent 60%),
          radial-gradient(ellipse 700px 500px at 100% 0%, rgba(34,211,238,0.15), transparent 55%),
          var(--paper);
        color: var(--ink);
        font-family: 'Inter', sans-serif;
        min-height: 100vh;
      }
      .pb2-wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; }
      .pb2-title {
        font-family: 'Space Grotesk', sans-serif; font-size: 40px; font-weight: 700;
        margin: 0; line-height: 1; letter-spacing: -0.02em;
      }
      .pb2-title span {
        background: linear-gradient(135deg, var(--red), var(--accent2));
        -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .pb2-card {
        background: var(--panel);
        backdrop-filter: blur(16px);
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        padding: 26px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        margin-bottom: 24px;
      }
      .pb2-input, .pb2-select, textarea.pb2-input {
        width: 100%; font-family: 'Inter', sans-serif; font-size: 15px; padding: 12px 14px;
        border: 1px solid var(--panel-border); border-radius: 10px;
        background: rgba(255,255,255,0.03); color: var(--ink);
      }
      .pb2-input::placeholder { color: var(--muted); }
      textarea.pb2-input { resize: vertical; min-height: 80px; }
      .pb2-input:focus, .pb2-select:focus {
        outline: none; border-color: var(--red);
        box-shadow: 0 0 0 3px rgba(99,102,241,0.25);
      }
      .pb2-label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; margin-top: 14px; color: var(--ink); }
      .pb2-label:first-child { margin-top: 0; }
      .pb2-btn {
        font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px;
        padding: 12px 20px;
        background: linear-gradient(135deg, var(--red), #8B5CF6);
        color: #fff; border: none; border-radius: 10px;
        box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
      }
      .pb2-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(99,102,241,0.5); }
      .pb2-btn:disabled { opacity: 0.5; cursor: default; }
      .pb2-btn-ghost {
        background: rgba(255,255,255,0.06); color: var(--ink);
        border: 1px solid var(--panel-border); box-shadow: none;
      }
      .pb2-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.1); box-shadow: none; }
      .pb2-nav { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; align-items: center; }
      .pb2-nav-link {
        font-family: 'Inter', sans-serif; font-weight: 500; font-size: 13px;
        padding: 9px 14px; border: 1px solid var(--panel-border); border-radius: 999px;
        background: transparent; color: var(--muted); cursor: pointer;
      }
      .pb2-nav-link.active { background: var(--panel-border); color: var(--ink); border-color: transparent; }
      .pb2-error {
        background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35);
        color: #FCA5A5; padding: 12px 14px; border-radius: 10px; font-size: 14px; margin-top: 14px;
      }
      .pb2-hint { font-size: 12px; color: var(--muted); margin-top: 6px; }
      .pb2-section-label {
        font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--accent2); margin-bottom: 8px;
      }
      @media (max-width: 720px) { .pb2-main-grid { grid-template-columns: 1fr !important; } }
    `}</style>
  );
}
