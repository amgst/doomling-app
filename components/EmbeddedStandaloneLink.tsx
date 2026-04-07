"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

type EmbeddedStandaloneLinkProps = {
  appBaseUrl?: string;
  message?: string;
  targetPath?: string;
  title?: string;
};

export default function EmbeddedStandaloneLink({
  appBaseUrl,
  message = "Opening Doomlings App dashboard…",
  targetPath,
  title = "Open dashboard",
}: EmbeddedStandaloneLinkProps) {
  const params = useSearchParams();

  const targetUrl = useMemo(() => {
    const baseUrl = appBaseUrl || window.location.origin;
    const discountIntent = Array.from(params.entries()).some(([key, value]) =>
      `${key} ${value}`.toLowerCase().includes("discount"),
    );
    const next = new URL(targetPath || (discountIntent ? "/dashboard/buyxgety" : "/dashboard"), baseUrl);
    const shop = params.get("shop");
    const locale = params.get("locale");

    if (shop) next.searchParams.set("shop", shop);
    if (locale) next.searchParams.set("locale", locale);

    return next.toString();
  }, [appBaseUrl, params, targetPath]);

  // Auto-navigate the top frame to the standalone dashboard so the full UI
  // opens immediately without requiring a manual button click.
  useEffect(() => {
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = targetUrl;
      } else {
        window.location.href = targetUrl;
      }
    } catch {
      // Cross-origin frame restriction — fall back to navigating current frame
      window.location.href = targetUrl;
    }
  }, [targetUrl]);

  // Shown briefly while the redirect fires, and as a fallback if JS is slow
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
          maxWidth: "460px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>Doomlings App</h1>
        <p style={{ margin: "0.9rem 0 0", color: "#4b5563", lineHeight: 1.5 }}>{message}</p>
        <a
          href={targetUrl}
          target="_top"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1.25rem",
            padding: "0.85rem 1.1rem",
            minWidth: "220px",
            borderRadius: "10px",
            background: "#008060",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {title}
        </a>
      </div>
    </main>
  );
}
