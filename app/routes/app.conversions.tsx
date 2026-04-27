import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Card,
  DataTable,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { formatMoney } from "../lib/money";
import { listRecentConversions } from "../repositories/conversions.repository.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const conversions = await listRecentConversions(session.shop);

  return { conversions };
};

export default function ConversionsPage() {
  const { conversions } = useLoaderData<typeof loader>();
  const rows = conversions.map((conversion) => [
    conversion.orderName ?? conversion.orderId,
    conversion.affiliateCode,
    formatMoney(conversion.subtotalAmountCents, conversion.currencyCode),
    formatMoney(conversion.commissionAmountCents, conversion.currencyCode),
    conversion.billingEvent?.status ?? "PENDING",
    new Date(conversion.createdAt).toLocaleString(),
  ]);

  return (
    <Page>
      <TitleBar title="Conversions" />
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Recent conversion events
          </Text>
          <DataTable
            columnContentTypes={["text", "text", "numeric", "numeric", "text", "text"]}
            headings={[
              "Order",
              "Affiliate",
              "Subtotal",
              "Commission",
              "Billing",
              "Created at",
            ]}
            rows={rows}
          />
        </BlockStack>
      </Card>
    </Page>
  );
}
