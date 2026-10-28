/**
 * Member repository.
 * Database operations for project membership.
 */

const { prisma } = require('../../config/database');

async function findByProjectId(projectId) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
}

async function findMembership(userId, projectId) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
  });
}

async function addMember(userId, projectId, role) {
  return prisma.projectMember.create({
    data: { userId, projectId, role },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}

async function updateRole(userId, projectId, role) {
  return prisma.projectMember.update({
    where: {
      userId_projectId: { userId, projectId },
    },
    data: { role },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}

async function removeMember(userId, projectId) {
  return prisma.projectMember.delete({
    where: {
      userId_projectId: { userId, projectId },
    },
  });
}

async function findMembershipById(id, projectId) {
  return prisma.projectMember.findFirst({
    where: {
      id,
      projectId,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });
}

/**
 * Count how many OWNERs a project has.
 */
async function countOwners(projectId) {
  return prisma.projectMember.count({
    where: { projectId, role: 'OWNER' },
  });
}

module.exports = {
  findByProjectId,
  findMembership,
  findMembershipById,
  addMember,
  updateRole,
  removeMember,
  countOwners,
};
