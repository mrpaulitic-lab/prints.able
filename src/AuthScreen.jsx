import React, { useState } from "react";
import { supabase } from "./supabaseClient";
import GlobalStyle from "./GlobalStyle";

const EXAMPLES = [
  { idea: "Coffee brand for night-shift nurses", brand: "Graveyard Grounds", tagline: "Fuel for the shift nobody sees" },
  { idea: "Merch for plant parents who kill everything", brand: "Serial Killer Succulents", tagline: "We've all been there" },
  { idea: "Running club for slow, happy joggers", brand: "Last Place Club", tagline: "We finish. That's the whole plan." },
];

export default function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb2-app">
      <GlobalStyle />
      <div className="pb2-wrap" style={{ maxWidth: 420, marginTop: 60 }}>
        <h1 className="pb2-title">Print<span>sable</span></h1>
        <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 8 }}>
          Turn a concept into a real product, start to finish.
        </p>

        <form onSubmit={handleSubmit} className="pb2-card" style={{ marginTop: 20 }}>
          <label className="pb2-label">Email</label>
          <input className="pb2-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="pb2-label">Password</label>
          <input className="pb2-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {error && <div className="pb2-error">{error}</div>}
          {info && <div className="pb2-hint" style={{ color: "var(--green)" }}>{info}</div>}
          <button className="pb2-btn" type="submit" disabled={busy} style={{ marginTop: 16, width: "100%" }}>
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="pb2-btn pb2-btn-ghost"
          style={{ width: "100%" }}
          onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setInfo(""); }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>

        <div className="pb2-section-label" style={{ marginTop: 36, textAlign: "center" }}>What Printsable can make</div>
        {EXAMPLES.map((ex, i) => (
          <div key={i} className="pb2-card" style={{ marginTop: 12 }}>
            <div className="pb2-hint" style={{ marginBottom: 6 }}>Idea: "{ex.idea}"</div>
            <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16 }}>{ex.brand}</strong>
            <p style={{ fontStyle: "italic", color: "var(--muted)", margin: "2px 0 0", fontSize: 14 }}>{ex.tagline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
