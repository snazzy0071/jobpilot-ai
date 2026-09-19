import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { endActiveImpersonation } from "@/lib/auth/impersonation";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";

// A dedicated route outside /dashboard on purpose, not a Server Action:
// Server Actions POST back to whatever page rendered them, which would
// be some /dashboard/** path depending on where the banner happens to
// be showing — proxy.ts's impersonation write-block would catch that
// same request before this ever ran. This fixed path is the one
// explicit exception carved out of that block.
export async function POST(request: NextRequest) {
  // getCurrentUser() (the REAL session, never the impersonation
  // target) — exiting doesn't need a fresh permission re-check the way
  // starting does (ending your own active session is always allowed,
  // and endActiveImpersonation() only ever touches the cookie's own
  // session row), just confirmation someone is actually signed in.
  const realUser = await getCurrentUser();
  if (!realUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const ended = await endActiveImpersonation("manual_exit");

  if (ended) {
    const admin = createAdminClient();
    const { data: targetAuthUser } = await admin.auth.admin.getUserById(ended.targetUserId);

    await logAdminAction({
      actorId: ended.adminUserId,
      actorEmail: realUser.email ?? null,
      action: "user.impersonate_end",
      entityType: "user",
      entityId: ended.targetUserId,
      metadata: {
        impersonationSessionId: ended.id,
        targetEmail: targetAuthUser.user?.email ?? null,
        startedAt: ended.startedAt,
        endedAt: ended.endedAt,
        reason: "manual_exit",
      },
    });
  }

  return NextResponse.redirect(new URL("/admin", request.url));
}
