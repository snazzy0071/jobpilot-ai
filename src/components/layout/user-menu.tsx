import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  fullName,
  settingsHref,
}: {
  email: string | null;
  fullName?: string | null;
  settingsHref?: string;
}) {
  const initial = (fullName?.[0] ?? email?.[0])?.toUpperCase() ?? "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Account menu"
      >
        <Avatar>
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5">
          {fullName && <p className="text-sm font-medium">{fullName}</p>}
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        {settingsHref && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link href={settingsHref} className="flex w-full items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              }
            />
          </>
        )}
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            render={
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            }
          />
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
