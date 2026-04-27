import db from "../db.server";

export function listAffiliatesByShop(shop: string) {
  return db.affiliate.findMany({
    where: { shop },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });
}

export function findAffiliateByCode(shop: string, code: string) {
  return db.affiliate.findUnique({
    where: {
      shop_code: {
        shop,
        code,
      },
    },
  });
}
