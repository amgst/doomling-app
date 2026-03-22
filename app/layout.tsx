import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doomling",
  description: "Doomling Shopify App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
