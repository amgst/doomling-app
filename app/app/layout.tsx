"use client";

import EmbeddedSessionBridge from "@/components/EmbeddedSessionBridge";
import EmbeddedAppNav from "@/components/EmbeddedAppNav";
import { Suspense } from "react";

function EmbeddedLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <EmbeddedSessionBridge>
      <EmbeddedAppNav />
      {children}
    </EmbeddedSessionBridge>
  );
}

export default function EmbeddedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <EmbeddedLayoutInner>{children}</EmbeddedLayoutInner>
    </Suspense>
  );
}
