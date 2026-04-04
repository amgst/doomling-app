export type CustomCursorPageTarget = "all" | "home" | "product" | "collection";
export type CustomCursorTheme = "glow" | "stardust" | "doomlings" | "retro";

export interface CustomCursorCampaign {
  id: string;
  name: string;
  pageTarget: CustomCursorPageTarget;
  theme: CustomCursorTheme;
  iconUrl: string;
  size: number;
  priority: number;
  enabled: boolean;
  startAt: string | null;
  endAt: string | null;
}

const VALID_PAGE_TARGETS: CustomCursorPageTarget[] = ["all", "home", "product", "collection"];
const VALID_THEMES: CustomCursorTheme[] = ["glow", "stardust", "doomlings", "retro"];

function normalizeDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function normalizeCustomCursorCampaign(input: unknown, index: number): CustomCursorCampaign | null {
  if (!input || typeof input !== "object") return null;

  const value = input as Record<string, unknown>;
  const name = String(value.name ?? "").trim();
  const pageTarget = String(value.pageTarget ?? "all").trim() as CustomCursorPageTarget;
  const theme = String(value.theme ?? "glow").trim() as CustomCursorTheme;

  if (!name) return null;
  if (!VALID_PAGE_TARGETS.includes(pageTarget)) return null;
  if (!VALID_THEMES.includes(theme)) return null;

  const startAt = normalizeDate(value.startAt);
  const endAt = normalizeDate(value.endAt);
  if (startAt && endAt && Date.parse(startAt) >= Date.parse(endAt)) return null;

  return {
    id: String(value.id ?? `custom-cursor-${index}`),
    name,
    pageTarget,
    theme,
    iconUrl: String(value.iconUrl ?? "").trim(),
    size: Math.max(16, Math.min(96, Number(value.size) || 28)),
    priority: Math.max(1, Math.min(100, Number(value.priority) || 1)),
    enabled: value.enabled !== false,
    startAt,
    endAt,
  };
}

export function sortCustomCursorCampaigns(campaigns: CustomCursorCampaign[]) {
  return campaigns.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name);
  });
}

export function matchCustomCursorCampaign(
  campaigns: CustomCursorCampaign[],
  options: { pageTarget?: string | null; now?: number },
) {
  const pageTarget = String(options.pageTarget ?? "all").trim().toLowerCase();
  const now = options.now ?? Date.now();

  return sortCustomCursorCampaigns(campaigns).find((campaign) => {
    if (!campaign.enabled) return false;
    if (campaign.pageTarget !== "all" && campaign.pageTarget !== pageTarget) return false;
    if (campaign.startAt && Date.parse(campaign.startAt) > now) return false;
    if (campaign.endAt && Date.parse(campaign.endAt) <= now) return false;
    return true;
  }) ?? null;
}
