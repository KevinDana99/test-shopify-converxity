import { createHash, timingSafeEqual } from "node:crypto";

import { normalizeShopDomain } from "../../lib/shop-domain";

function getReportPaymentSecret() {
  return (
    process.env.REPORT_PAYMENT_SECRET ||
    process.env.SHOPIFY_API_SECRET ||
    "development-report-payment-secret"
  );
}

export function createReportPaymentToken(shopDomain: string) {
  const normalizedShopDomain = normalizeShopDomain(shopDomain);

  return createHash("sha256")
    .update(`${normalizedShopDomain}:${getReportPaymentSecret()}`)
    .digest("hex");
}

export function isValidReportPaymentToken(
  shopDomain: string,
  reportPaymentToken: string,
) {
  const expected = createReportPaymentToken(shopDomain);
  const actual = reportPaymentToken.trim();

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}
