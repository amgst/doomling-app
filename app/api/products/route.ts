import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/utils/verifyRequest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getNextPageUrl(linkHeader: string | null) {
  if (!linkHeader) return null;

  const nextPart = linkHeader
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.includes('rel="next"'));

  if (!nextPart) return null;

  const match = nextPart.match(/<([^>]+)>/);
  return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const { session, shop, errorResponse } = await verifyRequest(req);
  if (errorResponse) return errorResponse;
  if (!session?.accessToken || !shop) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = { "X-Shopify-Access-Token": session.accessToken };
  let nextUrl: string | null =
    `https://${shop}/admin/api/2024-01/products.json?limit=250&fields=id,title,handle,status,variants,image`;
  const products: any[] = [];

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers, cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      return NextResponse.json({ error: `Shopify ${response.status}: ${body}` }, { status: response.status });
    }

    const data = await response.json();
    products.push(...(data.products ?? []));
    nextUrl = getNextPageUrl(response.headers.get("link"));
  }

  return NextResponse.json({ products });
}
