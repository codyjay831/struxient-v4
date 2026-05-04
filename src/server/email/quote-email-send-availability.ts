import { describePublicAppBaseUrlForQuoteEmail } from "@/server/email/public-app-url";
import { describeQuoteEmailInfrastructure } from "@/server/email/transactional";

/** Combined gate for the “Send quote to customer” button (no recipient checks). */
export function getQuoteEmailSendFormAvailability():
  | { canAttemptSend: true }
  | { canAttemptSend: false; reason: string } {
  const infra = describeQuoteEmailInfrastructure();
  if (!infra.ok) {
    return { canAttemptSend: false, reason: infra.message };
  }
  const url = describePublicAppBaseUrlForQuoteEmail();
  if (!url.ok) {
    return { canAttemptSend: false, reason: url.message };
  }
  return { canAttemptSend: true };
}
