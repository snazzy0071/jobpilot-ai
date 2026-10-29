import { Eyebrow } from "@/components/marketing/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-3",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">{title}</h2>
      {lead && (
        <p className={cn("text-lg text-pretty text-muted-foreground", align === "center" && "max-w-2xl")}>
          {lead}
        </p>
      )}
    </Reveal>
  );
}
