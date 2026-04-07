"use client";

import { Page } from "@shopify/polaris";
import BuyXGetYTabPolaris from "@/components/dashboard/tabs/BuyXGetYTabPolaris";

export default function BxgyPage() {
  return (
    <Page title="Buy X Get Y">
      <BuyXGetYTabPolaris />
    </Page>
  );
}
