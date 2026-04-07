"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import EmbeddedStandaloneLink from "@/components/EmbeddedStandaloneLink";

function LoginForm() {
  const DEFAULT_SHOP = "upsellertheme.myshopify.com";
  const [shop, setShop] = useState(DEFAULT_SHOP);
  const params = useSearchParams();
  const error = params.get("error");

  useEffect(() => {
    if (error) return;
    // Fast path: if a valid session cookie already exists, skip OAuth entirely
    fetch("/api/standalone/me")
      .then((res) => {
        if (res.ok) {
          window.location.href = "/dashboard";
        } else {
          window.location.href = `/standalone/auth?shop=${DEFAULT_SHOP}`;
        }
      })
      .catch(() => {
        window.location.href = `/standalone/auth?shop=${DEFAULT_SHOP}`;
      });
  }, [error]);
  const embedded = params.get("embedded");
  const shopParam = params.get("shop");
  const discountIntent = Array.from(params.entries()).some(([key, value]) =>
    `${key} ${value}`.toLowerCase().includes("discount"),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let s = shop.trim().toLowerCase();
    if (!s) return;
    if (!s.endsWith(".myshopify.com")) s = `${s}.myshopify.com`;
    window.location.href = `/standalone/auth?shop=${s}`;
  };

  if (embedded === "1" && shopParam) {
    return (
      <EmbeddedStandaloneLink
        appBaseUrl={process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || undefined}
        message={
          discountIntent
            ? `Finish setting up your Buy X Get Y discount for ${shopParam} using the button below.`
            : `Open the full dashboard for ${shopParam} using the button below.`
        }
        targetPath={discountIntent ? "/dashboard/buyxgety" : "/dashboard"}
        title={discountIntent ? "Open BXGY setup" : "Open dashboard"}
      />
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f6f6f7",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
        padding: "2.5rem",
        width: "100%",
        maxWidth: "400px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src="https://www.doomlings.com/cdn/shop/files/Doomlings_Logo_FullColor_Outline_440x.png?v=1741365053"
            alt="Doomlings"
            style={{ width: 160, display: "block", margin: "0 auto 1rem" }}
          />
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a" }}>Doomlings App</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#6d7175", fontSize: "0.9rem" }}>
            {embedded === "1" ? "Opening the embedded dashboard..." : "Sign in to your store dashboard"}
          </p>
        </div>

        {error && (
          <div style={{
            background: "#fff4f4",
            border: "1px solid #ffd2d2",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            color: "#c0392b",
            fontSize: "0.875rem",
          }}>
            {error === "auth-failed" ? "Authentication failed. Please try again." : "Invalid store domain."}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.875rem", fontWeight: 500, color: "#1a1a1a" }}>
            Store domain
          </label>
          <input
            type="text"
            value={shop}
            onChange={e => setShop(e.target.value)}
            placeholder="your-store.myshopify.com"
            required
            style={{
              width: "100%",
              padding: "0.65rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "0.9rem",
              outline: "none",
              boxSizing: "border-box",
              marginBottom: "1rem",
            }}
          />
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "0.7rem",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Login with Shopify
          </button>
        </form>

        <p style={{ margin: "1.5rem 0 0", textAlign: "center", fontSize: "0.75rem", color: "#9ca3af" }}>
          &copy; {new Date().getFullYear()} Doomlings LLC. All rights reserved.
        </p>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
