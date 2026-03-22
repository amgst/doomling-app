"use client";

// App Bridge v4 no longer uses a React <Provider>.
// It is initialized by the Shopify Admin iFrame via a <script> tag in the layout.
// This component is kept as a pass-through so the import in app/app/layout.tsx
// doesn't need to change when we wire up the script tag separately.

import type { ReactNode } from "react";

interface AppBridgeProviderProps {
  apiKey: string;
  host: string;
  children: ReactNode;
}

export default function AppBridgeProvider({ children }: AppBridgeProviderProps) {
  return <>{children}</>;
}
