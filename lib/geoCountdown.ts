export type GeoCountdownPageTarget = "all" | "home" | "product" | "collection";

export interface GeoCountdownCampaign {
  id: string;
  name: string;
  eyebrow: string;
  heading: string;
  message: string;
  endAt: string;
  countryCodes: string[];
  pageTarget: GeoCountdownPageTarget;
  priority: number;
  enabled: boolean;
  hideOnExpire: boolean;
  expiredLabel: string;
}

export function normalizeCountryCodes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim().toUpperCase())
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
}

export function normalizeGeoCountdownCampaign(input: unknown, index: number): GeoCountdownCampaign | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const name = String(value.name ?? "").trim();
  const heading = String(value.heading ?? "").trim();
  const endAt = String(value.endAt ?? "").trim();
  const pageTarget = String(value.pageTarget ?? "all").trim() as GeoCountdownPageTarget;

  if (!name || !heading || !endAt) return null;
  if (!["all", "home", "product", "collection"].includes(pageTarget)) return null;

  const parsed = Date.parse(endAt);
  if (Number.isNaN(parsed)) return null;

  return {
    id: String(value.id ?? `geo-countdown-${index}`),
    name,
    eyebrow: String(value.eyebrow ?? "").trim(),
    heading,
    message: String(value.message ?? "").trim(),
    endAt: new Date(parsed).toISOString(),
    countryCodes: normalizeCountryCodes(value.countryCodes),
    pageTarget,
    priority: Math.max(1, Math.min(100, Number(value.priority) || 1)),
    enabled: value.enabled !== false,
    hideOnExpire: value.hideOnExpire !== false,
    expiredLabel: String(value.expiredLabel ?? "Offer expired").trim() || "Offer expired",
  };
}

export function sortGeoCountdownCampaigns(campaigns: GeoCountdownCampaign[]) {
  return campaigns.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

export function matchGeoCountdownCampaign(
  campaigns: GeoCountdownCampaign[],
  options: { country?: string | null; pageTarget?: string | null; now?: number },
) {
  const country = String(options.country ?? "").trim().toUpperCase();
  const pageTarget = String(options.pageTarget ?? "all").trim().toLowerCase();
  const now = options.now ?? Date.now();

  return sortGeoCountdownCampaigns(campaigns).find((campaign) => {
    if (!campaign.enabled) return false;
    if (Date.parse(campaign.endAt) <= now) return false;
    if (campaign.pageTarget !== "all" && campaign.pageTarget !== pageTarget) return false;
    if (campaign.countryCodes.length > 0 && !campaign.countryCodes.includes(country)) return false;
    return true;
  }) ?? null;
}

export function getSpecificGeoCountdownCampaign(
  campaigns: GeoCountdownCampaign[],
  campaignId: string | null | undefined,
  options?: { now?: number },
) {
  const id = String(campaignId ?? "").trim();
  if (!id) return null;

  const now = options?.now ?? Date.now();
  return campaigns.find((campaign) => {
    if (campaign.id !== id) return false;
    if (!campaign.enabled) return false;
    if (Date.parse(campaign.endAt) <= now) return false;
    return true;
  }) ?? null;
}
