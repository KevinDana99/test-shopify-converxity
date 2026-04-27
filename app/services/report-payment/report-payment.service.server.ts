import db from "../../db.server";
import { isOriginAllowed } from "../../lib/cors.server";
import { normalizeShopDomain } from "../../lib/shop-domain";
import {
  buildReportPaymentIdempotencyKey,
  type ReportPaymentPayload,
} from "../../schemas/conversion.schema";
import { findAffiliateByCode } from "../../repositories/affiliates.repository.server";
import { findConversionByIdempotencyKey } from "../../repositories/conversions.repository.server";
import {
  enqueueReportPaymentJob,
  releaseReportPaymentJob,
  reserveReportPaymentJob,
} from "./report-payment-queue.server";
import { isValidReportPaymentToken } from "./report-payment-token.server";

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
    throw new Response(
      JSON.stringify({
        error: "forbidden",
        message: "El acceso a esta API está prohibido para este origen o tienda.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!isOriginAllowed(request.headers.get("Origin"), allowedOrigins)) {
    throw new Response(
      JSON.stringify({
        error: "forbidden",
        message: "El acceso a esta API está prohibido para este origen o tienda.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
}

export async function reportPayment(input: ReportPaymentPayload, request: Request) {
  return reportPaymentWithOptions(input, request, {});
}

export async function reportPaymentWithOptions(
  input: ReportPaymentPayload,
  request: Request,
  options: {trustedShopDomain?: string},
) {
  const settings = await db.appInstallationSettings.upsert({
    where: { shop: input.shopDomain },
    update: {},
    create: { shop: input.shopDomain },
  });

  if (options.trustedShopDomain && options.trustedShopDomain !== input.shopDomain) {
    throw new Response(
      JSON.stringify({
        error: "forbidden",
        message: "El acceso a esta API está prohibido para este origen o tienda.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (!options.trustedShopDomain) {
    assertTrustedRequest(request, input.shopDomain, settings.allowedOrigins);
  }

  if (!isValidReportPaymentToken(input.shopDomain, input.reportPaymentToken)) {
    throw new Response(
      JSON.stringify({
        error: "forbidden",
        message: "El acceso a esta API está prohibido para este origen o tienda.",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const idempotencyKey = buildReportPaymentIdempotencyKey(input);
  const existing = await findConversionByIdempotencyKey(
    input.shopDomain,
    idempotencyKey,
  );

  if (existing) {
    return {
      allowedOrigins: settings.allowedOrigins,
      createdAt: existing.createdAt.toISOString(),
      customerId: existing.customerId ?? null,
      duplicate: true,
      orderId: existing.orderId,
      status: "duplicate" as const,
    };
  }

  if (!reserveReportPaymentJob(idempotencyKey)) {
    return {
      allowedOrigins: settings.allowedOrigins,
      createdAt: new Date().toISOString(),
      customerId: input.customerId ?? null,
      duplicate: true,
      orderId: input.orderId,
      status: "duplicate" as const,
    };
  }

  try {
    enqueueReportPaymentJob({
      idempotencyKey,
      payload: {
        affiliateCode: input.affiliateCode,
        orderId: input.orderId,
        shopDomain: input.shopDomain,
      },
      queuedAt: new Date().toISOString(),
    });

    const affiliate = await findAffiliateByCode(input.shopDomain, input.affiliateCode);

    if (settings.requireKnownAffiliate && !affiliate) {
      throw new Response(
        JSON.stringify({
          error: "affiliate_required",
          message: "La conversión requiere un afiliado válido para ser procesada.",
        }),
        {
          status: 422,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const subtotalAmountCents = amountToCents(input.subtotalAmount);
    const commissionRateBps =
      affiliate?.commissionRateBps ?? settings.defaultCommissionRateBps;
    const commissionAmountCents = calculateCommissionAmountCents(
      subtotalAmountCents,
      commissionRateBps,
    );

    const conversion = await db.$transaction(async (tx) => {
      const { reportPaymentToken: _reportPaymentToken, ...safeInput } = input;
      const rawPayload = {
        ...safeInput,
        happenedAt: safeInput.happenedAt.toISOString(),
      };

      const createdConversion = await tx.conversion.create({
        data: {
          affiliateCode: input.affiliateCode,
          affiliateId: affiliate?.id,
          commissionAmountCents,
          currencyCode: input.currencyCode,
          customerId: input.customerId,
          eventName: "checkout_completed",
          happenedAt: input.happenedAt,
          idempotencyKey,
          orderId: input.orderId,
          orderName: input.orderName,
          rawPayload,
          shop: input.shopDomain,
          sourceUrl: input.sourceUrl,
          subtotalAmountCents,
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
      });
    });

    return {
      allowedOrigins: settings.allowedOrigins,
      createdAt: conversion.createdAt.toISOString(),
      customerId: conversion.customerId ?? null,
      duplicate: false,
      orderId: conversion.orderId,
      status: "created" as const,
    };
  } finally {
    releaseReportPaymentJob(idempotencyKey);
  }
}
