import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
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
    <PageHero
      badge={
        <span
          className={
            success
              ? "flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success shadow-card"
              : "flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-card"
          }
        >
          {success ? <CheckCircle2Icon className="size-7" /> : <LinkIcon className="size-7" />}
        </span>
      }
      title={success ? "You're unsubscribed" : "That link isn't valid"}
      description={
        success
          ? "You won't receive any more newsletter emails from us. You can resubscribe any time."
          : "This unsubscribe link has expired or doesn't match a subscription."
      }
      actions={
        <>
          <Button variant="outline" size="lg" render={<Link href="/">Back to the homepage</Link>} />
          {success && <Button size="lg" variant="gradient" render={<Link href="/newsletter">Resubscribe</Link>} />}
        </>
      }
      className="pb-24 [&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:lg:text-5xl"
    />
  );
}
