/**
 * Password hashing and comparison utilities.
 * Wraps bcryptjs for consistent password handling.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Safe constant-time string comparison to prevent timing attacks.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hash a plain-text password using standard bcrypt.
 * @param {string} plainPassword - The plain-text password to hash
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt or legacy hash.
 * @param {string} plainPassword - The plain-text password to check
 * @param {string} hashedPassword - The stored hash
 * @returns {Promise<boolean>} True if the password matches
 */
async function comparePassword(plainPassword, hashedPassword) {
  const result = await verifyPasswordAndCheckUpgrade(plainPassword, hashedPassword);
  return result.isValid;
}

/**
 * Verify password against stored hash, supporting both modern bcrypt and verified legacy formats.
 * Indicates whether the stored hash should be upgraded to modern bcrypt (12 rounds).
 *
 * Supported legacy formats:
 * - SHA-256 (64 hex characters)
 * - SHA-512 (128 hex characters)
 * - SHA-1 (40 hex characters)
 * - MD5 (32 hex characters)
 * - Plaintext fallback (early development or unhashed legacy records)
 * - Bcrypt with fewer rounds (< 12) or older salt formats ($2a$)
 * - Trimmed input matching if password has accidental whitespace
 *
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {Promise<{ isValid: boolean, needsUpgrade: boolean, reason?: string }>}
 */
async function verifyPasswordAndCheckUpgrade(plainPassword, storedHash) {
  if (!plainPassword || !storedHash || typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
    return { isValid: false, needsUpgrade: false };
  }

  // 1. Standard Bcrypt ($2a$, $2b$, $2y$, $2x$)
  if (/^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedHash)) {
    try {
      const match = await bcrypt.compare(plainPassword, storedHash);
      if (match) {
        const parts = storedHash.split('$');
        const rounds = parseInt(parts[2], 10);
        const needsUpgrade = rounds < SALT_ROUNDS || parts[1] !== '2b';
        return {
          isValid: true,
          needsUpgrade,
          reason: needsUpgrade ? `Bcrypt rounds=${rounds} or prefix=${parts[1]} upgraded to standard 12 rounds` : undefined,
        };
      }
    } catch {
      // Fall through to other checks if bcrypt parsing fails
    }
  }

  // 2. SHA-256 (64 hex chars)
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const computed = crypto.createHash('sha256').update(plainPassword).digest('hex');
    if (safeEqual(computed.toLowerCase(), storedHash.toLowerCase())) {
      return { isValid: true, needsUpgrade: true, reason: 'Legacy SHA-256 hash upgraded to bcrypt' };
    }
  }

  // 3. SHA-512 (128 hex chars)
  if (/^[a-f0-9]{128}$/i.test(storedHash)) {
    const computed = crypto.createHash('sha512').update(plainPassword).digest('hex');
    if (safeEqual(computed.toLowerCase(), storedHash.toLowerCase())) {
      return { isValid: true, needsUpgrade: true, reason: 'Legacy SHA-512 hash upgraded to bcrypt' };
    }
  }

  // 4. SHA-1 (40 hex chars)
  if (/^[a-f0-9]{40}$/i.test(storedHash)) {
    const computed = crypto.createHash('sha1').update(plainPassword).digest('hex');
    if (safeEqual(computed.toLowerCase(), storedHash.toLowerCase())) {
      return { isValid: true, needsUpgrade: true, reason: 'Legacy SHA-1 hash upgraded to bcrypt' };
    }
  }

  // 5. MD5 (32 hex chars)
  if (/^[a-f0-9]{32}$/i.test(storedHash)) {
    const computed = crypto.createHash('md5').update(plainPassword).digest('hex');
    if (safeEqual(computed.toLowerCase(), storedHash.toLowerCase())) {
      return { isValid: true, needsUpgrade: true, reason: 'Legacy MD5 hash upgraded to bcrypt' };
    }
  }

  // 6. Plaintext match fallback (e.g. unhashed seed/legacy records)
  if (safeEqual(plainPassword, storedHash)) {
    return { isValid: true, needsUpgrade: true, reason: 'Plaintext credentials upgraded to bcrypt' };
  }

  // 7. Whitespace-trimmed plain password fallback (if input has leading/trailing spaces)
  const trimmed = plainPassword.trim();
  if (trimmed !== plainPassword && trimmed.length > 0) {
    const retryResult = await verifyPasswordAndCheckUpgrade(trimmed, storedHash);
    if (retryResult.isValid) {
      return { isValid: true, needsUpgrade: true, reason: 'Password matched after whitespace normalization' };
    }
  }

  return { isValid: false, needsUpgrade: false };
}

module.exports = {
  SALT_ROUNDS,
  hashPassword,
  comparePassword,
  verifyPasswordAndCheckUpgrade,
};

