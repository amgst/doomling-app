# Post-Purchase Notes

The new `Post-Purchase` tab in the app dashboard manages Doomlings offers that are intended to appear right after checkout.

What is already in place:
- Admin tab: `/dashboard/postpurchase`
- Offer storage: Shopify metaobjects
- Compiled shop metafield: `upsell.post_purchase_offers`
- Stats route: `/api/standalone/post-purchase-stats`

Important Shopify limitation:
- Post-purchase extensions work freely on development stores.
- A live store requires Shopify access approval before the checkout extension can run there.

Extension folder:
- `extensions/post-purchase-offer/`

If the live checkout layer is needed next, use the extension folder above as the implementation target.
