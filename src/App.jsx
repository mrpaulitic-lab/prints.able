import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import GlobalStyle from "./GlobalStyle";
import AuthScreen from "./AuthScreen";
import Studio from "./Studio";
import Dashboard from "./Dashboard";
import ConnectPrintify from "./ConnectPrintify";
import PushToPrintify from "./PushToPrintify";
import PublicStorefront from "./PublicStorefront";

function getPublicSlug() {
  const path = window.location.pathname;
  const match = path.match(/^\/b\/([^/]+)\/?$/);
  return match ? match[1] : null;
}

export default function App() {
  const publicSlug = getPublicSlug();

  if (publicSlug) {
    return <PublicStorefront slug={publicSlug} />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("studio");
  const [pushTarget, setPushTarget] = useState(null);
  const [dashboardKey, setDashboardKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (authLoading) return <div className="pb2-app" style={{ padding: 40 }}>Loading…</div>;
  if (!session) return <AuthScreen />;

  return (
    <div className="pb2-app">
      <GlobalStyle />
      <div className="pb2-wrap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <h1 className="pb2-title">Print<span>able</span></h1>
          <button className="pb2-nav-link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>

        <div className="pb2-nav">
          <button className={`pb2-nav-link ${tab === "studio" ? "active" : ""}`} onClick={() => setTab("studio")}>Studio</button>
          <button
            className={`pb2-nav-link ${tab === "dashboard" ? "active" : ""}`}
            onClick={() => { setTab("dashboard"); setDashboardKey((k) => k + 1); }}
          >
            My Brands
          </button>
        </div>

        {tab === "studio" && (
          <Studio session={session} onSaved={() => setDashboardKey((k) => k + 1)} />
        )}

        {tab === "dashboard" && (
          <Dashboard
            key={dashboardKey}
            session={session}
            onOpenPush={(brand, design) => { setPushTarget({ brand, design }); setTab("push"); }}
          />
        )}

        {tab === "connect" && (
          <ConnectPrintify onConnected={() => setTab("push")} />
        )}

        {tab === "push" && pushTarget && (
          <PushToPrintify
            brand={pushTarget.brand}
            design={pushTarget.design}
            onDone={() => { setTab("dashboard"); setDashboardKey((k) => k + 1); }}
            onNeedsConnection={() => setTab("connect")}
          />
        )}
      </div>
    </div>
  );
}
