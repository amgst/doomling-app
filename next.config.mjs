/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // Allow Shopify Admin to embed the app in an iframe
        source: "/((?!api|auth|_next).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
          },
        ],
      },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
