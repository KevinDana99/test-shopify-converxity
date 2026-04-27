import {
  createReportPaymentWorker,
  markReportPaymentJobState,
} from "../services/report-payment/report-payment-queue.server";
import { reportConversionResult } from "../services/report-payment/conversion-report.service.server";
import { processPaymentAffiliate } from "../services/report-payment/payment-affiliate.service.server";
import { buildReportPaymentIdempotencyKey } from "../schemas/conversion.schema";

const worker = createReportPaymentWorker(async (job) => {
  const idempotencyKey = buildReportPaymentIdempotencyKey(job.data);

  await markReportPaymentJobState(idempotencyKey, "processing", {
    attemptsMade: job.attemptsMade,
  });

  try {
    const paymentResult = await processPaymentAffiliate(job.data);
    const conversionResult = await reportConversionResult(job.data, paymentResult);

    await markReportPaymentJobState(idempotencyKey, "completed", {
      attemptsMade: job.attemptsMade,
    });

    console.log("[report-payment-worker] job completed", {
      duplicate: conversionResult.duplicate,
      idempotencyKey,
      jobId: job.id,
      orderId: job.data.orderId,
      shopDomain: job.data.shopDomain,
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
      orderId: job.data.orderId,
      shopDomain: job.data.shopDomain,
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
