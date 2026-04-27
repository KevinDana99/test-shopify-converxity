import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Card,
  InlineStack,
  List,
  Page,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import db from "../db.server";
import { authenticate } from "../shopify.server";
import {
  getInstalledWebPixel,
  upsertWebPixel,
} from "../services/pixels/web-pixel.service.server";
import { createReportPaymentToken } from "../services/report-payment/report-payment-token.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log("[settings] Loading settings page");
    const { session, admin } = await authenticate.admin(request);
    const settings = await db.appInstallationSettings.upsert({
      where: { shop: session.shop },
      update: {},
      create: { shop: session.shop },
    });
    let webPixel = await getInstalledWebPixel(admin).catch((error) => {
      console.error("[settings] Failed to query installed web pixel", error);
      return null;
    });
    const conversionApiUrl = process.env.SHOPIFY_APP_URL
      ? new URL("/api/conversions", process.env.SHOPIFY_APP_URL).toString()
      : "";
    const reportPaymentToken = createReportPaymentToken(session.shop);

    const shouldProvisionPixel =
      Boolean(conversionApiUrl) &&
      (
        !webPixel ||
        webPixel.settings?.conversionApiUrl !== conversionApiUrl ||
        webPixel.settings?.reportPaymentToken !== reportPaymentToken
      );

    if (shouldProvisionPixel) {
      console.log("[settings] Provisioning web pixel", {
        current: webPixel?.settings?.conversionApiUrl,
        next: conversionApiUrl,
      });

      webPixel = await upsertWebPixel(admin, {
        conversionApiUrl,
        reportPaymentToken,
      }).catch((error) => {
        console.error("[settings] Failed to provision web pixel", error);
        return webPixel;
      });
    }

    return {
      conversionApiUrl,
      reportPaymentToken,
      settings,
      webPixel,
    };
  } catch (error) {
    console.error("[settings] Loader failed", error);
    throw error;
  }
};

export default function SettingsPage() {
  const { conversionApiUrl, settings, webPixel } = useLoaderData<typeof loader>();
  const currentConversionApiUrl =
    webPixel?.settings?.conversionApiUrl ??
    conversionApiUrl;

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Installation defaults
            </Text>
            <List>
              <List.Item>
                Default commission rate: {settings.defaultCommissionRateBps / 100}%
              </List.Item>
              <List.Item>Allowed origins: {settings.allowedOrigins}</List.Item>
              <List.Item>
                Require known affiliate: {settings.requireKnownAffiliate ? "yes" : "no"}
              </List.Item>
            </List>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                Web pixel activation
              </Text>
              <Text as="span" variant="bodySm" tone={webPixel ? "success" : "subdued"}>
                {webPixel ? "Active" : "Inactive"}
              </Text>
            </InlineStack>

            <TextField
              label="Conversion API URL"
              name="conversionApiUrl"
              autoComplete="off"
              value={currentConversionApiUrl}
              readOnly
              helpText="This external endpoint URL is synced automatically into the Shopify web pixel settings and used by checkout_completed."
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
