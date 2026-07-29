// Same backoff ladder as apps/worker-service/src/modules/enquiries/application/aok-enquiry-dispatch.ts
// and apps/worker-service/src/modules/notifications/application/notification-email-dispatch.ts —
// duplicated per this repo's existing convention of one retry-state helper per domain rather
// than a shared cross-domain one.
const retryBackoffSeconds = [0, 5, 30, 300] as const;

export function resolveInboundEventRetryState(input: {
  attemptCount: number;
  maxAttempts: number;
  now?: Date;
}): {
  status: "retrying" | "dead_letter";
  nextAttemptAt: Date | null;
} {
  const now = input.now ?? new Date();
  const nextAttemptNumber = input.attemptCount + 1;

  if (nextAttemptNumber >= input.maxAttempts) {
    return {
      status: "dead_letter",
      nextAttemptAt: null
    };
  }

  const backoffSeconds =
    retryBackoffSeconds[Math.min(nextAttemptNumber, retryBackoffSeconds.length - 1)] ?? 300;

  return {
    status: "retrying",
    nextAttemptAt: new Date(now.getTime() + backoffSeconds * 1000)
  };
}
