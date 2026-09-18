import { Eyebrow } from "@/components/marketing/eyebrow";
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
      <Section className="pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Legal</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{document.title}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{document.intro}</p>
          <p className="text-sm text-muted-foreground">
            Last updated{" "}
            <time dateTime={document.lastUpdated}>{formatLegalDate(document.lastUpdated)}</time>
          </p>
        </div>
      </Section>

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
