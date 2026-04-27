import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
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

    const shouldSyncPixel =
      Boolean(webPixel) &&
      Boolean(conversionApiUrl) &&
      (
        webPixel?.settings?.conversionApiUrl !== conversionApiUrl ||
        webPixel?.settings?.reportPaymentToken !== reportPaymentToken
      );

    if (shouldSyncPixel) {
      console.log("[settings] Syncing web pixel conversionApiUrl", {
        current: webPixel?.settings?.conversionApiUrl,
        next: conversionApiUrl,
      });

      webPixel = await upsertWebPixel(admin, {
        conversionApiUrl,
        reportPaymentToken,
      }).catch((error) => {
        console.error("[settings] Failed to auto-sync web pixel", error);
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

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    console.log("[settings] Web pixel activation request received");
    const { admin, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const conversionApiUrl = String(formData.get("conversionApiUrl") || "").trim();
    const reportPaymentToken = createReportPaymentToken(session.shop);

    if (!conversionApiUrl) {
      return json(
        {
          ok: false,
          error: "Conversion API URL is required.",
        },
        { status: 400 },
      );
    }

    console.log("[settings] Activating web pixel with URL", conversionApiUrl);
    const webPixel = await upsertWebPixel(admin, {
      conversionApiUrl,
      reportPaymentToken,
    });

    return json({
      ok: true,
      message: "Web pixel activated successfully.",
      webPixel,
    });
  } catch (error) {
    console.error("[settings] Action failed", error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to activate web pixel.",
      },
      { status: 500 },
    );
  }
};

export default function SettingsPage() {
  const { conversionApiUrl, settings, webPixel } = useLoaderData<typeof loader>();
  const currentConversionApiUrl =
    webPixel?.settings?.conversionApiUrl ?? conversionApiUrl;

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
