import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph } from "@/lib/email/layout";

function buildDemoAcknowledgementEmailHtml(contactName: string, institutionName: string): string {
  return renderEmailLayout({
    previewText: "We received your demo request",
    bodyHtml: [
      emailHeading(`Thanks, ${contactName.trim().split(/\s+/)[0]}`),
      emailParagraph(
        `We've received your demo request for ${institutionName}. Someone from the ${siteConfig.name} team will be in touch shortly to set up a time.`,
      ),
    ].join(""),
  });
}

/** Best-effort — the form's own "we'll be in touch" response doesn't depend on this. */
export async function sendDemoAcknowledgementEmail(to: string, contactName: string, institutionName: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `We received your demo request — ${siteConfig.name}`,
      html: buildDemoAcknowledgementEmailHtml(contactName, institutionName),
      template: "demo_acknowledgement",
    });
  } catch (err) {
    console.error("sendDemoAcknowledgementEmail failed:", err);
  }
}
