import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { unsubscribeByToken } from "@/lib/newsletter/unsubscribe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

export default async function NewsletterUnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const success = await unsubscribeByToken(token);

  return (
    <Section className="pt-24 pb-24 sm:pt-32">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {success ? "You're unsubscribed" : "That link isn't valid"}
        </h1>
        <p className="text-muted-foreground">
          {success
            ? "You won't receive any more newsletter emails from us. You can resubscribe any time."
            : "This unsubscribe link has expired or doesn't match a subscription."}
        </p>
        <Link href="/" className="text-sm underline">
          Back to the homepage
        </Link>
      </div>
    </Section>
  );
}
