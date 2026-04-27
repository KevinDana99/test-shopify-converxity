import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Badge,
  BlockStack,
  Card,
  DataTable,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { listAffiliatesByShop } from "../repositories/affiliates.repository.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const affiliates = await listAffiliatesByShop(session.shop);

  return { affiliates };
};

export default function AffiliatesPage() {
  const { affiliates } = useLoaderData<typeof loader>();
  const rows = affiliates.map((affiliate) => [
    affiliate.displayName,
    affiliate.code,
    `${affiliate.commissionRateBps / 100}%`,
    <Badge key={affiliate.id} tone={affiliate.status === "ACTIVE" ? "success" : undefined}>
      {affiliate.status}
    </Badge>,
  ]);

  return (
    <Page>
      <TitleBar title="Affiliates" />
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Registered affiliates
          </Text>
          <DataTable
            columnContentTypes={["text", "text", "numeric", "text"]}
            headings={["Name", "Code", "Rate", "Status"]}
            rows={rows}
          />
        </BlockStack>
      </Card>
    </Page>
  );
}
