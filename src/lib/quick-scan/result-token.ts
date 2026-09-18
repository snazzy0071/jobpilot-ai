import "server-only";
import { randomBytes, createHash } from "node:crypto";

/** 256 bits of entropy, URL-safe — long enough that guessing a valid token is infeasible, so possession of the token is itself the access control. */
export function generateResultToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this hash is ever persisted (migration 0036) — never the raw token — so a database read alone can't be turned into a usable link. */
export function hashResultToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
