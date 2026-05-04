export type QuoteProposalEmailContentParams = {
  organizationName: string;
  customerDisplayName: string;
  quoteDisplayNumber: number;
  portalAbsoluteUrl: string;
  replyToStaffEmail?: string | null;
};

export function buildQuoteProposalEmailContent(params: QuoteProposalEmailContentParams): {
  subject: string;
  html: string;
  text: string;
  replyTo: string | null;
} {
  const subject = `Your proposal from ${params.organizationName}`;
  const greetingName = params.customerDisplayName.trim() || "there";
  const text = [
    `Hi ${greetingName},`,
    "",
    "Your proposal is ready to review.",
    "",
    `Open your secure proposal link:`,
    params.portalAbsoluteUrl,
    "",
    `— ${params.organizationName}`,
    params.replyToStaffEmail?.trim()
      ? `If you have questions, reply to this message or contact us at ${params.replyToStaffEmail.trim()}.`
      : "If you have questions, reply to this message.",
    "",
  ].join("\n");

  const safeOrg = escapeHtml(params.organizationName);
  const safeName = escapeHtml(greetingName);
  const safeUrl = escapeHtml(params.portalAbsoluteUrl);
  const cta = `<a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">View proposal</a>`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#111827;max-width:560px;">
<p>Hi ${safeName},</p>
<p>Your proposal is ready to review.</p>
<p>${cta}</p>
<p style="font-size:14px;color:#4b5563;">Or copy this link:<br/><span style="word-break:break-all;">${safeUrl}</span></p>
<p style="font-size:14px;color:#4b5563;">— ${safeOrg}</p>
${
  params.replyToStaffEmail?.trim()
    ? `<p style="font-size:14px;color:#4b5563;">Questions? Reply to this email or write to ${escapeHtml(params.replyToStaffEmail.trim())}.</p>`
    : `<p style="font-size:14px;color:#4b5563;">Questions? Reply to this email.</p>`
}
</body></html>`;

  return {
    subject,
    html,
    text,
    replyTo: params.replyToStaffEmail?.trim() ? params.replyToStaffEmail.trim() : null,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
