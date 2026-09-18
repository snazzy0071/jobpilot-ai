import type { ContentBlock } from "@/lib/content/blocks";

export function ArticleBody({ content }: { content: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-5 text-base leading-relaxed text-foreground/90">
      {content.map((block, index) => {
        switch (block.type) {
          case "heading": {
            const HeadingTag = block.level === 2 ? "h2" : "h3";
            return (
              <HeadingTag
                key={block.id}
                id={block.id}
                className={
                  block.level === 2
                    ? "mt-4 scroll-mt-24 text-2xl font-semibold tracking-tight"
                    : "mt-2 scroll-mt-24 text-xl font-semibold tracking-tight"
                }
              >
                {block.text}
              </HeadingTag>
            );
          }
          case "list":
            return (
              <ul key={index} className="list-disc space-y-2 pl-5">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={index} className="border-l-2 border-primary pl-4 text-muted-foreground italic">
                {block.text}
              </blockquote>
            );
          case "paragraph":
          default:
            return <p key={index}>{block.text}</p>;
        }
      })}
    </div>
  );
}
