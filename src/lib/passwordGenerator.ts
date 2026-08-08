// Ambiguous glyphs (0/O, 1/l/I) are excluded: these passwords get read aloud or
// copied off a screen during handover, and a misread character looks to the
// recipient like a broken account rather than a typo.
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

export const GENERATED_PASSWORD_LENGTH = 16;

/**
 * Uniform random integer in [0, max) from the Web Crypto API, which both the
 * browser and Node 18+ expose — this module is imported from an admin modal
 * and from route handlers, so it cannot depend on node:crypto.
 *
 * Rejection sampling, not `% max`: the modulo of a uniform byte is biased
 * toward low values whenever max doesn't divide 256, which would quietly
 * skew the charset.
 */
function randomBelow(max: number): number {
  if (!Number.isInteger(max) || max < 1) {
    throw new RangeError(`randomBelow needs a positive integer, got ${max}`);
  }
  // Draw enough bytes to cover `max`. With a single byte, any max > 256 makes
  // `limit` collapse to 0 and the rejection loop spin forever, since a byte is
  // always >= 0. Shuffling a long password reaches max > 256 legitimately.
  const bytes = Math.ceil(Math.log2(max) / 8) || 1;
  const space = 2 ** (bytes * 8);
  const limit = Math.floor(space / max) * max;

  const buf = new Uint8Array(bytes);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    let v = 0;
    for (const b of buf) v = v * 256 + b;
    if (v < limit) return v % max;
  }
}

function pick(charset: string): string {
  return charset[randomBelow(charset.length)];
}

/**
 * A cryptographically random password for admin handover. Guarantees at least
 * one character from each class so it satisfies any downstream policy, then
 * shuffles so the guaranteed characters aren't pinned to the first four slots.
 */
export function generatePassword(
  length: number = GENERATED_PASSWORD_LENGTH
): string {
  if (length < 8) throw new Error("generated password must be at least 8 chars");

  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher-Yates with a CSPRNG; Math.random() would undo the entropy above.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomBelow(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
