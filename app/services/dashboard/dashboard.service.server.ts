import db from "../../db.server";
import { listRecentConversions } from "../../repositories/conversions.repository.server";

export async function getDashboardSummary(shop: string) {
  const settings = await db.appInstallationSettings.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });

  const [recentConversions, conversionAggregate, billingAggregate, topAffiliates] =
    await Promise.all([
      listRecentConversions(shop),
      db.conversion.aggregate({
        where: { shop },
        _count: { _all: true },
        _sum: {
          subtotalAmountCents: true,
          commissionAmountCents: true,
        },
      }),
      db.billingEvent.aggregate({
        where: {
          shop,
          status: "PENDING",
        },
        _sum: {
          amountCents: true,
        },
      }),
      db.affiliate.findMany({
        where: { shop },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          conversions: {
            select: {
              commissionAmountCents: true,
            },
          },
        },
      }),
    ]);

  return {
    currencyCode: recentConversions[0]?.currencyCode ?? "USD",
    metrics: {
      pendingCommissionCents: billingAggregate._sum.amountCents ?? 0,
      revenueTrackedCents: conversionAggregate._sum.subtotalAmountCents ?? 0,
      totalConversions: conversionAggregate._count._all,
    },
    recentConversions,
    settings,
    topAffiliates: topAffiliates.map((affiliate) => ({
      code: affiliate.code,
      displayName: affiliate.displayName,
      generatedCommissionCents: affiliate.conversions.reduce(
        (total, conversion) => total + conversion.commissionAmountCents,
        0,
      ),
    })),
  };
}
