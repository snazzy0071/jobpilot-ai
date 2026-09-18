import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export type FaqItem = {
  question: string;
  answer: string;
};

// Wired in here rather than per-page (like Breadcrumbs/OrganizationSchema
// elsewhere) so every one of the ~18 pages rendering a `Faq` gets
// FAQPage rich-result eligibility for free, with no risk of a page's
// visible questions ever drifting from what the schema claims — they're
// always the same `items` array. Same dangerouslySetInnerHTML + "<"
// escaping pattern as breadcrumbs.tsx/organization-schema.tsx.
export function Faq({ items }: { items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Accordion className="mx-auto max-w-2xl">
        {items.map((item, index) => (
          <AccordionItem key={item.question} value={String(index)}>
            <AccordionTrigger>{item.question}</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">{item.answer}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </>
  );
}
