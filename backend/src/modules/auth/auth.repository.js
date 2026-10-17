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

/** Returns user WITH password hash — for credential verification only. */
async function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

/** Returns user WITHOUT password hash. */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: SAFE_USER_SELECT,
  });
}

module.exports = { createUser, findByEmail, findById };
