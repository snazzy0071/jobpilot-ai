import Link from "next/link";
import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { NewsletterForm } from "@/components/newsletter/newsletter-form";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Newsletter",
  description: "Occasional emails on new features and career tips — no account needed, unsubscribe anytime.",
  path: "/newsletter",
});

export default function NewsletterPage() {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-24 sm:pt-32">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <Eyebrow>Newsletter</Eyebrow>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Career tips in your inbox
        </h1>
        <p className="text-lg text-muted-foreground">
          Occasional emails on new features and career tips — no account needed, unsubscribe
          anytime.
        </p>

        <div className="w-full max-w-sm">
          <NewsletterForm />
        </div>

        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/dashboard/settings" className="text-foreground underline">
            Opt in from your settings
          </Link>{" "}
          instead.
        </p>
      </div>
    </Section>
  );
}
