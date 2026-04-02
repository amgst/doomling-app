# Theme Notes

This file lists the Shopify theme files we added or edited for the Pebble theme integration, so we can find them quickly later.

## Pebble theme files

- Added [theme/assets/upsale-bxgy.js](/c:/shopify%20apps/doomling/theme/assets/upsale-bxgy.js)
  - Legacy Pebble-specific BXGY theme script.
  - Kept in the repo for reference, but it is no longer auto-loaded by the theme.

- Edited [theme/snippets/scripts.liquid](/c:/shopify%20apps/doomling/theme/snippets/scripts.liquid)
  - Removed the unconditional `upsale-bxgy.js` script include.
  - Removed the old always-on `FoxTheme.upsale.appUrl` config.
  - Storefront BXGY should now be activated through the app embed/block instead of always loading from the theme.

## Related app theme extension file

- Added [extensions/upsell-widget/blocks/gift-notification.liquid](/c:/shopify%20apps/doomling/extensions/upsell-widget/blocks/gift-notification.liquid)
  - Theme app extension version of the BXGY gift notifier.
  - This is now the recommended activation path for BXGY storefront behavior.

## Notes

- No app embed/app block enabled means no BXGY storefront script is loaded.
- Enable the relevant app blocks/embeds only on the theme you want to test.
- If the app backend URL changes, update the extension block settings where the embed/block is enabled.
one more 