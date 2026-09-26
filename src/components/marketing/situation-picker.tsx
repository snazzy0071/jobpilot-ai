"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheckIcon, FileSearchIcon, MailXIcon, MessagesSquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Scenario = {
  id: string;
  icon: typeof MailXIcon;
  label: string;
  heading: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

const SCENARIOS: Scenario[] = [
  {
    id: "no-response",
    icon: MailXIcon,
    label: "I apply and hear nothing back",
    heading: "Start with the ATS Scanner",
    body: "Most silent rejections happen before a human ever reads your CV. Check it against the exact job description first — it's free to start.",
    primary: { label: "Try the ATS Scanner", href: "/features/ats" },
    secondary: { label: "Or rebuild your CV", href: "/features/cv" },
  },
  {
    id: "interviews-no-offer",
    icon: MessagesSquareIcon,
    label: "I get interviews but no offer",
    heading: "Practise with the Interview Coach",
    body: "If you're past the CV stage, the gap is usually in how you answer, not what's on paper. Practise real questions and get feedback before the next one.",
    primary: { label: "Try the Interview Coach", href: "/features/interview" },
  },
  {
    id: "visa-worry",
    icon: BadgeCheckIcon,
    label: "I'm worried about visa sponsorship",
    heading: "Check the sponsor register first",
    body: "Confirm an employer can actually sponsor a visa before you spend time on an application.",
    primary: { label: "Search Visa Sponsors", href: "/visa-sponsors" },
    secondary: { label: "Or check one company", href: "/sponsor-licence-check" },
  },
  {
    id: "unsure-cv",
    icon: FileSearchIcon,
    label: "I don't know if my CV is even right",
    heading: "Score it for free, no account needed",
    body: "See exactly what's missing before you apply anywhere.",
    primary: { label: "Score my CV free", href: "/free-ats-checker" },
    secondary: { label: "Or use the CV Builder", href: "/features/cv" },
  },
];

export function SituationPicker() {
  const [activeId, setActiveId] = useState(SCENARIOS[0].id);
  const active = SCENARIOS.find((scenario) => scenario.id === activeId) ?? SCENARIOS[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => setActiveId(scenario.id)}
            aria-pressed={scenario.id === activeId}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-4 text-left text-sm font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              scenario.id === activeId && "border-primary bg-primary/5 text-primary shadow-elevated",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors",
                scenario.id === activeId && "gradient-brand text-white",
              )}
            >
              <scenario.icon className="size-4" />
            </span>
            {scenario.label}
          </button>
        ))}
      </div>

      <Card key={active.id} variant="feature" className="animate-in fade-in slide-in-from-bottom-2 items-center gap-3 p-8 text-center duration-300" aria-live="polite">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Recommended for you
        </p>
        <h3 className="text-xl font-semibold">{active.heading}</h3>
        <p className="max-w-md text-muted-foreground">{active.body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button render={<Link href={active.primary.href}>{active.primary.label}</Link>} />
          {active.secondary && (
            <Button
              variant="outline"
              render={<Link href={active.secondary.href}>{active.secondary.label}</Link>}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
