"use client";

import EmbeddedStandaloneLink from "@/components/EmbeddedStandaloneLink";
import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function EmbeddedLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const embedded = params.get("embedded");
  const shop = params.get("shop");
  const discountIntent = Array.from(params.entries()).some(([key, value]) =>
    `${key} ${value}`.toLowerCase().includes("discount"),
  );

  if (embedded === "1" || shop) {
    return (
      <EmbeddedStandaloneLink
        appBaseUrl={process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL || undefined}
        message={
          discountIntent
            ? "This Shopify admin view is opening a discount setup. Use the button below to jump straight into Buy X Get Y."
            : "This Shopify admin view links out to the full dashboard on your Vercel app."
        }
        targetPath={discountIntent ? "/dashboard/buyxgety" : "/dashboard"}
        title={discountIntent ? "Open BXGY setup" : "Open full dashboard"}
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
