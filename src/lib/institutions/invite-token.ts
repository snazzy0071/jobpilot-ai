import "server-only";
import { randomBytes, createHash } from "node:crypto";

// Same scheme as src/lib/quick-scan/result-token.ts: only the hash is
// ever persisted (migration 0072's institution_invites.token_hash) —
// never the raw token — so a database read alone can't be turned into
// a usable invite link.

/** 256 bits of entropy, URL-safe — long enough that guessing a valid invite token is infeasible. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is ever stored — never the raw token. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
