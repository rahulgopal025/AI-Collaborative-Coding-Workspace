/**
 * Member business logic.
 * Manages project membership, role changes, and removal with safety checks.
 */

const memberRepository = require('./member.repository');
const activityService = require('../activities/activity.service');
const notificationService = require('../notifications/notification.service');
const { prisma } = require('../../config/database');
const AppError = require('../../common/errors/AppError');
const ERROR_CODES = require('../../common/errors/errorCodes');

async function getProjectMembers(projectId) {
  return memberRepository.findByProjectId(projectId);
}

async function addMember(projectId, data, addedByUserId) {
  // Find user by email or userId
  let userToAdd;
  if (data.email) {
    userToAdd = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true, name: true, email: true },
    });
    if (!userToAdd) {
      throw AppError.notFound('No user found with this email', ERROR_CODES.USER_NOT_FOUND);
    }
  } else if (data.userId) {
    userToAdd = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, name: true, email: true },
    });
    if (!userToAdd) {
      throw AppError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }
  } else {
    throw AppError.badRequest('Either email or userId must be provided');
  }

  // Check if already a member
  const existingMembership = await memberRepository.findMembership(userToAdd.id, projectId);
  if (existingMembership) {
    throw AppError.conflict(
      'User is already a member of this project',
      ERROR_CODES.MEMBER_ALREADY_EXISTS
    );
  }

  const member = await memberRepository.addMember(userToAdd.id, projectId, data.role);

  // Log activity
  await activityService.log({
    projectId,
    userId: addedByUserId,
    action: 'MEMBER_ADDED',
    metadata: { addedUser: userToAdd.name, role: data.role },
  });

  // Notify the added user
  await notificationService.notify({
    userId: userToAdd.id,
    projectId,
    type: 'MEMBER_ADDED',
    message: `You have been added to a project as ${data.role}.`,
  });

  return member;
}

async function updateMemberRole(projectId, targetUserId, newRole, updatedByUserId) {
  const membership = await memberRepository.findMembership(targetUserId, projectId);
  if (!membership) {
    throw AppError.notFound('Member not found', ERROR_CODES.MEMBER_NOT_FOUND);
  }

  // Prevent demoting the last OWNER
  if (membership.role === 'OWNER' && newRole !== 'OWNER') {
    const ownerCount = await memberRepository.countOwners(projectId);
    if (ownerCount <= 1) {
      throw AppError.badRequest(
        'Cannot change role of the last owner. Transfer ownership first.',
        ERROR_CODES.MEMBER_CANNOT_REMOVE_LAST_OWNER
      );
    }
  }

  const updated = await memberRepository.updateRole(targetUserId, projectId, newRole);

  await activityService.log({
    projectId,
    userId: updatedByUserId,
    action: 'MEMBER_ROLE_CHANGED',
    metadata: { targetUser: targetUserId, oldRole: membership.role, newRole },
  });

  return updated;
}

async function removeMember(projectId, targetUserId, removedByUserId) {
  const membership = await memberRepository.findMembership(targetUserId, projectId);
  if (!membership) {
    throw AppError.notFound('Member not found', ERROR_CODES.MEMBER_NOT_FOUND);
  }

  // Prevent removing the last OWNER
  if (membership.role === 'OWNER') {
    const ownerCount = await memberRepository.countOwners(projectId);
    if (ownerCount <= 1) {
      throw AppError.badRequest(
        'Cannot remove the last owner. Transfer ownership first.',
        ERROR_CODES.MEMBER_CANNOT_REMOVE_LAST_OWNER
      );
    }
  }

  await memberRepository.removeMember(targetUserId, projectId);

  await activityService.log({
    projectId,
    userId: removedByUserId,
    action: 'MEMBER_REMOVED',
    metadata: { removedUser: targetUserId },
  });

  // Notify the removed user
  await notificationService.notify({
    userId: targetUserId,
    projectId,
    type: 'MEMBER_REMOVED',
    message: 'You have been removed from a project.',
  });
}

module.exports = { getProjectMembers, addMember, updateMemberRole, removeMember };
