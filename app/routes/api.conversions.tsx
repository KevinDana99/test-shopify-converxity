import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";

import { buildCorsHeaders } from "../lib/cors.server";
import { reportPayment } from "../services/report-payment/report-payment.service.server";
import { reportPaymentPayloadSchema } from "../schemas/conversion.schema";

const FALLBACK_ALLOWED_ORIGINS = process.env.ALLOWED_PIXEL_ORIGINS ?? "*";

function responseWithCors(
  request: Request,
  allowedOrigins: string,
  body: unknown,
  init?: ResponseInit,
) {
  const headers = buildCorsHeaders(request, allowedOrigins);
  const response = json(body, init);

  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request, FALLBACK_ALLOWED_ORIGINS),
    });
  }

  return responseWithCors(
    request,
    FALLBACK_ALLOWED_ORIGINS,
    {
      error: "method_not_allowed",
      message: "Use POST for this endpoint.",
    },
    { status: 405 },
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      { error: "method_not_allowed", message: "Use POST for this endpoint." },
      { status: 405 },
    );
  }

  const rawBody = await request.json().catch(() => null);

  const payload = reportPaymentPayloadSchema.safeParse(rawBody);

  if (!payload.success) {
    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      {
        error: "invalid_payload",
        message: "La solicitud no cumple el contrato esperado.",
        issues: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await reportPayment(payload.data, request);

    return responseWithCors(
      request,
      result.allowedOrigins,
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

      return responseWithCors(
        request,
        FALLBACK_ALLOWED_ORIGINS,
        JSON.parse(errorText),
        { status: error.status },
      );
    }

    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      { error: "unexpected_error", message: "Unexpected error" },
      { status: 500 },
    );
  }
};
