import db from "../db.server";

export function findConversionByIdempotencyKey(shop: string, idempotencyKey: string) {
  return db.conversion.findUnique({
    where: {
      shop_idempotencyKey: {
        shop,
        idempotencyKey,
      },
    },
    include: {
      affiliate: true,
      billingEvent: true,
    },
  });
}

export function listRecentConversions(shop: string) {
  return db.conversion.findMany({
    where: { shop },
    include: {
      affiliate: true,
      billingEvent: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}
