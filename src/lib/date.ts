export const MIN_SIGNUP_AGE = 13;

export function isAtLeastAge(dateOfBirth: string, minAge: number) {
  const dob = new Date(dateOfBirth);
  const now = new Date();

  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() >= dob.getUTCDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  return age >= minAge;
}
