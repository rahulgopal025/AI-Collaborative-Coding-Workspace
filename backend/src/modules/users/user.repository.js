/**
 * User repository.
 * Database operations for user profiles.
 */

const { prisma } = require('../../config/database');

// Fields to select (never returns password)
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
};

async function findById(id) {
  return prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });
}

async function updateUser(id, data) {
  return prisma.user.update({
    where: { id },
    data,
    select: USER_SELECT,
  });
}

module.exports = { findById, updateUser };
