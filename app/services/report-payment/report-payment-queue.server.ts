import { Queue, type Processor, Worker } from "bullmq";
import Redis from "ioredis";

import {
  buildReportPaymentIdempotencyKey,
  type ReportPaymentPayload,
} from "../../schemas/conversion.schema";

export const REPORT_PAYMENT_QUEUE_NAME = "report-payment";

const IDEMPOTENCY_PREFIX = "report-payment:idempotency";
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BACKOFF_DELAY_MS = 2_000;

type ReportPaymentJobState =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

type ReportPaymentJobMetadata = {
  attemptsMade?: number;
  errorMessage?: string;
  queuedAt?: string;
  updatedAt?: string;
};

type SerializedReportPaymentState = {
  idempotencyKey: string;
  state: ReportPaymentJobState;
} & ReportPaymentJobMetadata;

declare global {
  // eslint-disable-next-line no-var
  var __reportPaymentQueue__: Queue<ReportPaymentPayload> | undefined;
  // eslint-disable-next-line no-var
  var __reportPaymentQueueRedis__: Redis | undefined;
}

function assertRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required for report-payment queue processing.");
  }

  return redisUrl;
}

function createRedisConnection() {
  return new Redis(assertRedisUrl(), {
    maxRetriesPerRequest: null,
  });
}

function getRedisConnection() {
  if (!global.__reportPaymentQueueRedis__) {
    global.__reportPaymentQueueRedis__ = createRedisConnection();
  }

  return global.__reportPaymentQueueRedis__;
}

function createQueue() {
  return new Queue<ReportPaymentPayload>(REPORT_PAYMENT_QUEUE_NAME, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: DEFAULT_ATTEMPTS,
      backoff: {
        delay: DEFAULT_BACKOFF_DELAY_MS,
        type: "exponential",
      },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

function getQueue() {
  if (!global.__reportPaymentQueue__) {
    global.__reportPaymentQueue__ = createQueue();
  }

  return global.__reportPaymentQueue__;
}

function buildRedisIdempotencyKey(idempotencyKey: string) {
  return `${IDEMPOTENCY_PREFIX}:${idempotencyKey}`;
}

function serializeState(
  idempotencyKey: string,
  state: ReportPaymentJobState,
  metadata: ReportPaymentJobMetadata = {},
) {
  return JSON.stringify({
    attemptsMade: metadata.attemptsMade,
    errorMessage: metadata.errorMessage,
    idempotencyKey,
    queuedAt: metadata.queuedAt,
    state,
    updatedAt: metadata.updatedAt ?? new Date().toISOString(),
  } satisfies SerializedReportPaymentState);
}

export async function hasQueuedReportPaymentJob(idempotencyKey: string) {
  const value = await getRedisConnection().get(buildRedisIdempotencyKey(idempotencyKey));
  return Boolean(value);
}

export async function markReportPaymentJobState(
  idempotencyKey: string,
  state: ReportPaymentJobState,
  metadata: ReportPaymentJobMetadata = {},
) {
  await getRedisConnection().set(
    buildRedisIdempotencyKey(idempotencyKey),
    serializeState(idempotencyKey, state, metadata),
  );
}

export async function enqueueReportPaymentJob(payload: ReportPaymentPayload) {
  const idempotencyKey = buildReportPaymentIdempotencyKey(payload);
  const queuedAt = new Date().toISOString();
  const redisKey = buildRedisIdempotencyKey(idempotencyKey);

  const reserved = await getRedisConnection().set(
    redisKey,
    serializeState(idempotencyKey, "queued", { queuedAt }),
    "NX",
  );

  if (reserved !== "OK") {
    return {
      duplicate: true as const,
      idempotencyKey,
      queuedAt: null,
    };
  }

  try {
    await getQueue().add(REPORT_PAYMENT_QUEUE_NAME, payload, {
      jobId: idempotencyKey,
    });

    return {
      duplicate: false as const,
      idempotencyKey,
      queuedAt,
    };
  } catch (error) {
    await getRedisConnection().del(redisKey);
    throw error;
  }
}

export function createReportPaymentWorker(processor: Processor<ReportPaymentPayload>) {
  return new Worker<ReportPaymentPayload>(REPORT_PAYMENT_QUEUE_NAME, processor, {
    connection: createRedisConnection(),
    concurrency: Number(process.env.REPORT_PAYMENT_WORKER_CONCURRENCY ?? 5),
  });
}
