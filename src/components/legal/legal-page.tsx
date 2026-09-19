import { ClockIcon, ScaleIcon } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Section } from "@/components/marketing/section";
import { ArticleBody } from "@/components/content/article-body";
import { TableOfContents } from "@/components/content/table-of-contents";
import type { LegalDocument } from "@/config/legal";

function formatLegalDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Every legal page is this same shell around a `LegalDocument` from
// src/config/legal.ts — edit the prose there, not here.
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <>
      <PageHero
        badge={
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-card">
            <ScaleIcon className="size-6" />
          </span>
        }
        eyebrow="Legal"
        title={document.title}
        description={
          <div className="flex flex-col items-center gap-4">
            <p>{document.intro}</p>
            <p className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-sm">
              <ClockIcon className="size-3.5 text-primary" aria-hidden="true" />
              Last updated <time dateTime={document.lastUpdated}>{formatLegalDate(document.lastUpdated)}</time>
            </p>
          </div>
        }
        className="sm:pb-16"
      />

      <Section className="pt-0 pb-24">
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[14rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <TableOfContents content={document.content} />
          </aside>
          <article>
            <ArticleBody content={document.content} />
          </article>
        </div>
      </Section>
    </>
  );
}
