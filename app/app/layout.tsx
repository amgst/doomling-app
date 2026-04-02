import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { Suspense } from "react";

/**
 * App Bridge v4: initialized by the Shopify Admin via a <script> tag with
 * data-api-key set to your app's API key. The admin iFrame calls this script
 * automatically when the embedded app loads.
 */
export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY!;

  return (
    <>
      {/* App Bridge v4 initialization script */}
      <script
        data-api-key={apiKey}
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        async
      />
      <Suspense fallback={null}>
        <EmbeddedAppNav />
        {children}
      </Suspense>
    </>
  );
}
