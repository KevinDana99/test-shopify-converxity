import { Prisma } from "@prisma/client";

import db from "../../db.server";
import {
  buildReportPaymentIdempotencyKey,
  type ReportPaymentPayload,
} from "../../schemas/conversion.schema";
import { findConversionByIdempotencyKey } from "../../repositories/conversions.repository.server";
import type { processPaymentAffiliate } from "./payment-affiliate.service.server";

type PaymentAffiliateResult = Awaited<ReturnType<typeof processPaymentAffiliate>>;

export async function reportConversionResult(
  payload: ReportPaymentPayload,
  paymentResult: PaymentAffiliateResult,
) {
  const idempotencyKey = buildReportPaymentIdempotencyKey(payload);

  try {
    const conversion = await db.$transaction(async (tx) => {
      const { reportPaymentToken: _reportPaymentToken, ...safePayload } = payload;
      const rawPayload = {
        ...safePayload,
        happenedAt: safePayload.happenedAt.toISOString(),
        paymentAffiliate: {
          affiliateId: paymentResult.affiliateId,
          commissionAmountCents: paymentResult.commissionAmountCents,
          commissionRateBps: paymentResult.commissionRateBps,
          converxityFeeBps: paymentResult.converxityFeeBps,
          converxityFeeCents: paymentResult.converxityFeeCents,
          usageRecord: paymentResult.usageRecord,
        },
      };

      const createdConversion = await tx.conversion.create({
        data: {
          affiliateCode: payload.affiliateCode,
          affiliateId: paymentResult.affiliateId,
          commissionAmountCents: paymentResult.commissionAmountCents,
          currencyCode: payload.currencyCode,
          customerId: payload.customerId,
          eventName: "checkout_completed",
          happenedAt: payload.happenedAt,
          idempotencyKey,
          orderId: payload.orderId,
          orderName: payload.orderName,
          rawPayload,
          shop: payload.shopDomain,
          sourceUrl: payload.sourceUrl,
          subtotalAmountCents: paymentResult.subtotalAmountCents,
        },
      });

      await tx.billingEvent.create({
        data: {
          amountCents: paymentResult.commissionAmountCents,
          conversionId: createdConversion.id,
          currencyCode: payload.currencyCode,
          shop: payload.shopDomain,
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
      conversion,
      duplicate: false as const,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await findConversionByIdempotencyKey(
        payload.shopDomain,
        idempotencyKey,
      );

      if (existing) {
        return {
          conversion: existing,
          duplicate: true as const,
        };
      }
    }

    throw error;
  }
}
