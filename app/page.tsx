"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const [shop, setShop] = useState("upsallerapp.myshopify.com");
  const params = useSearchParams();
  const error = params.get("error");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let s = shop.trim().toLowerCase();
    if (!s) return;
    if (!s.endsWith(".myshopify.com")) s = `${s}.myshopify.com`;
    window.location.href = `/standalone/auth?shop=${s}`;
  };

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
          <div style={{
            width: 48, height: 48,
            background: "#008060",
            borderRadius: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}>
            <span style={{ color: "#fff", fontSize: "1.5rem", fontWeight: 700 }}>U</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a" }}>Upsale</h1>
          <p style={{ margin: "0.5rem 0 0", color: "#6d7175", fontSize: "0.9rem" }}>
            Sign in to your store dashboard
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
