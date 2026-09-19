import { CheckCircle2Icon, MailIcon, ShieldCheckIcon, FileTextIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Counter } from "@/components/motion/counter";

/**
 * Four real, checkable claims, not marketing filler — no invented
 * "average score" or timing stat here, since this app has no data to
 * back one. The sponsor count is the one live figure (passed in from
 * a real `getTotalSponsorCount()` read on the homepage itself), so it
 * can never drift out of sync with the actual register.
 */
export function HeroStatChips({ sponsorCount }: { sponsorCount: number }) {
  const items = [
    { icon: CheckCircle2Icon, title: "Free to check", caption: "No signup, no card" },
    { icon: MailIcon, title: "2 scans a month", caption: "Free ATS report by email" },
    {
      icon: ShieldCheckIcon,
      title: sponsorCount > 0 ? <Counter value={sponsorCount} suffix="+" /> : "UK sponsors",
      caption: "Licensed, synced from gov.uk",
    },
    { icon: FileTextIcon, title: "UK-format CVs", caption: "A4, two pages, no photo" },
  ];

  return (
    <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item, index) => (
        <Reveal
          key={item.caption}
          delay={Math.min(index * 0.08, 0.3)}
          className="flex flex-col gap-1 rounded-xl border bg-card/60 p-3 text-left backdrop-blur-sm"
        >
          <item.icon className="size-4 text-primary" />
          <p className="text-sm font-semibold">{item.title}</p>
          <p className="text-[11px] text-muted-foreground">{item.caption}</p>
        </Reveal>
      ))}
    </div>
  );
}
