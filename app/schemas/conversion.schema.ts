import { z } from "zod";

import { isShopDomain, normalizeShopDomain } from "../lib/shop-domain";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

export const conversionPayloadSchema = z.object({
  shopDomain: z
    .string()
    .trim()
    .transform(normalizeShopDomain)
    .refine(isShopDomain, "Invalid shop domain"),
  affiliateCode: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .transform((value) => value.toUpperCase()),
  orderId: z.string().trim().min(1).max(128),
  orderName: optionalString,
  subtotalAmount: z.coerce.number().nonnegative(),
  currencyCode: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase()),
  eventName: z.string().trim().default("checkout_completed"),
  happenedAt: z.coerce.date(),
  sourceUrl: z.string().url().optional(),
  customerId: optionalString,
  idempotencyKey: optionalString,
});

export type ConversionPayload = z.infer<typeof conversionPayloadSchema>;

export function buildIdempotencyKey(payload: ConversionPayload) {
  return (
    payload.idempotencyKey ??
    [
      payload.shopDomain,
      payload.orderId,
      payload.affiliateCode,
      payload.eventName,
    ].join(":")
  );
}
