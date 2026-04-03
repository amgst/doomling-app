"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type EmbeddedStandaloneRedirectProps = {
  message?: string;
};

export default function EmbeddedStandaloneRedirect({
  message = "Opening the full dashboard...",
}: EmbeddedStandaloneRedirectProps) {
  const params = useSearchParams();
  const [autoRedirectFailed, setAutoRedirectFailed] = useState(false);

  const targetUrl = useMemo(() => {
    const next = new URL("/dashboard", window.location.origin);
    const shop = params.get("shop");
    const locale = params.get("locale");

    if (shop) next.searchParams.set("shop", shop);
    if (locale) next.searchParams.set("locale", locale);

    return next.toString();
  }, [params]);

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      if (window.top && window.top !== window) {
        window.top.location.href = targetUrl;
        timeoutId = window.setTimeout(() => setAutoRedirectFailed(true), 1200);
        return () => {
          if (timeoutId) window.clearTimeout(timeoutId);
        };
      }

      window.location.replace(targetUrl);
    } catch (error) {
      console.error("Embedded redirect failed", error);
      setAutoRedirectFailed(true);
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [targetUrl]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f6f7",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>Upsale</h1>
        <p style={{ margin: "0.9rem 0 0", color: "#4b5563", lineHeight: 1.5 }}>{message}</p>

        {autoRedirectFailed ? (
          <>
            <p style={{ margin: "1rem 0 0", color: "#6b7280", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Your browser blocked the automatic handoff from Shopify admin. Use the button below to continue to
              the full dashboard.
            </p>
            <button
              type="button"
              onClick={() => window.open(targetUrl, "_top")}
              style={{
                marginTop: "1.2rem",
                padding: "0.8rem 1rem",
                width: "100%",
                borderRadius: "10px",
                border: "none",
                background: "#008060",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open dashboard
            </button>
          </>
        ) : (
          <p style={{ margin: "1rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>Redirecting...</p>
        )}
      </div>
    </main>
  );
}
