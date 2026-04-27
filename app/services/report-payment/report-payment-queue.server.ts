type ReportPaymentJob = {
  idempotencyKey: string;
  payload: {
    affiliateCode: string;
    orderId: string;
    shopDomain: string;
  };
  queuedAt: string;
};

type QueueState = {
  jobs: ReportPaymentJob[];
  reservations: Set<string>;
};

declare global {
  // eslint-disable-next-line no-var
  var __reportPaymentQueueState__: QueueState | undefined;
}

function getQueueState() {
  if (!global.__reportPaymentQueueState__) {
    global.__reportPaymentQueueState__ = {
      jobs: [],
      reservations: new Set<string>(),
    };
  }

  return global.__reportPaymentQueueState__;
}

export function reserveReportPaymentJob(idempotencyKey: string) {
  const state = getQueueState();

  if (state.reservations.has(idempotencyKey)) {
    return false;
  }

  state.reservations.add(idempotencyKey);
  return true;
}

export function releaseReportPaymentJob(idempotencyKey: string) {
  getQueueState().reservations.delete(idempotencyKey);
}

export function enqueueReportPaymentJob(job: ReportPaymentJob) {
  const state = getQueueState();
  state.jobs.push(job);

  return job;
}
