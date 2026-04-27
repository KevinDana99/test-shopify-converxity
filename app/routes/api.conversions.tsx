import { json, type ActionFunctionArgs } from "@remix-run/node";

import { buildCorsHeaders } from "../lib/cors.server";
import { createConversion } from "../services/conversions/conversion.service.server";
import { conversionPayloadSchema } from "../schemas/conversion.schema";

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

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request, FALLBACK_ALLOWED_ORIGINS),
    });
  }

  if (request.method !== "POST") {
    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      { ok: false, error: "Method not allowed" },
      { status: 405 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const payload = conversionPayloadSchema.safeParse(rawBody);

  if (!payload.success) {
    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      {
        ok: false,
        error: "Invalid payload",
        issues: payload.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await createConversion(payload.data, request);

    return responseWithCors(
      request,
      result.allowedOrigins,
      {
        ok: true,
        conversionId: result.conversion.id,
        duplicate: result.duplicate,
        commissionAmountCents: result.conversion.commissionAmountCents,
      },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Response) {
      return responseWithCors(
        request,
        FALLBACK_ALLOWED_ORIGINS,
        { ok: false, error: await error.text() },
        { status: error.status },
      );
    }

    return responseWithCors(
      request,
      FALLBACK_ALLOWED_ORIGINS,
      { ok: false, error: "Unexpected error" },
      { status: 500 },
    );
  }
};
