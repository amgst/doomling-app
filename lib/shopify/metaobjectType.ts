import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

export type ResolvedMetaobjectType = {
  type: string;
  foundDefinition: boolean;
};

type CacheEntry = ResolvedMetaobjectType;

function getCache() {
  const g = globalThis as unknown as {
    __shopifyMetaobjectTypeCacheV1?: Map<string, CacheEntry>;
  };
  if (!g.__shopifyMetaobjectTypeCacheV1) {
    g.__shopifyMetaobjectTypeCacheV1 = new Map();
  }
  return g.__shopifyMetaobjectTypeCacheV1;
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export async function resolveMetaobjectType(
  shop: string,
  accessToken: string,
  preferredType: string,
  definitionName?: string,
): Promise<ResolvedMetaobjectType> {
  const key = `${shop}::${preferredType}::${definitionName ?? ""}`;
  const cache = getCache();
  const cached = cache.get(key);
  if (cached) return cached;

  const logicalKey = String(preferredType || "").replace(/^\$app:/, "");

  try {
    const res = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        query MetaobjectDefinitionsForApp {
          metaobjectDefinitions(first: 250) {
            nodes {
              name
              type
            }
          }
        }
      `,
    );

    const nodes = res?.data?.metaobjectDefinitions?.nodes ?? [];
    const wantedName = normalize(definitionName);

    const match =
      nodes.find((n: any) => String(n?.type || "") === preferredType) ??
      nodes.find((n: any) => String(n?.type || "") === logicalKey) ??
      nodes.find((n: any) => String(n?.type || "").endsWith(`--${logicalKey}`)) ??
      nodes.find((n: any) => wantedName && normalize(n?.name) === wantedName);

    const result: ResolvedMetaobjectType = match?.type
      ? { type: String(match.type), foundDefinition: true }
      : { type: preferredType, foundDefinition: false };

    cache.set(key, result);
    return result;
  } catch {
    const fallback = { type: preferredType, foundDefinition: false };
    cache.set(key, fallback);
    return fallback;
  }
}

