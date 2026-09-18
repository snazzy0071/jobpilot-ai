import { Logo } from "@/components/layout/logo";
import { SkipLink } from "@/components/layout/skip-link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main id="main-content" className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
        <Logo />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </>
  );
}
