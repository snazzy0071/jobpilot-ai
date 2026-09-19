import type { ContentBlock } from "@/lib/content/blocks";

export function TableOfContents({ content }: { content: ContentBlock[] }) {
  const headings = content.filter(
    (block): block is Extract<ContentBlock, { type: "heading" }> => block.type === "heading",
  );

  if (headings.length === 0) return null;

  return (
    <nav aria-label="Table of contents" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-card">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        On this page
      </p>
      <ul className="flex flex-col gap-2 border-l border-primary/20">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? "pl-6" : "pl-3"}>
            <a
              href={`#${heading.id}`}
              className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
