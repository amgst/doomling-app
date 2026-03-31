# MCP (Model Context Protocol) for this app

This repo can benefit from Shopify MCP in two ways:

1) **Developer productivity (recommended now):** connect your IDE/assistant to **Shopify Dev MCP** so it can validate Shopify APIs (Admin GraphQL, Functions targets, Liquid/theme validation, etc).
2) **Product features (optional later):** build agentic commerce features using **Storefront/Catalog/Checkout MCP**.

---

## 1) Connect Shopify Dev MCP (for coding + debugging)

### Codex CLI (recommended)

Edit your Codex config file:

- Windows: `C:\Users\<you>\.codex\config.toml`
- macOS/Linux: `~/.codex/config.toml`

Add:

```toml
[mcp_servers.shopify-dev-mcp]
command = "npx"
args = ["-y", "@shopify/dev-mcp@latest"]

# Optional
# env = { LIQUID_VALIDATION_MODE = "full" }
# env = { OPT_OUT_INSTRUMENTATION = "true" }
```

If `npx` isn’t found on Windows, try:

```toml
[mcp_servers.shopify-dev-mcp]
command = "cmd"
args = ["/c", "npx", "-y", "@shopify/dev-mcp@latest"]
```

Restart Codex after saving.

### Cursor / Claude / VSCode

See Shopify’s Dev MCP doc for the exact config shape per tool.

---

## 2) MCP you can use *in the app* (optional product features)

### Storefront MCP (per-shop, no auth)

Each shop exposes an MCP endpoint:

`https://{shop}.myshopify.com/api/mcp`

Use it when you want an AI experience scoped to the merchant’s store (search products, manage carts, answer policy questions).

### Catalog MCP (global discovery)

Use when you want cross-Shopify product discovery (not limited to one store). This typically requires auth and has strict usage rules (don’t cache results/images).

### Checkout MCP (agentic checkout)

Use when your AI agent needs to create/manage checkout sessions and then hand off to a trusted UI to complete payment. Requires client credentials + Bearer token.

---

## What’s most valuable for *this* repo

Given this app’s features (Functions + theme block + Admin GraphQL), the fastest win is **Shopify Dev MCP** so your assistant can:

- validate Admin GraphQL fields/mutations
- validate Functions targets/input schemas
- validate Liquid/theme changes

If you want “latest tech” in the product, the next step is usually a small **AI helper inside the app** (merchant-facing) that turns plain English into rules, then saves/syncs them.

