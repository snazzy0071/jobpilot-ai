// A plain constant, not exported alongside purchaseVoiceTopup in
// topup-actions.ts — a "use server" file may only export async functions
// (Next.js turns every other export into a client-side reference stub,
// which breaks for a plain number), so this lives in its own file that
// both the Server Action and the client components displaying the same
// number can import without that restriction.

/**
 * How many extra voice interviews one top-up purchase grants, for the
 * current calendar month only — matching migration 0016's own
 * "additional voice sessions beyond the monthly count" description
 * rather than a purchase that banks forever. A plain constant, not a
 * config table: the actual price is whatever STRIPE_PRICE_VOICE_TOPUP
 * is configured to charge in Stripe (this file has no opinion on that),
 * so this only needs to state what the purchase grants, not what it
 * costs. Tune by editing this one number.
 */
export const VOICE_TOPUP_CREDITS = 5;
