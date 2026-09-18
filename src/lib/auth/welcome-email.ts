import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph, emailButton } from "@/lib/email/layout";
import { createAdminClient } from "@/lib/supabase/admin";

function buildWelcomeEmailHtml(fullName: string | null): string {
  const firstName = fullName?.trim().split(/\s+/)[0];
  return renderEmailLayout({
    previewText: `Welcome to ${siteConfig.name}`,
    bodyHtml: [
      emailHeading(firstName ? `Welcome, ${firstName}!` : `Welcome to ${siteConfig.name}!`),
      emailParagraph(
        `Your account is ready. Build a tailored CV, run it through the ATS scanner, and practice interviews with ${siteConfig.aiCoachName}, your AI coach.`,
      ),
      emailButton("Go to your dashboard", `${siteConfig.domain}/dashboard`),
    ].join(""),
  });
}

/**
 * Fired from two different auth routes (password-signup confirmation and
 * OAuth callback), so dedup has to key off a persisted flag rather than
 * "first time we see this route fire" — the conditional update below
 * only succeeds, and only then sends, the first time it runs for a given
 * user, so a retried callback or a reused confirmation link is a safe
 * no-op. Best-effort: never lets an email hiccup surface as an auth
 * failure to someone who just signed in successfully.
 */
export async function sendWelcomeEmailOnce(userId: string, email: string, fullName: string | null): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId)
      .is("welcome_email_sent_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) return;

    await sendEmail({
      to: email,
      subject: `Welcome to ${siteConfig.name}`,
      html: buildWelcomeEmailHtml(fullName),
      template: "welcome",
    });
  } catch (err) {
    console.error("sendWelcomeEmailOnce failed:", err);
  }
}
