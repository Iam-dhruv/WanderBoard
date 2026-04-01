// ─── Invite code utilities ────────────────────────────────────────────────────
// Codes are 6-character uppercase alphanumeric strings.
// Excludes visually ambiguous characters: 0, O, I, 1, L
// to prevent misreads when codes are shared verbally or on screen.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(): string {
  const arr = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(arr);  // Web Crypto — available in all modern browsers
  return Array.from(arr)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
}

export function isValidInviteCode(code: string): boolean {
  if (code.length !== INVITE_CODE_LENGTH) return false;
  return [...code].every((ch) => ALPHABET.includes(ch));
}

export function normalizeInviteCode(raw: string): string {
  // Strip whitespace and uppercase — be lenient about what users type
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
