import type { Metadata } from "next";
import PolarisProvider from "@/components/PolarisProvider";

export const metadata: Metadata = {
  title: "Upsale",
  description: "Upsale Shopify App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  return (
    <html lang="en">
      <head>
        {apiKey ? <meta name="shopify-api-key" content={apiKey} /> : null}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        {apiKey ? <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script> : null}
      </head>
      <body>
        <PolarisProvider>{children}</PolarisProvider>
      </body>
    </html>
  );
}
