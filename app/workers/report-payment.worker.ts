import {
  createReportPaymentWorker,
  markReportPaymentJobState,
} from "../services/report-payment/report-payment-queue.server";
import { reportConversionResult } from "../services/report-payment/conversion-report.service.server";
import { processPaymentAffiliate } from "../services/report-payment/payment-affiliate.service.server";
import {
  buildReportPaymentIdempotencyKey,
  reportPaymentPayloadSchema,
} from "../schemas/conversion.schema";

const worker = createReportPaymentWorker(async (job) => {
  const payload = reportPaymentPayloadSchema.parse(job.data);
  const idempotencyKey = buildReportPaymentIdempotencyKey(payload);

  await markReportPaymentJobState(idempotencyKey, "processing", {
    attemptsMade: job.attemptsMade,
  });

  try {
    const paymentResult = await processPaymentAffiliate(payload);
    const conversionResult = await reportConversionResult(payload, paymentResult);

    await markReportPaymentJobState(idempotencyKey, "completed", {
      attemptsMade: job.attemptsMade,
    });

    console.log("[report-payment-worker] job completed", {
      duplicate: conversionResult.duplicate,
      idempotencyKey,
      jobId: job.id,
      orderId: payload.orderId,
      shopDomain: payload.shopDomain,
    });
  } catch (error) {
    await markReportPaymentJobState(idempotencyKey, "failed", {
      attemptsMade: job.attemptsMade + 1,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    console.error("[report-payment-worker] job failed", {
      error: error instanceof Error ? error.message : error,
      idempotencyKey,
      jobId: job.id,
      orderId: payload.orderId,
      shopDomain: payload.shopDomain,
    });

    throw error;
  }
});

worker.on("ready", () => {
  console.log("[report-payment-worker] ready");
});

worker.on("error", (error) => {
  console.error("[report-payment-worker] worker error", error);
});
