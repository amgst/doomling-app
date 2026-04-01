# BXGY App Embed Notes

Buy X Get Y storefront behavior should run only when the BXGY app embed / app block is enabled in the theme.

## BXGY activation

- Enable:
  - [extensions/upsell-widget/blocks/gift-notification.liquid](/c:/shopify%20apps/doomling/extensions/upsell-widget/blocks/gift-notification.liquid)

- If this BXGY app block is not enabled in a theme:
  - BXGY storefront script should not load
  - BXGY auto-add should not run
  - BXGY cart or drawer UI should not appear

## Doomlings workflow

1. Duplicate the current live theme.
2. Enable the BXGY app block only on the duplicate theme.
3. Test BXGY there.
4. Publish after QA.
