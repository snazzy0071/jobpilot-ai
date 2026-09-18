import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph } from "@/lib/email/layout";

function buildAccountDeletedEmailHtml(): string {
  return renderEmailLayout({
    previewText: "Your account has been deleted",
    bodyHtml: [
      emailHeading("Your account has been deleted"),
      emailParagraph(
        `Your ${siteConfig.name} account and all associated data have been permanently deleted. If you didn't request this, contact us immediately at ${siteConfig.supportEmail}.`,
      ),
    ].join(""),
  });
}

/**
 * Best-effort, sent after `auth.admin.deleteUser` has already succeeded
 * (self-service or admin-triggered) — a failure here must never make an
 * already-completed deletion look like it failed.
 */
export async function sendAccountDeletedEmail(to: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `Your account has been deleted — ${siteConfig.name}`,
      html: buildAccountDeletedEmailHtml(),
      template: "account_deleted",
    });
  } catch (err) {
    console.error("sendAccountDeletedEmail failed:", err);
  }
}
