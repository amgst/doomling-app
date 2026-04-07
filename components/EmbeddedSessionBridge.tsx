"use client";

import { useEffect, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { Spinner } from "@shopify/polaris";

/**
 * Exchanges the App Bridge JWT for the standalone HMAC cookie on mount.
 * This allows embedded pages to use the same /api/standalone/* routes
 * that the standalone dashboard uses (cookie-authenticated).
 */
export default function EmbeddedSessionBridge({ children }: { children: React.ReactNode }) {
  const app = useAppBridge();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bridge() {
      try {
        const token = await app.idToken();
        const res = await fetch("/api/standalone/session", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Session bridge failed: HTTP ${res.status}`);
        if (!cancelled) setReady(true);
      } catch (err) {
        console.error("[EmbeddedSessionBridge]", err);
        if (!cancelled) setError("Failed to initialize session. Please refresh the page.");
      }
    }

    void bridge();
    return () => {
      cancelled = true;
    };
  }, [app]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
          color: "#b91c1c",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {error}
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <Spinner size="large" />
      </div>
    );
  }

  return <>{children}</>;
}
