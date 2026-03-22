import { Card, Text, BlockStack } from "@shopify/polaris";

interface StatCardProps {
  title: string;
  value: string;
  helpText?: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

export default function StatCard({ title, value, helpText, trend }: StatCardProps) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text variant="bodySm" tone="subdued" as="p">
          {title}
        </Text>
        <Text variant="heading2xl" as="p">
          {value}
        </Text>
        {helpText && (
          <Text variant="bodySm" tone="subdued" as="p">
            {helpText}
          </Text>
        )}
        {trend && (
          <Text
            variant="bodySm"
            tone={trend.direction === "up" ? "success" : trend.direction === "down" ? "critical" : "subdued"}
            as="p"
          >
            {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
            {trend.value}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
