# Theme Notes

This file lists the Shopify theme files we added or edited for the Pebble theme integration, so we can find them quickly later.

## Pebble theme files

- Added [theme/assets/upsale-bxgy.js](/c:/shopify%20apps/doomling/theme/assets/upsale-bxgy.js)
  - Handles Buy X Get Y auto-gift logic inside the Pebble theme.
  - Hooks into Pebble cart updates.
  - Adds/removes the free gift in the cart and drawer.
  - Renders the BXGY gift panel and toast UI.

- Edited [theme/snippets/scripts.liquid](/c:/shopify%20apps/doomling/theme/snippets/scripts.liquid)
  - Loads `upsale-bxgy.js`.
  - Sets the app backend URL used by the theme integration.

## Related app theme extension file

- Added [extensions/upsell-widget/blocks/gift-notification.liquid](/c:/shopify%20apps/doomling/extensions/upsell-widget/blocks/gift-notification.liquid)
  - Theme app extension version of the BXGY gift notifier.
  - This is separate from the direct Pebble theme integration above.

## Notes

- For Pebble, the main live storefront integration is the theme-native script in `theme/assets/upsale-bxgy.js`.
- If the app backend URL changes, update it in `theme/snippets/scripts.liquid`.
