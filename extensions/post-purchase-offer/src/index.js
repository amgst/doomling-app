import {
  extend,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  Separator,
  Text,
  TextBlock,
  TextContainer,
  Tiles,
} from "@shopify/post-purchase-ui-extensions";

const APP_URL = "https://upsale-cyan.vercel.app";

extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  const response = await fetch(`${APP_URL}/api/post-purchase/offer`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${inputData.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      referenceId: inputData.initialPurchase.referenceId,
      initialPurchase: inputData.initialPurchase,
    }),
  }).then((result) => result.json());

  await storage.update(response);

  return { render: Boolean(response?.render && response?.offer) };
});

extend(
  "Checkout::PostPurchase::Render",
  (root, { done, storage, calculateChangeset, applyChangeset, inputData }) => {
    const purchaseOption = storage.initialData?.offer;

    if (!purchaseOption) {
      done();
      return;
    }

    async function acceptOffer() {
      const token = await fetch(`${APP_URL}/api/post-purchase/sign-changeset`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${inputData.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceId: inputData.initialPurchase.referenceId,
          changes: purchaseOption.id,
        }),
      })
        .then((response) => response.json())
        .then((response) => response.token);

      await applyChangeset(token);
      done();
    }

    function declineOffer() {
      done();
    }

    async function renderOffer() {
      const result = await calculateChangeset({ changes: purchaseOption.changes });

      const shipping =
        result.calculatedPurchase?.addedShippingLines?.[0]?.priceSet?.presentmentMoney?.amount ?? "0.00";
      const taxes =
        result.calculatedPurchase?.addedTaxLines?.[0]?.priceSet?.presentmentMoney?.amount ?? "0.00";
      const total =
        result.calculatedPurchase?.totalOutstandingSet?.presentmentMoney?.amount ?? purchaseOption.discountedPrice;

      const content = root.createComponent(BlockStack, { spacing: "loose" }, [
        root.createComponent(CalloutBanner, {}, [
          root.createComponent(BlockStack, { spacing: "tight" }, [
              root.createComponent(TextContainer, {}, [
                root.createComponent(Text, { size: "medium", emphasized: true }, "It's not too late to add this to your order"),
            ]),
            root.createComponent(TextContainer, {}, [
              root.createComponent(Text, { size: "medium" }, `${purchaseOption.productTitle} is available right now.`),
            ]),
          ]),
        ]),
        root.createComponent(
          Layout,
          {
            media: [
              { viewportSize: "small", sizes: [1, 0, 1], maxInlineSize: 0.9 },
              { viewportSize: "medium", sizes: [532, 0, 1], maxInlineSize: 420 },
              { viewportSize: "large", sizes: [560, 38, 340] },
            ],
          },
          [
            root.createComponent(Image, {
              description: "product photo",
              source: purchaseOption.productImageURL,
            }),
            root.createComponent(BlockStack),
            root.createComponent(BlockStack, {}, [
              root.createComponent(Heading, {}, purchaseOption.productTitle),
              root.createComponent(TextContainer, { alignment: "leading", spacing: "loose" }, [
                root.createComponent(Text, { role: "deletion", size: "large" }, formatCurrency(purchaseOption.originalPrice)),
                " ",
                root.createComponent(Text, { emphasized: true, size: "large", appearance: "critical" }, formatCurrency(purchaseOption.discountedPrice)),
              ]),
              root.createComponent(BlockStack, { spacing: "xtight" }, purchaseOption.productDescription.map((line) =>
                root.createComponent(TextBlock, { subdued: true }, line),
              )),
              root.createComponent(BlockStack, { spacing: "tight" }, [
                root.createComponent(Separator),
                moneyLine(root, "Subtotal", purchaseOption.discountedPrice),
                moneyLine(root, "Shipping", shipping),
                moneyLine(root, "Taxes", taxes),
                root.createComponent(Separator),
                moneySummary(root, "Total", total),
              ]),
              root.createComponent(BlockStack, {}, [
                root.createComponent(Button, { onPress: acceptOffer, submit: true }, `Pay now · ${formatCurrency(total)}`),
                root.createComponent(Button, { onPress: declineOffer, subdued: true }, "Decline upsell offer"),
              ]),
            ]),
          ],
        ),
      ]);

      root.appendChild(content);
    }

    renderOffer();
  },
);

function moneyLine(root, label, amount) {
  return root.createComponent(Tiles, {}, [
    root.createComponent(TextBlock, { size: "small" }, label),
    root.createComponent(
      TextContainer,
      { alignment: "trailing" },
      root.createComponent(TextBlock, { emphasized: true, size: "small" }, formatCurrency(amount)),
    ),
  ]);
}

function moneySummary(root, label, amount) {
  return root.createComponent(Tiles, {}, [
    root.createComponent(TextBlock, { size: "medium", emphasized: true }, label),
    root.createComponent(
      TextContainer,
      { alignment: "trailing" },
      root.createComponent(TextBlock, { emphasized: true, size: "medium" }, formatCurrency(amount)),
    ),
  ]);
}

function formatCurrency(amount) {
  const numeric = Number.parseFloat(String(amount ?? 0));
  if (!Number.isFinite(numeric) || numeric === 0) return "Free";
  return `$${numeric.toFixed(2)}`;
}
