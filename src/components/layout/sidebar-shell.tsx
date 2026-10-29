import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

export function SidebarShell({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <nav
      aria-label="Main"
      className={cn(
        "flex h-full w-64 flex-col gap-5 border-r border-sidebar-border bg-linear-to-b from-[#f5f7ff] via-[#f3f8ff] to-[#fff6f1] p-4 text-sidebar-foreground",
        className,
      )}
    >
      <Logo />
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">{children}</div>
      {footer && <div className="flex flex-col gap-3 border-t pt-3">{footer}</div>}
    </nav>
  );
}
