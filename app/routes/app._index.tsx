import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Card,
  DataTable,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { formatMoney } from "../lib/money";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  return getDashboardSummary(session.shop);
};

export default function AppDashboard() {
  const data = useLoaderData<typeof loader>();
  const rows = data.recentConversions.map((conversion) => [
    conversion.orderName ?? conversion.orderId,
    conversion.affiliateCode,
    formatMoney(conversion.subtotalAmountCents, conversion.currencyCode),
    formatMoney(conversion.commissionAmountCents, conversion.currencyCode),
    new Date(conversion.happenedAt).toLocaleString(),
  ]);

  return (
    <Page>
      <TitleBar title="Affiliate dashboard" />
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Pipeline
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  LocalStorage ref, Web Pixel event, explicit CORS, Zod
                  validation, idempotent persistence and billing events.
                </Text>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">
                    Default commission
                  </Text>
                  <Badge tone="info">
                    {`${data.settings.defaultCommissionRateBps / 100}%`}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">
                    Allowed origins
                  </Text>
                  <Badge>{data.settings.allowedOrigins}</Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span" variant="bodyMd">
                    Known affiliate required
                  </Text>
                  <Badge
                    tone={
                      data.settings.requireKnownAffiliate ? "attention" : undefined
                    }
                  >
                    {data.settings.requireKnownAffiliate ? "Yes" : "No"}
                  </Badge>
                </InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Top affiliates
                </Text>
                {data.topAffiliates.length === 0 ? (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No affiliates created yet.
                  </Text>
                ) : (
                  data.topAffiliates.map((affiliate) => (
                    <InlineStack
                      key={affiliate.code}
                      align="space-between"
                      blockAlign="center"
                    >
                      <BlockStack gap="100">
                        <Text as="span" variant="bodyMd" fontWeight="medium">
                          {affiliate.displayName}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {affiliate.code}
                        </Text>
                      </BlockStack>
                      <Badge tone="success">
                        {formatMoney(
                          affiliate.generatedCommissionCents,
                          data.currencyCode,
                        )}
                      </Badge>
                    </InlineStack>
                  ))
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section>
          <BlockStack gap="400">
            <InlineStack gap="400" align="space-between">
              <Card>
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Total conversions
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {data.metrics.totalConversions}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Revenue tracked
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {formatMoney(data.metrics.revenueTrackedCents, data.currencyCode)}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Pending commissions
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {formatMoney(
                      data.metrics.pendingCommissionCents,
                      data.currencyCode,
                    )}
                  </Text>
                </BlockStack>
              </Card>
            </InlineStack>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Recent conversions
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "text"]}
                  headings={[
                    "Order",
                    "Affiliate",
                    "Subtotal",
                    "Commission",
                    "Occurred at",
                  ]}
                  rows={rows}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
