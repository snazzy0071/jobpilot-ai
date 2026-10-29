import { CheckCircle2Icon, MailIcon, ShieldCheckIcon, FileTextIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Counter } from "@/components/motion/counter";
import { cn } from "@/lib/utils";

/**
 * Four real, checkable claims, not marketing filler. The sponsor count is the one live figure (passed in from a real
 * `getTotalSponsorCount()` read on the homepage), so it can never drift out of sync with the register.
 */
export function HeroStatChips({ sponsorCount }: { sponsorCount: number }) {
  const items = [
    { icon: CheckCircle2Icon, title: "Free to check", caption: "No signup, no card", tone: "bg-primary/10 text-primary" },
    { icon: MailIcon, title: "2 scans a month", caption: "Free ATS report by email", tone: "bg-brand-cyan/15 text-brand-secondary" },
    {
      icon: ShieldCheckIcon,
      title: sponsorCount > 0 ? <Counter value={sponsorCount} suffix="+" /> : "UK sponsors",
      caption: "Licensed, synced from gov.uk",
      tone: "bg-success/10 text-success",
    },
    { icon: FileTextIcon, title: "UK-format CVs", caption: "A4, two pages, no photo", tone: "bg-brand-coral/15 text-brand-accent" },
  ];

  return (
    <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item, index) => (
        <Reveal
          key={item.caption}
          delay={0.4 + Math.min(index * 0.08, 0.3)}
          className="glass flex flex-col gap-1.5 rounded-2xl p-3.5 text-left shadow-card transition-transform duration-300 hover:-translate-y-1"
        >
          <span className={cn("flex size-8 items-center justify-center rounded-lg", item.tone)}>
            <item.icon className="size-4" />
          </span>
          <p className="mt-1 text-sm font-semibold">{item.title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{item.caption}</p>
        </Reveal>
      ))}
    </div>
  );
}
