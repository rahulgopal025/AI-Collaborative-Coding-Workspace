/**
 * Member validation schemas.
 */

const { z } = require('zod');
const { PROJECT_ROLES } = require('../../common/constants/projectRoles');

const roleSchema = z
  .preprocess((val) => {
    if (typeof val !== 'string') return val;
    const normalized = val.trim().toUpperCase();
    if (normalized === 'EDITOR') return PROJECT_ROLES.DEVELOPER;
    return normalized;
  }, z.enum([PROJECT_ROLES.DEVELOPER, PROJECT_ROLES.VIEWER], {
    errorMap: () => ({ message: 'Role must be DEVELOPER or VIEWER' }),
  }))
  .default(PROJECT_ROLES.DEVELOPER);

const addMemberSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address')
      .trim()
      .toLowerCase()
      .optional(),
    userId: z
      .string()
      .uuid('Invalid user ID')
      .optional(),
    role: roleSchema,
  })
  .refine((data) => Boolean(data.email || data.userId), {
    message: 'Either email or userId must be provided',
  });

const updateMemberRoleSchema = z.object({
  role: z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    const normalized = val.trim().toUpperCase();
    if (normalized === 'EDITOR') return PROJECT_ROLES.DEVELOPER;
    return normalized;
  }, z.enum([PROJECT_ROLES.OWNER, PROJECT_ROLES.DEVELOPER, PROJECT_ROLES.VIEWER], {
    errorMap: () => ({ message: 'Invalid role' }),
  })),
});

const memberParamsSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
});

module.exports = { addMemberSchema, updateMemberRoleSchema, memberParamsSchema };
