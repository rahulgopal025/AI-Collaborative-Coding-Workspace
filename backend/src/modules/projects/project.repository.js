/**
 * Project repository.
 * Database operations for projects.
 */

const { prisma } = require('../../config/database');

async function create(data) {
  return prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
    },
  });
}

/**
 * Create a project and its OWNER membership in a single transaction.
 */
async function createWithOwner(data, userId) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    await tx.projectMember.create({
      data: {
        userId,
        projectId: project.id,
        role: 'OWNER',
      },
    });

    return project;
  });
}

/**
 * Find all projects where the user is a member.
 */
async function findByUserId(userId) {
  return prisma.project.findMany({
    where: {
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      _count: {
        select: { files: true, folders: true, members: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

async function findById(id) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
      },
      _count: {
        select: { files: true, folders: true, members: true },
      },
    },
  });
}

async function update(id, data) {
  return prisma.project.update({
    where: { id },
    data,
  });
}

async function remove(id) {
  return prisma.project.delete({
    where: { id },
  });
}

module.exports = { create, createWithOwner, findByUserId, findById, update, remove };
