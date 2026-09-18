/** Canonical email form, shared by the auth DTOs and the rate-limit keys. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
