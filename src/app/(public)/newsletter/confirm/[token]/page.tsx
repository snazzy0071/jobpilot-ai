import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { confirmSubscriptionByToken } from "@/lib/newsletter/confirmation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false, follow: false },
};

const COPY = {
  confirmed: { ok: true, title: "You're subscribed", description: "Thanks for confirming. You'll get occasional career tips and feature updates, and every email has an unsubscribe link." },
  already_confirmed: { ok: true, title: "You're already subscribed", description: "This address is confirmed, so there's nothing more to do." },
  expired: { ok: false, title: "That link has expired", description: "Confirmation links only work for a few days. Subscribe again and we'll send a fresh one." },
  invalid: { ok: false, title: "That link isn't valid", description: "This confirmation link doesn't match a subscription. It may have been mistyped, or the address has since unsubscribed." },
} as const;

export default async function NewsletterConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const outcome = await confirmSubscriptionByToken(token);
  const copy = COPY[outcome];

  return (
    <PageHero
      badge={
        <span
          className={
            copy.ok
              ? "flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success shadow-card"
              : "flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-card"
          }
        >
          {copy.ok ? <CheckCircle2Icon className="size-7" /> : <LinkIcon className="size-7" />}
        </span>
      }
      title={copy.title}
      description={copy.description}
      actions={
        <>
          <Button variant="outline" size="lg" render={<Link href="/">Back to the homepage</Link>} />
          {!copy.ok && <Button size="lg" variant="gradient" render={<Link href="/newsletter">Subscribe again</Link>} />}
        </>
      }
      className="pb-24 [&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:lg:text-5xl"
    />
  );
}
