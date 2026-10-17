/**
 * Password hashing and comparison utilities.
 * Wraps bcryptjs for consistent password handling.
 */

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plain-text password.
 * @param {string} plainPassword - The plain-text password to hash
 * @returns {Promise<string>} The bcrypt hash
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 * @param {string} plainPassword - The plain-text password to check
 * @param {string} hashedPassword - The stored bcrypt hash
 * @returns {Promise<boolean>} True if the password matches
 */
async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = { hashPassword, comparePassword };
