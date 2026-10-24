import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const algorithm = 'scrypt';
const keyLength = 64;
const saltLength = 16;
// N=2^14, r=8, p=5 is one of the OWASP Password Storage Cheat Sheet's equivalent
// minimum scrypt configurations (16 MiB of memory per hash). Parameters are stored
// with each hash, so hashes created with older parameters still verify.
const costParameters = { N: 16384, r: 8, p: 5 };

// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>
export async function hashPassword(password) {
  const salt = randomBytes(saltLength);
  const hash = await scryptAsync(password, salt, keyLength, costParameters);
  const { N, r, p } = costParameters;

  return [algorithm, N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, storedHash) {
  const parts = typeof storedHash === 'string' ? storedHash.split('$') : [];
  if (parts.length !== 6 || parts[0] !== algorithm) {
    return false;
  }

  const [, N, r, p, saltValue, hashValue] = parts;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = await scryptAsync(password, Buffer.from(saltValue, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
