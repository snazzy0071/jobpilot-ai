import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/marketing/container";
import { SiteNav } from "@/components/layout/site-nav";
import { HeaderShell } from "@/components/layout/header-shell";

export function SiteHeader() {
  return (
    <HeaderShell>
      <Container className="flex h-[68px] items-center justify-between gap-4">
        <Logo />
        <SiteNav />
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" className="rounded-full px-4" render={<Link href="/login">Sign in</Link>} />
          <Button
            variant="gradient"
            className="btn-shine group/cta rounded-full px-5"
            render={
              <Link href="/signup">
                Get started free
                <ArrowRightIcon className="transition-transform duration-300 group-hover/cta:translate-x-0.5" />
              </Link>
            }
          />
        </div>
      </Container>
    </HeaderShell>
  );
}
