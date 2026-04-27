import db from "../../db.server";
import { isOriginAllowed } from "../../lib/cors.server";
import { normalizeShopDomain } from "../../lib/shop-domain";
import {
  buildReportPaymentIdempotencyKey,
  type ReportPaymentPayload,
} from "../../schemas/conversion.schema";
import { findConversionByIdempotencyKey } from "../../repositories/conversions.repository.server";
import {
  enqueueReportPaymentJob,
  hasQueuedReportPaymentJob,
} from "./report-payment-queue.server";
import { isValidReportPaymentToken } from "./report-payment-token.server";

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
  const settings = await db.appInstallationSettings.upsert({
    where: { shop: input.shopDomain },
    update: {},
    create: { shop: input.shopDomain },
  });

  assertTrustedRequest(request, input.shopDomain, settings.allowedOrigins);

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
      queuedAt: null,
      status: "duplicate" as const,
    };
  }

  if (await hasQueuedReportPaymentJob(idempotencyKey)) {
    return {
      allowedOrigins: settings.allowedOrigins,
      createdAt: null,
      customerId: input.customerId ?? null,
      duplicate: true,
      orderId: input.orderId,
      queuedAt: null,
      status: "duplicate" as const,
    };
  }

  const queued = await enqueueReportPaymentJob(input);

  if (queued.duplicate) {
    return {
      allowedOrigins: settings.allowedOrigins,
      createdAt: null,
      customerId: input.customerId ?? null,
      duplicate: true,
      orderId: input.orderId,
      queuedAt: null,
      status: "duplicate" as const,
    };
  }

  return {
    allowedOrigins: settings.allowedOrigins,
    createdAt: null,
    customerId: input.customerId ?? null,
    duplicate: false,
    orderId: input.orderId,
    queuedAt: queued.queuedAt,
    status: "accepted" as const,
  };
}
