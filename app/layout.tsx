import type { Metadata } from "next";
import PolarisProvider from "@/components/PolarisProvider";

export const metadata: Metadata = {
  title: "Doomlings App",
  description: "Doomlings App — Shopify Admin",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <PolarisProvider>{children}</PolarisProvider>
      </body>
    </html>
  );
}
