/**
 * Permission repository.
 * Fetches project membership for authorization checks.
 */

const { prisma } = require('../../config/database');

/**
 * Get a user's membership in a project.
 * @param {string} userId
 * @param {string} projectId
 * @returns {Promise<{ role: string } | null>}
 */
async function getMembership(userId, projectId) {
  return prisma.projectMember.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
    select: { role: true },
  });
}

module.exports = { getMembership };
