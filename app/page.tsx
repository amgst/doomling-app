import { redirect } from "next/navigation";

/**
 * Root page — redirect to the embedded app dashboard.
 * The shop and host params will be missing here; Shopify will provide them
 * after OAuth completes via the /auth/callback redirect.
 */
export default function RootPage({
  searchParams,
}: {
  searchParams: { shop?: string; host?: string };
}) {
  const { shop, host } = searchParams;

  if (shop) {
    // Trigger OAuth install flow
    redirect(`/auth?shop=${shop}${host ? `&host=${host}` : ""}`);
  }

  // No shop param — show a simple landing page
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
      <h1>Upsale</h1>
      <p>Install this app from the Shopify App Store.</p>
    </main>
  );
}
