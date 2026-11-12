import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// Game passwords: scrypt with a per-game random salt, stored as "scrypt:<salt>:<hash>" (base64).
// A password only gates joining a game; it is a shared secret between friends, not an account credential.

export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 64;
const KEY_LEN = 32;

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString('base64')}:${(await derive(password, salt)).toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? '').split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
