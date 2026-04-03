"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

type EmbeddedStandaloneLinkProps = {
  appBaseUrl?: string;
  message?: string;
  title?: string;
};

export default function EmbeddedStandaloneLink({
  appBaseUrl,
  message = "Use the button below to open the full dashboard outside Shopify admin.",
  title = "Open full dashboard",
}: EmbeddedStandaloneLinkProps) {
  const params = useSearchParams();

  const targetUrl = useMemo(() => {
    const baseUrl = appBaseUrl || window.location.origin;
    const next = new URL("/dashboard", baseUrl);
    const shop = params.get("shop");
    const locale = params.get("locale");

    if (shop) next.searchParams.set("shop", shop);
    if (locale) next.searchParams.set("locale", locale);

    return next.toString();
  }, [appBaseUrl, params]);

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
        <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>Upsale</h1>
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
        <p style={{ margin: "0.95rem 0 0", color: "#6b7280", fontSize: "0.9rem" }}>{targetUrl}</p>
      </div>
    </main>
  );
}
