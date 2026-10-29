import { BriefcaseIcon, FileTextIcon, GaugeIcon, GraduationCapIcon, KanbanSquareIcon, MailIcon, MessagesSquareIcon, ShieldCheckIcon, SparklesIcon, UserRoundPenIcon, type LucideIcon } from "lucide-react";

const ITEMS: { icon: LucideIcon; label: string; tone: string }[] = [
  { icon: FileTextIcon, label: "UK CV Builder", tone: "text-primary bg-primary/10" },
  { icon: GaugeIcon, label: "ATS Scanner", tone: "text-brand-secondary bg-brand-cyan/15" },
  { icon: MailIcon, label: "Cover Letters", tone: "text-brand-accent bg-brand-coral/15" },
  { icon: MessagesSquareIcon, label: "AI Interview Coach", tone: "text-primary bg-primary/10" },
  { icon: ShieldCheckIcon, label: "Visa Sponsor Search", tone: "text-success bg-success/10" },
  { icon: BriefcaseIcon, label: "Job Match", tone: "text-brand-secondary bg-brand-cyan/15" },
  { icon: KanbanSquareIcon, label: "Application Tracker", tone: "text-brand-accent bg-brand-sun/20" },
  { icon: UserRoundPenIcon, label: "LinkedIn Optimiser", tone: "text-primary bg-primary/10" },
  { icon: GraduationCapIcon, label: "Graduate Test Prep", tone: "text-brand-accent bg-brand-coral/15" },
  { icon: SparklesIcon, label: "Assisted Auto-Apply", tone: "text-brand-secondary bg-brand-cyan/15" },
];

/** An endless, slowly scrolling row of the real tools in the product. Pauses on hover. */
export function ToolMarquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2.5 rounded-full border border-border/80 bg-white px-4 py-2 text-sm font-medium whitespace-nowrap shadow-card"
        >
          <span className={`flex size-7 items-center justify-center rounded-full ${item.tone}`}>
            <item.icon className="size-3.5" />
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="marquee-fade group/marquee relative overflow-hidden py-2">
      <div className="animate-marquee flex w-max group-hover/marquee:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
