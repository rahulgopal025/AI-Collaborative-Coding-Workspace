/**
 * Member validation schemas.
 */

const { z } = require('zod');
const { PROJECT_ROLES } = require('../../common/constants/projectRoles');

const addMemberSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase(),
  role: z
    .enum([PROJECT_ROLES.DEVELOPER, PROJECT_ROLES.VIEWER], {
      errorMap: () => ({ message: 'Role must be DEVELOPER or VIEWER' }),
    })
    .default(PROJECT_ROLES.DEVELOPER),
});

const updateMemberRoleSchema = z.object({
  role: z
    .enum([PROJECT_ROLES.OWNER, PROJECT_ROLES.DEVELOPER, PROJECT_ROLES.VIEWER], {
      errorMap: () => ({ message: 'Invalid role' }),
    }),
});

const memberParamsSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
});

module.exports = { addMemberSchema, updateMemberRoleSchema, memberParamsSchema };
