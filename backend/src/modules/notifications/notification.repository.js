/**
 * Notification repository.
 * Database operations for notifications.
 */

const { prisma } = require('../../config/database');

async function create(data) {
  return prisma.notification.create({
    data: {
      type: data.type,
      message: data.message,
      userId: data.userId,
      projectId: data.projectId || null,
    },
  });
}

async function findByUserId(userId, { page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return { notifications, total };
}

async function markAsRead(notificationId, userId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

module.exports = { create, findByUserId, markAsRead };
