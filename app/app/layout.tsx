"use client";

import EmbeddedStandaloneLink from "@/components/EmbeddedStandaloneLink";
import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function EmbeddedLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const embedded = params.get("embedded");
  const shop = params.get("shop");

  if (embedded === "1" || shop) {
    return (
      <EmbeddedStandaloneLink
        appBaseUrl={process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || undefined}
        message="This Shopify admin view links out to the full dashboard on your Vercel app."
        title="Open full dashboard"
      />
    );
  }

  return (
    <>
      <EmbeddedAppNav />
      {children}
    </>
  );
}

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <EmbeddedLayoutInner>{children}</EmbeddedLayoutInner>
    </Suspense>
  );
}
