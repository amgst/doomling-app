import { shopifyAdminGraphql } from "@/lib/shopify/adminGraphql";

type EnsureArgs = {
  shop: string;
  accessToken: string;
};

type Resolved = {
  type: string;
  created: boolean;
};

function throwIfGraphqlErrors(res: any) {
  const errors = res?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return;
  throw new Error(errors.map((e: any) => e?.message).filter(Boolean).join("; ") || "Shopify GraphQL error");
}

async function getCurrentNumericAppId(args: EnsureArgs) {
  const res = await shopifyAdminGraphql(
    args.shop,
    args.accessToken,
    `
      query CurrentAppId {
        currentAppInstallation {
          app { id }
        }
      }
    `,
  );
  throwIfGraphqlErrors(res);
  const gid = res?.data?.currentAppInstallation?.app?.id as string | undefined;
  const m = String(gid || "").match(/gid:\/\/shopify\/App\/(\d+)/);
  if (!m) throw new Error("Unable to resolve current app id");
  return m[1];
}

async function appOwnedType(args: EnsureArgs, shortType: string) {
  const appId = await getCurrentNumericAppId(args);
  return `app--${appId}--${shortType}`;
}

async function ensureMetaobjectDefinition(
  { shop, accessToken }: EnsureArgs,
  definition: Record<string, any>,
): Promise<Resolved> {
  const type = String(definition?.type || "").trim();
  if (!type) throw new Error("Missing metaobject definition type");

  try {
    const existing = await shopifyAdminGraphql(
      shop,
      accessToken,
      `
        query MetaobjectDefinitionByType($type: String!) {
          metaobjectDefinitionByType(type: $type) { id type }
        }
      `,
      { type },
    );
    throwIfGraphqlErrors(existing);
    if (existing?.data?.metaobjectDefinitionByType?.id) {
      return { type: String(existing.data.metaobjectDefinitionByType.type), created: false };
    }
  } catch {
    // If we can't read definitions due to scopes, fall through and attempt create.
  }

  const created = await shopifyAdminGraphql(
    shop,
    accessToken,
    `
      mutation MetaobjectDefinitionCreate($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition { id type }
          userErrors { field message }
        }
      }
    `,
    { definition },
  );
  throwIfGraphqlErrors(created);

  const userErrors = created?.data?.metaobjectDefinitionCreate?.userErrors ?? [];
  if (Array.isArray(userErrors) && userErrors.length > 0) {
    const msg = userErrors.map((e: any) => e?.message).filter(Boolean).join("; ");
    // If it already exists, re-query to get the confirmed stored type rather than
    // returning our locally-computed string (handles cases where the initial query
    // was swallowed by the catch block above).
    if (/already exists|has already been taken|taken/i.test(msg)) {
      try {
        const refetch = await shopifyAdminGraphql(
          shop,
          accessToken,
          `
            query MetaobjectDefinitionByType($type: String!) {
              metaobjectDefinitionByType(type: $type) { id type }
            }
          `,
          { type },
        );
        if (refetch?.data?.metaobjectDefinitionByType?.id) {
          return { type: String(refetch.data.metaobjectDefinitionByType.type), created: false };
        }
      } catch {
        // Ignore — fall back to computed type below.
      }
      return { type, created: false };
    }
    throw new Error(`Metaobject definition create failed: ${msg}`);
  }

  if (!created?.data?.metaobjectDefinitionCreate?.metaobjectDefinition?.id) {
    throw new Error("Metaobject definition create failed");
  }

  return {
    type: String(created.data.metaobjectDefinitionCreate.metaobjectDefinition.type),
    created: true,
  };
}

export async function resolveGwpRuleType(args: EnsureArgs) {
  const type = await appOwnedType(args, "gwp_rule");
  const ensured = await ensureMetaobjectDefinition(args, {
    type,
    name: "Gift rule",
    displayNameKey: "title",
    access: { admin: "MERCHANT_READ_WRITE", storefront: "PUBLIC_READ" },
    fieldDefinitions: [
      { key: "enabled", name: "Enabled", type: "boolean", required: true },
      { key: "title", name: "Title", type: "single_line_text_field" },
      { key: "priority", name: "Priority", type: "number_integer" },
      { key: "main_variant", name: "Main variant", type: "variant_reference", required: true },
      { key: "gift_variant", name: "Gift variant", type: "variant_reference", required: true },
      { key: "gift_quantity_mode", name: "Gift quantity mode", type: "single_line_text_field" },
      { key: "gift_quantity_fixed", name: "Gift quantity fixed", type: "number_integer" },
      { key: "max_gift_qty_per_cart", name: "Max gift quantity per cart", type: "number_integer" },
      { key: "min_main_qty", name: "Min main quantity", type: "number_integer" },
      { key: "min_cart_subtotal_cents", name: "Min cart subtotal (cents)", type: "number_integer" },
      { key: "customer_tags_include", name: "Customer tags include", type: "list.single_line_text_field" },
      { key: "customer_tags_exclude", name: "Customer tags exclude", type: "list.single_line_text_field" },
      { key: "countries_include", name: "Countries include (ISO)", type: "list.single_line_text_field" },
      { key: "markets_include", name: "Markets include", type: "list.single_line_text_field" },
      { key: "starts_at", name: "Starts at", type: "date_time" },
      { key: "ends_at", name: "Ends at", type: "date_time" },
    ],
  });

  return ensured.type;
}

export async function resolveUpsellRuleType(args: EnsureArgs) {
  const type = await appOwnedType(args, "upsell_rule");
  const ensured = await ensureMetaobjectDefinition(args, {
    type,
    name: "Upsell rule",
    displayNameKey: "trigger_product_title",
    access: { admin: "MERCHANT_READ_WRITE", storefront: "PUBLIC_READ" },
    fieldDefinitions: [
      { key: "enabled", name: "Enabled", type: "boolean", required: true },
      { key: "trigger_product", name: "Trigger product", type: "product_reference", required: true },
      { key: "trigger_product_title", name: "Trigger product title", type: "single_line_text_field" },
      { key: "message", name: "Message", type: "single_line_text_field" },
      { key: "upsell_products", name: "Upsell products", type: "json" },
    ],
  });
  return ensured.type;
}
