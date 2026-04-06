"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeJson, type BxgyRule, type BxgyRuleStat } from "../shared";

type PublicGiftRule = {
  ruleId: string;
  name: string;
  buyQuantity: number;
  giftQuantity: number;
  priority: number;
  buyVariantIds: string[];
  giftVariantId: string;
  giftTitle: string;
};

type HealthTone = "good" | "warn" | "bad";

type HealthCheck = {
  label: string;
  detail: string;
  tone: HealthTone;
};

type ManualTestCase = {
  id: string;
  title: string;
  objective: string;
  steps: string[];
  expected: string;
  severity: "Critical" | "High" | "Medium";
};

function toneStyles(tone: HealthTone) {
  if (tone === "good") {
    return { background: "#ecfdf5", border: "#a7f3d0", text: "#065f46", badge: "#10b981" };
  }
  if (tone === "bad") {
    return { background: "#fef2f2", border: "#fecaca", text: "#991b1b", badge: "#ef4444" };
  }
  return { background: "#fffbeb", border: "#fde68a", text: "#92400e", badge: "#f59e0b" };
}

function cardStyle(background = "#fff"): React.CSSProperties {
  return {
    background,
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: "1.1rem 1.15rem",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  };
}

function statValue(value: string | number) {
  return (
    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#111827", lineHeight: 1.05 }}>
      {value}
    </div>
  );
}

function formatRuleLabel(rule: BxgyRule) {
  const gift = rule.giftProduct?.title || "Missing gift";
  return `${rule.name} -> ${gift}`;
}

export default function QaLabTab({ shopDomain, storeUrl }: { shopDomain?: string; storeUrl?: string }) {
  const [rules, setRules] = useState<BxgyRule[]>([]);
  const [ruleStats, setRuleStats] = useState<BxgyRuleStat[]>([]);
  const [publicRules, setPublicRules] = useState<PublicGiftRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    if (!showRefreshing) setLoading(true);
    setError(null);

    try {
      const [bxgy, bxgyStats, publicData] = await Promise.all([
        fetch("/api/standalone/bxgy").then((r) => safeJson<{ rules?: BxgyRule[] }>(r)),
        fetch("/api/standalone/bxgy-stats").then((r) => safeJson<{ rules?: BxgyRuleStat[] }>(r)),
        shopDomain
          ? fetch(`/api/public/gift-rules?shop=${encodeURIComponent(shopDomain)}`).then((r) =>
              safeJson<{ rules?: PublicGiftRule[] }>(r),
            )
          : Promise.resolve(null),
      ]);

      setRules(bxgy?.rules ?? []);
      setRuleStats(bxgyStats?.rules ?? []);
      setPublicRules(publicData?.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QA diagnostics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shopDomain]);

  useEffect(() => {
    load();
  }, [load]);

  const checks = useMemo<HealthCheck[]>(() => {
    const enabledRules = rules.filter((rule) => rule.enabled);
    const autoAddRules = enabledRules.filter((rule) => rule.autoAdd);

    const selfGiftRules = autoAddRules.filter((rule) => {
      const giftVariantId = String(rule.giftProduct?.variantId ?? "");
      return Boolean(giftVariantId) && rule.buyProducts.some((product) => String(product.variantId) === giftVariantId);
    });

    const duplicateGiftGroups = new Map<string, string[]>();
    autoAddRules.forEach((rule) => {
      const giftVariantId = String(rule.giftProduct?.variantId ?? "");
      if (!giftVariantId) return;
      const current = duplicateGiftGroups.get(giftVariantId) ?? [];
      current.push(rule.name);
      duplicateGiftGroups.set(giftVariantId, current);
    });

    const duplicateGiftWarnings = Array.from(duplicateGiftGroups.values()).filter((group) => group.length > 1);

    const unpublishedAutoAddRules = autoAddRules.filter(
      (rule) => !publicRules.some((publicRule) => String(publicRule.ruleId) === String(rule.id)),
    );

    const inactiveStats = autoAddRules.filter(
      (rule) => !ruleStats.some((stat) => String(stat.ruleId) === String(rule.id)),
    );

    const results: HealthCheck[] = [
      {
        label: "BXGY rules loaded",
        detail:
          enabledRules.length > 0
            ? `${enabledRules.length} enabled rule${enabledRules.length === 1 ? "" : "s"} found in admin config.`
            : "No enabled BXGY rules are configured.",
        tone: enabledRules.length > 0 ? "good" : "warn",
      },
      {
        label: "Public storefront feed",
        detail: shopDomain
          ? `${publicRules.length} auto-add rule${publicRules.length === 1 ? "" : "s"} exposed to the storefront script.`
          : "Shop domain unavailable, so the public gift-rules feed could not be checked.",
        tone: shopDomain ? (publicRules.length > 0 ? "good" : "warn") : "warn",
      },
      {
        label: "Self-trigger loop risk",
        detail: selfGiftRules.length
          ? `${selfGiftRules.length} rule${selfGiftRules.length === 1 ? "" : "s"} use the same variant for Buy and Gift: ${selfGiftRules.map((rule) => rule.name).join(", ")}.`
          : "No rule uses its gift variant as a buy trigger.",
        tone: selfGiftRules.length ? "bad" : "good",
      },
      {
        label: "Shared gift collisions",
        detail: duplicateGiftWarnings.length
          ? `${duplicateGiftWarnings.length} gift variant${duplicateGiftWarnings.length === 1 ? "" : "s"} are reused by multiple auto-add rules.`
          : "Each auto-add rule currently owns its own gift variant.",
        tone: duplicateGiftWarnings.length ? "warn" : "good",
      },
      {
        label: "Storefront publish alignment",
        detail: unpublishedAutoAddRules.length
          ? `${unpublishedAutoAddRules.length} auto-add rule${unpublishedAutoAddRules.length === 1 ? "" : "s"} are enabled in admin but missing from the public feed.`
          : "Enabled auto-add rules are present in the public feed.",
        tone: unpublishedAutoAddRules.length ? "bad" : "good",
      },
      {
        label: "Stats coverage",
        detail: inactiveStats.length
          ? `${inactiveStats.length} auto-add rule${inactiveStats.length === 1 ? "" : "s"} have no matching stats row yet.`
          : "Every auto-add rule has a matching stats row.",
        tone: inactiveStats.length ? "warn" : "good",
      },
    ];

    return results;
  }, [publicRules, ruleStats, rules, shopDomain]);

  const manualTests = useMemo<ManualTestCase[]>(
    () => [
      {
        id: "BXGY-001",
        title: "Gift adds once after qualification",
        objective: "Verify the free item appears only once when the cart first qualifies.",
        severity: "Critical",
        steps: [
          "Open a fresh incognito storefront session.",
          "Add the qualifying Buy product until the rule threshold is met.",
          "Watch the cart drawer and full cart page during the first auto-add.",
        ],
        expected: "Exactly one gift line is added, no duplicate line appears, and the gift quantity settles immediately to the configured amount.",
      },
      {
        id: "BXGY-002",
        title: "Manual gift removal stays removed",
        objective: "Verify shoppers can dismiss the auto gift without the app forcing it back instantly.",
        severity: "Critical",
        steps: [
          "Qualify the cart so the gift is auto-added.",
          "Remove only the gift line from the cart or cart drawer.",
          "Wait 5 seconds and trigger one cart refresh by opening or closing the drawer.",
        ],
        expected: "The gift does not reappear while the shopper keeps the same qualifying cart in the same session.",
      },
      {
        id: "BXGY-003",
        title: "Cart can empty normally",
        objective: "Verify BXGY never traps a line in the cart.",
        severity: "Critical",
        steps: [
          "Qualify the cart and confirm the gift is present.",
          "Remove the qualifying Buy product.",
          "If a gift line remains, remove it as well.",
        ],
        expected: "Both the Buy item and the gift can be removed, and the cart reaches zero items without the gift being re-added.",
      },
      {
        id: "BXGY-004",
        title: "No quantity flicker on first add",
        objective: "Catch the bug where a gift briefly shows quantity 2 and then changes to 1.",
        severity: "High",
        steps: [
          "Open the cart drawer before adding the final qualifying item.",
          "Add the last required Buy quantity.",
          "Observe the gift line for 3 to 5 seconds.",
        ],
        expected: "The gift line appears once at the correct quantity and does not jump between values.",
      },
      {
        id: "BXGY-005",
        title: "Multi-bundle quantity stays correct",
        objective: "Verify quantity math when the shopper qualifies for more than one gift bundle.",
        severity: "High",
        steps: [
          "Use a rule with Buy quantity greater than 0 and Gift quantity greater than 0.",
          "Add enough Buy items to qualify for two bundles.",
          "Remove one Buy unit so only one bundle still qualifies.",
        ],
        expected: "Gift quantity increases to the correct multi-bundle amount and then decreases cleanly to the new qualified amount.",
      },
      {
        id: "BXGY-006",
        title: "Manual gift purchase is not mistaken for auto gift",
        objective: "Ensure a shopper-added gift SKU is not removed by BXGY automation.",
        severity: "Medium",
        steps: [
          "Add the gift product manually from its product page before qualifying the BXGY rule.",
          "Then qualify the BXGY rule using the Buy products.",
          "Review the cart lines and the final discount behavior.",
        ],
        expected: "The manually added item remains a shopper-controlled line, and BXGY does not remove it as part of auto-gift cleanup.",
      },
    ],
    [],
  );

  const enabledRules = rules.filter((rule) => rule.enabled);
  const autoAddRules = enabledRules.filter((rule) => rule.autoAdd);
  const blockingIssues = checks.filter((check) => check.tone === "bad").length;
  const warningIssues = checks.filter((check) => check.tone === "warn").length;

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#6d7175" }}>Loading QA diagnostics...</div>;
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <section
        style={{
          ...cardStyle("linear-gradient(135deg, #fff7ed 0%, #fffbeb 46%, #f0fdf4 100%)"),
          borderColor: "#fed7aa",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 760 }}>
            <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9a3412" }}>
              QA Lab
            </p>
            <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.8rem", lineHeight: 1.1, color: "#111827" }}>BXGY emergency panel</h1>
            <p style={{ margin: "0.6rem 0 0", color: "#4b5563", fontSize: "0.95rem", lineHeight: 1.6 }}>
              This tab is the first version of a super-admin quality screen for Buy X Get Y. It shows live rule health,
              risky configurations, and a manual regression pack built around the gift re-add and quantity flicker bugs.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              style={{
                border: "1px solid #d1d5db",
                background: refreshing ? "#f9fafb" : "#fff",
                color: "#111827",
                padding: "0.72rem 0.95rem",
                borderRadius: 12,
                fontWeight: 700,
                cursor: refreshing ? "default" : "pointer",
              }}
            >
              {refreshing ? "Refreshing..." : "Refresh diagnostics"}
            </button>
            {storeUrl ? (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  border: "1px solid #16a34a",
                  background: "#16a34a",
                  color: "#fff",
                  padding: "0.72rem 0.95rem",
                  borderRadius: 12,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Open storefront
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <section style={{ ...cardStyle("#fef2f2"), borderColor: "#fecaca", color: "#991b1b" }}>
          <strong>Diagnostics failed.</strong> {error}
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.9rem",
        }}
      >
        <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: "0.84rem", marginBottom: "0.35rem" }}>Enabled rules</div>{statValue(enabledRules.length)}</div>
        <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: "0.84rem", marginBottom: "0.35rem" }}>Auto-add rules</div>{statValue(autoAddRules.length)}</div>
        <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: "0.84rem", marginBottom: "0.35rem" }}>Blocking risks</div>{statValue(blockingIssues)}</div>
        <div style={cardStyle()}><div style={{ color: "#6b7280", fontSize: "0.84rem", marginBottom: "0.35rem" }}>Warnings</div>{statValue(warningIssues)}</div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ margin: 0, fontSize: "1.08rem", color: "#111827" }}>Live health checks</h2>
        <p style={{ margin: "0.45rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
          These checks are computed from the current BXGY admin rules, stats, and public storefront feed.
        </p>
        <div style={{ display: "grid", gap: "0.8rem" }}>
          {checks.map((check) => {
            const colors = toneStyles(check.tone);
            return (
              <div
                key={check.label}
                style={{
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  borderRadius: 14,
                  padding: "0.9rem 1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.25rem" }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: colors.badge,
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ color: colors.text }}>{check.label}</strong>
                </div>
                <p style={{ margin: 0, color: colors.text, lineHeight: 1.55 }}>{check.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section style={cardStyle()}>
        <h2 style={{ margin: 0, fontSize: "1.08rem", color: "#111827" }}>BXGY regression pack</h2>
        <p style={{ margin: "0.45rem 0 1rem", color: "#6b7280", fontSize: "0.9rem" }}>
          These are the manual QA cases I would run before every BXGY release and after every storefront script change.
        </p>
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {manualTests.map((test) => (
            <div key={test.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "0.95rem 1rem", background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.05em", color: "#9ca3af" }}>{test.id}</div>
                  <div style={{ marginTop: "0.2rem", fontSize: "1rem", fontWeight: 700, color: "#111827" }}>{test.title}</div>
                </div>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.74rem",
                    fontWeight: 800,
                    background: test.severity === "Critical" ? "#fee2e2" : test.severity === "High" ? "#ffedd5" : "#e0f2fe",
                    color: test.severity === "Critical" ? "#991b1b" : test.severity === "High" ? "#9a3412" : "#075985",
                  }}
                >
                  {test.severity}
                </span>
              </div>
              <p style={{ margin: "0.6rem 0 0", color: "#374151", lineHeight: 1.55 }}>
                <strong>Objective:</strong> {test.objective}
              </p>
              <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.3rem" }}>
                {test.steps.map((step, index) => (
                  <div key={`${test.id}-${index}`} style={{ color: "#374151", lineHeight: 1.55 }}>
                    {index + 1}. {step}
                  </div>
                ))}
              </div>
              <p style={{ margin: "0.75rem 0 0", color: "#111827", lineHeight: 1.55 }}>
                <strong>Expected:</strong> {test.expected}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: "1.08rem", color: "#111827" }}>Current rule snapshot</h2>
          <p style={{ margin: "0.45rem 0 0.95rem", color: "#6b7280", fontSize: "0.9rem" }}>
            Quick view of what is actually configured right now.
          </p>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {enabledRules.length === 0 ? (
              <div style={{ color: "#6b7280" }}>No enabled BXGY rules found.</div>
            ) : (
              enabledRules.map((rule) => (
                <div key={rule.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "0.8rem 0.9rem", background: "#fcfcfd" }}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>{formatRuleLabel(rule)}</div>
                  <div style={{ marginTop: "0.3rem", color: "#4b5563", fontSize: "0.88rem", lineHeight: 1.55 }}>
                    Buy {rule.buyQuantity}, get {rule.giftQuantity}. Priority {rule.priority}. Auto-add {rule.autoAdd ? "on" : "off"}.
                  </div>
                  <div style={{ marginTop: "0.35rem", color: "#6b7280", fontSize: "0.82rem", lineHeight: 1.55 }}>
                    Buy variants: {rule.buyProducts.map((product) => product.title).join(", ") || "None"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={cardStyle()}>
          <h2 style={{ margin: 0, fontSize: "1.08rem", color: "#111827" }}>Next debug tools</h2>
          <p style={{ margin: "0.45rem 0 0.95rem", color: "#6b7280", fontSize: "0.9rem" }}>
            Good candidates for the next step if we keep building this super-admin area.
          </p>
          <div style={{ display: "grid", gap: "0.7rem", color: "#374151", lineHeight: 1.55 }}>
            <div>1. Add a live BXGY event timeline so we can see qualify, auto-add, quantity-change, and remove actions in order.</div>
            <div>2. Add a rule simulator where we enter cart lines and preview the expected gift quantity before testing on the storefront.</div>
            <div>3. Add a storefront embed status check that verifies the BXGY app block is enabled on the active theme.</div>
            <div>4. Add one-click smoke tests for common scenarios once we have a safe test store workflow.</div>
          </div>
        </div>
      </section>
    </div>
  );
}
