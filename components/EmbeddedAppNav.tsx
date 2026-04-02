"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Cart Limits", href: "/app/cart-limits" },
  { label: "Settings", href: "/app/settings" },
];

export default function EmbeddedAppNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        display: "flex",
        gap: "0.75rem",
        padding: "1rem 1rem 0",
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        flexWrap: "wrap",
      }}
    >
      {LINKS.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "0.55rem 0.85rem",
              borderRadius: 999,
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 600,
              color: active ? "#92400e" : "#4b5563",
              background: active ? "#fef3c7" : "#f3f4f6",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
