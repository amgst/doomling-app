"use client";

import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import type { ReactNode } from "react";

export default function PolarisProvider({ children }: { children: ReactNode }) {
  return <AppProvider i18n={en}>{children}</AppProvider>;
}
