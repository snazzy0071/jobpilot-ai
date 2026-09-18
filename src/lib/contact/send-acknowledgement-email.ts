import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph } from "@/lib/email/layout";

function buildContactAcknowledgementEmailHtml(name: string): string {
  return renderEmailLayout({
    previewText: "We received your message",
    bodyHtml: [
      emailHeading(`Thanks, ${name.trim().split(/\s+/)[0]}`),
      emailParagraph(`We've received your message and someone from the ${siteConfig.name} team will get back to you soon.`),
    ].join(""),
  });
}

/** Best-effort — the form's own "Message sent" response doesn't depend on this. */
export async function sendContactAcknowledgementEmail(to: string, name: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `We received your message — ${siteConfig.name}`,
      html: buildContactAcknowledgementEmailHtml(name),
      template: "contact_acknowledgement",
    });
  } catch (err) {
    console.error("sendContactAcknowledgementEmail failed:", err);
  }
}
