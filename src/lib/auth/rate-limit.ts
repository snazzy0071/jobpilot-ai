import "server-only";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";

const FIVE_MINUTES_SECONDS = 5 * 60;
const ONE_HOUR_SECONDS = 60 * 60;

const RATE_LIMIT_MESSAGE = "Too many attempts — wait a few minutes and try again.";

/**
 * Every auth entry point reachable *before* a session exists — nothing
 * here can key off a user id, only the request's IP, same "no account
 * to check anything else against" position Quick Scan's own rate
 * limiting is in (src/lib/quick-scan/rate-limit.ts). Each gets its own
 * scope so a burst on one form (e.g. sign-in guesses) never eats into
 * another's budget (e.g. a real user resending their confirmation
 * email), and its own limit sized to what it protects against:
 *
 * - Sign-in: generous enough for a real person mistyping their password
 *   a few times, tight enough to blunt credential-stuffing from one IP.
 * - Sign-up / password-reset-request / resend-confirmation: all three
 *   trigger an email send to an address the caller doesn't have to
 *   prove they own — the real risk is spamming an arbitrary inbox or
 *   enumerating accounts, not brute force, so a looser hourly cap is
 *   the right shape rather than a tight per-minute one.
 */
export async function consumeSignInRateLimit(): Promise<boolean> {
  return consumeIpRateLimit("auth_sign_in", { windowSeconds: FIVE_MINUTES_SECONDS, maxRequests: 10 });
}

export async function consumeSignUpRateLimit(): Promise<boolean> {
  return consumeIpRateLimit("auth_sign_up", { windowSeconds: ONE_HOUR_SECONDS, maxRequests: 5 });
}

export async function consumePasswordResetRateLimit(): Promise<boolean> {
  return consumeIpRateLimit("auth_password_reset", { windowSeconds: ONE_HOUR_SECONDS, maxRequests: 5 });
}

export async function consumeResendConfirmationRateLimit(): Promise<boolean> {
  return consumeIpRateLimit("auth_resend_confirmation", { windowSeconds: ONE_HOUR_SECONDS, maxRequests: 5 });
}

export const AUTH_RATE_LIMIT_MESSAGE = RATE_LIMIT_MESSAGE;
