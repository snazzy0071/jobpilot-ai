import { BadgeCheckIcon, FileTextIcon, ScanSearchIcon, SparklesIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SkipLink } from "@/components/layout/skip-link";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { HeroStage } from "@/components/marketing/home/hero-stage";
import { Reveal } from "@/components/motion/reveal";
import { tileGradient } from "@/components/marketing/tile-colors";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  { icon: FileTextIcon, label: "UK-standard CVs" },
  { icon: ScanSearchIcon, label: "Real ATS scores" },
  { icon: BadgeCheckIcon, label: "Sponsor data" },
];

// Shared by login, signup, forgot/reset password and the check-email screens. A full-screen moving background sits
// behind everything; from lg up a showcase column (headline + animated product preview) sits beside the form. The
// showcase has no headings, so each auth page keeps its own single h1. Every page's <Card> is restyled from here
// into a frosted glass panel with a spinning gradient border, so the pages themselves stay untouched.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main id="main-content" className="relative isolate grid min-h-screen flex-1 lg:grid-cols-[1.1fr_1fr]">
        <AuthBackdrop />

        <div className="relative hidden flex-col justify-between gap-10 p-12 lg:flex xl:px-16">
          <Logo className="w-fit" />
          <div className="flex flex-col gap-16">
            <Reveal className="flex max-w-lg flex-col gap-4">
              <span className="glass inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-primary shadow-card">
                <SparklesIcon className="size-3.5" aria-hidden="true" />
                Your UK job search, sorted
              </span>
              <p className="font-heading text-5xl leading-[1.05] font-bold tracking-tight text-balance xl:text-[3.4rem]">
                Everything between your CV and <span className="text-gradient">the offer.</span>
              </p>
              <p className="text-lg text-muted-foreground">
                A UK-standard CV, a real ATS check, sponsor data and interview practice in one workspace.
              </p>
            </Reveal>
            <Reveal delay={0.2} className="origin-top-left scale-[0.82] pl-28 xl:pl-36">
              <HeroStage />
            </Reveal>
          </div>
          <ul className="flex flex-wrap gap-3">
            {HIGHLIGHTS.map((item, index) => (
              <Reveal as="li" key={item.label} delay={0.4 + index * 0.1}>
                <span className="glass inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-sm font-medium shadow-card">
                  <span className={cn("flex size-7 items-center justify-center rounded-full text-white", tileGradient(index))}>
                    <item.icon className="size-3.5" aria-hidden="true" />
                  </span>
                  {item.label}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>

        <div className="relative flex flex-col items-center justify-center gap-8 px-4 py-12 sm:py-16">
          <Logo className="lg:hidden" />
          <Reveal delay={0.1} distance={24} className="w-full max-w-md">
            <div
              className={cn(
                "border-animated rounded-[1.75rem] shadow-[0_40px_80px_-24px_rgba(51,80,255,0.35)]",
                // Restyle each page's Card into a roomy glass panel without touching the pages.
                "[&>[data-slot=card]]:rounded-[1.65rem] [&>[data-slot=card]]:border-0 [&>[data-slot=card]]:bg-white/85 [&>[data-slot=card]]:px-3 [&>[data-slot=card]]:py-8 [&>[data-slot=card]]:shadow-none [&>[data-slot=card]]:backdrop-blur-xl sm:[&>[data-slot=card]]:px-5",
                "[&_[data-slot=card-title]]:font-heading [&_[data-slot=card-title]]:text-2xl [&_[data-slot=card-title]]:font-bold [&_[data-slot=card-title]]:tracking-tight",
                "[&_input]:h-11 [&_input]:rounded-xl [&_input]:bg-white [&_input]:transition-shadow [&_input:focus-visible]:shadow-[0_0_0_4px_rgba(51,80,255,0.12)]",
                "[&_button[type=submit]]:h-11 [&_button[type=submit]]:rounded-xl [&_button[type=submit]]:text-[0.95rem] [&_button[type=submit]]:font-semibold [&_button[type=submit]]:bg-[image:var(--gradient-brand)] [&_button[type=submit]]:shadow-glow",
              )}
            >
              {children}
            </div>
          </Reveal>
          <p className="text-xs text-muted-foreground">Free to start. No card required.</p>
        </div>
      </main>
    </>
  );
}
