import db from "../../db.server";

type CreateBillingEventInput = {
  amountCents: number;
  conversionId: string;
  currencyCode: string;
  shop: string;
};

export function createPendingCommissionBillingEvent(input: CreateBillingEventInput) {
  return db.billingEvent.create({
    data: {
      amountCents: input.amountCents,
      conversionId: input.conversionId,
      currencyCode: input.currencyCode,
      shop: input.shop,
    },
  });
}
