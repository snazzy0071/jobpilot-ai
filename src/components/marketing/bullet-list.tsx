import { Check, TrendingUp, type LucideIcon } from "lucide-react";

function BulletList({ items, icon: Icon }: { items: string[]; icon: LucideIcon }) {
  return (
    <ul className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Icon className="mt-1 size-4 shrink-0 text-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** What the tool actually does. */
export function Capabilities({ items }: { items: string[] }) {
  return <BulletList items={items} icon={Check} />;
}

/** What you get out of using it — framed as results, not features. */
export function Outcomes({ items }: { items: string[] }) {
  return <BulletList items={items} icon={TrendingUp} />;
}
