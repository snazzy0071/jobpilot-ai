import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Container } from "@/components/marketing/container";
import { SiteNav } from "@/components/layout/site-nav";

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <SiteNav />
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" render={<Link href="/login">Sign in</Link>} />
          <Button render={<Link href="/signup">Get started</Link>} />
        </div>
      </Container>
    </header>
  );
}
