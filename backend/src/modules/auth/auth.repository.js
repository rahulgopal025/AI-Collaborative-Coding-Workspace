/**
 * Auth repository.
 * Database operations for authentication.
 */

const { prisma } = require('../../config/database');

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
};



async function createUser(data) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: data.password,
    },
    select: SAFE_USER_SELECT,
  });
}




/** Returns user WITH password hash — for credential verification only. Supports case & whitespace normalization. */
async function findByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  // 1. Exact match with normalized lowercase email
  let user = await prisma.user.findUnique({
    where: { email: normalized },
  });
  if (user) return user;

  // 2. Exact match with raw trimmed email (if legacy record was stored in mixed/uppercase)
  if (trimmed !== normalized) {
    user = await prisma.user.findUnique({
      where: { email: trimmed },
    });
    if (user) return user;
  }

  // 3. Case-insensitive lookup (PostgreSQL mode: insensitive)
  if (typeof prisma.user.findFirst === 'function') {
    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: trimmed,
          mode: 'insensitive',
        },
      },
    });
  }

  return user;
}

/** Returns user WITHOUT password hash. */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: SAFE_USER_SELECT,
  });
}

/** Update user's password hash (e.g. after legacy hash upgrade or password reset). */
async function updatePassword(id, hashedPassword) {
  return prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
    select: SAFE_USER_SELECT,
  });
}

/** Update user's email (e.g. normalizing legacy mixed-case stored emails). */
async function updateEmail(id, email) {
  return prisma.user.update({
    where: { id },
    data: { email: email.trim().toLowerCase() },
    select: SAFE_USER_SELECT,
  });
}

module.exports = {
  SAFE_USER_SELECT,
  createUser,
  findByEmail,
  findById,
  updatePassword,
  updateEmail,
};




