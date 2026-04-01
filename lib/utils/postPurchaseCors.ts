const ALLOW_HEADERS = "Authorization, Content-Type";
const ALLOW_METHODS = "POST, OPTIONS";
const MAX_AGE = "86400";

export function buildPostPurchaseCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    "Access-Control-Max-Age": MAX_AGE,
    Vary: "Origin",
  };
}
