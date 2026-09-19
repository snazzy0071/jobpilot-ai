import { BadgeCheckIcon, FileTextIcon, ScanSearchIcon } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { SkipLink } from "@/components/layout/skip-link";
import { SectionBackground } from "@/components/backgrounds/section-background";
import { FloatingCardStack } from "@/components/marketing/floating-card-stack";
import { GradientText } from "@/components/marketing/gradient-text";

// Below lg this is the same single centred column it always was; from lg
// up a brand panel sits beside the form. The panel is decorative
// reassurance only (no headings, so each auth page keeps its own single
// h1), and the form column keeps the exact `max-w-sm` container the
// pages were built for.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main id="main-content" className="grid min-h-screen flex-1 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative hidden overflow-hidden border-r bg-muted/30 lg:flex lg:flex-col lg:justify-between lg:p-12">
          <SectionBackground />
          <Logo className="relative w-fit" />
          <div className="relative flex flex-col gap-10">
            <div className="flex max-w-md flex-col gap-3">
              <p className="font-heading text-4xl font-semibold tracking-tight text-balance">
                Everything between your CV and <GradientText>the offer</GradientText>.
              </p>
              <p className="text-muted-foreground">
                A UK-standard CV, a real ATS check, sponsor data and interview practice in one workspace.
              </p>
            </div>
            <FloatingCardStack
              className="mx-0 max-w-sm"
              items={[
                { icon: FileTextIcon, title: "UK-standard CV builder", caption: "A4, two pages, no photo" },
                { icon: ScanSearchIcon, title: "ATS scanner", caption: "Scored against the real job", tone: "coral" },
                { icon: BadgeCheckIcon, title: "Visa sponsor register", caption: "Home Office data", tone: "success" },
              ]}
            />
          </div>
          <p className="relative text-xs text-muted-foreground">Free to start. No card required.</p>
        </div>

        <div className="flex flex-col items-center justify-center gap-8 px-4 py-16">
          <Logo className="lg:hidden" />
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </>
  );
}
