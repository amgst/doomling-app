# Post-Purchase Offer Extension

This folder is reserved for the Shopify post-purchase checkout extension used by Doomlings.

Current status:
- The app dashboard, offer storage, and offer statistics are implemented in the main app.
- The live checkout extension still needs Shopify post-purchase access on the target store.
- Shopify CLI scaffolding was attempted, but the repo's root `package.json` override for `@types/react` blocked the generated install step.

Recommended next step when we wire the live checkout:
1. Resolve the root npm override conflict.
2. Run `shopify app generate extension --template post_purchase_ui --name post-purchase-offer`.
3. Point the extension at the app's post-purchase offer endpoints.
4. Test on a development store with the Shopify post-purchase browser extension.
5. Request Shopify access before enabling on a live store.
