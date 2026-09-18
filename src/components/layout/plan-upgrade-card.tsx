import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PlanUpgradeCard() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3">
      <p className="text-sm font-medium">Free plan</p>
      <p className="text-xs text-muted-foreground">
        Upgrade for full access to every tool once plans are live.
      </p>
      <Button size="sm" render={<Link href="/pricing">Upgrade</Link>} />
    </div>
  );
}
