import { Check, TrendingUp, type LucideIcon } from "lucide-react";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";

function BulletList({ items, icon: Icon }: { items: string[]; icon: LucideIcon }) {
  return (
    <StaggerContainer as="ul" className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2" staggerDelay={0.07}>
      {items.map((item) => (
        <StaggerItem
          as="li"
          key={item}
          className="group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Icon className="size-4" />
          </span>
          <span className="pt-1 text-sm leading-relaxed">{item}</span>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

/** What the tool actually does. */
export function Capabilities({ items }: { items: string[] }) {
  return <BulletList items={items} icon={Check} />;
}

/** What you get out of using it, framed as results, not features. */
export function Outcomes({ items }: { items: string[] }) {
  return <BulletList items={items} icon={TrendingUp} />;
}
