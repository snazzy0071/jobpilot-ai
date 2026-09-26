import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** Any address that matches no page (and any notFound() raised outside the app areas): branded, with real ways back. */
export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <p className="text-sm font-semibold tracking-widest text-primary uppercase">404</p>
      <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-muted-foreground">The link may be wrong or the page may have moved. Here are some places to start.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/">Go to the homepage</Link>} />
        <Button variant="outline" render={<Link href="/dashboard">Your dashboard</Link>} />
        <Button variant="outline" render={<Link href="/free-ats-checker">Free ATS checker</Link>} />
      </div>
    </main>
  );
}
