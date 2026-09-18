/** Matches the exact RAISE EXCEPTION text enforce_institution_seat_capacity() uses (migrations 0072/0073) — shared by every caller (enrollment actions, admin actions) that needs to tell "seats are actually full" apart from any other failure. */
export function isSeatCapacityError(message: string): boolean {
  return message.includes("No seats remaining") || message.includes("no active licence");
}
