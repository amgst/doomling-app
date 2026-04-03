"use client";

import EmbeddedStandaloneRedirect from "@/components/EmbeddedStandaloneRedirect";
import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function EmbeddedLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const embedded = params.get("embedded");
  const shop = params.get("shop");

  if (embedded === "1" || shop) {
    return <EmbeddedStandaloneRedirect message="Opening the full dashboard outside Shopify admin..." />;
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
