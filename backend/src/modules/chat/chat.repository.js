/**
 * Chat repository.
 * Database operations for project messages.
 */

const { prisma } = require('../../config/database');

async function create(data) {
  return prisma.message.create({
    data: {
      content: data.content,
      userId: data.userId,
      projectId: data.projectId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });
}

async function findByProjectId(projectId, { page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.message.count({ where: { projectId } }),
  ]);

  // Return in chronological order (oldest to newest) for chat stream rendering
  return { messages: messages.reverse(), total };
}

async function findById(id) {
  return prisma.message.findUnique({
    where: { id },
  });
}

async function remove(id) {
  return prisma.message.delete({
    where: { id },
  });
}

module.exports = { create, findByProjectId, findById, remove };


