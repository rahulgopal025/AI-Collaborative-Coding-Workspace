/**
 * Activity repository.
 * Database operations for activity logging and retrieval.
 */

const { prisma } = require('../../config/database');

/**
 * Create an activity record.
 */
async function create(data) {
  return prisma.activity.create({
    data: {
      action: data.action,
      metadata: data.metadata || {},
      userId: data.userId,
      projectId: data.projectId,
    },
  });
}

/**
 * List activities for a project with pagination.
 */
async function findByProjectId(projectId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.activity.count({ where: { projectId } }),
  ]);

  return { activities, total };
}

module.exports = { create, findByProjectId };
