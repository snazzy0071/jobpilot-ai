import { CheckIcon, CircleIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  label: string;
  done: boolean;
};

/**
 * A trimmed version of reference/auth/dashboard.png's 5-step "Get set
 * up" checklist — only the steps this app can honestly report on from
 * real data (has a CV, has run an ATS scan, has completed an interview,
 * has a LinkedIn draft). The reference's remaining step ("Save your
 * first job") still needs a Job Tracker that doesn't exist yet (see
 * docs/SCREENSHOT_MAP.md) — showing it as a checkable step toward a
 * feature that doesn't work would be exactly the fake progress
 * CLAUDE.md rules out.
 */
export function GettingStartedChecklist({ items }: { items: ChecklistItem[] }) {
  const doneCount = items.filter((item) => item.done).length;
  const progress = items.length === 0 ? 0 : Math.round((doneCount / items.length) * 100);

  return (
    <Card className="overflow-hidden p-0">
      <Accordion defaultValue={["checklist"]}>
        <AccordionItem value="checklist" className="border-b-0">
          <AccordionTrigger className="rounded-none px-6 py-6 hover:no-underline focus-visible:rounded-none [&>svg]:mt-1">
            <div className="flex-1 text-left">
              <div className="flex items-baseline gap-2">
                <h2 className="font-heading text-lg font-semibold">Get set up</h2>
                <span className="text-sm text-primary">
                  {doneCount}/{items.length}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Quick steps to get the most out of {siteConfig.name}.</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <div className="divide-y divide-border border-t">
              {items.map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-6 py-3.5">
                  {item.done ? (
                    <CheckIcon className="size-4 shrink-0 text-success" />
                  ) : (
                    <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn("text-base", item.done && "text-muted-foreground line-through")}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}
