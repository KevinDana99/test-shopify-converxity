import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";

import { normalizeShopDomain } from "../lib/shop-domain";
import { reportPaymentPayloadSchema } from "../schemas/conversion.schema";
import { reportPaymentWithOptions } from "../services/report-payment/report-payment.service.server";
import { authenticate } from "../shopify.server";

function getTrustedShopDomain(request: Request, sessionShop?: string) {
  if (sessionShop) {
    return normalizeShopDomain(sessionShop);
  }

  const shop = new URL(request.url).searchParams.get("shop");

  return shop ? normalizeShopDomain(shop) : undefined;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  return json(
    {
      error: "method_not_allowed",
      message: "Use POST for this endpoint.",
    },
    { status: 405 },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json(
      {
        error: "method_not_allowed",
        message: "Use POST for this endpoint.",
      },
      { status: 405 },
    );
  }

  const context = await authenticate.public.appProxy(request);
  const rawBody = await request.json().catch(() => null);
  const payload = reportPaymentPayloadSchema.safeParse(rawBody);

  if (!payload.success) {
    return json(
      {
        error: "invalid_payload",
        message: "La solicitud no cumple el contrato esperado.",
        issues: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const trustedShopDomain = getTrustedShopDomain(
    request,
    context.session?.shop,
  );

  if (!trustedShopDomain) {
    return json(
      {
        error: "forbidden",
        message: "El acceso a esta API está prohibido para este origen o tienda.",
      },
      { status: 403 },
    );
  }

  try {
    const result = await reportPaymentWithOptions(payload.data, request, {
      trustedShopDomain,
    });

    return json(
      {
        status: result.status,
        orderId: result.orderId,
        customerId: result.customerId,
        createdAt: result.createdAt,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Response) {
      const errorText = await error.text();

      return new Response(errorText, {
        status: error.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return json(
      { error: "unexpected_error", message: "Unexpected error" },
      { status: 500 },
    );
  }
};
