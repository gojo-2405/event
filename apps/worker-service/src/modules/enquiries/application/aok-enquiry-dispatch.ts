import { createAokClient } from "@eventrax/config";

const retryBackoffSeconds = [0, 5, 30, 300] as const;

export function resolveEnquiryRetryState(input: {
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

export async function dispatchEnquiryToAok(job: {
  dispatchKey: string;
  targetMode: string;
  targetContactRef: number | null;
  payload: any;
}) {
  const client = createAokClient();

  if (job.targetMode === "existing_contact" && job.targetContactRef) {
    return client.createContactEnquiry({
      contactId: job.targetContactRef,
      idempotencyKey: job.dispatchKey,
      enquirySource: job.payload?.enquirySource ?? "Eventrax",
      details: job.payload?.details ?? ""
    });
  }

  const publicContact = job.payload?.publicContact ?? {};
  return client.createPublicEnquiry({
    idempotencyKey: job.dispatchKey,
    enquirySource: job.payload?.enquirySource ?? "Eventrax",
    name: typeof publicContact.name === "string" ? publicContact.name : "Unknown",
    surname: typeof publicContact.surname === "string" ? publicContact.surname : "Unknown",
    telephone: typeof publicContact.telephone === "string" ? publicContact.telephone : undefined,
    mobile: typeof publicContact.mobile === "string" ? publicContact.mobile : undefined,
    email: typeof publicContact.email === "string" ? publicContact.email : undefined,
    position: typeof publicContact.position === "string" ? publicContact.position : undefined,
    additionalInformation:
      typeof publicContact.additionalInformation === "string"
        ? publicContact.additionalInformation
        : undefined,
    details: job.payload?.details ?? ""
  });
}
