import { findAffiliateByCode } from "../../repositories/affiliates.repository.server";
import { unauthenticated } from "../../shopify.server";
import db from "../../db.server";
import type { ReportPaymentPayload } from "../../schemas/conversion.schema";

const DEFAULT_CONVERXITY_FEE_BPS = 500;

function amountToCents(amount: number) {
  return Math.round(amount * 100);
}

function calculateAmountCents(
  subtotalAmountCents: number,
  rateBps: number,
) {
  return Math.round((subtotalAmountCents * rateBps) / 10_000);
}

function buildUsageRecordDescription(input: {
  affiliateCode: string;
  converxityFeeCents: number;
  currencyCode: string;
  orderId: string;
}) {
  return `Converxity fee for order ${input.orderId} (${input.affiliateCode}) - ${(
    input.converxityFeeCents / 100
  ).toFixed(2)} ${input.currencyCode}`;
}

async function createUsageRecord(input: {
  currencyCode: string;
  description: string;
  shopDomain: string;
  valueCents: number;
}) {
  const subscriptionLineItemId = process.env.SHOPIFY_USAGE_RECORD_LINE_ITEM_ID;

  if (!subscriptionLineItemId) {
    return {
      lineItemId: null,
      reason: "missing_line_item_id",
      status: "skipped" as const,
      usageRecordId: null,
    };
  }

  const { admin } = await unauthenticated.admin(input.shopDomain);
  const response = await admin.graphql(
    `#graphql
      mutation createUsageRecord(
        $subscriptionLineItemId: ID!
        $description: String!
        $price: MoneyInput!
      ) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          description: $description
          price: $price
        ) {
          appUsageRecord {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        description: input.description,
        price: {
          amount: (input.valueCents / 100).toFixed(2),
          currencyCode: input.currencyCode,
        },
        subscriptionLineItemId,
      },
    },
  );

  const body = (await response.json()) as {
    data?: {
      appUsageRecordCreate?: {
        appUsageRecord?: { id: string | null } | null;
        userErrors?: Array<{ field?: string[] | null; message: string }>;
      } | null;
    };
  };

  const result = body.data?.appUsageRecordCreate;
  const firstError = result?.userErrors?.[0];

  if (firstError) {
    throw new Error(`Shopify usage record failed: ${firstError.message}`);
  }

  return {
    lineItemId: subscriptionLineItemId,
    reason: null,
    status: "created" as const,
    usageRecordId: result?.appUsageRecord?.id ?? null,
  };
}

export async function processPaymentAffiliate(payload: ReportPaymentPayload) {
  const settings = await db.appInstallationSettings.upsert({
    where: { shop: payload.shopDomain },
    update: {},
    create: { shop: payload.shopDomain },
  });

  const affiliate = await findAffiliateByCode(payload.shopDomain, payload.affiliateCode);

  if (settings.requireKnownAffiliate && !affiliate) {
    throw new Error("Affiliate is required to process this conversion.");
  }

  const subtotalAmountCents = amountToCents(payload.subtotalAmount);
  const commissionRateBps =
    affiliate?.commissionRateBps ?? settings.defaultCommissionRateBps;
  const converxityFeeBps = Number(
    process.env.CONVERXITY_FEE_BPS ?? DEFAULT_CONVERXITY_FEE_BPS,
  );
  const commissionAmountCents = calculateAmountCents(
    subtotalAmountCents,
    commissionRateBps,
  );
  const converxityFeeCents = calculateAmountCents(
    subtotalAmountCents,
    converxityFeeBps,
  );

  const usageRecord = await createUsageRecord({
    currencyCode: payload.currencyCode,
    description: buildUsageRecordDescription({
      affiliateCode: payload.affiliateCode,
      converxityFeeCents,
      currencyCode: payload.currencyCode,
      orderId: payload.orderId,
    }),
    shopDomain: payload.shopDomain,
    valueCents: converxityFeeCents,
  });

  return {
    affiliateCode: payload.affiliateCode,
    affiliateId: affiliate?.id ?? null,
    commissionAmountCents,
    commissionRateBps,
    converxityFeeBps,
    converxityFeeCents,
    currencyCode: payload.currencyCode,
    customerId: payload.customerId,
    happenedAt: payload.happenedAt,
    orderId: payload.orderId,
    orderName: payload.orderName,
    reportPaymentToken: payload.reportPaymentToken,
    shopDomain: payload.shopDomain,
    sourceUrl: payload.sourceUrl,
    subtotalAmount: payload.subtotalAmount,
    subtotalAmountCents,
    usageRecord,
  };
}
