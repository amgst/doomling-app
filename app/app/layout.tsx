import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { Suspense } from "react";

/**
 * App Bridge v4: initialized by the Shopify Admin via a <script> tag with
 * data-api-key set to your app's API key. The admin iFrame calls this script
 * automatically when the embedded app loads.
 */
export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <EmbeddedAppNav />
        {children}
      </Suspense>
    </>
  );
}
