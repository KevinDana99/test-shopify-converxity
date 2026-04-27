import db from "../../db.server";
import { isOriginAllowed } from "../../lib/cors.server";
import { normalizeShopDomain } from "../../lib/shop-domain";
import {
  buildIdempotencyKey,
  type ConversionPayload,
} from "../../schemas/conversion.schema";
import { findAffiliateByCode } from "../../repositories/affiliates.repository.server";
import { findConversionByIdempotencyKey } from "../../repositories/conversions.repository.server";

function amountToCents(amount: number) {
  return Math.round(amount * 100);
}

function calculateCommissionAmountCents(
  subtotalAmountCents: number,
  commissionRateBps: number,
) {
  return Math.round((subtotalAmountCents * commissionRateBps) / 10000);
}

function assertTrustedRequest(
  request: Request,
  shopDomain: string,
  allowedOrigins: string,
) {
  const headerShop = request.headers.get("X-Shopify-Shop-Domain");

  if (headerShop && normalizeShopDomain(headerShop) !== shopDomain) {
    throw new Response("Shop domain mismatch", { status: 403 });
  }

  if (!isOriginAllowed(request.headers.get("Origin"), allowedOrigins)) {
    throw new Response("Origin not allowed", { status: 403 });
  }
}

export async function createConversion(input: ConversionPayload, request: Request) {
  const settings = await db.appInstallationSettings.upsert({
    where: { shop: input.shopDomain },
    update: {},
    create: { shop: input.shopDomain },
  });

  assertTrustedRequest(request, input.shopDomain, settings.allowedOrigins);

  const idempotencyKey = buildIdempotencyKey(input);
  const existing = await findConversionByIdempotencyKey(
    input.shopDomain,
    idempotencyKey,
  );

  if (existing) {
    return {
      allowedOrigins: settings.allowedOrigins,
      conversion: existing,
      duplicate: true,
    };
  }

  const affiliate = await findAffiliateByCode(input.shopDomain, input.affiliateCode);

  if (settings.requireKnownAffiliate && !affiliate) {
    throw new Response("Affiliate is required", { status: 422 });
  }

  const subtotalAmountCents = amountToCents(input.subtotalAmount);
  const commissionRateBps =
    affiliate?.commissionRateBps ?? settings.defaultCommissionRateBps;
  const commissionAmountCents = calculateCommissionAmountCents(
    subtotalAmountCents,
    commissionRateBps,
  );

  const conversion = await db.$transaction(async (tx) => {
    const rawPayload = {
      ...input,
      happenedAt: input.happenedAt.toISOString(),
    };

    const createdConversion = await tx.conversion.create({
      data: {
        affiliateCode: input.affiliateCode,
        affiliateId: affiliate?.id,
        commissionAmountCents,
        currencyCode: input.currencyCode,
        customerId: input.customerId,
        eventName: input.eventName,
        happenedAt: input.happenedAt,
        idempotencyKey,
        orderId: input.orderId,
        orderName: input.orderName,
        rawPayload,
        shop: input.shopDomain,
        sourceUrl: input.sourceUrl,
        subtotalAmountCents,
      },
      include: {
        affiliate: true,
        billingEvent: true,
      },
    });

    await tx.billingEvent.create({
      data: {
        amountCents: commissionAmountCents,
        conversionId: createdConversion.id,
        currencyCode: input.currencyCode,
        shop: input.shopDomain,
      },
    });

    return tx.conversion.findUniqueOrThrow({
      where: { id: createdConversion.id },
      include: {
        affiliate: true,
        billingEvent: true,
      },
    });
  });

  return {
    allowedOrigins: settings.allowedOrigins,
    conversion,
    duplicate: false,
  };
}
