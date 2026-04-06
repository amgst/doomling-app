"use client";

import { useState } from "react";

interface FeatureHelpSection {
  title: string;
  body: string[];
}

export default function FeatureHelpCard({
  intro,
  sections,
}: {
  intro: string;
  sections: FeatureHelpSection[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        style={{
          background: "#fff",
          border: "1px solid #dfe3e8",
          borderRadius: 18,
          padding: "1.5rem 1.3rem 1.15rem",
          boxShadow: "0 8px 20px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "grid", gap: "0.65rem" }}>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Do you need any help?</div>
          <div style={{ fontSize: "0.95rem", color: "#6b7280", lineHeight: 1.5 }}>{intro}</div>
          <div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              style={{
                border: "1px solid #111827",
                borderRadius: 10,
                background: "#1f2937",
                color: "#fff",
                padding: "0.5rem 0.9rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 0 rgba(17, 24, 39, 0.35)",
              }}
            >
              Help
            </button>
          </div>
        </div>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
            zIndex: 2000,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "min(760px, 100%)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.24)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1.1rem 1.25rem",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>Help</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  color: "#4b5563",
                  borderRadius: 10,
                  width: 36,
                  height: 36,
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                X
              </button>
            </div>

            <div style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
              {sections.map((section) => (
                <div key={section.title} style={{ display: "grid", gap: "0.5rem" }}>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{section.title}</div>
                  {section.body.map((paragraph) => (
                    <p key={paragraph} style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6, color: "#4b5563" }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
