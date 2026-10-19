import "server-only";
import { requireEnvironment } from "../env";
import { AuthError } from "../auth/service";
import { getWorkerDatabase } from "../auth/runtime";
import type { SecurityOtpDelivery } from "../accounts/http";
import { SecurityOutboxWorker } from "./security-outbox";
import { createMailAdapter } from "./adapter";

export function createSecurityOtpDelivery(deps: {
  ready(): void;
  worker(): SecurityOutboxWorker;
}): SecurityOtpDelivery {
  return {
    ready: deps.ready,
    async deliver(challengeId) {
      const result = await deps.worker().deliverOne(challengeId);
      if (result.processed === 0 || result.result === "lease_lost")
        return "pending";
      if (result.result === "sent") return "accepted";
      if (result.result === "failed") return "failed";
      if (result.result === "unknown") return "unknown";
      return "pending";
    },
  };
}
export const securityOtpDelivery = createSecurityOtpDelivery({
  ready() {
    try {
      requireEnvironment("mail");
      requireEnvironment("worker");
      requireEnvironment("database");
    } catch {
      throw new AuthError("EMAIL_DELIVERY_UNAVAILABLE", 503);
    }
  },
  worker() {
    const mail = requireEnvironment("mail");
    return new SecurityOutboxWorker(
      getWorkerDatabase(),
      createMailAdapter(mail),
      requireEnvironment("auth").AUTH_OUTBOX_ENCRYPTION_KEY,
      requireEnvironment("core").APP_URL,
    );
  },
});
