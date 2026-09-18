import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph, emailButton } from "@/lib/email/layout";

function buildPaymentFailedEmailHtml(): string {
  return renderEmailLayout({
    previewText: "A recent payment didn't go through",
    bodyHtml: [
      emailHeading("We couldn't process your payment"),
      emailParagraph(
        "A recent payment on your subscription didn't go through. Update your payment details to keep your plan active — we'll retry automatically, but acting sooner avoids any interruption.",
      ),
      emailButton("Update payment details", `${siteConfig.domain}/dashboard/settings`),
    ].join(""),
  });
}

function buildSubscriptionCanceledEmailHtml(): string {
  return renderEmailLayout({
    previewText: "Your subscription has ended",
    bodyHtml: [
      emailHeading("Your subscription has ended"),
      emailParagraph(`Your paid subscription to ${siteConfig.name} is now inactive. You can resubscribe any time from your billing settings.`),
      emailButton("View billing settings", `${siteConfig.domain}/dashboard/settings`),
    ].join(""),
  });
}

/** Best-effort — never lets an email hiccup fail or retry an otherwise-successful webhook event. */
export async function sendPaymentFailedEmail(to: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `Action needed: payment failed — ${siteConfig.name}`,
      html: buildPaymentFailedEmailHtml(),
      template: "payment_failed",
    });
  } catch (err) {
    console.error("sendPaymentFailedEmail failed:", err);
  }
}

export async function sendSubscriptionCanceledEmail(to: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `Your subscription has ended — ${siteConfig.name}`,
      html: buildSubscriptionCanceledEmailHtml(),
      template: "subscription_canceled",
    });
  } catch (err) {
    console.error("sendSubscriptionCanceledEmail failed:", err);
  }
}
