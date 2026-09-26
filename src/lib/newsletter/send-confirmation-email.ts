import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph, emailButton, emailSmallPrint } from "@/lib/email/layout";
import { CONFIRMATION_TTL_HOURS } from "@/lib/newsletter/confirmation-rules";

export function newsletterConfirmationLink(token: string): string {
  return `${siteConfig.domain}/newsletter/confirm/${token}`;
}

/** Throws when the email cannot be sent, so the form can say so instead of claiming a subscription that cannot be confirmed. */
export async function sendNewsletterConfirmationEmail(to: string, token: string): Promise<void> {
  const link = newsletterConfirmationLink(token);
  await sendEmail({
    to,
    subject: `Confirm your ${siteConfig.name} subscription`,
    html: renderEmailLayout({
      previewText: "One click to confirm your subscription",
      bodyHtml: [
        emailHeading("Confirm your subscription"),
        emailParagraph(`Someone, hopefully you, asked to receive occasional career tips and feature updates from ${siteConfig.name} at this address. Confirm it to start.`),
        emailButton("Confirm my subscription", link),
        emailSmallPrint(`The link works for ${CONFIRMATION_TTL_HOURS / 24} days. If it wasn't you, ignore this email and nothing will be sent.`),
      ].join(""),
    }),
    template: "newsletter_confirmation",
  });
}
