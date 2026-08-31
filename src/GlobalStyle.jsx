import React from "react";

export default function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');
      :root {
        --ink: #191512;
        --paper: #F5EFE4;
        --marigold: #E8A33D;
        --red: #C1462F;
        --green: #4C6B54;
        --line: #D9CBB0;
      }
      * { box-sizing: border-box; }
      body { margin: 0; }
      .pb2-app {
        background: var(--paper);
        color: var(--ink);
        font-family: 'Inter', sans-serif;
        min-height: 100vh;
        background-image: radial-gradient(var(--line) 1px, transparent 1px);
        background-size: 14px 14px;
      }
      .pb2-wrap { max-width: 820px; margin: 0 auto; padding: 32px 20px 80px; }
      .pb2-title { font-family: 'Anton', sans-serif; font-size: 40px; text-transform: uppercase; margin: 0; line-height: 0.95; }
      .pb2-title span { color: var(--red); }
      .pb2-card { background: #FFFCF6; border: 2px solid var(--ink); border-radius: 6px; padding: 24px; box-shadow: 5px 5px 0 var(--ink); margin-bottom: 24px; }
      .pb2-input, .pb2-select, textarea.pb2-input {
        width: 100%; font-family: 'Inter', sans-serif; font-size: 15px; padding: 11px 13px;
        border: 2px solid var(--ink); border-radius: 4px; background: #fff; color: var(--ink);
      }
      textarea.pb2-input { resize: vertical; min-height: 80px; }
      .pb2-input:focus, .pb2-select:focus { outline: 3px solid var(--marigold); outline-offset: 1px; }
      .pb2-label { display: block; font-weight: 600; font-size: 13px; margin-bottom: 6px; margin-top: 14px; }
      .pb2-label:first-child { margin-top: 0; }
      .pb2-btn {
        font-family: 'Anton', sans-serif; font-size: 16px; letter-spacing: 0.02em; text-transform: uppercase;
        padding: 12px 18px; background: var(--red); color: #FFFCF6; border: 2px solid var(--ink);
        border-radius: 4px; box-shadow: 4px 4px 0 var(--ink); cursor: pointer;
      }
      .pb2-btn:hover:not(:disabled) { transform: translate(1px, 1px); box-shadow: 3px 3px 0 var(--ink); }
      .pb2-btn:disabled { opacity: 0.6; cursor: default; }
      .pb2-btn-ghost { background: #FFFCF6; color: var(--ink); }
      .pb2-nav { display: flex; gap: 10px; margin-bottom: 28px; flex-wrap: wrap; align-items: center; }
      .pb2-nav-link {
        font-family: 'IBM Plex Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
        padding: 8px 12px; border: 2px solid var(--ink); border-radius: 4px; background: #FFFCF6; cursor: pointer;
      }
      .pb2-nav-link.active { background: var(--ink); color: var(--paper); }
      .pb2-error { background: #FBEAE6; border: 2px solid var(--red); color: var(--red); padding: 12px 14px; border-radius: 4px; font-size: 14px; margin-top: 14px; }
      .pb2-hint { font-size: 12px; color: #8A8072; margin-top: 6px; }
      .pb2-section-label { font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--red); margin-bottom: 8px; }
    `}</style>
  );
}
